# Rust public-API tests

Inherit the Rust/core instructions. Test observable behavior through the crate API. Use explicit simulation timestamps and deterministic inputs, not real sleeps. Keep fixture loading errors actionable.

Cover authorization, input validation, round transitions, delayed observations, present-time hits, movement parity, and ability boundaries. Add regressions for fixes; do not weaken assertions or change expected fixtures without a gameplay explanation. Include the entire workspace test run in final verification evidence.
