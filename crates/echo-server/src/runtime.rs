//! The composition root owns startup and shutdown of the real server.
use crate::{
    config::Config,
    http,
    sessions::serve_webtransport,
    simulation::simulation,
    state::{App, Engine},
};
use serde_json::json;
use std::{
    collections::HashMap,
    error::Error,
    net::SocketAddr,
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::{watch, Mutex, Semaphore};
use wtransport::{Endpoint, Identity, ServerConfig};

pub(super) async fn run() -> Result<(), Box<dyn Error>> {
    dotenvy::dotenv().ok();
    let config = Config::load()?;
    let generated = config.transport.tls_files.is_none();
    let identity = match &config.transport.tls_files {
        Some((cert, key)) => Identity::load_pemfiles(cert, key).await?,
        None => Identity::self_signed(["localhost", "127.0.0.1", "::1"])?,
    };
    let hashes: Vec<Vec<u8>> = if generated {
        vec![identity.certificate_chain().as_slice()[0]
            .hash()
            .as_ref()
            .to_vec()]
    } else {
        vec![]
    };
    let mut quic = wtransport::config::QuicTransportConfig::default();
    quic.max_concurrent_bidi_streams(8u32.into())
        .max_concurrent_uni_streams(8u32.into())
        .receive_window(1_048_576u32.into())
        .stream_receive_window(262_144u32.into())
        .send_window(1_048_576);
    let server_config = ServerConfig::builder()
        .with_bind_address(config.transport.bind)
        .with_custom_transport(identity, quic)
        .max_idle_timeout(Some(Duration::from_secs(35)))?
        .keep_alive_interval(Some(Duration::from_secs(5)))
        .build();
    let endpoint = Endpoint::server(server_config)?;

    let (stopping, _) = watch::channel(false);
    let app = App {
        engine: Arc::new(Mutex::new(Engine {
            rooms: HashMap::new(),
            peers: HashMap::new(),
            max_rooms: config.max_rooms,
        })),
        origin: Instant::now(),
        allowed_origins: Arc::new(config.allowed_origins),
        access_key: Arc::new(config.access_key),
        control_token: Arc::new(config.control_token),
        public_url: Arc::new(Mutex::new(config.public_url)),
        permits: Arc::new(Semaphore::new(192)),
        defaults: config.defaults,
        stopping: stopping.clone(),
        transport: Arc::new(json!({
            "url": config.transport.url, "certificateHashes": hashes, "protocolVersion": 3,
            "loopbackUrl": if generated { Some(format!("https://127.0.0.1:{}/echo",config.transport.port)) } else { None }
        })),
        public_transport: config.transport.public,
    };
    if !config.assets.join("index.html").is_file() {
        eprintln!("Client build missing; run pnpm build:client. /health and /api/config remain available.");
    }
    let router = http::router(app.clone(), config.assets);
    let listener =
        tokio::net::TcpListener::bind(format!("{}:{}", config.host, config.port)).await?;
    println!(
        "ECHO: http://{}:{} Â· WebTransport UDP {} Â· protocol 3",
        config.host, config.port, config.transport.bind
    );
    if generated {
        println!("Pinned playtest certificate generated (maximum 14-day lifetime); restart and refresh clients to rotate.");
    }
    let simulation_task = tokio::spawn(simulation(app.clone()));
    let network_task = tokio::spawn(serve_webtransport(endpoint, app));
    let result = axum::serve(
        listener,
        router.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(async move {
        shutdown().await;
        stopping.send_replace(true);
    })
    .await;
    // Observe cancellation so ownership ends before returning from the runtime.
    simulation_task.abort();
    network_task.abort();
    let _ = simulation_task.await;
    let _ = network_task.await;
    result?;
    Ok(())
}

async fn shutdown() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("SIGTERM handler");
        tokio::select! {_=tokio::signal::ctrl_c()=>{},_=terminate.recv()=>{}}
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}
