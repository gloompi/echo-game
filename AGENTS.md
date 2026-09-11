# Echo engineering contract

## Gameplay authority

- Room delay is host-configurable from 0 to 10000 whole milliseconds, immutable during a hunt. Default 3000. Only Hiders are delayed for Seekers; allied Seekers and self movement are live.
- The Rust server samples and withholds Hider poses. Never send current hidden Hider transforms through debug fields, roster, scene objects, shadows or spatial events. Missing history must not fall back to current poses.
- Shots test PRESENT authoritative positions, not historical echoes. Do not add a generic lag-compensation rewind that undoes Echo's mechanic.
- Keep `shared/rules.json` and `shared/arena.json` authoritative for shared tunings/colliders. Changes to either motor must update/review JS-generated fixtures and pass Rust parity tests. This is currently a TS/Rust port, not one shared WASM motor.
- Preserve the existing striped blocky Hider, blue armored Seeker, orange blaster and cyan/magenta arena. Renderer/UI changes must not own game authority.

## Workflow and verification

The game runtime is `crates/echo-server`; Node is frontend/build/launcher tooling only. Use the repository's test/build commands and real multi-client browser checks. Verify new crate and npm versions against primary documentation when changing dependencies. Keep real generated lockfiles once a dependency-enabled installation has resolved them; never invent a lockfile or report an unexecuted build/test as successful.

Use a feature branch for an unverified migration and do not force-push user work. The authoring environment lacked Rust and registry network access. At that point only 33 JS logic tests, six regenerated fixture scenarios, a mock-service launcher lifecycle test, limited strict typechecking and syntax checks were executable; Rust/live WebSocket/WebGL/Docker/tunnel validation remained pending. Update this status only with observed evidence.

`npm run play` binds loopback. Only explicit `npm run share` starts a public tunnel, and it publishes the built app port, never Vite or the source tree. Do not commit access keys, `.env`, control tokens or tunnel credentials. Keep the public invite key fragment intact across copy/rejoin flows. A PC-hosted tunnel is for private playtests, not production uptime or a zero-lag guarantee.
