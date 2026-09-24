# World map contract

A map is gameplay data plus art. The data is authoritative and shared by the TypeScript and
Rust motors; the art only has to match it. Re-read `shared/rules.json`,
`shared/movement.json` and `shared/physics.ts` for current values.

## Folder and build

```text
assets-src/worlds/<id>/
  brief.md  refs/  reviews/  <id>.blend  map.json  validation-glb.json
scripts/worlds/<id>.py              one reproducible script writes the .blend, map.json and GLB
public/assets/worlds/<id>.glb       runtime export only
```

Rerunning the script replaces its `.blend`, so every accepted change (including anything
tried live through the Blender MCP) must live in the script. The existing
`scripts/worlds/*.py` show the technical pattern (colliders tagged with `collisionId`,
`map.json` emission, export flags). Their art and layouts are not a quality reference.

## Collision data (`map.json`)

`{ id, name, half, recommended, description, theme, boxes, spawns, waypoints, mirrors,
landmarks }`, metres, game coordinates.

- `boxes`: `{ id, x, y, z, w, h, d, kind }`, axis-aligned only; `x/z` centre, `y` bottom,
  `kind` in `cover | platform | step`. No rotation, slopes or ramps; stairs are step boxes.
- `spawns`: clear standing positions spread for both roles (the map tests check clearance).
- `mirrors`: pairs `{ id, target, label, x, y, z, yaw, exit }`; exit 2.6 m in front of the
  mirror, clear of boxes. Mirror trigger radius is 1.8 m (`mirrorRadius`).
- `waypoints`: ground positions covering the routes; server bots patrol them
  (`crates/echo-core/src/room.rs`) and the route tests start from them.
- `landmarks`: `{ name, x, y, z }` labels for navigation callouts.
- `half`: square play-area half extent; player positions are clamped inside it.

## Movement metrics to design with

| Metric             | Value                                     | Source                                    |
| ------------------ | ----------------------------------------- | ----------------------------------------- |
| Automatic step-up  | 0.37 m                                    | `resolveCollision` in `shared/physics.ts` |
| Jump apex          | about 1.76 m (9.2² / (2 × 24))            | `jumpSpeed`, `gravity`                    |
| Standing clearance | 2.16 m + margin                           | `height`                                  |
| Crouch-only gap    | clear height > 1.12 m and < 2.16 m        | `crouchHeight`                            |
| Body diameter      | 0.72 m; make passages at least 1.2 m wide | `radius`                                  |
| Eye height         | 1.76 m standing, 0.92 m crouched          | `eye`, `crouchEye`                        |

Use stair steps of 0.30-0.35 m rise. Design for Echo's mechanic: Seekers see Hiders with a
delay, so long clean sightlines favour Seekers and loops with breakable line of sight favour
Hiders. Provide route choice, vertical options, crouch escapes and mirror shortcuts; avoid
dead ends and spots where a player is invisible from every angle.

## Art rules

- Each collider gets exactly one visible mesh tagged `collisionId` whose bounds equal its
  box within 2 mm. Put bevels, trims, signage and props in separate untagged decorative
  objects that stay within or flush to the solids (no decorative geometry that looks walkable
  or solid where there is no collider, and no invisible walls).
- Budgets (tests/world-exports.test.ts): under 180k triangles, under 350 mesh objects, under
  12 MB GLB. Target 150k / 300 so there is headroom. Merge static decoration by material.
- Export only runtime geometry: no cameras, lights or presentation backdrop
  (`export_cameras=False, export_lights=False, use_selection=True, export_extras=True`).
  The game provides its own lighting, so the map must read without baked presentation
  lights; use emission for signage.

## Order of work

1. Layout in the script: boxes, spawns, mirrors and waypoints only, emitted as `map.json`
   plus a graybox GLB. Register the map (below) and **playtest it in the game** with two
   clients before any art. Iterate the layout until routes, heights and sightlines work.
2. Art passes 3-6 of the review loop on top of the approved layout. Layout edits after
   approval restart the gameplay checks.

## Validate and register

```bash
"$B" --background --factory-startup --python-exit-code 1 --python scripts/worlds/<id>.py
"$B" --background --factory-startup --python-exit-code 1 --python scripts/blender/validate_glb.py -- \
  --glb public/assets/worlds/<id>.glb --kind world --map assets-src/worlds/<id>/map.json \
  --out assets-src/worlds/<id>/validation-glb.json
```

A new map ID must be added everywhere the existing authored maps appear:
`shared/settings.ts` (`MAP_IDS`), `crates/echo-core/src/world.rs` (`MapId` enum and name),
`scripts/build-maps.mjs` (authored list), `client/world-assets.ts`,
`tests/world-exports.test.ts`, `tests/worlds.e2e.ts`, the Rust gameplay test list, and
traversal fixtures in `scripts/gameplay-fixtures.ts` for its stairs and crouch routes. Then
`pnpm run maps`, `pnpm run fixtures`, inspect the generated diff, and `pnpm verify`.
Replacing an existing map keeps its ID and updates the same tests and fixtures. Follow
`shared/AGENTS.md`: never hand-edit generated fixtures.
