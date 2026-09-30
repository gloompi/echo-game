# 3D asset pipeline

How new characters, props and world maps are produced for Echo. The agent workflow lives
in [`.agents/skills/echo-3d-assets`](../.agents/skills/echo-3d-assets/SKILL.md); this page
records the tools, folders and commands it relies on.

The current Blender worlds and procedural characters are technical baselines, not quality
references. New assets are judged against their approved brief and reference pack.

## Flow

1. **Brief**: asset ID, identity to keep, style, budgets, mesh route, "done means". Templates:
   [brief-templates.md](../.agents/skills/echo-3d-assets/references/brief-templates.md).
2. **References**: user images or Higgsfield-generated concepts, then turnarounds from the
   approved concept, recorded in `refs/provenance.json`.
3. **Generate, then passes live**: the Higgsfield plugin generates the mesh into the open
   Blender (auto-rigged characters; map props extracted from the concept sheets), then the
   agent cleans it up through the Blender MCP, one visible step at a time with viewport
   screenshots: blockout, structure, form, material, rig/motion (characters) or dressing
   (maps), optimize. Every pass renders fixed views and a reference comparison sheet and
   records a review decision. Maps are playtested as a graybox before art.
4. **Export and validation**: clean reimport of the runtime GLB against budgets and contracts.
5. **Integration**: registration, tests, `pnpm verify`, in-game screenshots (feature branch).

## Folders

```text
assets-src/<characters|worlds|props>/<id>/   brief.md, refs/, reviews/, <id>.blend, reports
assets-src/<...>/<id>/build-log.py         accepted live-modeling steps
scripts/worlds/<id>.py                      map layout: map.json and tagged colliders
scripts/blender/                            shared review and validation tools
public/assets/<characters|worlds>/<id>.glb  runtime exports only (publicly served)
```

## Tools

| Tool                                                        | Use                                                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Blender 5.2 LTS                                             | Live authoring; background only for review/validation: `/c/Program Files/Blender Foundation/Blender 5.2/blender.exe` |
| Blender MCP (Blender Lab add-on + Claude Desktop extension) | Live scene inspection, edits, screenshots from an agent; server on `localhost:9876`                                  |
| Higgsfield CLI and skills                                   | Concepts, turnarounds, cost estimates, prompted extraction and job recovery within the brief's credit budget         |
| Higgsfield Blender plugin + hosted connector                | In-scene 3D generation, auto-rig, remesh (`bl_*` tools); connects out to its bridge, runs alongside the Blender MCP  |
| `scripts/blender/review_renders.py`                         | Fixed review views and `sheet.png`                                                                                   |
| `scripts/blender/validate_glb.py`                           | Budget and contract gate on a clean reimport                                                                         |

`scripts/blender/` is Python run inside Blender. It is not covered by the Node/TypeScript
lint and test gates, so each tool reports its own failures through a nonzero exit code.

## Commands

```bash
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"

# Review renders from a source .blend or an exported GLB, with reference images.
"$B" --background --factory-startup --python-exit-code 1 --python scripts/blender/review_renders.py -- \
  --blend assets-src/characters/<id>/<id>.blend --kind character \
  --out assets-src/characters/<id>/reviews/pass-1-blockout --reference <ref.png>

# World review views from spawns in map.json.
"$B" --background --factory-startup --python-exit-code 1 --python scripts/blender/review_renders.py -- \
  --glb public/assets/worlds/<id>.glb --kind world --map assets-src/worlds/<id>/map.json \
  --out assets-src/worlds/<id>/reviews/pass-3-form

# Validate a runtime export.
"$B" --background --factory-startup --python-exit-code 1 --python scripts/blender/validate_glb.py -- \
  --glb public/assets/characters/<id>.glb --kind character \
  --clips idle,run,jump,crouch_idle,crouch_walk,slide,hit,wave --out <report.json>
```

Review views: characters get orthographic front/right/back/left, a three-quarter view and
gameplay views at about 9 m and 3.5 m from another player's eye (1.76 m, 72 degree vertical
FOV as in `client/main.ts`). They draw two guides: the movement cylinder as a magenta wire
(radius and height from `shared/rules.json`) and the shot hit box as yellow dashes (±0.38 m
in x/z from 0.08 m to 2.16 m, copied from `player_ray_crouched` in
`crates/echo-core/src/physics.rs`). Movement uses the cylinder, shots test only the box, and
neither uses the mesh. Props get only the cylinder, for scale. Worlds get a square plan, four
elevated corners and four eye-level views from `map.json` spawns. Renders use a neutral light
rig and the `Standard` view transform; the game uses its own lighting and ACES tone mapping,
so in-game screenshots remain required.

## Budgets enforced by `validate_glb.py`

| Kind      | Triangles (target / hard) | Other hard limits                                                                                                                    |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| character | 10k / 15k                 | 8 materials, 64 bones, 4 influences, 2048 px textures, 6 MB, height 85-110% of 2.16 m, feet at origin, `crouch*` clips within 1.12 m |
| prop      | 3k / 6k                   | 4 materials, 1024 px textures, 2 MB, base at origin                                                                                  |
| world     | 150k / 180k               | 350 meshes, 12 MB, collider visuals match `map.json` within 2 mm, no cameras or lights                                               |

World limits mirror `tests/world-exports.test.ts`, which stays the authoritative gate for
registered maps. Character and prop limits are project policy for up to 12 on-screen players.

## Verification record, 24 September 2026

Blender 5.2.0 LTS on Windows, run headless against this revision's tools:

- `validate_glb.py` on `public/assets/worlds/mirror-yard.glb` with its `map.json`: passed,
  76,832 triangles, 222 collider visuals matched. Against a copy of the map with one box
  moved 5 cm and one removed, and with `--kind prop`: exited 1 listing every failure.
- A disposable six-bone test character with `idle`, `run` and two crouch clips: passed
  skin, clip and height checks (2.0 s and 1.0 s clips reported correctly). A missing
  required clip and a 1.35 m crouch pose each failed as expected; a 1.05 m crouch passed.
- `review_renders.py` produced all world views (from spawns) and all character views plus
  contact sheets with a reference row.

No new character or map has been produced with this pipeline yet, and no loader for
skinned GLB characters exists in the client.

Update, 28 September 2026: `hider-hoodie` (`assets-src/characters/hider-hoodie/`) was
produced with this pipeline and is the in-game Hider. The client loads skinned GLB characters
through `client/character-assets.ts`; the Seeker is still procedural.

Update, 30 September 2026: the in-game Hider and Seeker are now generated with the Higgsfield
route (picture, image-to-3D mesh, live cleanup, auto-rig, clips keyed live in Blender):
`assets-src/characters/hider-hoodie/body-gen/` and `seeker-hunter/body-gen/`. The Seeker's four
weapons (`seeker-hunter/weapons-gen/`, runtime GLBs in `public/assets/weapons/`) share one grip
layout, so one clip set holds each of them. Each folder's `manifest.json` records every job ID.

## Verification record, 25 September 2026

Hit-box guide, Blender 5.2.0 LTS headless on Windows: `review_renders.py` rendered the Hider
and Seeker GLBs exported by the `codex/character-fidelity` work (not committed to this
repository) with both guides. Measured in the scene, the cylinder had a 0.36 m radius over
0-2.16 m and the box ±0.38 m over 0.08-2.16 m. Prop views drew only the cylinder;
`--no-guides` and the `mirror-yard` world views drew none.
