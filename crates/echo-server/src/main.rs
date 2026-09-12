mod framing;
use axum::{extract::{ConnectInfo, DefaultBodyLimit, State}, http::{header, HeaderMap, HeaderValue, StatusCode, Uri}, routing::{get, post}, Json, Router};
use echo_core::{balance::Skin, room::{Player, Room}, rules, Input, Phase, Preference, Settings};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashMap, env, error::Error, net::SocketAddr, path::PathBuf, sync::Arc, time::{Duration, Instant}};
use tokio::{sync::{mpsc, watch, Mutex, Semaphore}, task::JoinSet, time::timeout};
use tower_http::{services::ServeDir, set_header::SetResponseHeaderLayer};
use uuid::Uuid;
use wtransport::{Connection, Endpoint, Identity, ServerConfig, VarInt};

#[derive(Clone)]
struct App {
    engine: Arc<Mutex<Engine>>, origin: Instant, allowed_origins: Arc<Vec<String>>,
    access_key: Arc<String>, control_token: Arc<String>, public_url: Arc<Mutex<Option<String>>>,
    permits: Arc<Semaphore>, defaults: Settings, stopping: watch::Sender<bool>, transport: Arc<Value>,
    public_transport: bool,
}
struct Peer { room: String, player: String, snapshots: watch::Sender<Option<String>> }
struct Engine { rooms: HashMap<String, Room>, peers: HashMap<String, Peer>, max_rooms: usize }
#[derive(Deserialize)]
#[serde(tag="type",rename_all="camelCase",rename_all_fields="camelCase",deny_unknown_fields)]
enum ClientMessage {
    Join {mode:JoinMode,name:String,room:Option<String>,preference:Option<Preference>,access_key:Option<String>,settings:Option<Settings>,skin:Option<Skin>},
    Input {input:Input}, Start, Lobby, Preference {value:Preference}, Bots {enabled:bool}, Settings {settings:Settings}, Ping {at:f64}, Skin {value:Skin},
}
#[derive(Deserialize,PartialEq)]
#[serde(rename_all="lowercase")]
enum JoinMode {Create,Join,Quick,Practice}
fn time(app: &App) -> f64 { app.origin.elapsed().as_secs_f64()*1000.0 }
fn equal_key(a: &str,b: &str) -> bool { a.len()==b.len()&&a.as_bytes().iter().zip(b.as_bytes()).fold(0u8,|n,(a,b)|n|(a^b))==0 }
fn valid_https(url: &str, path: &str) -> bool {
    let Ok(uri)=url.parse::<Uri>() else {return false;};
    uri.scheme_str()==Some("https")&&uri.authority().is_some_and(|a|!a.as_str().contains('@'))
        &&uri.query().is_none()&&uri.path()==path&&!url.contains('#')
}
async fn health(State(app): State<App>) -> Json<Value> {
    let e=app.engine.lock().await;
    Json(json!({"ok":true,"server":"rust","transport":"webtransport","protocolVersion":3,"rooms":e.rooms.len(),"players":e.peers.len(),"tickRate":rules().tick_rate,"snapshotRate":rules().snapshot_rate}))
}
async fn config(State(app): State<App>) -> Json<Value> {
    Json(json!({"publicUrl":app.public_url.lock().await.clone(),"requiresKey":!app.access_key.is_empty(),"transport":*app.transport}))
}
#[derive(Deserialize)]
struct PublicUrl {url:String}
async fn public_url(State(app): State<App>,ConnectInfo(peer): ConnectInfo<SocketAddr>,headers: HeaderMap,Json(body): Json<PublicUrl>) -> StatusCode {
    let token=headers.get("x-echo-control").and_then(|h|h.to_str().ok()).unwrap_or("");
    if !peer.ip().is_loopback()||app.control_token.is_empty()||!equal_key(token,&app.control_token){return StatusCode::FORBIDDEN;}
    // A frontend-only tunnel must not be advertised as a working WebTransport game.
    if !app.public_transport||!valid_https(&(body.url.trim_end_matches('/').to_owned()+"/"),"/"){return StatusCode::BAD_REQUEST;}
    *app.public_url.lock().await=Some(body.url.trim_end_matches('/').to_owned());StatusCode::NO_CONTENT
}
async fn origin_allowed(app: &App, origin: Option<&str>) -> bool {
    let Some(origin)=origin else {return false;};
    app.allowed_origins.iter().any(|v|v==origin)||app.public_url.lock().await.as_deref()==Some(origin)
}
async fn send_control(tx: &mpsc::Sender<String>,value: Value) -> bool {tx.try_send(value.to_string()).is_ok()}
fn error(message: &str,fatal: bool) -> Value {json!({"type":"error","message":message,"fatal":fatal})}
fn room_code(rooms: &HashMap<String,Room>) -> String {
    const CHARS:&[u8]=b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    loop {let id=Uuid::new_v4();let code:String=id.as_bytes()[..6].iter().map(|b|CHARS[*b as usize%CHARS.len()] as char).collect();if !rooms.contains_key(&code){return code;}}
}
async fn handle(app: &App,id: &str,message: ClientMessage,tx: &mpsc::Sender<String>,snapshots: &watch::Sender<Option<String>>) -> bool {
    let now=time(app);
    if let ClientMessage::Ping{at}=message {return at.is_finite()&&send_control(tx,json!({"type":"pong","at":at,"now":now})).await;}
    let mut engine=app.engine.lock().await;
    if let ClientMessage::Join{mode,name,room,preference,access_key,settings,skin}=message {
        if engine.peers.contains_key(id){return false;}
        if !app.access_key.is_empty()&&!equal_key(access_key.as_deref().unwrap_or(""),&app.access_key){
            return send_control(tx,error("This playtest requires the complete invitation link (including #key=…).",true)).await;
        }
        let name:String=name.trim().chars().filter(|c|!c.is_control()).take(18).collect();
        let name=if name.is_empty(){"Runner".to_owned()}else{name};
        let existing=if mode==JoinMode::Join {
            let code=room.unwrap_or_default().trim().to_ascii_uppercase();
            if !engine.rooms.get(&code).is_some_and(|r|!r.practice){return send_control(tx,error("Room not found. Check the code and server address.",true)).await;}
            Some(code)
        }else if mode==JoinMode::Quick {
            engine.rooms.values().find(|r|r.public&&r.players.len()<rules().max_players&&r.phase!=Phase::Finished).map(|r|r.code.clone())
        }else{None};
        let code=if let Some(code)=existing {code} else {
            if engine.rooms.len()>=engine.max_rooms{return send_control(tx,error("The server has reached its room limit.",true)).await;}
            let settings=settings.unwrap_or(app.defaults);
            if let Err(reason)=settings.validate(){return send_control(tx,error(reason,true)).await;}
            let code=room_code(&engine.rooms);engine.rooms.insert(code.clone(),Room::new(code.clone(),mode==JoinMode::Quick,mode==JoinMode::Practice,settings));code
        };
        let room=engine.rooms.get_mut(&code).expect("selected room");
        let mut player=Player::new(id.to_owned(),name,false,preference.unwrap_or_default(),now);player.skin=skin.unwrap_or_default();
        if !room.add(player){return send_control(tx,error("This room is full (12 players).",true)).await;}
        if mode==JoinMode::Practice||mode==JoinMode::Quick{room.start(now);}
        let snapshot=room.snapshot_for(id,now).and_then(|s|serde_json::to_string(&s).ok());
        engine.peers.insert(id.to_owned(),Peer{room:code.clone(),player:id.to_owned(),snapshots:snapshots.clone()});drop(engine);
        let success=send_control(tx,json!({"type":"welcome","id":id,"room":code,"protocolVersion":3,"publicUrl":app.public_url.lock().await.clone()})).await;
        snapshots.send_replace(snapshot);return success;
    }
    let Some(peer)=engine.peers.get(id) else{return false;};let code=peer.room.clone();
    let Some(room)=engine.rooms.get_mut(&code) else{return false;};
    let result=match message {
        ClientMessage::Input{input}=>{if !input.validate(){return false;}if let Some(p)=room.player_mut(id){p.set_input(input,now);}Ok(())},
        ClientMessage::Start=>if room.host!=id{Err("Only the host can start the round.")}else if !room.start(now){Err("Return to the lobby, invite a friend or enable bots before starting.")}else{Ok(())},
        ClientMessage::Lobby=>room.lobby(id),ClientMessage::Settings{settings}=>room.configure(id,settings),ClientMessage::Skin{value}=>room.set_skin(id,value),
        ClientMessage::Preference{value}=>if room.phase==Phase::Lobby{if let Some(p)=room.player_mut(id){p.preference=value;}Ok(())}else{Err("Change your role preference in the lobby.")},
        ClientMessage::Bots{enabled}=>if room.host==id&&room.phase==Phase::Lobby{room.bots_enabled=enabled;Ok(())}else{Err("Only the host can change bots in the lobby.")},
        _=>return false,
    };
    if let Err(reason)=result{return send_control(tx,error(reason,false)).await;}true
}
async fn write_snapshot(connection: Connection,text: String) {
    let Ok(Some(mut stream))=timeout(Duration::from_millis(500),async {connection.open_uni().await.ok()?.await.ok()}).await else{return;};
    // A deadline resets a stale stream; no old snapshot queue accumulates.
    let sent=timeout(Duration::from_millis(500),framing::write_frame(&mut stream,&text,framing::MAX_SNAPSHOT)).await;
    if !matches!(sent,Ok(Ok(()))) {let _=stream.reset(VarInt::from_u32(1));return;}
    if !matches!(timeout(Duration::from_secs(1),stream.finish()).await,Ok(Ok(()))){let _=stream.reset(VarInt::from_u32(1));}
}
async fn snapshots_writer(connection: Connection,mut latest: watch::Receiver<Option<String>>) {
    let mut writes=JoinSet::new();
    loop {
        tokio::select! {
            biased;
            _=writes.join_next(),if !writes.is_empty()=>{},
            changed=latest.changed(),if writes.len()<4=>{
                if changed.is_err(){break;}
                let text=latest.borrow_and_update().clone();
                if let Some(text)=text {writes.spawn(write_snapshot(connection.clone(),text));}
            }
        }
    }
    writes.abort_all();while writes.join_next().await.is_some(){}
}
async fn session(connection: Connection,app: App) {
    let mut stopping=app.stopping.subscribe();if *stopping.borrow(){return;}
    let Ok(Ok((mut send,mut recv)))=timeout(Duration::from_secs(10),connection.accept_bi()).await else{connection.close(VarInt::from_u32(1),b"control stream timeout");return;};
    let id=Uuid::new_v4().to_string();let (tx,mut rx)=mpsc::channel::<String>(32);
    let (snapshots,latest)=watch::channel::<Option<String>>(None);
    let writer=async {
        while let Some(text)=rx.recv().await {
            if !matches!(timeout(Duration::from_secs(2),framing::write_frame(&mut send,&text,framing::MAX_CONTROL)).await,Ok(Ok(()))){break;}
        }
    };
    let reader=async {
        let began=Instant::now();let mut window=Instant::now();let mut count=0u32;
        loop {
            let joined=app.engine.lock().await.peers.contains_key(&id);
            let deadline=if joined{Duration::from_secs(35)}else{Duration::from_secs(10).saturating_sub(began.elapsed())};
            let Ok(Ok(text))=timeout(deadline,framing::read_frame(&mut recv)).await else{break;};
            if window.elapsed()>=Duration::from_secs(1){window=Instant::now();count=0;}
            count+=1;if count>180{break;}
            let Ok(message)=serde_json::from_str::<ClientMessage>(&text) else{break;};
            if !handle(&app,&id,message,&tx,&snapshots).await{break;}
        }
    };
    let snapshot_task=tokio::spawn(snapshots_writer(connection.clone(),latest));
    tokio::select! {
        _=writer=>{},_=reader=>{},_=stopping.changed()=>{},_=connection.closed()=>{},
        // Protocol v3 has exactly one client-originated application stream.
        _=connection.accept_bi()=>{},_=connection.accept_uni()=>{}
    }
    snapshot_task.abort();let _=snapshot_task.await;
    connection.close(VarInt::from_u32(0),b"session ended");
    let mut engine=app.engine.lock().await;
    if let Some(peer)=engine.peers.remove(&id) {
        let empty=if let Some(room)=engine.rooms.get_mut(&peer.room){room.remove(&peer.player);room.human_count()==0}else{false};
        if empty{engine.rooms.remove(&peer.room);}
    }
}
async fn serve_webtransport(endpoint: Endpoint<wtransport::endpoint::endpoint_side::Server>,app: App) {
    let mut stopping=app.stopping.subscribe();let mut sessions=JoinSet::new();
    loop {
        tokio::select! {
            biased;
            _=stopping.changed()=>break,
            _=sessions.join_next(),if !sessions.is_empty()=>{},
            incoming=endpoint.accept()=>{
                // Includes handshakes in the cap; a slow handshake cannot spawn unlimited tasks.
                let Ok(permit)=app.permits.clone().try_acquire_owned() else{drop(incoming);continue;};
                let app=app.clone();sessions.spawn(async move {
                    let _permit=permit;
                    let Ok(Ok(request))=timeout(Duration::from_secs(10),incoming).await else{return;};
                    if request.path()!="/echo" {request.not_found().await;return;}
                    if !origin_allowed(&app,request.origin()).await {request.forbidden().await;return;}
                    let Ok(Ok(connection))=timeout(Duration::from_secs(10),request.accept()).await else{return;};
                    session(connection,app).await;
                });
            }
        }
    }
    endpoint.close(VarInt::from_u32(0),b"server stopping");sessions.abort_all();while sessions.join_next().await.is_some(){}
}
async fn simulation(app: App) {
    let mut clock=tokio::time::interval(Duration::from_secs_f64(1.0/rules().tick_rate as f64));
    clock.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);let mut tick=0u64;
    loop {clock.tick().await;let now=time(&app);let mut engine=app.engine.lock().await;
        for room in engine.rooms.values_mut(){room.tick(now);}tick+=1;
        if tick%(rules().tick_rate/rules().snapshot_rate)==0 {
            for peer in engine.peers.values() {
                if let Some(s)=engine.rooms.get(&peer.room).and_then(|r|r.snapshot_for(&peer.player,now)) {
                    if let Ok(text)=serde_json::to_string(&s){peer.snapshots.send_replace(Some(text));}
                }
            }
        }
    }
}
fn number(name: &str,default: u64,min: u64,max: u64) -> Result<u64,Box<dyn Error>> {
    let value=env::var(name).map(|s|s.parse::<u64>()).unwrap_or(Ok(default))?;
    if !(min..=max).contains(&value){return Err(format!("{name} must be {min}–{max}").into());}Ok(value)
}
async fn shutdown() {
    #[cfg(unix)] {let mut terminate=tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("SIGTERM handler");tokio::select!{_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}}
    #[cfg(not(unix))] {let _=tokio::signal::ctrl_c().await;}
}
#[tokio::main]
async fn main() -> Result<(),Box<dyn Error>> {
    dotenvy::dotenv().ok();
    let host=env::var("HOST").unwrap_or_else(|_|"127.0.0.1".into());let port=number("PORT",3000,1,65535)?;
    let wt_port=number("ECHO_WT_PORT",4433,1,65535)?;
    let wt_host=env::var("ECHO_WT_HOST").unwrap_or_else(|_|"127.0.0.1".into());
    let bind:SocketAddr=format!("{wt_host}:{wt_port}").parse()?;
    let public_transport=env::var("ECHO_WT_PUBLIC_URL").ok().filter(|s|!s.is_empty());
    let wt_url=public_transport.clone().unwrap_or_else(||format!("https://127.0.0.1:{wt_port}/echo"));
    if !valid_https(&wt_url,"/echo"){return Err("ECHO_WT_PUBLIC_URL must be an HTTPS URL ending /echo without query or fragment".into());}
    let tls_cert=env::var("ECHO_TLS_CERT").ok();let tls_key=env::var("ECHO_TLS_KEY").ok();
    let generated=tls_cert.is_none()&&tls_key.is_none();
    let identity=match(tls_cert,tls_key) {
        (Some(cert),Some(key))=>Identity::load_pemfiles(cert,key).await?,
        (None,None)=>Identity::self_signed(["localhost","127.0.0.1","::1"] )?,
        _=>return Err("Set both ECHO_TLS_CERT and ECHO_TLS_KEY, or neither for a short-lived pinned playtest certificate".into()),
    };
    let hashes:Vec<Vec<u8>>=if generated {vec![identity.certificate_chain().as_slice()[0].hash().as_ref().to_vec()]}else{vec![]};
    let mut quic=wtransport::config::QuicTransportConfig::default();
    quic.max_concurrent_bidi_streams(8u32.into()).max_concurrent_uni_streams(8u32.into())
        .receive_window(1_048_576u32.into()).stream_receive_window(262_144u32.into()).send_window(1_048_576);
    let server_config=ServerConfig::builder().with_bind_address(bind).with_custom_transport(identity,quic)
        .max_idle_timeout(Some(Duration::from_secs(35)))?.keep_alive_interval(Some(Duration::from_secs(5))).build();
    let endpoint=Endpoint::server(server_config)?;
    let mut defaults=Settings{delay_ms:number("ECHO_DELAY_MS",rules().delay_ms,0,rules().max_delay_ms)?,round_ms:number("ECHO_ROUND_MS",rules().round_ms,30_000,600_000)?,seeker_count:number("ECHO_SEEKERS",2,1,3)? as usize,
        reload_ms:number("ECHO_RELOAD_MS",rules().reload_ms,0,10000)?,dash_cooldown_ms:number("ECHO_DASH_COOLDOWN_MS",3200,0,30000)?,
        mirror_cooldown_ms:number("ECHO_MIRROR_COOLDOWN_MS",60000,0,180000)?,..Settings::default()};
    if let Ok(path)=env::var("ECHO_BALANCE_FILE"){defaults.balance=serde_json::from_str(&std::fs::read_to_string(path)?)?;}
    defaults.validate().map_err(|e|std::io::Error::new(std::io::ErrorKind::InvalidInput,e))?;
    let mut allowed:Vec<String>=env::var("ALLOWED_ORIGINS").unwrap_or_default().split(',').map(str::trim).filter(|s|!s.is_empty()).map(str::to_owned).collect();
    for local in [format!("http://localhost:{port}"),format!("http://127.0.0.1:{port}"),"http://localhost:5173".into(),"http://127.0.0.1:5173".into()] {allowed.push(local);}
    let public=env::var("ECHO_PUBLIC_URL").ok().filter(|s|!s.is_empty());
    if let Some(url)=&public {if public_transport.is_none()||!valid_https(&(url.trim_end_matches('/').to_owned()+"/"),"/"){return Err("Public hosting requires a valid HTTPS frontend and ECHO_WT_PUBLIC_URL for reachable UDP".into());}}
    let (stopping,_)=watch::channel(false);
    let app=App{engine:Arc::new(Mutex::new(Engine{rooms:HashMap::new(),peers:HashMap::new(),max_rooms:number("MAX_ROOMS",32,1,256)? as usize})),origin:Instant::now(),
        allowed_origins:Arc::new(allowed),access_key:Arc::new(env::var("ECHO_ACCESS_KEY").unwrap_or_default()),control_token:Arc::new(env::var("ECHO_CONTROL_TOKEN").unwrap_or_default()),
        public_url:Arc::new(Mutex::new(public.map(|s|s.trim_end_matches('/').to_owned()))),permits:Arc::new(Semaphore::new(192)),defaults,stopping:stopping.clone(),
        transport:Arc::new(json!({"url":wt_url,"certificateHashes":hashes,"protocolVersion":3,"loopbackUrl":if generated{Some(format!("https://127.0.0.1:{wt_port}/echo"))}else{None}})),public_transport:public_transport.is_some()};
    let assets=PathBuf::from(env::var("ECHO_CLIENT_DIR").unwrap_or_else(|_|"dist/client".into()));
    if !assets.join("index.html").is_file(){eprintln!("Client build missing; run npm run build:client. /health and /api/config remain available.");}
    let router=Router::new().route("/health",get(health)).route("/api/config",get(config)).route("/api/public-url",post(public_url))
        .fallback_service(ServeDir::new(assets)).layer(DefaultBodyLimit::max(16_384))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS,HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY,HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL,HeaderValue::from_static("no-store")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CONTENT_SECURITY_POLICY,HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self'; object-src 'none'; frame-ancestors 'none'"))).with_state(app.clone());
    let listener=tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;
    println!("ECHO: http://{host}:{port} · WebTransport UDP {bind} · protocol 3");
    if generated{println!("Pinned playtest certificate generated (maximum 14-day lifetime); restart and refresh clients to rotate.");}
    let simulation_task=tokio::spawn(simulation(app.clone()));let network_task=tokio::spawn(serve_webtransport(endpoint,app));
    let result=axum::serve(listener,router.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async move{shutdown().await;stopping.send_replace(true);}).await;
    simulation_task.abort();network_task.abort();result?;Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]fn key_comparison(){assert!(equal_key("abc","abc"));assert!(!equal_key("abc","abd"));assert!(!equal_key("","x"));}
    #[test]fn reject_unsafe_transport_urls(){assert!(valid_https("https://localhost:4433/echo","/echo"));for u in ["http://localhost/echo","https://user@host/echo","https://host/echo?key=secret","https://host/echo#x"]{assert!(!valid_https(u,"/echo"));}}
    #[test]fn protocol_rejects_authoritative_positions(){assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"input","input":{"seq":1,"x":99}}"#).is_err());}
}
