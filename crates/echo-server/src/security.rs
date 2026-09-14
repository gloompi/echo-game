//! Origin and endpoint policies. Never log credentials here.
use crate::state::App;
use axum::http::Uri;

pub(super) fn equal_key(a: &str, b: &str) -> bool {
    a.len() == b.len()
        && a.as_bytes()
            .iter()
            .zip(b.as_bytes())
            .fold(0u8, |n, (a, b)| n | (a ^ b))
            == 0
}
pub(super) fn valid_https(url: &str, path: &str) -> bool {
    let Ok(uri) = url.parse::<Uri>() else {
        return false;
    };
    uri.scheme_str() == Some("https")
        && uri.authority().is_some_and(|a| !a.as_str().contains('@'))
        && uri.query().is_none()
        && uri.path() == path
        && !url.contains('#')
}
pub(super) async fn origin_allowed(app: &App, origin: Option<&str>) -> bool {
    let Some(origin) = origin else {
        return false;
    };
    app.allowed_origins.iter().any(|v| v == origin)
        || app.public_url.lock().await.as_deref() == Some(origin)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn key_comparison() {
        assert!(equal_key("abc", "abc"));
        assert!(!equal_key("abc", "abd"));
        assert!(!equal_key("", "x"));
    }
    #[test]
    fn reject_unsafe_transport_urls() {
        assert!(valid_https("https://localhost:4433/echo", "/echo"));
        for u in [
            "http://localhost/echo",
            "https://user@host/echo",
            "https://host/echo?key=secret",
            "https://host/echo#x",
        ] {
            assert!(!valid_https(u, "/echo"));
        }
    }
}
