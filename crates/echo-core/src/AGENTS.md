# Simulation implementation

Inherit the Rust/core instructions. Keep wire representations stable and expose only intentional crate API. Pure value and validation code must not reach outward into the server.

History sampling must fail closed for missing/invalid observations. Interpolation must not cross warp, role, or alive-state discontinuities. Retention must remain bounded and preserve the predecessor needed at the time boundary. Caller-supplied recorded times must be monotonic.

Put narrow unit tests beside private policies; use `../tests/` for public-API integration and parity scenarios. Do not remove existing tests when moving implementation. Run formatting, warning-denying Clippy, and workspace tests rather than claiming a text-only review proves compilation.
