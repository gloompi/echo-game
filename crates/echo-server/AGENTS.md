# Server boundary

Inherit `crates/AGENTS.md`. The server owns transport, HTTP/static serving, configuration, authentication, room orchestration, and the simulation clock; gameplay policies belong in `echo-core`.

Validate environment and protocol inputs before use. Preserve origin checks, access-key handling, message sizes, bounded queues, handshake/session limits, and backpressure. Keep private credentials out of URLs and logs. Do not allow client-supplied positions or arbitrary settings changes during a hunt.

Never hold the engine mutex across network I/O. Make shutdown, task cancellation, reader/writer ownership, and peer removal explicit. Use focused modules when extracting the existing large entry point; a broad rewrite without real integration evidence is not acceptable.

Run Rust checks plus live WebTransport integration and production-app E2E for transport, lifecycle, startup, or routing changes. Local tests bind loopback and must not advertise a public invite.
