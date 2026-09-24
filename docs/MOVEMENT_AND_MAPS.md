# Movement, mirrors and map playtests

This is an extension of the Rust playtest branch. Start with `npm run share` (public invitation) or `npm run play` (local only). These commands rebuild the client and Rust server. Both the server and clients must use the same revision; refresh browser tabs after updating.

## Controls on each player's device

| Action                     | Default                 | Configuration                                       |
| -------------------------- | ----------------------- | --------------------------------------------------- |
| Move / sprint              | WASD / Shift            | Existing controls                                   |
| Jump                       | Space                   | Settings → Movement keys; keyboard or wheel up/down |
| Crouch                     | Hold Ctrl (either side) | Settings → Movement keys; bind a held key such as C |
| Use nearby mirror          | Press F                 | Fixed interact key                                  |
| Hider dash / wave / reload | Q / E / R               | Existing controls                                   |
| Mouse sensitivity          | 1×                      | Settings slider, 0.1×–4×; saved locally             |

Jump/crouch bindings are saved locally, with conflict checks and a reset button. Movement/action keys W/A/S/D/Q/E/R/F are reserved. Swapping jump and crouch keys is supported unless it would bind a held action to the wheel. Browsers may reserve Ctrl shortcuts (notably Ctrl+W); rebinding crouch to C avoids those combinations. Ctrl is nevertheless the requested default.

Crouch is a real 1.12 m collider, not just a camera animation. It lowers the eye/weapon origin and present-time target hitbox, slows movement, and prevents sprint/dash. Releasing crouch under a low roof does not force the body into it. Both roles can use crouch tunnels. There are no invisible lockers: hiding works through physical cover and blocked sight lines.

## Host settings, between rounds

| Setting         | Default    | Allowed range / behavior                                             |
| --------------- | ---------- | -------------------------------------------------------------------- |
| Echo delay      | 3 s        | 0–10 s (existing feature)                                            |
| Reload duration | 1.5 s      | 0–10 s; 0 means no reload and unlimited magazine                     |
| Dash cooldown   | 3.2 s      | 0–30 s; still requires a new Q press, and dash duration is unchanged |
| Mirror cooldown | 60 s       | 0–180 s; per player, shared across all mirrors                       |
| Bunny hopping   | Timed      | Off, timed, or hold-to-hop                                           |
| Map             | Afterhours | Afterhours, Switchyard or Glassworks                                 |

Press APPLY SETTINGS before START ROUND. The HUD reports the authoritative settings. Esc → END ROUND / ROOM SETTINGS returns everyone to the lobby. Changes cannot retime ghosts, replace maps or alter movement rules halfway through a hunt. The host settings are server-validated; ordinary players cannot override them.

`ECHO_RELOAD_MS`, `ECHO_DASH_COOLDOWN_MS` and `ECHO_MIRROR_COOLDOWN_MS` optionally set server defaults in `.env`; values are whole milliseconds. The lobby also keeps the existing delay, round-length and Seeker-count controls. Personal sensitivity is not a room rule.

No-reload mode removes magazine management, not shot spacing: the existing 180 ms fire interval is still enforced. Dash cooldown zero does not mean permanently dashing while holding Q. Mirror cooldown zero still requires a new F press and proximity to a mirror.

## Bunny hopping

This is Counter-Strike-inspired movement, not a claim to reproduce a specific CS engine or version.

- **Off:** the previous acceleration behavior; holding jump does not repeatedly jump.
- **Timed:** fresh jump presses can be buffered for 100 ms before landing. Air movement retains momentum; strafing adds velocity along the requested direction. Timed successive jumps avoid ground friction.
- **Auto:** hold jump to chain hops, with the same air movement. This is the easier friends/party option.

Ordinary hop speed is capped at 12 m/s; the existing short dash is a separate faster burst. Ground friction slows missed hops. Crouching cancels dash and clamps movement to crouch speed. There is no wall-running or surfing implementation.

## Mirrors and the Echo boundary

Mirrors are clearly labeled, colored pairs. Press F within 1.8 m of one to appear at its partner's predefined clear exit. Both roles can use them, but Seekers remain frozen during the head start. The cooldown belongs to the player rather than the mirror, so one friend's use does not lock everyone else out. Exits sit outside the activation radius to prevent immediate bounce-back.

The Rust server validates phase, alive state, proximity, line of sight, exit bounds and occupancy. A client cannot submit a destination. Teleporting clears velocity/dash-in-progress but does not refill stamina or reset the dash cooldown. It preserves aim direction.

A Hider's teleport, crouch state and spatial event are delayed for Seekers. An internal discontinuity number travels only with that player's allowed pose timeline: neither server history sampling nor client interpolation draws a long ghost slide between the endpoints. There is no live remote-camera reflection in the mirror material. Personal cooldowns are not exposed through roster metadata.

## Maps and layout intent

| Map        | Footprint   | Suggested group | Distinct routes                                                                                            |
| ---------- | ----------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| Afterhours | 46 × 46 m   | 2–6             | Existing neon cover and balconies, one diagonal mirror pair                                                |
| Switchyard | 80 × 80 m   | 4–10            | Four warehouse loops, jump-through windows, crouch exits, open hiding alcoves, two lofts, two mirror pairs |
| Glassworks | 112 × 112 m | 8–12            | Four courtyard loops, offset hedge cover, central ring, four overlooks, three mirror pairs                 |

These are original procedural playtest layouts, not copies of Dead by Daylight maps. They borrow the idea of looping around cover and choosing alternate exits. They do **not** yet implement movable pallets, interaction-based vault animations, locker searches or final environment art. Ground routes connect the spawns and mirror approaches; upper routes add shortcuts. The larger map is an option, not automatically the recommended choice for a small lobby.

Lobby previews contain static layout data only, never live players. Map rendering, spawn locations, collision bounds, bullet occlusion and bot routes all read the selected shared layout. Mirror frames and signs are non-colliding visual markers; all cover geometry is represented in the shared collision data.

### Authoring maps

Edit `scripts/build-maps.mjs`, then run:

```sh
npm run maps
npm run fixtures
npm run fixtures:check
npm test
npm run build
npm run test:network
npm run test:e2e
```

Commit generated `shared/maps.json` with its generator. `shared/arena.json` remains the unchanged classic collision layout. `shared/movement.json` owns the new movement tuning; `shared/rules.json` owns the original rules. Rust and TypeScript still have separate motor implementations, verified through generated fixtures when Rust is available—not a shared WASM motor.

## Verification status for this change

Observed in the authoring environment: 50 TypeScript logic tests passed (28 existing simulation tests plus 22 new gameplay tests); all 11 movement fixture scenarios regenerated and matched; generated map data matched its source; strict TypeScript checking passed for shared logic, player/room controls, test logic and fixture generators. The TypeScript files were also syntax-checked.

Not verified here: Rust compilation/tests and JS/Rust parity execution, the full dependency-backed frontend build, WebGL gameplay, live multiplayer, Docker and a public tunnel. Rust/Cargo and registry network access were unavailable. An attempted isolated browser check could not navigate to the local test server (`ERR_BLOCKED_BY_ADMINISTRATOR`), so it is not counted as passing browser validation. New Rust and real-browser regression tests are included for CI/local execution. Keep the migration PR in draft until those checks pass.

For the first group playtest, try Switchyard, 1–2 s Echo delay, 1.5 s reload, 3.2 s dash cooldown, 60 s mirrors and auto-hop. Compare this against timed hopping and the larger map; these are starting hypotheses, not measured balance claims.
