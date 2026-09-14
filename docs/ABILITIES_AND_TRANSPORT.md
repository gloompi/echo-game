# Echo combat and WebTransport

See [VALIDATION.md](VALIDATION.md) for checks performed on this branch and remaining deployment/playtest work. This branch is for review and has not been merged to main.

## Gameplay and controls

Hider: Shift + the crouch binding (Ctrl by default) starts a slide while grounded,
standing, and already travelling at least 5 m/s. G activates the shield. Q remains
dash. Seeker: 1–4 selects Blaster / Scatter / Repeater / Web; G casts the hook,
V places a mine, B activates the possibility scan. F uses mirrors. R reloads.
Jump and crouch remain rebindable; combat keys are reserved to avoid conflicts.

The skin selector appears in personal settings and the lobby. There are eight
palettes: Classic, Cobalt, Ember, Jade, Violet, Arctic, Sunset and Carbon. These
are procedural recolours, not eight new character meshes. Role silhouettes and
hider stripes remain identifiable. Skins do not affect hitboxes or movement.
A mild blood-edge overlay and body flinch play on damage; blood can be disabled
and its CSS animation respects reduced-motion preferences.

## Initial balance (playtest values, not a claim of competitive balance)

| Mechanic                | Defaults                                                                                              | Counterplay / restriction                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Slide                   | 0.8 s active; 1.8 s cooldown; 12 stamina                                                              | Requires earned momentum; low steering; no speed boost; ends on release/jump/control. Solid walls still stop it.                                   |
| Shield                  | 2 s active; 16 s cooldown; 25 stamina                                                                 | Blocks damage and new control. Cannot break an existing stun/root/pull.                                                                            |
| Mine                    | 1.4 s root; 10 s placement cooldown; 0.9 s arming; 45 s lifetime; max 2                               | Ground placement, visible marker, proximity and line-of-sight checks, no damage. Jumping over or pre-shielding counters it.                        |
| Hook                    | 20 m range; 0.9 m corridor width; 14 s cooldown; 0.65 s pull at 14 m/s plus 0.8 s stun; max 4 targets | Cover clips its corridor; individual line-of-sight checks; allies can be pulled by default; no damage.                                             |
| Scan                    | 3 s active; 18 s cooldown                                                                             | Outer possibility regions, not a locator. Uses only received delayed observations and public rules.                                                |
| Seeker mirror           | 0.4 s cast; 20 s cooldown                                                                             | Movement/combat input or control interrupts the cast; use has recovery. Hider mirror cooldown remains the separate room setting (60 s by default). |
| Control recovery        | 1.5 s immunity after the control ends                                                                 | An active control effect is not extended by subsequent traps/hooks/webs.                                                                           |
| Weapon/utility recovery | 0.65 s                                                                                                | Switching keeps per-weapon ammunition and fire timers; switching cannot cancel reloads.                                                            |

All cooldowns are measured from activation, not the end of the effect. The UI
shows remaining time. Server validation rejects cooldowns no longer than their
active effects for slide, shield, scan and hook.

### Weapons

| Weapon   | Interval | Range | Magazine |               Reload | Behaviour                                                                    |
| -------- | -------: | ----: | -------: | -------------------: | ---------------------------------------------------------------------------- |
| Blaster  |   450 ms |  55 m |       12 | Inherits room reload | Accurate single ray; one damage.                                             |
| Scatter  | 1,100 ms |  14 m |        4 |                2.2 s | Seven rays in a spread; at most one damage per target per trigger.           |
| Repeater |   280 ms |  20 m |        9 |                2.4 s | Faster fire, short range and spread; one damage.                             |
| Web      | 2,300 ms |  18 m |        2 |                2.6 s | Travels at 18 m/s; 0.18 m projectile radius; roots for 1.2 s; never damages. |

The web cannot instantly trap at any distance: it has swept projectile travel and
collides with cover. Weapon switching recovery plus crowd-control immunity keeps
web-to-damage and multi-seeker chain trapping from being free combinations.
Global room reload = 0 still means unlimited magazines, without removing fire
intervals. Per-weapon reload = 0 inherits the room reload rather than making that
weapon unlimited independently.

Bullet rays originate from a server-computed muzzle with cover checks between eye
and muzzle. The local tracer begins at the named weapon model muzzle socket,
including current viewmodel animation; it no longer begins at the camera/face.
Weapon silhouettes differ, while their muzzle coordinate contract is shared.

## Configuration

`shared/balance.json` is the default ruleset, embedded by Rust and imported by TS.
`shared/balance-limits.json` supplies integer ranges and UI labels/units.
`shared/balance.ts` and `crates/echo-core/src/balance.rs` validate it.

Host Settings contains an expandable Abilities & Weapons editor. Changes are
submitted with the other room settings and are host-only between rounds.
Ability toggles, durations, cooldowns, stamina costs, ranges, trap limits, hook
friendly fire, weapon cadence/ammo/reload/spread/damage and web travel parameters
are configurable within validated bounds. Web damage remains fixed to zero and
the fallback blaster must remain enabled. Integral ms/cm/mrad units avoid unit
ambiguity; the UI presents seconds/metres where appropriate.

An optional `ECHO_BALANCE_FILE` loads a complete validated JSON ruleset for the
server's default rooms. It must have the same complete shape as balance.json;
unknown/missing nested keys are rejected instead of silently ignored.

## Delayed-visibility guarantees in the implementation

Hider transforms and status visuals remain historical for seekers. The scan does
not receive present position, actual present velocity, stamina or cooldowns.
It expands horizontal regions from delayed poses using maximum public movement
speed, observation age (including buffer/network age), and reachable static mirror
exits. Dijkstra traversal handles mirror chains and zero-cost cycles. Ignoring
walls, cooldown availability and vertical travel makes this conservative, not an
exact reachable-set solver. A long delay on a small map can cover most of it.

Shot/hook spatial effects do not end at a hidden current body coordinate. Tracers
extend to their public wall/range endpoint; successful hits use non-spatial
feedback. A consumed web continues its cosmetic path to its precomputed wall
endpoint. Mine removal is held back for seekers. Their live effect/collision state
is never serialized as a target-location side channel.

The server caps cosmetic events per snapshot to 64, retained events to 4,096,
web projectiles to 32 per room / 12 per owner, and uses bounded frame/stream queues.
These hard safety limits are not host-overridable. At the projectile limit another
web shot is rejected without spending ammunition; capacity is based on the public
cosmetic flight lifetime rather than its hidden collision outcome.

## WebTransport protocol v3

The browser uses native WebTransport. There is no WebSocket fallback.
The Rust server adds `wtransport = 0.7.2` and removes Axum's WebSocket feature.
The actual Cargo resolution is committed in Cargo.lock. The API is verified against the [wtransport 0.7.2 documentation](https://docs.rs/wtransport/0.7.2/wtransport/).

One bidirectional reliable stream carries join/settings/control, ping/pong, and
ordered fixed-tick inputs. Inputs are not silently dropped: the current prediction
model consumes an ordered sequence and would diverge with a naive lossy migration.
Each server snapshot is one independent unidirectional stream with a short expiry;
a stalled older stream does not gate reception of a newer one. Latest-wins
selection uses the server snapshot timestamp. This version does not use datagrams.

Frames use a 4-byte big-endian payload byte count followed by UTF-8 JSON. Controls
are capped at 16,384 bytes and snapshots at 65,536 bytes. The decoder handles split
headers, multiple frames and split multibyte text, and rejects invalid lengths,
truncation and invalid UTF-8. Streams, sessions and output queues are bounded.

`/api/config` provides the WT endpoint and optional SHA-256 certificate pins;
`/health` identifies protocol version 3. TLS is either a freshly generated,
short-lived pinned playtest certificate, or a configured certificate/key pair.
For generated pinned certificates, a browser on localhost chooses the local UDP
endpoint even while sharing, avoiding a router NAT-hairpin requirement. Remote
browsers use the public endpoint. Custom CA certificates retain their public URL.
The old `/socket` route is not used. Invitation secrets remain in URL fragments and
are submitted in the join message, not query strings.

### Local play after build verification

Use Node 22.12+ and a recent Rust toolchain. In a checkout with this overlay applied:

```sh
ppnpm install --frozen-lockfile --frozen-lockfile
ppnpm run fixtures:check
pnpm run typecheck
cargo test --workspace
pnpm run build
pnpm start
```

See [VALIDATION.md](VALIDATION.md) for observed results. Regenerate fixtures with `ppnpm run fixtures` only when changing the motor, and verify Rust parity afterward.

The launcher binds both services to loopback in non-share mode, overriding public
bind settings inherited from .env. Default frontend: http://127.0.0.1:3000;
WebTransport: https://127.0.0.1:4433/echo over UDP. Browser certificate pin support
must be tested on the actual browser. Refresh after a server restart rotates pins.

### Friends connecting over the Internet

A frontend HTTPS link alone is insufficient for this HTTP/3/UDP implementation.
The existing Cloudflare Quick Tunnel publishes the frontend/API, not the game's
UDP listener. This is a deliberate deployment change from the previous WebSocket
setup, not a transparent tunnel replacement.

Arrange a reachable UDP endpoint (for example router UDP forwarding to the host,
or an appropriate UDP relay), then explicitly configure and invoke sharing:

```sh
# Replace with your own reachable UDP hostname/address. Shell example, not a real endpoint.
ECHO_WT_PUBLIC_URL=https://YOUR-UDP-HOST:4433/echo pnpm run share
```

Sharing binds WT to 0.0.0.0 by default, starts a frontend-only cloudflared tunnel,
and requires its URL to be registered before printing an invite. Missing/loopback
public WT configuration is rejected before starting a tunnel. Preflight validates
configuration; it cannot prove external UDP reachability. Test from an external
network before inviting friends. CGNAT and firewall restrictions may require a
relay instead of router forwarding. Do not expose a development/source server.

For a container, UDP 4433 must be published explicitly in addition to the frontend
TCP port, and ECHO_WT_HOST must bind an appropriate interface. Compose publishes both ports on loopback by default, and the image binds UDP inside the container. Public container hosting needs deliberate external UDP publishing. The Linux image build and browser QUIC smoke test passed; see [validation results](VALIDATION.md).

Environment variables added:

- ECHO_WT_HOST / ECHO_WT_PORT: bind interface/UDP port.
- ECHO_WT_PUBLIC_URL: reachable browser WT URL ending in /echo.
- ECHO_TLS_CERT / ECHO_TLS_KEY: both PEM paths, or neither for pinned playtest TLS.
- ECHO_BALANCE_FILE: complete balance JSON override.

Keep existing ALLOWED_ORIGINS, ECHO_ACCESS_KEY and ECHO_CONTROL_TOKEN boundaries.
An Origin must match an allowed exact origin or the registered frontend URL.

## Technical references

- MDN WebTransport: https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
- MDN constructor / certificate hashes: https://developer.mozilla.org/en-US/docs/Web/API/WebTransport/WebTransport
- wtransport 0.7.2: https://docs.rs/wtransport/0.7.2/wtransport/
- Cloudflare published-application protocols: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/protocols/
