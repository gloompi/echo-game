//! Shared server state; gameplay remains inside echo-core.
use echo_core::{room::Room, Settings};
use serde_json::Value;
use std::{collections::HashMap, sync::Arc, time::Instant};
use tokio::sync::{watch, Mutex, Semaphore};

#[derive(Clone)]
pub(super) struct App {
    pub(super) engine: Arc<Mutex<Engine>>,
    pub(super) origin: Instant,
    pub(super) allowed_origins: Arc<Vec<String>>,
    pub(super) access_key: Arc<String>,
    pub(super) control_token: Arc<String>,
    pub(super) public_url: Arc<Mutex<Option<String>>>,
    pub(super) permits: Arc<Semaphore>,
    pub(super) defaults: Settings,
    pub(super) stopping: watch::Sender<bool>,
    pub(super) transport: Arc<Value>,
    pub(super) public_transport: bool,
}
pub(super) struct Peer {
    pub(super) room: String,
    pub(super) player: String,
    pub(super) snapshots: watch::Sender<Option<String>>,
}
pub(super) struct Engine {
    pub(super) rooms: HashMap<String, Room>,
    pub(super) peers: HashMap<String, Peer>,
    pub(super) max_rooms: usize,
}
pub(super) fn time(app: &App) -> f64 {
    app.origin.elapsed().as_secs_f64() * 1000.0
}
