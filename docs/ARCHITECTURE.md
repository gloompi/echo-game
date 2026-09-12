# Echo architecture — protocol v3

## Boundaries

Three.js renders game state. DOM UI owns menus and settings, not authoritative rules. `echo-core` owns movement, roles, rounds, shots and historical sampling without depending on Axum, Tokio, browser APIs or a wall clock. `echo-server` supplies monotonic time, a 60 Hz loop, room lifecycle, transport and static hosting. Each room is authoritative and in-memory.

`shared/rules.json` and `shared/arena.json` are imported by TypeScript and included at Rust compile time. The motor currently has **two implementations**: `shared/physics.ts` for local prediction and `echo-core::physics` for authority. Six JS-generated scenarios check cross-language parity. This is not yet a shared WASM simulation. Replacing the existing kinematic controller with Rapier is deferred to avoid combining a physics rewrite with a server rewrite.

## Timing contract

For a Seeker at server time T with room delay D:

- The Seeker's self state is current. Allied Seeker poses are current.
- Hider poses and their animation flags are sampled at T−D on the server; current Hider poses are not sent in a hidden secondary field.
- During history warmup, missing historical Hiders are omitted, never substituted with live transforms.
- Roster metadata contains no spatial fields. Remote spatial effects are held back conservatively; non-spatial hit/capture confirmations can be immediate.
- Shots use the shooter's current authoritative origin/aim and current Hider hitboxes, after all movement for that tick. There is no rewind to the visible echo and no generic historical lag compensation.
- Hiders receive current other-player poses and their own delayed echo.

The browser retains recent delivered frames and interpolates around estimated server-now minus 100 ms. It does **not** receive live Hider history and wait three seconds locally. Server holdback therefore does not provide a free three-second browser jitter cushion. Clock estimation, network conditions and interpolation affect effective display age; the configured delay is a gameplay rule, not a zero-latency promise.

A fixed-size time horizon of 12 seconds supports D=0…10000 ms plus interpolation boundaries. The server clears history at new rounds. Host setting changes increment `settingsVersion`; clients flush interpolation/prediction frames rather than blend across timelines. Settings are immutable during an active hunt.

## Inputs and transport

The browser predicts its own motor at 60 Hz and sends sequenced controls. The server validates finite values, axes, pitch and sequence bounds; clients never submit authoritative positions, durations or hit claims. At most one queued command is simulated per fixed tick. Held controls briefly continue across a short input gap, then neutralize after 300 ms. Snapshot acknowledgements let the browser discard processed commands and replay outstanding commands over the server correction.

Snapshots are produced at 20 Hz. The renderer is independent of both frequencies. Tokio's loop skips missed deadlines instead of running an unbounded catch-up burst; an overloaded host still degrades gameplay and must be measured.

Native WebTransport carries protocol v3 over HTTP/3 and QUIC. One reliable bidirectional stream preserves input and control ordering; separate expiring unidirectional streams carry snapshots. A watch channel retains only the latest unsent snapshot, and the client rejects stale timestamps. Stream counts, frame lengths, deadlines and output queues are bounded. No WebSocket fallback or lossy input datagrams are used. See [wire format and deployment](ABILITIES_AND_TRANSPORT.md).

## Local hosting

The Rust process serves `dist/client`, `/health` and `/api/config` on an HTTP port and `/echo` over a separate UDP WebTransport listener. `scripts/play.mjs --share` requires an explicit public UDP endpoint and publishes the frontend/API port through cloudflared, generates a playtest access key and a separate control token, and registers the resulting public origin. Only the game is published, not the project directory or development server.

The public-origin control route requires a loopback connection plus the control token. Browser joins require the configured access key. Exact allowed/registered frontend Origin checks, 16,384-byte control frames, connection/message limits, bounded queues and heartbeat timeouts are baseline protections for private playtests, not a complete production anti-abuse system.

Settings, scores and rooms are not persisted. A leaving host browser hands host controls to another human. Server process failure is not host migration and ends the session.

## Native-engine migration

Reuse shared map/tuning data, Rust room rules/protocol concepts and original visual designs. Renderer/input/audio integration and native transport adapters still need implementation. The existing art is procedural Three.js source, not a finished engine-independent skeletal GLB asset pack; see `assets-src/README.md`. No React conversion, native client, replay system or Signal Heist objectives are included in this server migration.
