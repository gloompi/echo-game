# Test strategy

Inherit the root contract. Keep four distinct layers: pure TS tests; Rust unit/integration/parity tests; launcher/network integration; and real-browser application E2E. Preserve existing tests when adding a new layer.

Unit tests should use explicit inputs, fake clocks, narrow injected dependencies, and observable assertions. Always close timers/streams/transports in cleanup. Avoid assertions that merely restate the implementation, broad snapshots, and arbitrary sleeps. Test invalid inputs and cancellation as well as success.

E2E must launch the real Rust server and built app. Do not mock HTTP/game transport, skip WebGL, or introduce current-Hider debug state just to make a test pass. A UI speed assertion tests user-visible movement, not an independent proof of server acknowledgement; protocol tests cover authority separately.

No test-only `.only`, hidden skip, weakened assertion, or inflated timeout as a substitute for fixing a regression. Save diagnostics without secrets. Report exact executed suites and environment limitations.
