//! Shared, host-configurable combat rules. Integral units avoid cross-language drift.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SlideTuning {
    pub enabled: bool,
    pub duration_ms: u64,
    pub cooldown_ms: u64,
    pub minimum_speed_cm: u64,
    pub stamina_cost: u64,
    pub steering_percent: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ShieldTuning {
    pub enabled: bool,
    pub duration_ms: u64,
    pub cooldown_ms: u64,
    pub stamina_cost: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MineTuning {
    pub enabled: bool,
    pub root_ms: u64,
    pub cooldown_ms: u64,
    pub arm_ms: u64,
    pub life_ms: u64,
    pub trigger_radius_cm: u64,
    pub max_active: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct HookTuning {
    pub enabled: bool,
    pub cooldown_ms: u64,
    pub range_cm: u64,
    pub width_cm: u64,
    pub pull_speed_cm: u64,
    pub pull_ms: u64,
    pub stun_ms: u64,
    pub max_targets: u64,
    pub friendly_fire: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ScanTuning {
    pub enabled: bool,
    pub duration_ms: u64,
    pub cooldown_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct TeleportTuning {
    pub seeker_cooldown_ms: u64,
    pub seeker_cast_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ControlTuning {
    pub immunity_ms: u64,
    pub switch_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WeaponTuning {
    pub enabled: bool,
    pub interval_ms: u64,
    pub range_cm: u64,
    pub magazine: u64,
    pub reload_ms: u64,
    pub pellets: u64,
    pub spread_mrad: u64,
    pub damage: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WeaponsTuning {
    pub blaster: WeaponTuning,
    pub scatter: WeaponTuning,
    pub repeater: WeaponTuning,
    pub web: WeaponTuning,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WebTuning {
    pub speed_cm: u64,
    pub radius_cm: u64,
    pub root_ms: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Balance {
    pub slide: SlideTuning,
    pub shield: ShieldTuning,
    pub mine: MineTuning,
    pub hook: HookTuning,
    pub scan: ScanTuning,
    pub teleport: TeleportTuning,
    pub control: ControlTuning,
    pub weapons: WeaponsTuning,
    pub web: WebTuning,
}

impl Default for Balance {
    fn default() -> Self {
        static DEFAULTS: OnceLock<Balance> = OnceLock::new();
        *DEFAULTS.get_or_init(|| {
            serde_json::from_str(include_str!("../../../shared/balance.json"))
                .expect("valid balance.json")
        })
    }
}
impl Balance {
    pub fn validate(&self) -> Result<(), &'static str> {
        static LIMITS: OnceLock<Value> = OnceLock::new();
        let limits = LIMITS.get_or_init(|| {
            serde_json::from_str(include_str!("../../../shared/balance-limits.json"))
                .expect("valid balance limits")
        });
        let values = serde_json::to_value(self).map_err(|_| "Invalid balance settings.")?;
        for (path, rule) in limits.as_object().ok_or("Invalid balance schema.")? {
            let mut value = &values;
            for part in path.split('.') {
                value = value.get(part).ok_or("Missing balance setting.")?;
            }
            if rule["kind"] == "boolean" {
                if !value.is_boolean() {
                    return Err("Expected an ability toggle.");
                }
            } else {
                let number = value
                    .as_u64()
                    .ok_or("Balance values must be whole numbers.")?;
                if number < rule["min"].as_u64().unwrap_or(0)
                    || number > rule["max"].as_u64().unwrap_or(0)
                {
                    return Err("A balance setting is outside its supported range.");
                }
            }
        }
        if !self.weapons.blaster.enabled {
            return Err("The fallback blaster must remain enabled.");
        }
        for (enabled, duration, cooldown) in [
            (
                self.slide.enabled,
                self.slide.duration_ms,
                self.slide.cooldown_ms,
            ),
            (
                self.shield.enabled,
                self.shield.duration_ms,
                self.shield.cooldown_ms,
            ),
            (
                self.scan.enabled,
                self.scan.duration_ms,
                self.scan.cooldown_ms,
            ),
            (
                self.hook.enabled,
                self.hook.pull_ms + self.hook.stun_ms,
                self.hook.cooldown_ms,
            ),
        ] {
            if enabled && duration >= cooldown {
                return Err("Ability cooldown must exceed its active duration.");
            }
        }
        if self.mine.arm_ms >= self.mine.life_ms {
            return Err("Mine arming time must be shorter than its lifetime.");
        }
        Ok(())
    }
    pub fn weapon(&self, weapon: Weapon) -> WeaponTuning {
        match weapon {
            Weapon::Blaster => self.weapons.blaster,
            Weapon::Scatter => self.weapons.scatter,
            Weapon::Repeater => self.weapons.repeater,
            Weapon::Web => self.weapons.web,
        }
    }
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Weapon {
    #[default]
    Blaster,
    Scatter,
    Repeater,
    Web,
}
impl Weapon {
    pub fn index(self) -> usize {
        match self {
            Self::Blaster => 0,
            Self::Scatter => 1,
            Self::Repeater => 2,
            Self::Web => 3,
        }
    }
}
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Skin {
    #[default]
    Classic,
    Cobalt,
    Ember,
    Jade,
    Violet,
    Arctic,
    Sunset,
    Carbon,
}
