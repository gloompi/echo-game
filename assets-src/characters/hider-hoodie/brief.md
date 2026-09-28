# hider-hoodie brief

```text
Asset: character
ID: hider-hoodie
Role: hider
Replaces in game: no, side-by-side until the user approves

Identity to keep: none from the current Hider (see identity changes); keep the sheet's
  design, proportions and cyan accents
Identity changes (explicit, user-approved 2026-09-25): replace the striped blocky Hider
  with the supplied design: white hoodie, hood up over a black cap with a cyan triangle
  logo, black face mask, black sling bag with a cyan triangle, black cargo joggers with
  cyan straps, fingerless gloves, cyan/white sneakers. Low-poly faceted style and
  proportions as in the sheet.
Style words: low-poly faceted, large flat facets, flat colours, cyan accents
Avoid: the gear row (stun grenade, scan drone, grapple launcher, parkour pick) and
  anything held; noisy textures; parts under ~3 cm that shimmer at 9 m
References: supplied, authoritative: refs/00-sheet.png and, for the side and back,
  refs/00b-sheet.png (sheet B, hood up); crops and provenance in refs/

Mesh route: scripted
Generation budget: 0 (ask before any paid job)
Triangle target: 6-10k, hard cap 15k
Animations: default Hider set: idle, run, jump, crouch_idle, crouch_walk, slide, hit, wave
Skins: the hoodie is the recolour region; map the sheet's colour variations onto classic,
  cobalt, ember, jade, violet, arctic, sunset, carbon. A dark hoodie must never make the
  Hider read as a Seeker.
Done means: renders match the sheet's front/side/back (as restated under Decisions),
  clean validate_glb, review sheet for every pass
```

## Status

Phase 1 of 4 (intake) was approved on 2026-09-25 with the decisions below. Phase 2 (passes 1
blockout and 2 structure) is built; on the user's request its last round rebuilt the side
and back from sheet B (Decision 6, `reviews/pass-2-structure/review.md`). Phase 3 (passes 3
form and 4 material) is built and reviewed (`reviews/pass-3-form/review.md`,
`reviews/pass-4-material/review.md`). Phase 4 (passes 5 rig and motion, 6 optimise and
export) is built and reviewed (`reviews/pass-5-rig/review.md`,
`reviews/pass-6-optimize/review.md`): `public/assets/characters/hider-hoodie.glb` passes
`validate_glb.py` with the Hider clip set. It is not wired into the game client; the
hand-off list is at the end of this brief.

## Decisions (user, 2026-09-25)

1. **Bag on the back**, as in 02, 03 and 04. The front shows the harness instead of the
   chest bag drawn in 01 and the six colour variations: two shoulder straps (black over
   both shoulders, the right one cyan down the chest, as in 01) running to the waist as in
   02, meeting the bag on the back as in 03. The bag's form and its cyan down-pointing
   triangle come from `10-part-sling-bag.png`.
2. **Hood up in every view.** The hood-up side and back profile comes from 01 and
   `10-part-hood-cap-mask.png`. 02, 03 and 04 draw the hood down and are not used for the
   head.
3. **Hood peak at 2.16 m** in the bind pose (scale plan below).
4. **Skin mapping and readability rules approved** as listed below.
5. **Logos stay cyan** on every skin: the cap and bag triangles, cuffs, hem band,
   drawstrings, jogger straps and sneaker panels. Only the hoodie recolours.
6. **Side and back from sheet B** (user, 2026-09-25, after "hood looks weird on sides and
   back"): the user supplied a second sheet with the hood up in every view and asked for
   the side and back views to be built from it. 02b and 03b replace 02 and 03 as the side
   and back match targets, head included. 01 stays the front target. This supersedes the
   head clause of Decision 2: the hood-up side and back come from 02b and 03b, not from
   01 and the detail crop.

"Done means", restated for these decisions:

- the front render is compared with 01, except the chest bag (the harness shows instead);
- the side and back renders are compared with 02b and 03b, head and bag included; the
  back arms are an exception, because sheet B's A-pose is wider (see "Sheet B");
- the hood's front and face opening are compared with 01, `10-part-hood-cap-mask.png` and
  `10b-part-hood-cap-mask.png`;
- the left render is compared with 02b mirrored, except the asymmetric straps (04 and 04b
  are second right views, not left views);
- plus a clean `validate_glb` and a review sheet for every pass.

## Reference pack

| File                                                    | Use                                                                                                  |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `00-sheet.png`                                          | Byte copy of the supplied sheet (SHA-256 in provenance)                                              |
| `01-front.png`                                          | Front match target (without the chest bag) and the hood-up head                                      |
| `02-side-right.png`                                     | Side target of passes 1-2 below the head; superseded by 02b (Decision 6)                             |
| `03-back.png`                                           | Back target of passes 1-2 below the head; superseded by 03b (Decision 6)                             |
| `04-side-left.png`                                      | Rejected: a second right-side view, not a left view                                                  |
| `10-part-hood-cap-mask.png`, `-sling-bag`, `-glove.png` | Head, back bag and glove details                                                                     |
| `30-colour-1…6-*.png`                                   | Hoodie colour sources for the skins (their chest bag and recoloured logos are superseded)            |
| `00b-sheet.png`                                         | Byte copy of sheet B, hood up in every view (SHA-256 in provenance)                                  |
| `02b-side-right.png`                                    | Side match target, head included: hood profile, cap and brim, back bag, harness, sneakers            |
| `03b-back.png`                                          | Back match target, head included: hood and its hem, back bag with triangle, strap layout             |
| `04b-side-left.png`                                     | Rejected: labelled LEFT but a second right-side view (IoU with 02b 0.91 as drawn, 0.69 mirrored)     |
| `10b-part-hood-cap-mask.png`                            | Hood-up head from the front: rim thickness, chin V, drawstrings (form pass)                          |
| `10b-part-sling-bag.png`, `10b-part-glove.png`          | Bag form (drawn on the chest; used for its shape only) and glove with the H mark (form pass)         |
| `10b-part-sneaker-side/front/back/sole.png`             | Sneaker panels: panel layout, midsole blocks, sole tread, rim and triangle (form pass)                |

01-04 and 02b-04b are framed like the `review_renders.py` orthographic views (square,
1.15 × model height, model centred), so in a review `sheet.png` each reference and a
render of the model appear at the same scale. Sheet B's figures measure 665-668 px from
hood peak to sole, so each of its crops is scaled by its own height (3.24 mm per sheet
pixel). The gear row is out of scope and not cropped; sheet B's bag, glove and sneaker
panels were cropped for the form pass. Intake evidence:
`reviews/intake/scale-plan.png` and `reviews/intake/measurements.json`.

## Scale plan

The front view measures 650 px from hood peak to sole; the side views agree within 1% (cap
crown 643 px, the hood peak sits about 7 px above the crown). Scale uniformly with the
**hood peak at 2.16 m**: 3.32 mm per sheet pixel (300.9 px/m). Idle and run bob will lift
the hood a few centimetres above 2.16 m for moments. That is cosmetic, because shots stop
at 2.16 m, but the hood can visibly touch a 2.16 m lintel, so the bob stays at 3 cm or
less.

| Landmark                   | Height (m)  |
| -------------------------- | ----------- |
| Hood peak / cap crown      | 2.16 / 2.14 |
| Brim tip / brim lower edge | 2.00 / 1.94 |
| Mask chin                  | 1.79        |
| Shoulder line              | 1.69        |
| Sleeve cuff                | 1.38-1.28   |
| Hem band bottom            | 1.09        |
| Crotch                     | 0.92        |
| Fingertips (A-pose)        | 0.87        |
| Knee                       | 0.57        |
| Jogger cuff bottom         | 0.36        |
| Shoe collar                | 0.28        |

About 6.3 heads tall (cap crown to chin 0.34 m); legs are 43% of the height.

Horizontal reach from the body axis, compared with the 0.36 m movement cylinder
(`shared/rules.json`) and the box that shots actually test (±0.38 m, axis-aligned, 0.08 to
2.16 m; `player_ray_crouched` in `crates/echo-core/src/physics.rs`):

| Part                      | From axis     | Cylinder        | Hit box    |
| ------------------------- | ------------- | --------------- | ---------- |
| Hands, A-pose             | 0.415 m (x)   | 0.06 m out      | 0.035 m out |
| Shoe edges, A-pose stance | 0.37-0.41 m   | 0.01-0.05 m out | inside     |
| Sleeves at the elbow      | 0.36 m        | at the wall     | inside     |
| Back bag                  | 0.269 m behind | 0.09 m in      | inside     |
| Hood back (crown, nape)   | 0.246 m behind | 0.11 m in      | inside     |
| Cap brim tip              | 0.246 m front | 0.11 m in       | inside     |
| Shoulders / hood sides    | 0.28 / 0.20 m | inside          | inside     |
| Toe / heel                | 0.244 / 0.195 m | inside        | inside     |

Depths follow sheet B since Decision 6, measured on the pass-4 build (the form pass
lengthened the sneaker 1 cm and made the bag a rounder pouch). Sheet A had the bag at
0.25 m, the brim at 0.23 m, the toe at 0.21 m and the heel at 0.20 m; its side view had no
hood-up profile. The shoe's outer toe corner is 0.41 m from the axis in the 10 degree
stance, still inside the hit box, which is square (0.366 m in x, 0.244 m in z).

Only the hands and, in the wide A-pose stance, the shoe edges leave the cylinder. The brim
and the bag stay well inside. In the run clip, hand swing stays near 35° so the hands
remain within 0.15 m of the capsule. (Intake plan. Pass 5 measured the clips: the gloves are
0.52 m from elbow to fingertip, so the run's hands reach 0.586 m, 0.23 m outside; see
`reviews/pass-5-rig/review.md`, "Capsule and hit-box fit".)

- Shots test the box, not the 0.36 m cylinder that `character.md` and `review_renders.py`
  describe and draw. The box is 2 cm wider, does not rotate with facing (0.54 m to a
  corner) and starts 0.08 m above the ground, so the soles can't be hit.
- The figure is slimmer than the box: the torso is 0.31 m deep and 0.55 m across the
  shoulders. Shots up to about 0.2 m in front of or behind the torso still register, as
  they do on today's block Hider (0.40 m deep). The proportions are not bulked up to hide
  this.
- The eyes, under the brim, sit at about 1.93 m. The camera eye is 1.76 m, just below the
  chin. This is cosmetic: shots use the box, and the hood fills its top. Lowering the eyes
  would mean a bigger head than the sheet shows.

## Conflicts and how they are handled

### Readability against the Seeker

About half of the design is black: the cap, mask, bag, gloves and joggers measure L* 13-22.
The Hider read comes from the hoodie (a light or saturated top over black legs) and from the
hood-and-brim silhouette. A dark hoodie removes the value split. That is exactly what the
sheet's charcoal variation does: its hoodie measures L* 22, the same as the joggers.
Approved rules for every skin:

- **R1:** the hoodie base colour has CIELAB L* ≥ 50.
- **R2:** saturated blues (hue 190-240°) need L* ≥ 65, because the Seeker is blue-armoured.
- **R3:** the material pass renders `gameplay.png` at 9 m for all eight skins next to a
  Seeker (the procedural one until seeker-v2 exists), plus a greyscale copy. The role must
  read from silhouette and value alone. Because the bag is on the back, R3 also includes a
  view from behind at 9 m, which is what a chasing Seeker sees. `review_renders.py` only
  shoots gameplay views from the front-left, so this one is an extra render. The black bag
  must stay framed by the white hood above it and the hoodie around it.

Skins apply to both roles. Under today's PALETTES a Seeker's armour takes the skin's dark
colour, so the ember armour (rust #9B422E) and violet armour (#7350A5) come within about
11 L* of the ember and violet hoodies, in the same hue family. For those two skins the
silhouette carries the role: hood, brim, black joggers and no weapon, against armour, a
helmet and the orange blaster. R3 shows whether that is enough. Nothing on the Hider is
orange: sunset stays gold (hue ≈40°) because orange belongs to the blaster.

### Crouch at 1.12 m

1.12 m is 52% of the standing height. These proportions give 0.71 m from hip to shoulder,
0.48 m of head and hood above the shoulder line, a 0.41 m thigh and a 0.45 m shin. With
them an upright deep squat tops out near 1.6 m, and a 45° lean with the head up near
1.35 m. Estimated fit: a hunched sneak reaches ≈1.10 m, with the hips at ≈0.40 m pushed
back, the back rounded at ≈50° and the head tucked forward. In that pose the brim reaches
≈0.55 m forward of the axis, which is 0.15-0.2 m outside the cylinder. The first fix to try
is pitching the head down 10-15° in the crouch clips; shortening the brim comes after that.
The back bag adds little height when the torso is pitched forward, but it must not rise
above the hood line. `crouch_idle` and `slide` get blocked as extreme poses straight after
rigging, before the rest of the clip set. The target is ≤ 1.12 m (`validate_glb.py` fails
above 1.17 m), and the review renders check the fit against the capsule.

### Skins and the runtime contract

- PALETTES' light and dark pairs can't produce the sheet's colours: ember's light colour is
  peach #FFD8B4 and violet's is lavender #E0D2F4. This model needs its own hoodie colour for
  each skin. The GLB loader and tint code don't exist yet, so the location of that table is
  an integration decision. The procedural fallback keeps using PALETTES.
- Authoring: `tint_light` covers the hoodie body, sleeves and hood, authored in the classic
  colour #EBE3D8. There is no `tint_dark`; everything else keeps its own colour.

### Sheet B (Decision 6)

- **Chest bag again.** Sheet B's front view draws the bag on the chest, as 01 does. Its
  side and back views put the bag on the back, so Decision 1 stands unchanged.
- **Wider A-pose.** Sheet B's hands hang 0.45-0.47 m from the axis at 1.04-1.10 m; in 01
  and in the model they hang at 0.41 m. The bind pose keeps 01's arms. 01 is the front
  target, and the narrower pose keeps the hands 0.04 m outside the hit box instead of
  0.07-0.09 m. In the back overlay the hands therefore sit inside the reference. That is a
  pose difference, not a design one.
- **Shoulders.** Seen from behind, sheet B's upper sleeves are 1-2.5 cm wider on each side
  at 1.44-1.56 m than 01's are seen from the front. The model stays between the two.
- **Sneakers.** Sheet B's sneaker is 2-3 cm longer at the toe and has a higher collar. The
  model follows sheet B, because the side view is its target; the front view is unchanged.
- **Two right views again.** The figure labelled LEFT faces right, like 02b (`04b`,
  rejected).
- **Scale.** All four figures measure 665-668 px from hood peak to sole (within ±0.2%), so
  the 2.16 m scale plan holds. Below the head, sheet B's side view matches sheet A's at
  IoU 0.93.

### Identity documents

Root `AGENTS.md` and the echo-3d-assets skill name the striped blocky Hider as the role
identity. This asset is an explicit exception approved by the user. If it replaces the
in-game Hider, those lines change in the integration PR.

## Skin mapping (approved 2026-09-25)

| Skin    | Sheet source             | Hoodie base | L*  | Note                                    |
| ------- | ------------------------ | ----------- | --- | --------------------------------------- |
| classic | 01 front, warm white     | `#EBE3D8`   | 91  | authored colour                         |
| ember   | swatch 2, red            | `#D8434B`   | 51  |                                         |
| violet  | swatch 3, purple         | `#9A5DDF`   | 52  |                                         |
| sunset  | swatch 4, yellow         | `#E3B050`   | 75  | gold, not orange                        |
| arctic  | swatch 6, white/grey     | `#DDE8F2`   | 92  | cooler than classic so the two differ   |
| carbon  | swatch 5, charcoal       | `#7C828C`   | 54  | lifted: the sheet's L* 22 fails R1      |
| jade    | not on the sheet         | `#3FAE7F`   | 64  | green, kept off the cyan accents' hue   |
| cobalt  | not on the sheet         | `#74A8EA`   | 68  | light blue, per R2                      |

Swatch 1 (the classic design with a teal hood crown) is not mapped. The values come from
the sheet's lit facets and are tuned against the swatches in the material pass without
breaking R1 or R2. Contrast with the black joggers (#353539) ranges from 2.8:1 (ember) to
9.8:1 (arctic).

## Defaults applied

- Game space: metres, +Y up, facing +Z, origin between the feet. The bind pose is the
  sheet's A-pose.
- At most 5 materials: `tint_light` (hoodie); black (cap, mask, bag, harness, gloves,
  joggers, socks); cyan (trims, logos, strap sections, sneaker panels, with the logos
  slightly emissive as in the bag detail); skin (forearms, fingers, shins, in the sheet's
  tone); white (soles, knuckle studs, drawstring tips).
- Triangle plan ≈9.5k: head (cap, brim, mask, hood) 2k, hoodie 2k, hands 1.2k, bag and
  harness 0.9k, joggers 1.8k, shins 0.2k, sneakers 1.4k. Built in pass 3: 6,986 in all
  (head 1.5k, hoodie 0.8k, hands 0.9k, bag and harness 0.6k, joggers 1.2k, sneakers 2.0k).
- Thin sheet details become readable forms: drawstrings ≥ 2.5 cm, studs as small blocks.
  Logo strokes were planned at ≥ 3 cm or filled; pass 3 keeps the sheet's open outlines
  instead, with 2 cm strokes on the cap and 1.7 cm on the bag, because a 3 cm stroke closes
  a 10 cm triangle. The tongue's small triangle is left out.
- Nothing from the gear row, no weapon and no held item.
- Build: `scripts/characters/hider_hoodie.py` (underscore, as in `scripts/worlds/`) writes
  `hider-hoodie.blend` and `public/assets/characters/hider-hoodie.glb`, with
  `scripts/characters/hider_hoodie_rig.py` for the skeleton, weights and clips. Each pass
  gets a review under `reviews/`.

## Decision log

- 2026-09-25: brief received. The identity change, scripted route, zero budget and
  side-by-side integration come from the user.
- 2026-09-25: `art/hider-hoodie` created from `main` (74c64ee) in a separate worktree,
  because the main checkout is on `art/seeker-v2` with uncommitted work.
- 2026-09-25: intake approved. Bag on the back (the agent had recommended the chest sling),
  hood up everywhere, hood peak 2.16 m (the agent had proposed 2.14 m), skin mapping and
  rules R1-R3 approved, logos stay cyan.
- 2026-09-25: after the Phase 2 review the user reported that the hood looked wrong from
  the sides and back. They then supplied sheet B, with the hood up in every view, and
  asked for the side and back views to be built from it (Decision 6). Pass 2 round 3
  rebuilt the hood, trapezius, cap front, brim, bag and sneakers against 02b and 03b.
- 2026-09-26: Phase 3 go-ahead (passes 3 form and 4 material). The asset's six refine
  rounds were spent in passes 1-2, so the go-ahead is taken as the skill's per-pass limit of
  3 rounds; pass 3 used 2, pass 4 used 1.
- 2026-09-27: passes 3 and 4 built and reviewed. Pass 4 made the build reproducible (the
  hood's shell) and fixed a folded hood tip left from pass 3. It rendered the Hider at 9 m
  beside two Seekers: the procedural one in all 8 skins, and seeker-hunter's pass-1 blockout
  (another session's work in progress, imported read-only). Neither pair can be confused;
  the narrowest is the ember or violet Hider against seeker-hunter from behind. Nothing is
  committed.
- 2026-09-28: Phase 4 go-ahead (passes 5 rig and motion, 6 optimise and export), taken
  with the per-pass limit of 3 refine rounds. Pass 5 used 2: keys made linear with
  quaternions kept in one hemisphere (r1), then arms re-posed so no arm passes through the
  body, the slide's hips moved back, an exact sole hull for the ground clamp and an IK range
  check (r2). Pass 6 used 2: keyed channels only, so wave stays on the upper body (r1), and
  a fixed key order in hit so builds are reproducible (r2).
- 2026-09-28: `validate_glb.py` measured the imported GLB in the pose of its first clip
  (`crouch_idle`, the exporter sorts clips by name) and failed a correct character on
  height; it now measures size, origin and centring in the rest pose, and
  `review_renders.py` shows imported GLBs in the rest pose. Three negative controls still
  fail. The runtime GLB passes with the Hider clip set.
- 2026-09-28: the crouch clips and slide put the hood 0.22 m in front of the movement
  cylinder, and the gloves (0.52 m from elbow to fingertip) take the hands 0.10-0.39 m out
  in several clips. Both are reported for the user's acceptance (pass-5 review). Per the
  user's instruction the asset is not wired into the game client.

## Hand-off (Phase 4)

Deliverables (review-loop.md):

- Brief and references: this file, `refs/` with `refs/provenance.json` (25 entries); the
  reference table above marks the match targets (01, 02b, 03b) and the rejected crops.
- Editable source: `hider-hoodie.blend` (the export build: one skinned mesh, the armature
  and the eight actions) and the authoring scripts `scripts/characters/hider_hoodie.py` and
  `scripts/characters/hider_hoodie_rig.py`. Every stage rebuilds from the script:
  `--stage blockout|structure|form|material|rig|export`; the export stage writes the runtime
  GLB and this folder's `.blend` and `manifest.json`.
- Runtime GLB: `public/assets/characters/hider-hoodie.glb`, 829,408 bytes, sha256
  89aff366cd77..., reproducible byte for byte.
- Reviews: `reviews/pass-1-blockout` to `reviews/pass-6-optimize`, each with `sheet.png` and
  `review.md`; intake evidence in `reviews/intake`.
- Validation: `validation-glb.json` (validate_glb.py, character, clips idle, run, jump,
  crouch_idle, crouch_walk, slide, hit, wave): passed, no failures, no warnings.
- Repository checks: `pnpm verify` on 2026-09-28 in this worktree (Windows 11, after
  `pnpm install --frozen-lockfile`): all 15 checks passed (typechecks, formatting, lint and
  boundaries, tool tests 30/30, TypeScript unit tests 129/129, map and parity fixtures,
  launcher integration, rustfmt, clippy, Rust tests, client and server production builds,
  WebTransport integration, 9/9 browser E2E). The launcher group skips its share-launcher
  test on Windows by design (`skip: process.platform === 'win32'`); that one did not run.
- In-game screenshots: none. The asset is not wired into the client yet, so there is no
  in-game view; the review renders use Blender's EEVEE with the Standard transform, not the
  game's ACES tone mapping and hemisphere light.

Open issues and what was not verified:

1. **Capsule fit** (pass-5 review): crouched, the hood reaches 0.2 m past the box that shots
   test, and hands and running feet leave it too. Accept, or change gameplay (for example a
   crouched hit box that follows the model); that is outside this asset.
2. **Between keys** the 30 fps clips let a planted sole sink up to 1.5 cm and slide up to
   2 cm; 60 fps keys would cost about 65 KB.
3. **Run and crouch_walk speeds**: authored for 6.4 and 2.88 m/s. The runtime should scale
   playback with the actual speed (character.md), or the feet slide.
4. **Mask and emission in game** (pass-4 review): the mask reads as a dark void under the
   brim in the review light, and the cyan emission of 0.35 has not been seen under ACES.
5. **Skins**: the per-skin hoodie colours (table above) have no runtime home yet.
6. **Integration** (character.md, a separate echo-change task): a cached loader,
   `SkeletonUtils.clone` of the whole scene per player (three.js makes 5 SkinnedMesh
   primitives on one skeleton), an AnimationMixer mapped from the Pose fields, wave layered
   over the legs (its clip has no leg tracks), the procedural Hider as fallback, disposal
   that never frees shared resources. Root `AGENTS.md` and the skill name the striped blocky
   Hider as the identity; that text changes if this model replaces it.
7. **seeker-hunter** readability should be checked again when its material pass lands
   (pass-4 review).
8. **Not verified**: the model in a browser build of the game, in network play, or on
   low-end hardware. The GLB was loaded and played with the client's three.js version
   (0.186) under Bun, not rendered in a browser. The wave's raised hand reaches 2.26 m, above
   a 2.16 m lintel; shots stop at 2.16 m.
