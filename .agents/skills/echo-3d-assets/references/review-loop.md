# Build passes and the render-and-compare loop

Sculpt in order and prove each pass against the references before starting the next.
One-shot modeling followed by one flattering render is the failure mode this loop
prevents.

## Passes

| Pass             | Character                                                 | World map                                                               |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1 Blockout       | Proportions, head:body ratio, silhouette in the guides    | Graybox from `map.json` colliders only; **playtest in game before art** |
| 2 Structure      | Part breakdown, joints, pivots, clean topology            | Routes, cover rhythm, heights, crouch/jump spaces, mirrors              |
| 3 Form           | Bevels, secondary shapes, face features, readable details | Architecture kit, silhouettes of landmarks, skyline                     |
| 4 Material       | Palette, tint regions, roughness/emission, texture if any | Material zones, signage, emissive accents in cyan/magenta               |
| 5 Rig and motion | Skeleton, weights, clip set, loops (character only)       | Lighting-independent readability, decals, decorative props              |
| 6 Optimize       | Budget, merges, LOD if needed, export                     | Instancing/merging to mesh budget, export                               |

Work only on the current pass. If a later pass exposes an earlier flaw, go back to that
pass explicitly and say so in the review record.

## Each pass

1. Generate or fix live in the open Blender through the MCPs, step by step with viewport
   screenshots ([live-blender.md](live-blender.md)), and save the `.blend`.
2. At the end of the pass, render the fixed views from the saved file:

   ```bash
   B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
   "$B" --background --factory-startup --python-exit-code 1 \
     --python scripts/blender/review_renders.py -- \
     --blend assets-src/characters/<id>/<id>.blend --kind character \
     --out assets-src/characters/<id>/reviews/pass-3-form \
     --reference assets-src/characters/<id>/refs/01-front.png \
     --reference assets-src/characters/<id>/refs/02-side.png
   ```

   Use `--glb` for the exported runtime model and `--kind world --map <map.json>` for maps
   (plan, four elevated corners, eye-level views from spawns). Character views draw the
   movement cylinder as a magenta wire and the shot hit box as yellow dashes; prop views
   draw only the cylinder, for player scale. `--no-guides` hides them.

3. Look at `sheet.png` and the individual views at full size. Compare like with like:
   front render against front reference, side against side.
4. Write `reviews/<pass>/review.md`:

   ```text
   Pass: 3 form            Source: <file + commit or hash>
   Decision: continue | refine | request-input
   Overall match: 0-10
   Feature checks (identity-defining, max 8):
     - striped shirt: 3 stripes, width and spacing match front ref .... pass
     - head:body ratio 1:2.1 vs ref 1:2.0 .............................. pass
     - Seeker visor reads from gameplay-9m view ........................ FAIL
   Evidence: sheet.png, gameplay.png
   Next change: <smallest concrete edit>
   ```

   A failing identity feature blocks `continue` even when the overall match looks fine.
   Name concrete evidence ("arms 20% too long in side view"), never "looks better".

5. Budget: at most 3 refine rounds per pass and 6 for the whole asset. When exhausted,
   stop and show the user the sheet, the failing checks and the options.

## Game-specific checks

- **Gameplay readability.** Judge `gameplay.png` (about 9 m, game FOV) and
  `gameplay-near.png`: role must read instantly at 9 m; the Seeker and the Hider must never
  be confusable by silhouette alone.
- **Cylinder and hit-box fit.** Head and torso inside the magenta movement cylinder, which
  keeps them inside the yellow hit box at every facing; limbs and gear may extend slightly
  (target at most 0.15 m). Hits feel fair when the silhouette stays close to the box:
  shots pass through parts outside it and still hit its empty corners, which show best in
  the three-quarter and gameplay views. Details in
  [character.md](character.md#movement-cylinder-and-hit-box).
- **Maps.** Eye-level views must show cover that hides a standing player (2.16 m) or a
  crouched one (1.12 m) on purpose, not accidentally. Look for accidental hiding holes, props
  that clip through colliders, and light/emissive noise that makes players hard to see.
- Existing Echo assets are not the quality target (see SKILL.md).

## Hand-off

Deliver, with paths:

- `brief.md`, `refs/` with `provenance.json`, approved references marked.
- Editable source (`.blend` + authoring script) and the runtime GLB.
- Final `reviews/<pass>/sheet.png` and `review.md` for every pass.
- `validate_glb.py` report (`--out assets-src/.../validation-glb.json`).
- Repository checks actually run (`pnpm verify` result) and in-game screenshots.
- Open issues and what was not verified (for example public-network play).
