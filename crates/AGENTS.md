# Rust engineering conventions

Inherit the root contract. Use rustfmt and Clippy, with `cargo fmt --all -- --check`, `cargo clippy --workspace --all-targets --locked -- -D warnings`, and `cargo test --workspace --locked` as required gates.

Prefer idiomatic ownership, borrowing, enums for closed alternatives, small structs with coherent responsibilities, iterators where clearer, and explicit `Result` propagation. Keep implementation details private; use `pub(crate)` or `pub(super)` instead of public exports where sufficient. Public data-transfer/simulation structs may expose fields when that is their intentional API.

Avoid panics/unwraps for user input, network failures, or ordinary control flow. An `expect` for a checked-in invariant must name that invariant and have test coverage. Do not clone to silence borrowing errors without considering ownership and cost. Bound queues, histories, rates, and task counts. Avoid unsafe code; the core crate forbids it.

SOLID means separating policy from I/O and keeping narrow capabilities, not a trait for every concrete struct. Add traits when substitutability or multiple implementations actually help. Prefer composition to inheritance emulation and avoid excessive generic/lifetime complexity.

Runtime clocks, environment, filesystem, sockets, and Tokio belong at the server boundary. Do not hold shared state locks across network I/O or an await that can block. Make task cancellation/shutdown and ownership explicit. Preserve serde names/defaults/validation when moving code; refactoring is not a protocol-version change.
