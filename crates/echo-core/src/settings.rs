//! Host-configurable rules. Authorization and round-phase checks live in Room.
use crate::{balance::Balance, rules, BunnyHop, MapId};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub delay_ms: u64,
    pub round_ms: u64,
    pub seeker_count: usize,
    pub map_id: MapId,
    pub reload_ms: u64,
    pub dash_cooldown_ms: u64,
    pub mirror_cooldown_ms: u64,
    pub bunny_hop: BunnyHop,
    pub balance: Balance,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            delay_ms: rules().delay_ms,
            round_ms: rules().round_ms,
            seeker_count: 2,
            map_id: MapId::Afterhours,
            reload_ms: rules().reload_ms,
            dash_cooldown_ms: 3200,
            mirror_cooldown_ms: 60000,
            bunny_hop: BunnyHop::Timed,
            balance: Balance::default(),
        }
    }
}

impl Settings {
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.delay_ms > rules().max_delay_ms {
            return Err("Delay must be between 0 and 10 seconds.");
        }
        if !(30000..=600000).contains(&self.round_ms) {
            return Err("Rounds must last 30–600 seconds.");
        }
        if !(1..=3).contains(&self.seeker_count) {
            return Err("Choose 1–3 Seekers.");
        }
        if self.reload_ms > 10000 {
            return Err("Reload duration must be 0–10 seconds.");
        }
        if self.dash_cooldown_ms > 30000 {
            return Err("Dash cooldown must be 0–30 seconds.");
        }
        if self.mirror_cooldown_ms > 180000 {
            return Err("Mirror cooldown must be 0–180 seconds.");
        }
        self.balance.validate()
    }
}
