//! Echo's executable entry point. Policies and runtime ownership live in explicit modules.
#![forbid(unsafe_code)]
mod commands;
mod config;
mod framing;
mod http;
mod protocol;
mod runtime;
mod security;
mod sessions;
mod simulation;
mod state;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    runtime::run().await
}
