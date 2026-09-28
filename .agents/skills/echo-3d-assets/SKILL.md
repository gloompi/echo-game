---
name: echo-3d-assets
description: Create or remake Echo 3D art in Blender — player characters, props and playable world maps — from a brief through references, staged modeling with render-vs-reference review, GLB export, validation and game integration. Use for any new or improved character model, map/environment model, prop, rig or animation for this repository.
---

# Echo 3D asset production

Produce a game-ready asset whose quality is proven by evidence, not by a single attractive
render. Read root `AGENTS.md`, `assets-src/AGENTS.md`, `public/AGENTS.md` and
[docs/3D_ASSET_PIPELINE.md](../../../docs/3D_ASSET_PIPELINE.md) first. Integration code
changes then follow the [echo-change](../echo-change/SKILL.md) workflow.

## Quality bar

The existing Blender worlds (`mirror-yard`, `neon-carnival`) and the procedural characters
in `client/models.ts` are **not quality references**. They are being replaced by better
versions. Use them only for technical contracts: coordinate mapping, `map.json` schema,
collider tagging, export settings and runtime loading. Do not copy their proportions,
detail density, materials, lighting or layout as a target. The approved brief and
reference pack define the target; review against those.

## Non-negotiables

- Keep role identity unless the brief explicitly changes it: hooded Hider (`hider-hoodie`),
  blue armored Seeker, orange blaster, cyan/magenta art direction (root `AGENTS.md`). "Better"
  means higher craft within that identity, not a different game. If a brief conflicts,
  surface the conflict before modeling.
- Art never owns authority. Collision comes from `map.json` boxes; hits use the server
  capsule (`shared/rules.json` radius/height), never the mesh.
- Game space is metres, +Y up, characters face +Z, origin at the feet. Blender authoring
  maps game `(x, y, z)` to Blender `(x, -z, y)`; the glTF exporter converts back.
- The editable source (`.blend` plus its authoring script) lives in `assets-src/`; only the
  runtime GLB goes to `public/assets/`. Never put private sources or credentials in
  `public/`.
- Live Blender MCP edits are exploration. An accepted change counts only when it is carried
  into the authoring script or the saved source and re-exported.
- A paid generation needs the brief's budget. Save every job ID immediately; resume a slow
  job instead of resubmitting it (see the reference pack guide).
- Report what was actually verified. Renders are not in-game proof; a valid GLB is not an
  integrated asset.

## Workflow

1. **Brief.** Require a brief using [templates](references/brief-templates.md). Fill obvious
   gaps with stated defaults; ask only about decisions that change the result (identity
   changes, mesh route, paid budget, which map ID it replaces). Save it as `brief.md` in the
   asset folder.
2. **Reference pack.** Build or collect references before modeling:
   [reference-pack.md](references/reference-pack.md). Get the user's approval of the hero
   concept before generating turnarounds or part sheets.
3. **Build in passes** with the render-and-compare loop:
   [review-loop.md](references/review-loop.md). Asset-specific contracts:
   [character.md](references/character.md), [world-map.md](references/world-map.md).
4. **Export and validate** the runtime GLB from a clean reimport:
   `scripts/blender/validate_glb.py`, then the repository tests.
5. **Integrate** through `echo-change` on a feature branch: register the asset, add or
   update tests, run `pnpm verify`, and capture real in-game screenshots with the browser.
6. **Hand off** with the evidence list in [review-loop.md](references/review-loop.md#hand-off).

## Tools

| Need                                                         | Tool                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Drive the open Blender 5.2 live (inspect, build, screenshot) | Blender MCP (`mcp__Blender__*`)                                                 |
| Headless reproducible build                                  | `blender --background --factory-startup --python-exit-code 1 --python <script>` |
| Fixed review views + comparison sheet                        | `scripts/blender/review_renders.py`                                             |
| Clean-reimport budget/contract gate                          | `scripts/blender/validate_glb.py`                                               |
| Concept/turnaround images, image-to-3D                       | `higgsfield-generate` skill / Higgsfield CLI; Higgsfield `generate_3d`          |
| In-game check                                                | `pnpm play` or E2E build + built-in browser                                     |

Commands in the references use `B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"`
(Git Bash). On this machine run Python helpers with `python`, not `python3`. The Blender MCP add-on and the
Higgsfield Blender plugin both default to port 9876; leave the Higgsfield plugin's MCP
option off while using the Blender MCP.
