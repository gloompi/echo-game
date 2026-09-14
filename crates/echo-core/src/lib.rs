//! Engine-independent rules and simulation. No renderer, network, or wall clock.
#![forbid(unsafe_code)]

pub mod balance;
pub mod history;
pub mod physics;
pub mod room;

mod config;
mod settings;
mod types;
mod world;

// Preserve the crate's public API while keeping each implementation cohesive.
pub use config::{movement, rules, Movement, Rules};
pub use settings::Settings;
pub use types::{BunnyHop, Event, Input, Motor, Phase, Pose, Preference, Role, Vec3};
pub use world::{arena, map, Arena, BoxCollider, MapId, Mirror};
