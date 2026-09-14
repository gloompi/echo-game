//! HTTP health/configuration, control endpoint and built static assets.
use crate::{
    security::{equal_key, valid_https},
    state::App,
};
use axum::{
    extract::{ConnectInfo, DefaultBodyLimit, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    routing::{get, post},
    Json, Router,
};
use echo_core::rules;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{net::SocketAddr, path::PathBuf};
use tower_http::{services::ServeDir, set_header::SetResponseHeaderLayer};

async fn health(State(app): State<App>) -> Json<Value> {
    let e = app.engine.lock().await;
    Json(
        json!({"ok":true,"server":"rust","transport":"webtransport","protocolVersion":3,"rooms":e.rooms.len(),"players":e.peers.len(),"tickRate":rules().tick_rate,"snapshotRate":rules().snapshot_rate}),
    )
}
async fn config(State(app): State<App>) -> Json<Value> {
    Json(
        json!({"publicUrl":app.public_url.lock().await.clone(),"requiresKey":!app.access_key.is_empty(),"transport":*app.transport}),
    )
}
#[derive(Deserialize)]
struct PublicUrl {
    url: String,
}
async fn public_url(
    State(app): State<App>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(body): Json<PublicUrl>,
) -> StatusCode {
    let token = headers
        .get("x-echo-control")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("");
    if !peer.ip().is_loopback()
        || app.control_token.is_empty()
        || !equal_key(token, &app.control_token)
    {
        return StatusCode::FORBIDDEN;
    }
    // A frontend-only tunnel must not be advertised as a working WebTransport game.
    if !app.public_transport
        || !valid_https(&(body.url.trim_end_matches('/').to_owned() + "/"), "/")
    {
        return StatusCode::BAD_REQUEST;
    }
    *app.public_url.lock().await = Some(body.url.trim_end_matches('/').to_owned());
    StatusCode::NO_CONTENT
}
pub(super) fn router(app: App, assets: PathBuf) -> Router {
    Router::new().route("/health",get(health)).route("/api/config",get(config)).route("/api/public-url",post(public_url))
        .fallback_service(ServeDir::new(assets)).layer(DefaultBodyLimit::max(16_384))
        .layer(SetResponseHeaderLayer::if_not_present(header::X_CONTENT_TYPE_OPTIONS,HeaderValue::from_static("nosniff")))
        .layer(SetResponseHeaderLayer::if_not_present(header::REFERRER_POLICY,HeaderValue::from_static("no-referrer")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CACHE_CONTROL,HeaderValue::from_static("no-store")))
        .layer(SetResponseHeaderLayer::if_not_present(header::CONTENT_SECURITY_POLICY,HeaderValue::from_static("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https:; font-src 'self'; object-src 'none'; frame-ancestors 'none'"))).with_state(app)
}
