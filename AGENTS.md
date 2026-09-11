# ECHO development rules

- Preserve the core information boundary: seekers receive other players' poses and spatial effects only after 3000 ms. Never add live remote transforms to a seeker's payload, debug HUD, minimap, label, collision response, sound cue or hidden render object.
- Test shots against present authoritative hitboxes. Do not add historical hitbox rewind as a generic latency fix.
- The shared map and movement implementation are authoritative for both prediction and server collision. Clients do not choose dt, position, ammo, role or hit results.
- Keep art direction: striped blocky hiders, blue armored seekers, orange toy blasters, cyan/magenta arena. The source illustration is a reference, not an in-game asset.
- Run npm test, npm run typecheck, npm run build and browser tests when dependencies are available. State exactly what was not tested. Never fabricate a package lock, green CI status, live deployment or screenshot.
- First follow-up: resolve dependency installation, generate and commit package-lock.json, finish WebGL/two-client testing. See README verification status and docs/PLAYTEST.md.
- Preserve user work. Inspect current repository state before writes; do not force-push. Keep modules typed and avoid unexplained external assets or paid services.
