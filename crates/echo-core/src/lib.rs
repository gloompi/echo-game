//! Engine-independent rules and simulation. No renderer, network, or wall clock.
pub mod history;
pub mod physics;
pub mod room;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::OnceLock};

#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
pub struct Vec3 { pub x: f64, pub y: f64, pub z: f64 }
#[derive(Debug, Clone, Deserialize)]
pub struct BoxCollider { pub x: f64, pub y: f64, pub z: f64, pub w: f64, pub d: f64, pub h: f64 }
#[derive(Debug, Clone, Deserialize)]
pub struct Mirror { pub id: String, pub target: String, pub x: f64, pub y: f64, pub z: f64, pub yaw: f64, pub exit: Vec3 }
fn classic_half() -> f64 { 23.0 }
#[derive(Debug, Deserialize)]
pub struct Arena {
    pub boxes: Vec<BoxCollider>, pub spawns: Vec<Vec3>, pub waypoints: Vec<Vec3>,
    #[serde(default="classic_half")] pub half: f64,
    #[serde(default)] pub mirrors: Vec<Mirror>,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Rules {
    pub tick_rate: u64, pub snapshot_rate: u64, pub delay_ms: u64, pub max_delay_ms: u64,
    pub history_ms: u64, pub round_ms: u64, pub headstart_ms: u64, pub results_ms: u64,
    pub max_players: usize, pub radius: f64, pub height: f64, pub eye: f64, pub arena_half: f64,
    pub hider_speed: f64, pub seeker_speed: f64, pub sprint_multiplier: f64,
    pub gravity: f64, pub jump_speed: f64, pub dash_speed: f64, pub dash_duration: f64, pub dash_cooldown: f64,
    pub magazine: u32, pub fire_interval: u64, pub reload_ms: u64, pub hit_points: u32, pub shot_range: f64,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Movement {
    pub crouch_height: f64, pub crouch_eye: f64, pub crouch_multiplier: f64,
    pub ground_friction: f64, pub ground_acceleration: f64, pub air_acceleration: f64,
    pub bhop_speed_cap: f64, pub jump_buffer_seconds: f64, pub mirror_radius: f64,
}
pub fn movement() -> &'static Movement {
    static VALUE: OnceLock<Movement> = OnceLock::new();
    VALUE.get_or_init(|| serde_json::from_str(include_str!("../../../shared/movement.json")).expect("checked-in movement.json"))
}
pub fn rules() -> &'static Rules {
    static VALUE: OnceLock<Rules> = OnceLock::new();
    VALUE.get_or_init(|| serde_json::from_str(include_str!("../../../shared/rules.json")).expect("checked-in rules.json"))
}
pub fn arena() -> &'static Arena {
    static VALUE: OnceLock<Arena> = OnceLock::new();
    VALUE.get_or_init(|| serde_json::from_str(include_str!("../../../shared/arena.json")).expect("checked-in arena.json"))
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="lowercase")]
pub enum MapId { #[default] Afterhours, Switchyard, Glassworks }
impl MapId { pub fn as_str(self) -> &'static str { match self { Self::Afterhours=>"afterhours", Self::Switchyard=>"switchyard", Self::Glassworks=>"glassworks" } } }
pub fn map(id: MapId) -> &'static Arena {
    static MAPS: OnceLock<HashMap<String,Arena>> = OnceLock::new();
    let maps=MAPS.get_or_init(|| {
        let mut maps:HashMap<String,Arena>=serde_json::from_str(include_str!("../../../shared/maps.json")).expect("checked-in maps.json");
        let classic=maps.get_mut("afterhours").expect("classic map metadata");
        classic.boxes=arena().boxes.clone(); classic.spawns=arena().spawns.clone(); classic.waypoints=arena().waypoints.clone();
        maps
    });
    &maps[id.as_str()]
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="lowercase")]
pub enum Role { #[default] Hider, Seeker }
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="lowercase")]
pub enum Preference { Hider, Seeker, #[default] Auto }
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="lowercase")]
pub enum Phase { #[default] Lobby, Headstart, Playing, Finished }
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all="lowercase")]
pub enum BunnyHop { Off, #[default] Timed, Auto }
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default,rename_all="camelCase",deny_unknown_fields)]
pub struct Settings {
    pub delay_ms: u64, pub round_ms: u64, pub seeker_count: usize,
    pub map_id: MapId, pub reload_ms: u64, pub dash_cooldown_ms: u64,
    pub mirror_cooldown_ms: u64, pub bunny_hop: BunnyHop,
}
impl Default for Settings {
    fn default() -> Self { Self { delay_ms:rules().delay_ms, round_ms:rules().round_ms, seeker_count:2,
        map_id:MapId::Afterhours,reload_ms:rules().reload_ms,dash_cooldown_ms:3200,mirror_cooldown_ms:60000,bunny_hop:BunnyHop::Timed } }
}
impl Settings {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.delay_ms>rules().max_delay_ms {return Err("Delay must be between 0 and 10 seconds.");}
        if !(30000..=600000).contains(&self.round_ms) {return Err("Rounds must last 30–600 seconds.");}
        if !(1..=3).contains(&self.seeker_count) {return Err("Choose 1–3 Seekers.");}
        if self.reload_ms>10000 {return Err("Reload duration must be 0–10 seconds.");}
        if self.dash_cooldown_ms>30000 {return Err("Dash cooldown must be 0–30 seconds.");}
        if self.mirror_cooldown_ms>180000 {return Err("Mirror cooldown must be 0–180 seconds.");}
        Ok(())
    }
}
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default,rename_all="camelCase",deny_unknown_fields)]
pub struct Input {
    pub seq:u64,pub mx:f64,pub mz:f64,pub yaw:f64,pub pitch:f64,
    pub sprint:bool,pub jump:bool,pub dash:bool,pub shoot:bool,pub reload:bool,pub wave:bool,
    pub crouch:bool,pub interact:bool,
}
impl Input {
    pub fn validate(&self) -> bool {
        self.seq<=9007199254740991&&self.mx.is_finite()&&self.mz.is_finite()&&self.mx.abs()<=1.0&&self.mz.abs()<=1.0
            &&self.yaw.is_finite()&&self.yaw.abs()<=1000000.0&&self.pitch.is_finite()&&self.pitch.abs()<=1.3
    }
    pub fn neutral(seq:u64,yaw:f64,pitch:f64)->Self {Self{seq,yaw,pitch,..Self::default()}}
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all="camelCase")]
pub struct Motor {
    pub x:f64,pub y:f64,pub z:f64,pub vx:f64,pub vy:f64,pub vz:f64,pub yaw:f64,pub pitch:f64,
    pub grounded:bool,pub stamina:f64,pub dash_time:f64,pub dash_cooldown:f64,pub jump_held:bool,pub dash_held:bool,
    #[serde(default)] pub crouched:bool, #[serde(default)] pub jump_buffer:f64, #[serde(default)] pub warp:u64,
}
impl Motor {
    pub fn new(p:Vec3)->Self {Self{x:p.x,y:p.y,z:p.z,vx:0.0,vy:0.0,vz:0.0,yaw:0.0,pitch:0.0,grounded:true,stamina:100.0,
        dash_time:0.0,dash_cooldown:0.0,jump_held:false,dash_held:false,crouched:false,jump_buffer:0.0,warp:0}}
    pub fn position(&self)->Vec3 {Vec3{x:self.x,y:self.y,z:self.z}}
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all="camelCase")]
pub struct Pose {
    pub id:String,pub x:f64,pub y:f64,pub z:f64,pub yaw:f64,pub pitch:f64,pub role:Role,pub alive:bool,
    pub moving:f64,pub grounded:bool,pub waving:bool,pub dashing:bool,
    #[serde(default)] pub crouched:bool, #[serde(default)] pub warp:u64,
}
impl Pose {pub fn position(&self)->Vec3{Vec3{x:self.x,y:self.y,z:self.z}}}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all="camelCase")]
pub struct Event {
    pub id:u64,pub at:f64,pub kind:&'static str,pub actor:String,
    #[serde(skip_serializing_if="Option::is_none")] pub target:Option<String>,
    #[serde(skip_serializing_if="Option::is_none")] pub from:Option<Vec3>,
    #[serde(skip_serializing_if="Option::is_none")] pub to:Option<Vec3>,
    #[serde(skip_serializing_if="Option::is_none")] pub hit:Option<bool>,
    #[serde(skip_serializing_if="Option::is_none")] pub echo:Option<bool>,
}
