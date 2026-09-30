# In-game check

```text
Date: 2026-09-28. Branch feat/hider-hoodie-in-game (on art/hider-hoodie 2ec57b9), uncommitted.
Build: Vite dev client and the debug Rust server from this worktree; runtime GLB unchanged
  (sha256 89aff366cd77...).
Capture: Chromium through Playwright, 1440x1100 at device scale 2, SwiftShader software
  rendering, the game's own lights and ACES tone mapping. Scripted inputs, no hidden-state hooks.
```

## Sheets

- `motion.png`: the Hider's own third-person view in a two-player room (idle Seeker host, no
  bots): idle, two run strides, jump, a standing wave, the wave over a strafe run, crouch
  idle, crouch walk and slide. The echo ghost overlaps the idle frame at the spawn and trails
  the crouch frames 3 s behind, still replaying the wave.
- `skins.png`: the menu stage Hider in all eight skins, chosen with the settings skin select.
  Only the hoodie changes; logos, trims, joggers and sneakers keep their colours.
- `views.png`: the menu stage with the echo ghost at its new place right of the Seeker, and
  a Seeker's view in practice of a bot Hider 3 s in the past (`Wrong Turn / −3s`), seen from
  the front.

## Observations

- Under the game's lighting the hoodie, black joggers and cyan trims read as in the pass-4
  renders. The mask reads as a black face covering under the brim; the cyan trims are clear
  but show no visible glow at play distance.
- Run and crouch-walk playback follow the ground speed (0.5-2x). Foot sliding at game
  speeds was not measured.
- The ghost echo reads as the procedural ghost did: a pale cyan translucent figure with the
  magenta ground ring.

## Limits

- Software rendering ran at 4-11 fps with either Hider, so these frames show poses, not frame
  pacing. No GPU, low-end hardware or real-network play was checked.
- The browser E2E test (`tests/characters.e2e.ts`) repeats a shorter version of this in the
  production build; its screenshots stay in `test-results/`.
