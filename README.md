# ECHO

**The Seeker sees 3 seconds in the past.**

A browser-based, asymmetric multiplayer arena prototype built with Three.js, TypeScript, and an authoritative Node.js server. Hiders wear blocky striped shirts; seekers wear blue armor and carry orange toy blasters. The arena uses cyan/magenta lighting, cover, stairs, and elevated routes.

## Run locally

Install Node.js **22.12 or newer**. Then:

```sh
git clone https://github.com/gloompi/echo-game.git
cd echo-game
npm install
npm run dev
```

Open **http://localhost:5173** in a desktop browser with WebGL2 enabled. Choose **Practice** for a solo room with bots, **Quick play** for a shared public room on this server, or **Create room** to invite friends. Private rooms wait for the host to start. A room supports up to eight participants, including bots. Bot fill brings small rooms to four players.

The repository is source code, not a hosted game. Players must connect to the same running server. On your LAN, friends open `http://YOUR-PC-LAN-IP:5173` while development mode is running. Copy the invite after opening that reachable address, not `localhost`. Internet friends need a reachable production server or a tunnel with WebSocket support. No paid deployment, tunnel, DNS change, or firewall change is provisioned by this repository.

## Production

```sh
npm run build
npm start
```

The production server serves the client and WebSocket endpoint from port **3000**. For an internet-facing deployment, place it behind HTTPS and forward WebSocket upgrades for `/socket`. Configure `ALLOWED_ORIGINS` with your exact public origin if the proxy rewrites the Host header. See `.env.example`; environment files are not loaded automatically. Set variables in your shell or hosting service.

An optional Dockerfile builds the same application. It has not been deployment-tested:

```sh
docker build -t echo-game .
docker run --rm -p 3000:3000 echo-game
```

GitHub Pages alone cannot host the authoritative Node/WebSocket server.

## Play

| Control | Action |
| --- | --- |
| WASD / arrows | Move |
| Mouse | Look; click **Enter arena** to capture the mouse |
| Shift | Sprint, consuming stamina |
| Space | Jump |
| Q | Hider dash |
| E | Wave — including in your delayed echo |
| Left mouse | Seeker blaster |
| R | Reload |
| Tab | Scoreboard |
| Escape | Release mouse / menu; the online round continues |

When mouse capture is unavailable, hold the right mouse button to look. This alpha targets desktop keyboard and mouse, not touch controls.

### The rule that matters

The server retains pose history and sends seekers other players' poses at **server time minus 3000 ms**. Seekers' own movement is predicted immediately. Other players' spatial effects and animations follow the delayed timeline too; live enemy coordinates are not sent as a hidden renderer state.

**Shots are checked against current server hitboxes and current cover. There is no three-second hitbox rewind.** Shooting an echo does not damage the player who has already left. A successful shot awards a tag; two tags catch a hider. Near-misses through a delayed ghost award the hider a bait, with a cooldown to avoid counting every bullet.

Hiders see live players and an optional translucent version of their own three-second-old pose. Other hiders remain solid, ordinary characters. Seekers also see solid delayed characters, not an additional live target. Network transit and a 100 ms interpolation buffer add to the perceptual delay; the rule is a 3000 ms **server holdback**, not a promise of exactly 3000 ms on screen over any connection.

Defaults: one seeker, a five-second hider head start, two-minute rounds, two-hit captures, 12-shot magazines, automatic rematches. Role preferences are hints, with seeker preferences taking priority. Automatic preferences rotate the seeker. Private-room late arrivals spectate until the next round; public quick-play arrivals enter as hiders.

## Development

```sh
npm test
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

A lockfile is intentionally **not fabricated**: dependency downloads were unavailable in the authoring environment. The first successful `npm install` creates `package-lock.json`; review and commit it, then use `npm ci`. CI already uses `npm ci` when a lockfile exists.

### Verification status of this initial implementation

- 33 simulation/protocol-validation tests were executed successfully after TypeScript transpilation with Node's native test runner.
- Shared simulation, room logic, validation, and those tests passed strict TypeScript checking using locally available Node definitions.
- All authored TypeScript files were checked for syntax during transpilation.
- The full dependency-backed build, WebGL rendering, browser tests, and live WebSocket transport were **not verified** in the authoring environment: npm registry access was unavailable, and the first GitHub Actions job stopped before any steps ran. The exact Actions failure cause was not exposed by the available connector.

The browser tests and CI workflow are included to finish that verification in a working Node environment. Treat this as an initial implementation, not a production-certified release.

## Structure

```text
client/       Three.js characters, arena, controls, HUD, audio, prediction
server/       WebSocket rooms, authoritative simulation and input validation
shared/       Protocol, fixed-step movement, collision layout and pose history
tests/        Simulation regression tests and Playwright browser checks
docs/         Architecture, constraints and a manual multiplayer playtest
```

See [architecture](docs/ARCHITECTURE.md) and [playtest checklist](docs/PLAYTEST.md). There are no accounts, database, analytics, matchmaking across separate server processes, paid assets, or external art/model downloads. All in-game meshes are procedural. The supplied illustration guided the character design; the image itself is not redistributed in this repository.
