//! Protocol-v3 client commands, rejecting client-owned authoritative state.
use echo_core::{balance::Skin, Input, Preference, Settings};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(super) enum ClientMessage {
    Join {
        mode: JoinMode,
        name: String,
        room: Option<String>,
        preference: Option<Preference>,
        access_key: Option<String>,
        settings: Option<Settings>,
        skin: Option<Skin>,
    },
    Input {
        input: Input,
    },
    Start {},
    Lobby {},
    Preference {
        value: Preference,
    },
    Bots {
        enabled: bool,
    },
    Settings {
        settings: Settings,
    },
    Ping {
        at: f64,
    },
    Skin {
        value: Skin,
    },
}
#[derive(Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub(super) enum JoinMode {
    Create,
    Join,
    Quick,
    Practice,
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn protocol_rejects_authoritative_positions() {
        assert!(serde_json::from_str::<ClientMessage>(
            r#"{"type":"input","input":{"seq":1,"x":99}}"#
        )
        .is_err());
    }
    #[test]
    fn protocol_rejects_unknown_commands_and_fields() {
        for text in [
            r#"{"type":"teleport","x":1}"#,
            r#"{"type":"start","admin":true}"#,
        ] {
            assert!(serde_json::from_str::<ClientMessage>(text).is_err());
        }
    }
}
