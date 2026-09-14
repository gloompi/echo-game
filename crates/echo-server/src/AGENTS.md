# Server implementation

Inherit the server/Rust instructions. Keep framing independent of room behavior. Parsing rejects unknown client fields; preserve protocol discriminants and case conventions.

The executable delegates to `runtime::run`. Keep configuration, HTTP, sessions, commands, protocol/security and scheduling in their dedicated modules. Configuration tests inject key/value lookups; never mutate the process environment in parallel tests. Bounded control-channel enqueue is synchronous, so it cannot suspend under the engine lock. Use empty struct variants for fieldless tagged commands when unknown fields must be rejected; cover serde behavior with a negative test.

For every spawned task and retained sender/reader, identify cancellation and resource release. Review lock scope and bounded writes. Test failure paths as well as normal joins. Do not introduce a WebSocket fallback or generic historical hit rewind.
