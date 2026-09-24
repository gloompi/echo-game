//! Simulation values and wire-facing state; no I/O or framework dependencies.
use crate::balance::{Skin, Weapon};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    #[default]
    Hider,
    Seeker,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Preference {
    Hider,
    Seeker,
    #[default]
    Auto,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    #[default]
    Lobby,
    Headstart,
    Playing,
    Finished,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BunnyHop {
    Off,
    #[default]
    Timed,
    Auto,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub seq: u64,
    pub mx: f64,
    pub mz: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub sprint: bool,
    pub jump: bool,
    pub dash: bool,
    pub shoot: bool,
    pub reload: bool,
    pub wave: bool,
    pub crouch: bool,
    pub interact: bool,
    pub ability: bool,
    pub mine: bool,
    pub scan: bool,
    pub weapon: Option<Weapon>,
}

impl Input {
    pub fn validate(&self) -> bool {
        self.seq <= 9007199254740991
            && self.mx.is_finite()
            && self.mz.is_finite()
            && self.mx.abs() <= 1.0
            && self.mz.abs() <= 1.0
            && self.yaw.is_finite()
            && self.yaw.abs() <= 1000000.0
            && self.pitch.is_finite()
            && self.pitch.abs() <= 1.3
    }

    pub fn neutral(seq: u64, yaw: f64, pitch: f64) -> Self {
        Self {
            seq,
            yaw,
            pitch,
            ..Self::default()
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Motor {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub vx: f64,
    pub vy: f64,
    pub vz: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub grounded: bool,
    pub stamina: f64,
    pub dash_time: f64,
    pub dash_cooldown: f64,
    pub jump_held: bool,
    pub dash_held: bool,
    #[serde(default)]
    pub crouched: bool,
    #[serde(default)]
    pub jump_buffer: f64,
    #[serde(default)]
    pub warp: u64,
    #[serde(default)]
    pub slide_time: f64,
    #[serde(default)]
    pub slide_cooldown: f64,
    #[serde(default)]
    pub crouch_held: bool,
    #[serde(default)]
    pub control_left: f64,
    #[serde(default)]
    pub pull_left: f64,
    #[serde(default)]
    pub pull_x: f64,
    #[serde(default)]
    pub pull_z: f64,
    #[serde(default)]
    pub pull_speed: f64,
}

impl Motor {
    pub fn new(position: Vec3) -> Self {
        Self {
            x: position.x,
            y: position.y,
            z: position.z,
            vx: 0.0,
            vy: 0.0,
            vz: 0.0,
            yaw: 0.0,
            pitch: 0.0,
            grounded: true,
            stamina: 100.0,
            dash_time: 0.0,
            dash_cooldown: 0.0,
            jump_held: false,
            dash_held: false,
            crouched: false,
            jump_buffer: 0.0,
            warp: 0,
            slide_time: 0.0,
            slide_cooldown: 0.0,
            crouch_held: false,
            control_left: 0.0,
            pull_left: 0.0,
            pull_x: 0.0,
            pull_z: 0.0,
            pull_speed: 0.0,
        }
    }

    pub fn position(&self) -> Vec3 {
        Vec3 {
            x: self.x,
            y: self.y,
            z: self.z,
        }
    }

    pub fn controlled(&self) -> bool {
        self.control_left > 0.0 || self.pull_left > 0.0
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pose {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub role: Role,
    pub alive: bool,
    pub moving: f64,
    pub grounded: bool,
    pub waving: bool,
    pub dashing: bool,
    #[serde(default)]
    pub crouched: bool,
    #[serde(default)]
    pub warp: u64,
    #[serde(default)]
    pub sliding: bool,
    #[serde(default)]
    pub shielded: bool,
    #[serde(default)]
    pub controlled: bool,
    #[serde(default)]
    pub hit_at: f64,
    #[serde(default)]
    pub skin: Skin,
    #[serde(default)]
    pub weapon: Weapon,
}

impl Pose {
    pub fn position(&self) -> Vec3 {
        Vec3 {
            x: self.x,
            y: self.y,
            z: self.z,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub id: u64,
    pub at: f64,
    pub kind: &'static str,
    pub actor: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<Vec3>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub to: Option<Vec3>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hit: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub echo: Option<bool>,
}
