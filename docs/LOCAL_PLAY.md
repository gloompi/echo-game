# Host a friends-only playtest from your PC

## Prerequisites

Install [Node.js](https://nodejs.org/en/download) 22.12 or newer, [Rust via rustup](https://rust-lang.org/tools/install/) and Git. On Windows, follow rustup's prompt to install the Visual Studio C++ build tools and Windows SDK. Restart your terminal after installations so `node`, `npm`, `cargo` and `rustc` are on PATH.

For public link sharing, also install [cloudflared](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). Verify `cloudflared --version` works. The launcher never downloads or silently installs an executable for you.

## Local only

From the repository root:

```sh
npm install
npm run play
```

The launcher prints `http://127.0.0.1:3000/` (or your configured PORT). Choose PRACTICE to play with bots. A loopback URL works only on your own PC; a friend cannot use your localhost address.

## Public invitation

```sh
npm run share
```

The launcher:

1. Builds the browser and Rust server, checks `cloudflared` and refuses an occupied port.
2. Starts only the built game server on `127.0.0.1:PORT`, not the Vite development server.
3. Starts a Quick Tunnel and registers the generated HTTPS origin with a loopback-only control endpoint protected by a random control token.
4. Prints a local URL and public URL, both carrying a playtest key in the URL fragment (`#key=...`).

Open the printed local URL to avoid routing your own connection through the tunnel. Create a private room, choose settings, and click COPY LINK. The client refreshes the public URL when copying, including when you joined before the tunnel became ready. Send this **complete room-specific link** privately to your friends. They can type a callsign, join the pre-filled room and play in their browsers. No client installation is necessary.

The public server URL without `?room=...` opens the main menu; COPY LINK adds the correct room. The fragment key is sent to the server in the WebSocket join message, not as an HTTP query string. It is not an account system or per-room identity. Every holder of the server key can create/join rooms on that playtest server. Treat the full link as a password; do not publish it on a public issue or commit it.

Keep the terminal, PC and Internet connection alive. Ctrl+C stops the server and tunnel. Sleep, restart or stopping the server ends every match. Disconnecting only the host's browser transfers lobby controls to another connected human; it does not migrate the authoritative server away from the host PC. Rejoining after a network loss creates a new player; session-resume is not implemented.

## Change defaults

Copy `.env.example` to `.env` using your editor or `cp .env.example .env` (`Copy-Item .env.example .env` in PowerShell). Set `ECHO_DELAY_MS` to a whole number from 0 to 10000. Room hosts can override it between rounds. A ten-second delay gets a ten-second head start so the delayed timeline can fill before the hunt.

For a persistent access key, set `ECHO_ACCESS_KEY` to a long random value in `.env`. Otherwise each `npm run share` invocation generates a new key. `.env` is gitignored and excluded from Docker builds. Plain `npm run play` is local-only and does not generate a key unless you set one. The launcher deliberately binds loopback regardless of HOST; direct native-server/Docker deployments use HOST from the environment.

After an existing build, `npm start` and `npm run share:built` skip rebuilding. Rebuild after source changes.

## Docker alternative (local)

```sh
docker compose up --build
```

This builds both languages inside containers and binds the web game to `127.0.0.1:3000`. Stop it with Ctrl+C, or `docker compose down` after detached use. The image runs the native Rust binary, not Node. This alternative does not automatically create a tunnel. The integrated `npm run share` route above is the supported one-command public-invite path.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `cargo` not found | Install Rust/rustup, restart the terminal, verify `cargo --version`. |
| Windows linker / `link.exe` missing | Complete Rust's Visual Studio C++ build-tools and Windows SDK prerequisites. |
| Missing cloudflared | Install the official package and add the executable to PATH. |
| Port busy | Stop the old instance, or choose another PORT in `.env`; do not publish an unknown existing process. |
| No public URL / Quick Tunnel fails | Check Internet/firewall access and cloudflared output. Cloudflare notes Quick Tunnels may conflict with an existing `.cloudflared/config.yaml`; review that configuration rather than deleting it blindly. |
| Friends see a key error | Resend the complete printed/copied invitation including `#key=...`; old keys stop working after restart unless configured persistently. |
| Room not found | Confirm the same current tunnel URL and room code; rooms are in-memory and vanish when the server stops or all humans leave. |
| Copy contains localhost | Ensure the tunnel URL was registered successfully and use COPY LINK again. Check `/api/config` on the local server for `publicUrl`; never manually share localhost. |
| WebSocket rejected behind another reverse proxy | Preserve the browser's Host header or configure exact ALLOWED_ORIGINS. Do not set a wildcard in production. |
| Stutter / high ping | Compare localhost, LAN and tunnel paths; stop bulk uploads, use Ethernet where possible, check GPU settings and server load. A tunnel is not a latency benchmark for a future regional server. |

Cloudflare [Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/) are intended for testing, use temporary generated hostnames, have no SLA and currently limit concurrent in-flight requests. [Cloudflare supports WebSockets](https://developers.cloudflare.com/network/websockets/), but connections can still be interrupted. Do not rely on a Quick Tunnel for a public production launch.
