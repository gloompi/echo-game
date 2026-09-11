# Playtest and verification checklist

## Automated gate

Run `npm run test:ts`, `npm run fixtures:check`, `cargo test --workspace`, `npm run build`, `npm run test:network`, and `npm run test:e2e` in a dependency-enabled checkout. The Rust suite covers current-hit/echo-miss semantics, delay boundaries including 0 and 10 seconds, host permissions, input limits, role rotation, capacity, history and JS motor parity. The network suite uses the real Rust binary and native Node WebSocket clients. Browser checks use the real production client, WebGL, two independent contexts and the Rust server.

The offline authoring environment passed 33 JS logic tests and regenerated/checked six motor scenarios; a mock-service launcher lifecycle test also passed. Full Rust, frontend build, socket, browser, Docker and public-tunnel checks were not run there. Do not count checked-in tests as passed merely because they exist. See CI for the next verification result.

## Two-person functional playtest

Create a room, disable bots, choose one Seeker and a 1.25s delay. Join from a second browser or PC. Confirm the friend cannot change host settings. Start the round, move the Hider, and verify the Seeker sees the earlier route while the Hider sees live Seeker movement. Check HUD and nameplates show the configured delay. Wave and dash; no spatial effect should reveal an unreleased live Hider transform.

Fire at the echo after the real Hider moves aside: miss plus echo feedback. Predict the real location: current hit. Check wall blocking, two-hit capture, reloads, dash-wall collision, jumps, stairs and camera collision. Test zero, three and ten-second delays in separate rounds; ten seconds gets a sufficiently long head start. Results must return to the lobby, preserving session scores, not immediately restart before settings can be changed.

Use the host's pause-menu return-to-lobby button during a round. Both clients should unlock the mouse and enter the lobby. Change settings and restart without interpolating between old and new timelines. Disconnect the host's browser and confirm the next human gets host controls. Stop the server and confirm clients report connection loss; resuming an old player session is not implemented.

## Friends-over-Internet check

Use `npm run share`, open the local URL before or after the tunnel is ready, then create a room and copy its link. Confirm the copied origin is the public tunnel rather than localhost and the fragment key is retained. A friend on another Internet connection should join directly in a desktop browser. A missing/wrong key should produce an actionable error. Stop the terminal and confirm the public game stops.

Join up to twelve clients (host included); the thirteenth must be rejected without affecting the room. Try Wi-Fi, background-tab pause/resume and moderate network jitter. Measure FPS, ping, corrections and browser/server CPU. Compare direct localhost with tunnel play before drawing conclusions about WebSocket suitability. Do not promise lag-free play based on a transport or a tick-rate number alone.
