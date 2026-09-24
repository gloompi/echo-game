# Room combat policies

Inherit all Rust/core instructions. Keep combat authority, phase/role eligibility, ability cooldowns, immunity, and collision decisions explicit. Shots resolve against present authoritative state, not the delayed echo.

Spatial events sent to Seekers must not reveal a Hider's current position. Consider all event payloads, mines/projectiles, spectators, and role transitions when changing visibility. Bound collections and make lifecycle removal deterministic.

Use targeted regression scenarios for simultaneous effects, cancellation, control immunity, invalid input, and expiry boundaries. Changes to balance or movement require reviewing shared data and parity fixtures, not only this module.
