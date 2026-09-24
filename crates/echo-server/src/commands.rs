//! Application commands and room orchestration, separate from stream I/O.
use crate::{
    protocol::{ClientMessage, JoinMode},
    security::equal_key,
    state::{time, App, Peer},
};
use echo_core::{
    room::{Player, Room},
    rules, Phase,
};
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::{mpsc, watch};
use uuid::Uuid;

fn send_control(tx: &mpsc::Sender<String>, value: Value) -> bool {
    tx.try_send(value.to_string()).is_ok()
}
fn error(message: &str, fatal: bool) -> Value {
    json!({"type":"error","message":message,"fatal":fatal})
}
fn room_code(rooms: &HashMap<String, Room>) -> String {
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    loop {
        let id = Uuid::new_v4();
        let code: String = id.as_bytes()[..6]
            .iter()
            .map(|b| CHARS[*b as usize % CHARS.len()] as char)
            .collect();
        if !rooms.contains_key(&code) {
            return code;
        }
    }
}
pub(super) async fn handle(
    app: &App,
    id: &str,
    message: ClientMessage,
    tx: &mpsc::Sender<String>,
    snapshots: &watch::Sender<Option<String>>,
) -> bool {
    let now = time(app);
    if let ClientMessage::Ping { at } = message {
        return at.is_finite() && send_control(tx, json!({"type":"pong","at":at,"now":now}));
    }
    let mut engine = app.engine.lock().await;
    if let ClientMessage::Join {
        mode,
        name,
        room,
        preference,
        access_key,
        settings,
        skin,
    } = message
    {
        if engine.peers.contains_key(id) {
            return false;
        }
        if !app.access_key.is_empty()
            && !equal_key(access_key.as_deref().unwrap_or(""), &app.access_key)
        {
            return send_control(
                tx,
                error(
                    "This playtest requires the complete invitation link (including #key=…).",
                    true,
                ),
            );
        }
        let name: String = name
            .trim()
            .chars()
            .filter(|c| !c.is_control())
            .take(18)
            .collect();
        let name = if name.is_empty() {
            "Runner".to_owned()
        } else {
            name
        };
        let existing = if mode == JoinMode::Join {
            let code = room.unwrap_or_default().trim().to_ascii_uppercase();
            if !engine.rooms.get(&code).is_some_and(|r| !r.practice) {
                return send_control(
                    tx,
                    error("Room not found. Check the code and server address.", true),
                );
            }
            Some(code)
        } else if mode == JoinMode::Quick {
            engine
                .rooms
                .values()
                .find(|r| {
                    r.public && r.players.len() < rules().max_players && r.phase != Phase::Finished
                })
                .map(|r| r.code.clone())
        } else {
            None
        };
        let code = if let Some(code) = existing {
            code
        } else {
            if engine.rooms.len() >= engine.max_rooms {
                return send_control(tx, error("The server has reached its room limit.", true));
            }
            let settings = settings.unwrap_or(app.defaults);
            if let Err(reason) = settings.validate() {
                return send_control(tx, error(reason, true));
            }
            let code = room_code(&engine.rooms);
            engine.rooms.insert(
                code.clone(),
                Room::new(
                    code.clone(),
                    mode == JoinMode::Quick,
                    mode == JoinMode::Practice,
                    settings,
                ),
            );
            code
        };
        let room = engine.rooms.get_mut(&code).expect("selected room");
        let mut player = Player::new(
            id.to_owned(),
            name,
            false,
            preference.unwrap_or_default(),
            now,
        );
        player.skin = skin.unwrap_or_default();
        if !room.add(player) {
            return send_control(tx, error("This room is full (12 players).", true));
        }
        if mode == JoinMode::Practice || mode == JoinMode::Quick {
            room.start(now);
        }
        let snapshot = room
            .snapshot_for(id, now)
            .and_then(|s| serde_json::to_string(&s).ok());
        engine.peers.insert(
            id.to_owned(),
            Peer {
                room: code.clone(),
                player: id.to_owned(),
                snapshots: snapshots.clone(),
            },
        );
        drop(engine);
        let success = send_control(
            tx,
            json!({"type":"welcome","id":id,"room":code,"protocolVersion":3,"publicUrl":app.public_url.lock().await.clone()}),
        );
        snapshots.send_replace(snapshot);
        return success;
    }
    let Some(peer) = engine.peers.get(id) else {
        return false;
    };
    let code = peer.room.clone();
    let Some(room) = engine.rooms.get_mut(&code) else {
        return false;
    };
    let result = match message {
        ClientMessage::Input { input } => {
            if !input.validate() {
                return false;
            }
            if let Some(p) = room.player_mut(id) {
                p.set_input(input, now);
            }
            Ok(())
        }
        ClientMessage::Start {} => {
            if room.host != id {
                Err("Only the host can start the round.")
            } else if !room.start(now) {
                Err("Return to the lobby, invite a friend or enable bots before starting.")
            } else {
                Ok(())
            }
        }
        ClientMessage::Lobby {} => room.lobby(id),
        ClientMessage::Settings { settings } => room.configure(id, settings),
        ClientMessage::Skin { value } => room.set_skin(id, value),
        ClientMessage::Preference { value } => {
            if room.phase == Phase::Lobby {
                if let Some(p) = room.player_mut(id) {
                    p.preference = value;
                }
                Ok(())
            } else {
                Err("Change your role preference in the lobby.")
            }
        }
        ClientMessage::Bots { enabled } => {
            if room.host == id && room.phase == Phase::Lobby {
                room.bots_enabled = enabled;
                Ok(())
            } else {
                Err("Only the host can change bots in the lobby.")
            }
        }
        _ => return false,
    };
    if let Err(reason) = result {
        return send_control(tx, error(reason, false));
    }
    true
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn control_queue_is_bounded_and_never_waits_under_the_engine_lock() {
        let (tx, _rx) = mpsc::channel(1);
        assert!(send_control(&tx, error("first", false)));
        assert!(!send_control(&tx, error("full", false)));
    }
}
