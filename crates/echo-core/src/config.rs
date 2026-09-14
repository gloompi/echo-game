//! Checked-in simulation constants. Runtime clocks and environment belong to the server.
use serde::Deserialize;
use std::sync::OnceLock;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rules {
    pub tick_rate: u64,
    pub snapshot_rate: u64,
    pub delay_ms: u64,
    pub max_delay_ms: u64,
    pub history_ms: u64,
    pub round_ms: u64,
    pub headstart_ms: u64,
    pub results_ms: u64,
    pub max_players: usize,
    pub radius: f64,
    pub height: f64,
    pub eye: f64,
    pub arena_half: f64,
    pub hider_speed: f64,
    pub seeker_speed: f64,
    pub sprint_multiplier: f64,
    pub gravity: f64,
    pub jump_speed: f64,
    pub dash_speed: f64,
    pub dash_duration: f64,
    pub dash_cooldown: f64,
    pub magazine: u32,
    pub fire_interval: u64,
    pub reload_ms: u64,
    pub hit_points: u32,
    pub shot_range: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Movement {
    pub crouch_height: f64,
    pub crouch_eye: f64,
    pub crouch_multiplier: f64,
    pub ground_friction: f64,
    pub ground_acceleration: f64,
    pub air_acceleration: f64,
    pub bhop_speed_cap: f64,
    pub jump_buffer_seconds: f64,
    pub mirror_radius: f64,
}

pub fn movement() -> &'static Movement {
    static VALUE: OnceLock<Movement> = OnceLock::new();
    VALUE.get_or_init(|| {
        serde_json::from_str(include_str!("../../../shared/movement.json"))
            .expect("checked-in movement.json")
    })
}

pub fn rules() -> &'static Rules {
    static VALUE: OnceLock<Rules> = OnceLock::new();
    VALUE.get_or_init(|| {
        serde_json::from_str(include_str!("../../../shared/rules.json"))
            .expect("checked-in rules.json")
    })
}
