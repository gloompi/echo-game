# Authoritative simulation crate

Inherit `crates/AGENTS.md`. Keep this crate engine-independent: no renderer, sockets, Tokio runtime, environment reads, or wall clock. Simulation time is supplied by the caller. Checked-in immutable JSON constants are cached once.

`src/lib.rs` is a public facade. Private `config`, `world`, `settings`, and `types` modules own their respective data; `history`, `physics`, `room`, and `balance` remain focused public modules. Preserve existing crate-root imports via explicit reexports during a move.

Keep inputs as intent, never trusted authoritative positions. Retain host/phase authorization and delayed-observation invariants. Test deterministic behavior and boundary conditions; changes affecting prediction must also pass TS/Rust parity fixtures.
