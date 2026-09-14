//! Fixed-rate scheduling around the deterministic echo-core simulation.
use crate::state::{time, App};
use echo_core::rules;
use std::time::Duration;

pub(super) async fn simulation(app: App) {
    let mut clock = tokio::time::interval(Duration::from_secs_f64(1.0 / rules().tick_rate as f64));
    clock.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    let mut tick = 0u64;
    loop {
        clock.tick().await;
        let now = time(&app);
        let mut engine = app.engine.lock().await;
        for room in engine.rooms.values_mut() {
            room.tick(now);
        }
        tick += 1;
        if tick.is_multiple_of(rules().tick_rate / rules().snapshot_rate) {
            for peer in engine.peers.values() {
                if let Some(s) = engine
                    .rooms
                    .get(&peer.room)
                    .and_then(|r| r.snapshot_for(&peer.player, now))
                {
                    if let Ok(text) = serde_json::to_string(&s) {
                        peer.snapshots.send_replace(Some(text));
                    }
                }
            }
        }
    }
}
