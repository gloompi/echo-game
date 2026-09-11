# Echo — Be here. Seen later.

A browser party hunt for **2–12 players**. Hiders are fully visible, but Seekers receive their poses on a configurable **0–10 second server holdback**. Your own movement is predicted locally; shots hit current authoritative positions, not echoes.

This branch replaces the Node game server with **Rust (Axum + Tokio)** while retaining the Three.js characters, arena, audio, controls and survival mode. Node is used for frontend tooling and the cross-platform launcher, not the game simulation.

## Play on your PC

Install Node.js 22.12+ and stable Rust/Cargo, then:

```sh
npm install
npm run play
```

Open the local URL printed by the launcher. Use **PRACTICE** for bots or **CREATE A ROOM** for friends.

To publish a temporary invite without deploying a permanent server, install `cloudflared` and run:

```sh
npm run share
```

The launcher builds the client and Rust server, starts both game HTTP and WebSocket traffic on one loopback port, launches a Cloudflare Quick Tunnel, and prints local and public URLs. It generates a random playtest access key unless `ECHO_ACCESS_KEY` is already configured. Open the local URL, create a room, then use **COPY LINK** for the public room-specific invitation. Keep the PC and terminal running. Ctrl+C stops both processes.

Friends need only the complete invitation and a desktop browser with keyboard and mouse. They do not need Rust, Node, cloudflared, port forwarding or a VPN.

See [local hosting and troubleshooting](docs/LOCAL_PLAY.md), including Windows prerequisites and a Docker alternative. Quick Tunnels are a development convenience, not a production hosting/SLA solution.

## Change the game settings

The host can edit **Echo delay**, **round length** and **Seeker count** in the lobby. Defaults: 3 seconds, 180 seconds, two Seekers (clamped so at least one Hider remains). The UI uses 0.25-second delay steps; the protocol/environment support whole milliseconds.

Settings are validated by the server and cannot change during a hunt. Results return to the lobby; the host starts the next round. The host can also use **Esc → END ROUND / ROOM SETTINGS** to stop a playtest and retune it. Up to 12 players includes the host.

Copy `.env.example` to `.env` to change defaults for newly created rooms:

```dotenv
ECHO_DELAY_MS=1250
ECHO_ROUND_MS=180000
ECHO_SEEKERS=2
PORT=3000
```

Zero disables the special Echo holdback, not ordinary Internet latency. The display also uses a 100 ms interpolation buffer. Do not interpret the setting as a guaranteed end-to-end on-screen age.

## Development and verification

```sh
npm run dev             # Rust server + Vite; no public tunnel
npm run build           # Typecheck, browser production build, Rust release binary
npm start               # Run an existing build locally
npm run share:built     # Publish an existing build through a temporary tunnel
npm run test:ts         # Browser-side rules, movement, transport/connection tests
npm run test:launcher   # Launcher lifecycle test with mock services (POSIX)
npm run fixtures:check  # JS motor must reproduce checked-in parity fixtures
cargo test --workspace  # Rust rules, delay boundaries, hits, permissions, motor parity
npm run test:network    # Actual Rust HTTP/WebSocket integration; build client first
npm run test:e2e        # Actual two-browser WebGL flow; build first
```

For browser tests, install Chromium once with `npx playwright install chromium` (CI uses `--with-deps`). No database or paid backend service is required by this implementation. Dependency installation requires access to npm and crates.io. Commit **real generated** `package-lock.json` and `Cargo.lock` after a successful dependency-enabled build; neither should be fabricated. CI retains generated lockfiles as artifacts for review.

## Code layout

```text
client/                     Three.js rendering, DOM UI, audio, input, networking
shared/rules.json            One set of numeric tunings for TS and Rust
shared/arena.json            One collision layout/spawn list for TS and Rust
shared/physics.ts            Browser prediction motor
shared/settings.ts          Room-setting validation and labels
crates/echo-core/            Engine-independent Rust simulation and rules
crates/echo-server/          HTTP, WebSockets, room lifecycle and fixed-step loop
scripts/play.mjs             Local/public playtest launcher
scripts/movement-fixtures.ts Cross-language movement fixture generator
```

[Architecture and timing contract](docs/ARCHITECTURE.md) · [Playtest checklist](docs/PLAYTEST.md) · [Asset portability](assets-src/README.md)

## Scope and validation status

Included: Rust authoritative rooms; current-position hits; server-held Hider history; live allied Seekers; local prediction/reconciliation; 60 Hz simulation and 20 Hz snapshots; bounded input/output queues; lobby configuration; private-room invites; practice bots; host transfer; local/temporary-public hosting; automated regression suites.

This is still the existing survival game, not the later Signal Heist/objective mode. WebTransport, Rapier/WASM-shared movement, React UI conversion, persistent accounts, reconnect/resume, full GLB animation authoring and a native-engine client are **not implemented** here. The existing collider motor is ported and covered by cross-language fixtures rather than changing movement engines during the server migration. No zero-lag guarantee is made.

At authoring time, 33 browser-side logic tests and the six JS fixture scenarios passed in an offline check using TypeScript 5.8.3. A launcher lifecycle integration test using mock server/tunnel processes also passed. The full dependency-backed frontend build, Rust compilation/tests, real socket/browser integration, Docker build and a live Internet tunnel were not executable in that environment. CI and the commands above are the remaining verification gate; do not treat this branch as a verified release until those pass.
