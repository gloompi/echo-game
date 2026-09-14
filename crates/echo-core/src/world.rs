//! Collision and navigation data, independent of rendered meshes.
use crate::Vec3;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::OnceLock};

#[derive(Debug, Clone, Deserialize)]
pub struct BoxCollider {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub w: f64,
    pub d: f64,
    pub h: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Mirror {
    pub id: String,
    pub target: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub yaw: f64,
    pub exit: Vec3,
}

fn classic_half() -> f64 {
    23.0
}

#[derive(Debug, Deserialize)]
pub struct Arena {
    pub boxes: Vec<BoxCollider>,
    pub spawns: Vec<Vec3>,
    pub waypoints: Vec<Vec3>,
    #[serde(default = "classic_half")]
    pub half: f64,
    #[serde(default)]
    pub mirrors: Vec<Mirror>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MapId {
    #[default]
    Afterhours,
    Switchyard,
    Glassworks,
    #[serde(rename = "mirror-yard")]
    MirrorYard,
    #[serde(rename = "neon-carnival")]
    NeonCarnival,
}

impl MapId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Afterhours => "afterhours",
            Self::Switchyard => "switchyard",
            Self::Glassworks => "glassworks",
            Self::MirrorYard => "mirror-yard",
            Self::NeonCarnival => "neon-carnival",
        }
    }
}

pub fn arena() -> &'static Arena {
    static VALUE: OnceLock<Arena> = OnceLock::new();
    VALUE.get_or_init(|| {
        serde_json::from_str(include_str!("../../../shared/arena.json"))
            .expect("checked-in arena.json")
    })
}

pub fn map(id: MapId) -> &'static Arena {
    static MAPS: OnceLock<HashMap<String, Arena>> = OnceLock::new();
    let maps = MAPS.get_or_init(|| {
        let mut maps: HashMap<String, Arena> =
            serde_json::from_str(include_str!("../../../shared/maps.json"))
                .expect("checked-in maps.json");
        let classic = maps.get_mut("afterhours").expect("classic map metadata");
        classic.boxes = arena().boxes.clone();
        classic.spawns = arena().spawns.clone();
        classic.waypoints = arena().waypoints.clone();
        maps
    });
    &maps[id.as_str()]
}
