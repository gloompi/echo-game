# Server implementation

Inherit the server/Rust instructions. Keep framing independent of room behavior. Parsing rejects unknown client fields; preserve protocol discriminants and case conventions.

Configuration, HTTP handlers, session I/O, and simulation scheduling are future extraction boundaries in `main.rs`, not invitations to change behavior while moving code. Prefer small explicit parameters over passing the whole application everywhere when extracting a policy.

For every spawned task and retained sender/reader, identify cancellation and resource release. Review lock scope and bounded writes. Test failure paths as well as normal joins. Do not introduce a WebSocket fallback or generic historical hit rewind.
