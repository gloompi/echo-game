# Client game policies

Inherit `client/AGENTS.md`. This feature owns client-side prediction and presentation sampling, not server authority. Keep it independent of DOM, Three.js, network construction and wall-clock reads; callers supply inputs, observations and monotonic time.

Snapshot buffers may interpolate only authorized received poses, never manufacture a current Hider pose. Preserve alive/role/warp discontinuities, bounded history and cache retention. Clear history and scratch caches on room/round/map changes. Returned scratch values must not be retained or mutated by consumers. Add deterministic regression tests for timing, cancellation, bounds and transitions before changing these policies.
