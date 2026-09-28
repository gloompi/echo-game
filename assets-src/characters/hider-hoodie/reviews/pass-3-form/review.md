# Pass 3: form

```text
Pass: 3 form            Source: scripts/characters/hider_hoodie.py --stage form
                        (script sha256 289420fdf90f..., preview GLB sha256 863b8c29509b...,
                        439,368 bytes; uncommitted, branch art/hider-hoodie). The structure
                        stage of the same script still rebuilds the pass-2 GLB byte for byte
                        (e49eec7504fb).
Decision: continue to pass 4 (material), which the same phase covers.
Overall match: 7.5/10 (form: the sheet's facets, folds and part details; flat colours and
               emission come in pass 4)
Feature checks:
  - hood folds and rim (10, 10b, 02b, 03b): a faceted cowl with a 2 cm shell. A thick rim
    (5 cm wide, 3 cm deep) frames the face opening and meets under the chin. The 02b crease
    at 1.88 m is 4.4 cm deep (4.9 cm in 02b). The facets are clamped so the peak stays at
    2.16 m. From behind, the crease reads as a shaded fold under the review lights, where
    03b draws a smooth dome. Side outline of the head within 1.1 cm except the brim's
    drooping sides at 1.96 m (2.8 cm short, from the rounded lip) and the chin at 1.80 m
    (1.3 cm forward: rim and facets) .................................................. pass
  - cap brim and logo: rounded lip on the brim. The cap's front panel carries an open cyan
    triangle (10 x 8.5 cm, 2 cm strokes), sampled along each stroke so that it follows the
    curved panel (a first build cut through the curve and showed a chevron) ........... pass
  - mask planes (10, 10b): a nose ridge that sharpens from 1.80 to 1.98 m, flat cheek
    planes and a rounder chin. Under the brim in the front view the mask still reads
    almost black; separating its planes from the hood's shadow is a material and lighting
    job for pass 4 .................................................................... pass
  - bag (10b bag, 03b): a pouch 11 cm deep in the middle and 4 cm at the ends, with
    bevelled edges, a zip on the top bevel with its pull at the lower end, and buckles
    where the straps meet it. The cyan down-pointing outline (1.7 cm strokes) now shows an
    open centre as in 03b and sits 2.4 cm toward the upper end. Against 02b's rounder side
    profile the bag is 1.7 cm deeper at 1.38 m (2.2 cm in pass 2), 0.6 cm shallower at
    1.56 m (1.1 cm deeper in pass 2) and 1.6 cm shallower at 1.32 m .................... pass
  - cargo pockets and cuffs (01, 02b, 03b): pocket plates follow the outer thigh 1.3 cm
    proud, under a wider flap 2.2 cm proud. The joggers have a diagonal fold and a pinch
    above the knee, two diagonal folds below it and a bunch over the 7 cm cuff. This
    replaced the five level rings of the first scratch build, which read as stripes. The
    folds cut in from the pass-2 outline: the front outer edge at 0.48-0.74 m moved 0.5-1
    cm toward 01 but is still 1-3 cm outside it, because 01's legs sit 1-2 cm closer to
    the centre line (joint placement from pass 1, not changed here) .................. pass
  - gloves (10, 10b): sheet B's cyan H on the back of the hand with its crossbar across
    the hand (the first build had it turned 90 degrees). Black wrist strap with a cyan
    square, four split fingers with bare tips, three white knuckle studs, a two-part
    thumb ............................................................................. pass
  - sneakers (10b sneaker panels; top line measured on 02b):
    * sole: a white midsole in two blocks with a rounded heel and a toe spring, a black
      shank in the arch notch, black treads inside cyan rims, and the cyan triangle under
      the forefoot;
    * upper: a black heel counter, a cyan quarter cut diagonally with a black patch, a
      black vamp band, a cyan toe box under a white toe cap, laces lying on the instep, a
      tall tongue leaning forward and a cyan heel tab;
    * fit to 02b: the top line is within 0.3 cm at the heel and within 1 cm along the
      instep and toe box. It is 1.6 cm high at the toe tip, where the toe spring lifts
      the toe 1-2 cm before 02b's ................................................ pass
  - gameplay read (gameplay.png, about 9 m; gameplay-near.png, about 3.5 m): at 9 m it
    reads as a light hooded top over black joggers, with cyan hem, cuffs and sneakers, the
    cap logo as a cyan mark, and no weapon. At 3.5 m the rim, the H marks, the pockets,
    the folds and the sneaker panels all read. The Seeker comparison belongs to pass 4
    (brief, rule R3) .................................................................. pass
Silhouette: front vs 01 IoU 0.894 (pass 2 0.895); side vs 02b 0.932 (0.935), below 1.66 m
  0.925 (0.924), head 0.952 (0.967); back vs 03b 0.843 (0.835); left vs 02b mirrored 0.932.
  The head's side score dropped because of the facets and the rim.
Budget: 6,986 triangles (target 6-10k), 5 materials. Per part:
  - sneakers 2 x 1,024 (the brief's plan was 1.4k for both);
  - hood 1,000, torso 632, bag 572, cap 354, mask 136;
  - gloves 2 x 300;
  - thighs 2 x 260, shins 2 x 236, hips 188;
  - forearms 2 x 124, sleeves 2 x 108.
Topology: every part is closed (0 non-manifold edges on the evaluated meshes). Cloth parts
  are triangulated by the facets; hard parts are quads with n-gon caps. No object rotation
  or scale; every origin is within 1 mm of its joint after re-import (build check), and
  parts still turn about their joints (pivot-test.png) (structure.json).
Evidence:
  - views: sheet.png (references 01, 02b, 03b), front/right/back/left/three-quarter.png,
    gameplay.png, gameplay-near.png;
  - overlays: overlay-front/right/back/left.png, overlay-metrics.json;
  - details: details-head-bag-glove.png, details-sneaker-legs.png, details-legs-vs-refs.png;
  - checks: pivot-test.png, structure.json.
Next change (pass 4, material): the palette sampled from the sheet, roughness per
  material and slightly emissive cyan. The mask needs enough lift to separate its planes
  under the brim, and the readability renders for rule R3 are due.
```

## Rounds (2 of 3 refine rounds for this pass)

The asset's six-round budget ran out in passes 1-2. The Phase 3 go-ahead is taken as the
skill's per-pass limit of 3 refine rounds for passes 3 and 4. r0 is the first official form
build; r1 and r2 are refine rounds.

| Round | Change | Front | Side (below 1.66 m, head) | Back (below 1.66 m, head) |
| ----- | ------ | ----- | ------------------------- | ------------------------- |
| pass 2 r3 | Baseline (structure) | 0.895 | 0.935 (0.924, 0.967) | 0.835 (0.812, 0.958) |
| r0 | Form build (below) | 0.894 | 0.926 (0.918, 0.949) | 0.843 (0.822, 0.952) |
| r1 | Face rim flush with the hood at the chin; drawstrings and aglets 5 mm off the chest (they stood 1.7 cm off and reached 2.5 cm past 02b at 1.62 m); kangaroo pocket 1-1.5 cm proud instead of 1.4-2 cm | 0.894 | 0.929 (0.920, 0.952) | 0.843 (0.822, 0.952) |
| r2 | Sneaker against 02b's top line: heel counter sloping back from 0.13 m instead of standing 0.19 m tall, rounded midsole heel, toe box 1-2.5 cm lower, forefoot 1 cm longer with a stronger toe spring, shank flush with the midsole, heel tab on the collar | 0.894 | 0.932 (0.925, 0.952) | 0.843 (0.822, 0.952) |

r0 was built in three scratch builds, each rendered, scored against 01, 02b and 03b and
checked in close-ups against the detail crops. They are not counted as rounds (as in
pass 2).

1. The form stage. Facets on the hood, hoodie, sleeves and joggers. Hood shell and rim,
   mask planes, brim lip and cap logo. Kangaroo pocket and drawstrings. Bag bevels, zip
   and logo. Glove fingers, studs and mark. Pocket flaps, jogger folds and cyan hip
   straps. The sneaker's midsole blocks, bands and laces.
2. Fixes to the first build:
   - the cap logo now wraps the curved crown;
   - the facets had lifted the hood peak to 2.165 m; it is clamped to 2.16 m;
   - the rim, drawstrings, hip straps and heel tab were pulled in, after they stood
     1.5-3 cm past 02b.
3. The detail pass against sheet B's part panels, added to `refs/` (below):
   - diagonal folds instead of level rings;
   - the cargo pocket as a plate on the thigh (the pass-2 box was buried in the thigh at
     its centre, 5 mm below the surface);
   - the bag as a pouch that thins toward its ends;
   - the H mark on the gloves;
   - a larger kangaroo pocket;
   - the sneaker rebuilt from the four sneaker panels.

## Reference pack additions

Sheet B's bag, glove and four sneaker panels were cropped from `refs/00b-sheet.png` into
`refs/10b-part-sling-bag.png`, `10b-part-glove.png` and `10b-part-sneaker-side/front/back/sole.png`,
with provenance entries (crop boxes recorded). The bag panel shows the bag worn on the chest,
so it is used for the bag's form only (Decision 1 keeps the bag on the back).

## Deviations and notes

- **Logo strokes.** The brief's default said logo strokes of 3 cm or more, or filled. The
  sheet's triangles are open outlines, and a 3 cm stroke would close the cap's (the
  panel is about 10 cm tall) and the bag's. The logos stay open, with 2 cm strokes on the
  cap and 1.7 cm on the bag (1.4-1.7 px at 9 m in a 1080-pixel-tall view). brief.md
  records the change.
- **Left out:**
  - the small cyan triangle on the sneaker tongue (10b front): about 3.5 cm tall with
    sub-centimetre strokes;
  - the sole's tread pattern: only the sole's triangle and cyan rim are modelled.
- **The hood crease seen from behind** is geometry that 02b's outline requires. 03b draws
  the back of the hood as a smooth dome, so the back render shows a fold that 03b does
  not.
- **Detail renders.** The close-ups are scratch renders (EEVEE and the Key, Fill and Rim
  suns of `review_renders.py`, perspective cameras). They are review evidence, not part of
  the repository tooling.

## Later fix (pass 4, r1)

Pass 4 found a flaw in this pass's hood, as the review loop asks, when it rebuilt the
source for a reproducibility check:
- **The peak.** The facet jitter lifted the two top rings above 2.16 m, and clamping them
  back folded the tip inside out, so faces at the peak pointed down. Those two rings (the
  top 3.5 cm) are now pinned out of the jitter.
- **The shell.** The hood's inner shell came from `bmesh.ops.solidify`, whose face order
  changed from build to build, so the GLB was never byte-reproducible. The shell is now
  built in a fixed order.

The silhouette scores are unchanged. The form stage now builds GLB sha256 8899703d034e...
(this review's r2 GLB was 863b8c29509b...). Details are in
`reviews/pass-4-material/review.md`.
