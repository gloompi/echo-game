//! Validate startup values without binding sockets or spawning tasks.
use crate::security::valid_https;
use echo_core::{rules, Settings};
use std::{env, error::Error, net::SocketAddr, path::PathBuf};

type ConfigResult<T> = Result<T, Box<dyn Error>>;

pub(super) struct Config {
    pub(super) host: String,
    pub(super) port: u64,
    pub(super) transport: TransportConfig,
    pub(super) defaults: Settings,
    pub(super) allowed_origins: Vec<String>,
    pub(super) public_url: Option<String>,
    pub(super) access_key: String,
    pub(super) control_token: String,
    pub(super) max_rooms: usize,
    pub(super) assets: PathBuf,
    balance_file: Option<String>,
}

pub(super) struct TransportConfig {
    pub(super) bind: SocketAddr,
    pub(super) port: u64,
    pub(super) url: String,
    pub(super) public: bool,
    pub(super) tls_files: Option<(String, String)>,
}

impl Config {
    pub(super) fn load() -> ConfigResult<Self> {
        let mut config = Self::from_values(&|name| env::var(name).ok())?;
        if let Some(path) = &config.balance_file {
            config.defaults.balance = serde_json::from_str(&std::fs::read_to_string(path)?)?;
            config.defaults.validate()?;
        }
        Ok(config)
    }

    // Tests supply values directly rather than mutating process-global environment.
    fn from_values(get: &impl Fn(&str) -> Option<String>) -> ConfigResult<Self> {
        let host = get("HOST").unwrap_or_else(|| "127.0.0.1".into());
        let port = number(get, "PORT", 3000, 1, 65535)?;
        let wt_port = number(get, "ECHO_WT_PORT", 4433, 1, 65535)?;
        let wt_host = get("ECHO_WT_HOST").unwrap_or_else(|| "127.0.0.1".into());
        let bind = format!("{wt_host}:{wt_port}").parse()?;
        let public_transport = get("ECHO_WT_PUBLIC_URL").filter(|s| !s.is_empty());
        let wt_url = public_transport
            .clone()
            .unwrap_or_else(|| format!("https://127.0.0.1:{wt_port}/echo"));
        if !valid_https(&wt_url, "/echo") {
            return Err(
                "ECHO_WT_PUBLIC_URL must be an HTTPS URL ending /echo without query or fragment"
                    .into(),
            );
        }
        let tls_files = match (get("ECHO_TLS_CERT"), get("ECHO_TLS_KEY")) {
            (Some(cert), Some(key)) => Some((cert, key)),
            (None, None) => None,
            _ => return Err("Set both ECHO_TLS_CERT and ECHO_TLS_KEY, or neither for a short-lived pinned playtest certificate".into()),
        };
        let defaults = Settings {
            delay_ms: number(
                get,
                "ECHO_DELAY_MS",
                rules().delay_ms,
                0,
                rules().max_delay_ms,
            )?,
            round_ms: number(get, "ECHO_ROUND_MS", rules().round_ms, 30_000, 600_000)?,
            seeker_count: number(get, "ECHO_SEEKERS", 2, 1, 3)? as usize,
            reload_ms: number(get, "ECHO_RELOAD_MS", rules().reload_ms, 0, 10000)?,
            dash_cooldown_ms: number(get, "ECHO_DASH_COOLDOWN_MS", 3200, 0, 30000)?,
            mirror_cooldown_ms: number(get, "ECHO_MIRROR_COOLDOWN_MS", 60000, 0, 180000)?,
            ..Settings::default()
        };
        defaults.validate()?;
        let mut allowed_origins: Vec<String> = get("ALLOWED_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .collect();
        allowed_origins.extend([
            format!("http://localhost:{port}"),
            format!("http://127.0.0.1:{port}"),
            "http://localhost:5173".into(),
            "http://127.0.0.1:5173".into(),
        ]);
        let public_url = get("ECHO_PUBLIC_URL")
            .filter(|s| !s.is_empty())
            .map(|s| s.trim_end_matches('/').to_owned());
        if let Some(url) = &public_url {
            if public_transport.is_none() || !valid_https(&(url.clone() + "/"), "/") {
                return Err("Public hosting requires a valid HTTPS frontend and ECHO_WT_PUBLIC_URL for reachable UDP".into());
            }
        }
        Ok(Self {
            host,
            port,
            defaults,
            allowed_origins,
            public_url,
            transport: TransportConfig {
                bind,
                port: wt_port,
                url: wt_url,
                public: public_transport.is_some(),
                tls_files,
            },
            access_key: get("ECHO_ACCESS_KEY").unwrap_or_default(),
            control_token: get("ECHO_CONTROL_TOKEN").unwrap_or_default(),
            max_rooms: number(get, "MAX_ROOMS", 32, 1, 256)? as usize,
            assets: PathBuf::from(get("ECHO_CLIENT_DIR").unwrap_or_else(|| "dist/client".into())),
            balance_file: get("ECHO_BALANCE_FILE"),
        })
    }
}

fn number(
    get: &impl Fn(&str) -> Option<String>,
    name: &str,
    default: u64,
    min: u64,
    max: u64,
) -> ConfigResult<u64> {
    let value = get(name).map(|s| s.parse::<u64>()).unwrap_or(Ok(default))?;
    if !(min..=max).contains(&value) {
        return Err(format!("{name} must be {min}–{max}").into());
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn parse(pairs: &[(&str, &str)]) -> ConfigResult<Config> {
        Config::from_values(&|name| {
            pairs
                .iter()
                .find(|(key, _)| *key == name)
                .map(|(_, value)| value.to_string())
        })
    }
    #[test]
    fn defaults_are_local_and_do_not_require_secrets() {
        let config = parse(&[]).unwrap();
        assert_eq!(config.host, "127.0.0.1");
        assert!(config.transport.bind.ip().is_loopback());
        assert!(!config.transport.public);
        assert!(config.transport.tls_files.is_none());
        assert_eq!(config.defaults.delay_ms, 3000);
    }
    #[test]
    fn rejects_invalid_ports_and_numeric_settings() {
        for pair in [
            ("PORT", "0"),
            ("PORT", "65536"),
            ("PORT", "abc"),
            ("MAX_ROOMS", "0"),
            ("ECHO_DELAY_MS", "10001"),
        ] {
            assert!(parse(&[pair]).is_err(), "{}", pair.0);
        }
        assert!(parse(&[("ECHO_DELAY_MS", "0")]).is_ok());
    }
    #[test]
    fn certificate_and_key_must_be_a_pair() {
        assert!(parse(&[("ECHO_TLS_CERT", "cert.pem")]).is_err());
        assert!(parse(&[("ECHO_TLS_KEY", "key.pem")]).is_err());
        assert!(parse(&[("ECHO_TLS_CERT", "cert.pem"), ("ECHO_TLS_KEY", "key.pem")]).is_ok());
    }
    #[test]
    fn a_frontend_tunnel_without_udp_must_not_be_advertised() {
        assert!(parse(&[("ECHO_PUBLIC_URL", "https://friends.example")]).is_err());
        let config = parse(&[
            ("ECHO_PUBLIC_URL", "https://friends.example/"),
            ("ECHO_WT_PUBLIC_URL", "https://udp.example:4433/echo"),
        ])
        .unwrap();
        assert_eq!(
            config.public_url.as_deref(),
            Some("https://friends.example")
        );
        assert!(config.transport.public);
    }
    #[test]
    fn origin_list_is_trimmed_and_preserves_local_play() {
        let config = parse(&[
            ("PORT", "3107"),
            ("ALLOWED_ORIGINS", " https://a.example, ,https://b.example "),
        ])
        .unwrap();
        assert_eq!(config.allowed_origins.len(), 6);
        assert!(config
            .allowed_origins
            .contains(&"http://127.0.0.1:3107".into()));
    }
}
