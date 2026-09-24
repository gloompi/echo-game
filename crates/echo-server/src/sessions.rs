//! Bounded WebTransport connections, stream I/O, cancellation and peer cleanup.
use crate::{
    commands::handle, framing, protocol::ClientMessage, security::origin_allowed, state::App,
};
use std::time::{Duration, Instant};
use tokio::{
    sync::{mpsc, watch},
    task::JoinSet,
    time::timeout,
};
use uuid::Uuid;
use wtransport::{Connection, Endpoint, VarInt};

async fn write_snapshot(connection: Connection, text: String) {
    let Ok(Some(mut stream)) = timeout(Duration::from_millis(500), async {
        connection.open_uni().await.ok()?.await.ok()
    })
    .await
    else {
        return;
    };
    // A deadline resets a stale stream; no old snapshot queue accumulates.
    let sent = timeout(
        Duration::from_millis(500),
        framing::write_frame(&mut stream, &text, framing::MAX_SNAPSHOT),
    )
    .await;
    if !matches!(sent, Ok(Ok(()))) {
        let _ = stream.reset(VarInt::from_u32(1));
        return;
    }
    if !matches!(
        timeout(Duration::from_secs(1), stream.finish()).await,
        Ok(Ok(()))
    ) {
        let _ = stream.reset(VarInt::from_u32(1));
    }
}
async fn snapshots_writer(connection: Connection, mut latest: watch::Receiver<Option<String>>) {
    let mut writes = JoinSet::new();
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
    writes.abort_all();
    while writes.join_next().await.is_some() {}
}
async fn session(connection: Connection, app: App) {
    let mut stopping = app.stopping.subscribe();
    if *stopping.borrow() {
        return;
    }
    let Ok(Ok((mut send, mut recv))) =
        timeout(Duration::from_secs(10), connection.accept_bi()).await
    else {
        connection.close(VarInt::from_u32(1), b"control stream timeout");
        return;
    };
    let id = Uuid::new_v4().to_string();
    let (tx, mut rx) = mpsc::channel::<String>(32);
    let (snapshots, latest) = watch::channel::<Option<String>>(None);
    let writer = async {
        while let Some(text) = rx.recv().await {
            if !matches!(
                timeout(
                    Duration::from_secs(2),
                    framing::write_frame(&mut send, &text, framing::MAX_CONTROL)
                )
                .await,
                Ok(Ok(()))
            ) {
                break;
            }
        }
    };
    let reader = async {
        let began = Instant::now();
        let mut window = Instant::now();
        let mut count = 0u32;
        loop {
            let joined = app.engine.lock().await.peers.contains_key(&id);
            let deadline = if joined {
                Duration::from_secs(35)
            } else {
                Duration::from_secs(10).saturating_sub(began.elapsed())
            };
            let Ok(Ok(text)) = timeout(deadline, framing::read_frame(&mut recv)).await else {
                break;
            };
            if window.elapsed() >= Duration::from_secs(1) {
                window = Instant::now();
                count = 0;
            }
            count += 1;
            if count > 180 {
                break;
            }
            let Ok(message) = serde_json::from_str::<ClientMessage>(&text) else {
                break;
            };
            if !handle(&app, &id, message, &tx, &snapshots).await {
                break;
            }
        }
    };
    let snapshot_task = tokio::spawn(snapshots_writer(connection.clone(), latest));
    tokio::select! {
        _=writer=>{},_=reader=>{},_=stopping.changed()=>{},_=connection.closed()=>{},
        // Protocol v3 has exactly one client-originated application stream.
        _=connection.accept_bi()=>{},_=connection.accept_uni()=>{}
    }
    snapshot_task.abort();
    let _ = snapshot_task.await;
    connection.close(VarInt::from_u32(0), b"session ended");
    let mut engine = app.engine.lock().await;
    if let Some(peer) = engine.peers.remove(&id) {
        let empty = if let Some(room) = engine.rooms.get_mut(&peer.room) {
            room.remove(&peer.player);
            room.human_count() == 0
        } else {
            false
        };
        if empty {
            engine.rooms.remove(&peer.room);
        }
    }
}
pub(super) async fn serve_webtransport(
    endpoint: Endpoint<wtransport::endpoint::endpoint_side::Server>,
    app: App,
) {
    let mut stopping = app.stopping.subscribe();
    let mut sessions = JoinSet::new();
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
    endpoint.close(VarInt::from_u32(0), b"server stopping");
    sessions.abort_all();
    while sessions.join_next().await.is_some() {}
}
