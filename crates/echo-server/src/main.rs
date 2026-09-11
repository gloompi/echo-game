use axum::{
    extract::{ws::{Message, WebSocket, WebSocketUpgrade}, ConnectInfo, DefaultBodyLimit, State},
    http::{header, HeaderMap, HeaderValue, StatusCode, Uri},
    response::{IntoResponse, Response}, routing::{get, post}, Json, Router,
};
use echo_core::{room::{Player, Room}, rules, Input, Phase, Preference, Settings};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{collections::HashMap, env, error::Error, net::SocketAddr, path::PathBuf, sync::Arc, time::{Duration, Instant}};
use tokio::sync::{mpsc, watch, Mutex, Semaphore};
use tower_http::{services::ServeDir, set_header::SetResponseHeaderLayer};
use uuid::Uuid;

#[derive(Clone)]
struct App {
    engine: Arc<Mutex<Engine>>, origin: Instant, allowed_origins: Arc<Vec<String>>,
    access_key: Arc<String>, control_token: Arc<String>, public_url: Arc<Mutex<Option<String>>>,
    permits: Arc<Semaphore>, defaults: Settings, stopping: watch::Sender<bool>,
}
struct Peer { room: String, player: String, snapshots: watch::Sender<Option<String>> }
struct Engine { rooms: HashMap<String,Room>, peers: HashMap<String,Peer>, max_rooms: usize }
#[derive(Deserialize)]
#[serde(tag="type",rename_all="camelCase",rename_all_fields="camelCase")]
enum ClientMessage {
    Join {mode:JoinMode,name:String,room:Option<String>,preference:Option<Preference>,access_key:Option<String>,settings:Option<Settings>},
    Input {input:Input}, Start, Lobby, Preference {value:Preference}, Bots {enabled:bool}, Settings {settings:Settings}, Ping {at:f64},
}
#[derive(Deserialize,PartialEq)]
#[serde(rename_all="lowercase")]
enum JoinMode {Create,Join,Quick,Practice}

fn time(app:&App)->f64 {app.origin.elapsed().as_secs_f64()*1000.0}
fn equal_key(a:&str,b:&str)->bool {
    // Length is not secret. Avoid early exits for differing bytes.
    a.len()==b.len()&&a.as_bytes().iter().zip(b.as_bytes()).fold(0u8,|n,(a,b)|n|(a^b))==0
}
fn origin_allowed(headers:&HeaderMap,allowed:&[String])->bool {
    let Some(origin)=headers.get(header::ORIGIN) else{return true;}; // Native test/game clients have no Origin.
    let Ok(origin)=origin.to_str() else{return false;};
    if allowed.iter().any(|v|v==origin){return true;}
    let Ok(uri)=origin.parse::<Uri>() else{return false;};
    matches!(uri.scheme_str(),Some("http"|"https"))&&uri.authority().map(|v|v.as_str())==headers.get(header::HOST).and_then(|h|h.to_str().ok())
}
async fn health(State(app):State<App>)->Json<Value>{
    let e=app.engine.lock().await;
    Json(json!({"ok":true,"server":"rust","protocolVersion":2,"rooms":e.rooms.len(),"players":e.peers.len(),"tickRate":rules().tick_rate,"snapshotRate":rules().snapshot_rate}))
}
async fn config(State(app):State<App>)->Json<Value>{Json(json!({"publicUrl":app.public_url.lock().await.clone(),"requiresKey":!app.access_key.is_empty()}))}
#[derive(Deserialize)]
struct PublicUrl {url:String}
async fn public_url(State(app):State<App>,ConnectInfo(peer):ConnectInfo<SocketAddr>,headers:HeaderMap,Json(body):Json<PublicUrl>)->StatusCode{
    let token=headers.get("x-echo-control").and_then(|h|h.to_str().ok()).unwrap_or("");
    if !peer.ip().is_loopback()||app.control_token.is_empty()||!equal_key(token,&app.control_token){return StatusCode::FORBIDDEN;}
    let Ok(uri)=body.url.parse::<Uri>() else{return StatusCode::BAD_REQUEST;};
    if uri.scheme_str()!=Some("https")||uri.authority().is_none()||uri.authority().is_some_and(|a|a.as_str().contains('@'))||uri.query().is_some()||!matches!(uri.path(),""|"/"){return StatusCode::BAD_REQUEST;}
    *app.public_url.lock().await=Some(body.url.trim_end_matches('/').to_owned());StatusCode::NO_CONTENT
}
async fn upgrade(State(app):State<App>,headers:HeaderMap,ws:WebSocketUpgrade)->Response{
    if !origin_allowed(&headers,&app.allowed_origins){return StatusCode::FORBIDDEN.into_response();}
    let Ok(permit)=app.permits.clone().try_acquire_owned() else{return StatusCode::SERVICE_UNAVAILABLE.into_response();};
    ws.max_message_size(2048).max_frame_size(2048).on_upgrade(move|socket|async move{let _permit=permit;session(socket,app).await})
}
async fn send_control(tx:&mpsc::Sender<String>,value:Value)->bool {tx.try_send(value.to_string()).is_ok()}
fn error(message:&str,fatal:bool)->Value {json!({"type":"error","message":message,"fatal":fatal})}
fn room_code(rooms:&HashMap<String,Room>)->String{
    const CHARS:&[u8]=b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    loop{let id=Uuid::new_v4();let code:String=id.as_bytes()[..6].iter().map(|b|CHARS[*b as usize%CHARS.len()] as char).collect();if !rooms.contains_key(&code){return code;}}
}
async fn handle(app:&App,id:&str,message:ClientMessage,tx:&mpsc::Sender<String>,snapshots:&watch::Sender<Option<String>>)->bool{
    let now=time(app);
    if let ClientMessage::Ping{at}=message {return at.is_finite()&&send_control(tx,json!({"type":"pong","at":at,"now":now})).await;}
    let mut engine=app.engine.lock().await;
    if let ClientMessage::Join{mode,name,room,preference,access_key,settings}=message{
        if engine.peers.contains_key(id){return false;}
        if !app.access_key.is_empty()&&!equal_key(access_key.as_deref().unwrap_or(""),&app.access_key){
            return send_control(tx,error("This playtest requires the complete invitation link (including #key=…).",true)).await;
        }
        let name:String=name.trim().chars().filter(|c|!c.is_control()).take(18).collect();
        let name=if name.is_empty(){"Runner".to_owned()}else{name};
        let existing=if mode==JoinMode::Join{
            let code=room.unwrap_or_default().trim().to_ascii_uppercase();
            if !engine.rooms.get(&code).is_some_and(|r|!r.practice){return send_control(tx,error("Room not found. Check the code and server address.",true)).await;}
            Some(code)
        }else if mode==JoinMode::Quick{
            engine.rooms.values().find(|r|r.public&&r.players.len()<rules().max_players&&r.phase!=Phase::Finished).map(|r|r.code.clone())
        }else{None};
        let code=if let Some(code)=existing{code}else{
            if engine.rooms.len()>=engine.max_rooms{return send_control(tx,error("The server has reached its room limit.",true)).await;}
            let settings=settings.unwrap_or(app.defaults);
            if let Err(reason)=settings.validate(){return send_control(tx,error(reason,true)).await;}
            let code=room_code(&engine.rooms);engine.rooms.insert(code.clone(),Room::new(code.clone(),mode==JoinMode::Quick,mode==JoinMode::Practice,settings));code
        };
        let room=engine.rooms.get_mut(&code).expect("selected room");
        if !room.add(Player::new(id.to_owned(),name,false,preference.unwrap_or_default(),now)){
            return send_control(tx,error("This room is full (12 players).",true)).await;
        }
        if mode==JoinMode::Practice||mode==JoinMode::Quick{room.start(now);}
        let snapshot=room.snapshot_for(id,now).and_then(|s|serde_json::to_string(&s).ok());
        engine.peers.insert(id.to_owned(),Peer{room:code.clone(),player:id.to_owned(),snapshots:snapshots.clone()});
        drop(engine);
        let success=send_control(tx,json!({"type":"welcome","id":id,"room":code,"protocolVersion":2,"publicUrl":app.public_url.lock().await.clone()})).await;
        snapshots.send_replace(snapshot);return success;
    }
    let Some(peer)=engine.peers.get(id) else{return false;};let code=peer.room.clone();
    let Some(room)=engine.rooms.get_mut(&code) else{return false;};
    let result=match message{
        ClientMessage::Input{input}=>{if !input.validate(){return false;}if let Some(p)=room.player_mut(id){p.set_input(input,now);}Ok(())},
        ClientMessage::Start=>if room.host!=id{Err("Only the host can start the round.")}else if !room.start(now){Err("Return to the lobby, invite a friend or enable bots before starting.")}else{Ok(())},
        ClientMessage::Lobby=>room.lobby(id),
        ClientMessage::Settings{settings}=>room.configure(id,settings),
        ClientMessage::Preference{value}=>if room.phase==Phase::Lobby{if let Some(p)=room.player_mut(id){p.preference=value;}Ok(())}else{Err("Change your role preference in the lobby.")},
        ClientMessage::Bots{enabled}=>if room.host==id&&room.phase==Phase::Lobby{room.bots_enabled=enabled;Ok(())}else{Err("Only the host can change bots in the lobby.")},
        _=>return false,
    };
    if let Err(reason)=result{return send_control(tx,error(reason,false)).await;}
    true
}
async fn session(socket:WebSocket,app:App){
    let mut stopping=app.stopping.subscribe(); if *stopping.borrow(){return;}
    let id=Uuid::new_v4().to_string();let (mut sink,mut stream)=socket.split();
    let (tx,mut rx)=mpsc::channel::<String>(32);
    let (snapshots,mut latest)=watch::channel::<Option<String>>(None);
    let writer=async move{
        let mut heartbeat=tokio::time::interval(Duration::from_secs(10));
        loop{
            let message=tokio::select!{
                biased;
                item=rx.recv()=>match item{Some(text)=>Message::Text(text.into()),None=>break},
                changed=latest.changed()=>{if changed.is_err(){break;}let text=latest.borrow_and_update().clone();let Some(text)=text else{continue;};Message::Text(text.into())},
                _=heartbeat.tick()=>Message::Ping(Vec::new().into()),
            };
            // A slow reader cannot stall simulation or accumulate old snapshots.
            if !matches!(tokio::time::timeout(Duration::from_secs(2),sink.send(message)).await,Ok(Ok(()))){break;}
        }
    };
    let reader=async{
        let mut window=Instant::now();let mut count=0;let began=Instant::now();
        loop{
            let joined=app.engine.lock().await.peers.contains_key(&id);
            let deadline=if joined{Duration::from_secs(35)}else{Duration::from_secs(10).saturating_sub(began.elapsed())};
            let Ok(Some(Ok(message)))=tokio::time::timeout(deadline,stream.next()).await else{break;};
            match message{
                Message::Text(text)=>{
                    if window.elapsed()>=Duration::from_secs(1){window=Instant::now();count=0;}
                    count+=1;if count>180{break;}
                    let Ok(message)=serde_json::from_str::<ClientMessage>(&text) else{break;};
                    if !handle(&app,&id,message,&tx,&snapshots).await{break;}
                },
                Message::Close(_)|Message::Binary(_)=>break,
                _=>{},
            }
            if began.elapsed()>Duration::from_secs(10)&&!app.engine.lock().await.peers.contains_key(&id){break;}
        }
    };
    tokio::select!{_=writer=>{},_=reader=>{},_=stopping.changed()=>{}}
    let mut engine=app.engine.lock().await;
    if let Some(peer)=engine.peers.remove(&id){
        let empty=if let Some(room)=engine.rooms.get_mut(&peer.room){room.remove(&peer.player);room.human_count()==0}else{false};
        if empty{engine.rooms.remove(&peer.room);}
    }
}
async fn simulation(app:App){
    let mut clock=tokio::time::interval(Duration::from_secs_f64(1.0/rules().tick_rate as f64));
    clock.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);let mut tick=0u64;
    loop{clock.tick().await;let now=time(&app);let mut engine=app.engine.lock().await;
        for room in engine.rooms.values_mut(){room.tick(now);}tick+=1;
        if tick%(rules().tick_rate/rules().snapshot_rate)==0{
            for peer in engine.peers.values(){
                if let Some(s)=engine.rooms.get(&peer.room).and_then(|r|r.snapshot_for(&peer.player,now)){
                    if let Ok(text)=serde_json::to_string(&s){peer.snapshots.send_replace(Some(text));}
                }
            }
        }
    }
}
fn number(name:&str,default:u64,min:u64,max:u64)->Result<u64,Box<dyn Error>>{
    let value=env::var(name).map(|s|s.parse::<u64>()).unwrap_or(Ok(default))?;
    if !(min..=max).contains(&value){return Err(format!("{name} must be {min}–{max}").into());}Ok(value)
}
async fn shutdown(){
    #[cfg(unix)]
    {let mut terminate=tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("SIGTERM handler");tokio::select!{_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}}
    #[cfg(not(unix))]
    {let _=tokio::signal::ctrl_c().await;}
}
#[tokio::main]
async fn main()->Result<(),Box<dyn Error>>{
    dotenvy::dotenv().ok();
    let host=env::var("HOST").unwrap_or_else(|_|"127.0.0.1".into());let port=number("PORT",3000,1,65535)?;
    let defaults=Settings{delay_ms:number("ECHO_DELAY_MS",rules().delay_ms,0,rules().max_delay_ms)?,round_ms:number("ECHO_ROUND_MS",rules().round_ms,30_000,600_000)?,seeker_count:number("ECHO_SEEKERS",2,1,3)? as usize,
        reload_ms:number("ECHO_RELOAD_MS",rules().reload_ms,0,10000)?,
        dash_cooldown_ms:number("ECHO_DASH_COOLDOWN_MS",3200,0,30000)?,
        mirror_cooldown_ms:number("ECHO_MIRROR_COOLDOWN_MS",60000,0,180000)?,..Settings::default()};
    let max_rooms=number("MAX_ROOMS",32,1,256)? as usize;
    let (stopping, _)=watch::channel(false);
    let app=App{engine:Arc::new(Mutex::new(Engine{rooms:HashMap::new(),peers:HashMap::new(),max_rooms})),origin:Instant::now(),
        allowed_origins:Arc::new(env::var("ALLOWED_ORIGINS").unwrap_or_default().split(',').map(str::trim).filter(|s|!s.is_empty()).map(str::to_owned).collect()),
        access_key:Arc::new(env::var("ECHO_ACCESS_KEY").unwrap_or_default()),control_token:Arc::new(env::var("ECHO_CONTROL_TOKEN").unwrap_or_default()),
        public_url:Arc::new(Mutex::new(env::var("ECHO_PUBLIC_URL").ok().filter(|s|!s.is_empty()))),permits:Arc::new(Semaphore::new(192)),defaults,stopping:stopping.clone()};
    let assets=PathBuf::from(env::var("ECHO_CLIENT_DIR").unwrap_or_else(|_|"dist/client".into()));
    if !assets.join("index.html").is_file(){eprintln!("Client build missing; run npm run build:client. The socket and /health are still available for development.");}
    let router=Router::new().route("/health",get(health)).route("/api/config",get(config)).route("/api/public-url",post(public_url))
        .route("/socket",get(upgrade)).fallback_service(ServeDir::new(assets))
        .layer(DefaultBodyLimit::max(2048))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS,HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY,HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CONTENT_SECURITY_POLICY,HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-ancestors 'none'")))
        .with_state(app.clone());
    let listener=tokio::net::TcpListener::bind(format!("{host}:{port}")).await?;
    println!("ECHO Rust server: http://{host}:{port} · {} Hz simulation / {} Hz snapshots · default delay {} ms",rules().tick_rate,rules().snapshot_rate,defaults.delay_ms);
    let task=tokio::spawn(simulation(app));
    let result=axum::serve(listener,router.into_make_service_with_connect_info::<SocketAddr>()).with_graceful_shutdown(async move {shutdown().await; stopping.send_replace(true);}).await;
    task.abort();result?;Ok(())
}
#[cfg(test)]
mod tests{
    use super::*;
    #[test]fn key_comparison(){assert!(equal_key("abc","abc"));assert!(!equal_key("abc","abd"));assert!(!equal_key("","x"));}
    #[test]fn rejects_cross_origin(){let mut h=HeaderMap::new();h.insert(header::HOST,HeaderValue::from_static("localhost:3000"));h.insert(header::ORIGIN,HeaderValue::from_static("https://attacker.invalid"));assert!(!origin_allowed(&h,&[]));h.insert(header::ORIGIN,HeaderValue::from_static("http://localhost:3000"));assert!(origin_allowed(&h,&[]));}
    #[test]fn protocol_rejects_nan_and_authoritative_position(){assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"input","input":{"seq":1,"x":99}}"#).is_err());assert!(serde_json::from_str::<ClientMessage>(r#"{"type":"input","input":{"yaw":NaN}}"#).is_err());}
}
