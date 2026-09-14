# Shared contracts and deterministic simulation

Inherit the root contract. This is the inward dependency layer shared conceptually by browser prediction and Rust authority. Do not import `client/`, scripts, tests, Node built-ins, browser APIs, or rendering/network frameworks. The AST boundary check enforces import direction, not every possible global access: review both.

Keep types, validated settings, protocol framing, collision data, and pure simulation policies explicit. Prefer named units and total handling of enum variants. Do not move game authority here into a browser-owned singleton. Time, input, and settings should be supplied by callers when extracting new pure policies.

Treat JSON/wire data as unknown until validated. Bound lengths and numeric values, reject non-finite values, and preserve serialized names and defaults. A TypeScript type or Rust serde annotation alone does not establish TS/Rust parity.

Movement, map, settings, and balance changes require reviewing both motors, regenerating fixtures with the documented scripts, inspecting the generated diff, and passing `pnpm fixtures:check` plus Rust parity tests. Never hand-edit generated fixtures to conceal a mismatch. Keep current-Hider data out of any shared outward-facing diagnostics.
