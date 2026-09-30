# Pass 4: material

```text
Pass: 4 material        Source: scripts/characters/hider_hoodie.py --stage material
                        (script sha256 0839acbdb470..., preview GLB sha256 aa5a69d84589...,
                        438,972 bytes; uncommitted, branch art/hider-hoodie). Rebuilding
                        gives the same GLB byte for byte (r1). The structure stage still
                        rebuilds the pass-2 GLB (e49eec7504fb).
Decision: continue; end of Phase 3. The next pass (5, rig and motion) waits for the user.
Overall match: 8/10 (colour and value as in the sheet; the mask reads as a dark void under
               the brim in the review light, see the notes)
Feature checks:
  - flat faceted colours as in the sheet: five flat materials, no textures, flat shading.
    In the front view, lit facets of the render against the sheet's (palette.png):
    * hoodie: delta E 6.5 (render L* 89 against the sheet's 88);
    * black: delta E 6.7 (L* 23 against 29);
    * cyan: delta E 6.8 (L* 68 against 72.5; 18.1 before the emission);
    * skin: delta E 8.5 (L* 63 against 70; the shin catches less of the review light).
    White is compared on the sneaker close-ups: the sheet's dim panel shows L* 75, ours
    88 ................................................................................ pass
  - hoodie on tint_light: hood, hoodie body, sleeves and kangaroo pocket use tint_light,
    authored in the approved classic colour #EBE3D8. The runtime recolours it per skin
    (brief table) ..................................................................... pass
  - cyan logos and trims slightly emissive: cyan #3CB9C4 with emission strength 0.35 (the
    glTF emissive factor is the base colour x 0.35). The glow shows on the cap, bag and
    sole triangles, the glove H, hem, cuffs, straps, drawstrings and sneaker panels, and
    the facets still read ............................................................. pass
  - joggers, mask and bag stay black: one black #2E2F35 (roughness 0.72), lifted from
    #2B2C31 toward the sheet's lit facets. Cap, mask, bag, harness, gloves, joggers, socks,
    treads and shank use it ........................................................... pass
  - R1 (hoodie base L* >= 50 on every skin) and R2 (blues L* >= 65): the brief's skin table
    (lowest ember 51, cobalt 68). Rendered at 9 m, the hoodie measures L* 50-76 from the
    front and 43-67 from behind ....................................................... pass
  - R3 against the procedural Seeker (client/models.ts rebuilt block by block, with its
    armour recoloured per skin, outline hulls, aim pose and orange blaster):
    * 8 skins at 8.75 m, from the gameplay camera and from behind, in colour and
      greyscale (r3-9m-front.png, r3-9m-behind.png);
    * the Hider's upper body is 26-56 L* lighter than the Seeker's in every skin and view
      (smallest: ember from behind, 42.7 against 17.1);
    * silhouettes differ at a glance: slim hood and brim against a broad helmet and
      shoulders, and no weapon against the orange blaster ........................... pass
  - seeker-hunter side by side at 9 m (seeker-hunter-9m-front.png, -behind.png):
    * the other session's pass-1 blockout GLB, imported read-only from its worktree, as
      exported (black suit, red accents, T visor, no blaster yet), beside the Hider in all
      8 skins;
    * both are hooded, so value carries the read: the Hider's upper body is 22-54 L*
      lighter (smallest: ember and violet from behind, 42.7 and 43.9 against 20.5);
    * from behind, the black bag sits framed by the light hood and hoodie, where
      seeker-hunter shows a black back plate on a black suit;
    * they can't be confused. The narrowest pair is the ember or violet Hider against
      seeker-hunter seen from behind: a mid-grey top over black legs against a suit that
      is black from hood to shoes ................................................... pass
  - gameplay views (gameplay.png about 9 m, gameplay-near.png about 3.5 m): the cyan
    accents are brighter than in pass 3 without blooming into the white hoodie. The logos
    read as cyan marks at 9 m and as triangles at 3.5 m ............................... pass
Silhouette (unchanged from pass 3): front vs 01 IoU 0.894; side vs 02b 0.932 (head 0.952);
  back vs 03b 0.843 (head 0.953); left vs 02b mirrored 0.932.
Budget: 6,986 triangles, 5 materials (black, cyan, skin, tint_light, white), 0 textures,
  438,972 bytes.
validate_glb.py (preview GLB, validation-preview.json): the one failure is "character has
  no skinned mesh". That is expected before the rig pass; triangles, materials, textures and
  size are all within the character budgets. It is not the "clean validate_glb" of the
  brief, which applies to the rigged runtime GLB with the Hider clip set (passes 5-6).
Evidence:
  - views: sheet.png (references 01, 02b, 03b), front/right/back/left/three-quarter.png,
    gameplay.png, gameplay-near.png;
  - colour: palette.png, palette.json, details-material.png;
  - readability: r3-9m-front.png, r3-9m-behind.png, seeker-hunter-9m-front.png,
    seeker-hunter-9m-behind.png, readability-metrics.json;
  - checks: overlay-*.png, overlay-metrics.json, pivot-test.png, structure.json,
    validation-preview.json.
Next change (pass 5, rig and motion; needs the user's go-ahead): the skeleton and weights.
  Pose crouch_idle and slide first as extremes against the 1.12 m clearance (brief).
```

## Materials

| Material | sRGB | Roughness | Emission | Used on |
| -------- | ---- | --------- | -------- | ------- |
| tint_light | #EBE3D8 | 0.85 | - | hood, hoodie body, sleeves, kangaroo pocket (recoloured per skin at runtime) |
| black | #2E2F35 | 0.72 | - | cap, mask, bag, harness, gloves, joggers, socks, sneaker treads and shank |
| cyan | #3CB9C4 | 0.45 | 0.35 | logos, hem band, cuffs, straps, drawstrings, glove marks, sneaker panels and rims |
| skin | #DDA98A | 0.65 | - | forearms, fingertips, thumb tips, shins |
| white | #E6DFD8 | 0.55 | - | midsoles, toe caps, knuckle studs |

Metallic is 0 on all five. Pass 3 used #2B2C31 black, #D9A688 skin and #E4DDD7 white, with
rougher cyan and no emission; the hoodie colour is unchanged.

## Rounds (1 of 3 refine rounds for this pass)

| Round | Change | Front | Side (head) | Back (head) |
| ----- | ------ | ----- | ----------- | ----------- |
| r0 | Material build: the palette above, roughness per material, cyan emission 0.35 | 0.894 | 0.932 (0.952) | 0.843 (0.952) |
| r1 | The hood is built reproducibly, and its peak no longer folds (see below) | 0.894 | 0.932 (0.952) | 0.843 (0.953) |

r0 came out of two scratch builds; neither is counted as a round (as in passes 2 and 3):

1. The draft palette, with cyan emission 0.35, took the hem from L* 56.5 to 68 (the sheet
   has 72.5).
2. Black at roughness 0.55 left the mask no more readable, so it went back to 0.72.

**Why r1 was needed.** Rebuilding the r0 source gave a different GLB each time: 180-ish
indices of the hood changed from build to build. `bmesh.ops.solidify` created the hood's
inner shell in a different face order on every run. The build now thickens the hood itself,
in a fixed order, and two builds give the same bytes.

That rebuild exposed a form flaw from pass 3. The facet jitter had lifted the two top rings
of the hood above 2.16 m, and clamping them back folded the tip inside out: faces at the
peak pointed down, and the new inner shell poked 0.9 mm above the collision height. Those
two rings (the top 3.5 cm) are now pinned out of the jitter. The peak sits at 2.16 m with
its normals up, and the silhouette scores are unchanged. The fix changes form geometry, so
pass 3's review notes it; the form stage now builds GLB 8899703d034e.

## Readability method

`gameplay.png` in `review_renders.py` shows one actor. For rule R3 and the seeker-hunter
check, a scratch script (not in the repository) renders pairs with the same look:
- camera and target: eye height 1.76 m, the gameplay camera's 8.75 m, 72 degree vertical
  FOV, aimed at 55% of the height;
- look: the review's EEVEE suns, world and Standard transform, on a 6 m ground pad;
- placement: the actors stand 1.4 m apart across the line of sight;
- inputs: the Hider is the exported preview GLB, recoloured per skin; the procedural Seeker
  is rebuilt from `client/models.ts` (blocks, skin recolour of the armour set, 1.055 outline
  hulls as back faces, aim pose, the blaster at the eye-height socket, roughness 0.76,
  metalness 0.12);
- output: each render also has a transparent, ground-free copy whose alpha gives each
  figure's exact silhouette. The L* figures are medians over the upper (20-50% of the
  figure from the top) and lower (55-85%) bands. The sheets show the render's own pixels,
  enlarged 1.5 times with nearest-neighbour sampling.

seeker-hunter is another session's work in progress: its pass-1 blockout and review renders
exist, but no `review.md` yet. Its GLB (sha256 9d07b7b6ae0b) was only imported; its
worktree was not changed. Its shapes and colours may still change, so the check should be
repeated when its material pass lands. Its brief keeps the suit black on every skin, which
makes these pairs representative.

## Notes and open items

- **The mask in the review light.** Under the brim, the review's key light never reaches
  the mask, and the fill and rim come from behind, so the mask reads as a dark void. 10 and
  10b light the face from the front and show its planes. A satin black (roughness 0.55) did
  not change it. In game the scene uses a hemisphere light (`client/world.ts`,
  `client/map-world.ts`), which should lift the mask more than the review suns do. The
  in-game check will tell whether the mask needs its own darker-grey material; that would
  be a sixth material, one above the character soft budget of 5.
- **Emission and tone mapping.** The game uses ACES filmic tone mapping at exposure 1.13;
  the review uses the Standard transform. The cyan emission of 0.35 may look slightly
  stronger or weaker in game. The in-game screenshots of the integration task will show it.
- **Skin colours at runtime.** No GLB loader or tint code exists yet. The per-skin hoodie
  colours above were applied in the scratch renders only; where the table lives at runtime
  is an integration decision (brief).
