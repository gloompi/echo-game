# Pass 2: structure

```text
Pass: 2 structure       Source: scripts/characters/hider_hoodie.py --stage structure
                        (script sha256 45c6d9228e98..., preview GLB sha256 e49eec7504fb...,
                        184,396 bytes; uncommitted, branch art/hider-hoodie). The r3 renders
                        were made with script b3a71c97a659; the later docstring edit rebuilt
                        a byte-identical GLB. .blend hashes change on every save, so the GLB
                        hash identifies the geometry.
Decision: continue (end of Phase 2; waiting for the user). The asset's refine budget is
          used up (6 of 6), so any further change needs the user's go-ahead.
Overall match: 7/10 (structure: parts, joints and silhouette; no form or material work yet)
Feature checks:
  - hood up from the side and back (Decision 6, refs 02b and 03b): a deep cowl leaning
    back, with a crown lobe 0.253 m behind the axis at 1.98 m, a crease at 1.88 m and a
    nape lobe 0.255 m behind at 1.76 m; the hem is a saddle at 1.73 m under the chin,
    1.80 m at the sides and 1.69 m down the back, resting on the trapezius with the straps
    running under it. Side (02b): the back outline is within 1 cm from 1.70 to 2.14 m, and
    the front outline (rim, cap, brim, mask) is within 1 cm except the brim's drooped sides
    at 1.96 m (1.7 cm), the mask at 1.82 m (1.3 cm) and the hood tip (1.1 cm). Back (03b):
    widths are within 1.4 cm from 1.78 to 2.12 m; 03b itself is 1 cm lopsided at
    2.06-2.10 m ......................................................................... pass
  - silhouette against the targets: front vs 01 IoU 0.895 (r2 0.894); side vs 02b 0.935,
    head 0.967 (r2 0.901 and 0.846); back vs 03b 0.835, head 0.958 (r2 0.832 and 0.944);
    left vs 02b mirrored 0.935. The back's lower score is sheet B's wider A-pose: its
    hands hang at 0.45-0.47 m against 0.41 m in 01 (brief, "Sheet B") ................ pass
  - part breakdown: hood, cap, mask | torso (hoodie with hem band) | bag (body, two
    shoulder straps, waist strap) | sleeve, forearm (cyan cuff + bare forearm), glove
    per arm | joggers hips, thigh (with cargo pocket), shin (cuff, bare shin, sock) per
    leg | sneaker (sole + upper) per leg; 18 meshes plus root and head nodes ......... pass
  - pivots at the joints: each part's origin sits on its joint; after re-importing the
    preview GLB every origin is within 1 mm of it (build check); no rotation or scale
    left on any object ................................................................ pass
  - hierarchy follows the joint chain: hips > spine > (chest: bag), head > hood, cap,
    mask; spine > upper_arm > forearm > hand; hips > thigh > shin > foot. Custom
    property rigJoint names each part's bone from character.md ....................... pass
  - pivot test: every part rotated about its own origin (shoulder, elbow, wrist, hip,
    knee, ankle, neck, spine) stays attached at its joint (pivot-test.png, r3) ....... pass
  - topology: quads plus n-gon end caps only, no triangles; every part manifold with
    the hood's Solidify evaluated; separate islands are deliberate (bag 4, cap 3,
    glove 4, thigh 2, sneaker 2) (structure.json, r3) ................................ pass
  - capsule fit: hood back 0.255 m, bag 0.265 m, brim tip +0.246 m and toe +0.23 m, all
    inside the 0.36 m cylinder; hands reach 0.418 m (0.058 m past the cylinder, 0.038 m
    past the ±0.38 m hit box, within the 0.15 m allowance) ........................... pass
Budget: 3,156 triangles (target 6-10k; the form pass adds the faceting), 5 materials.
Evidence: sheet.png (references 01, 02b, 03b), front/right/back/left/three-quarter.png,
  gameplay.png, gameplay-near.png, overlay-front/right/back/left.png, overlay-metrics.json,
  pivot-test.png, structure.json
Next change (pass 3, form): the thick rolled face rim and the chin V with drawstrings
  (10b), folds at the hood's crease and hem, the sheet's large flat facets on the hoodie
  and hood, jogger bunching at the knees and cuffs, the kangaroo pocket, the mask's nose
  ridge, the cap's panels and back adjuster, the bag as a bevelled pouch, split fingers
  with knuckle studs, the cyan strap on the left jogger hip (front and back), and sneaker
  panels from sheet B's four sneaker views.
```

## Rounds (3 of 3 refine rounds used; asset total 6 of 6)

| Round | Change | Front | Side (below 1.66 m) | Back (below 1.66 m) |
| ----- | ------ | ----- | ------------------- | ------------------- |
| r0 | Structure build: joint pivots and hierarchy, harness, cargo pockets, cap button, sole and glove fixes carried from pass 1, head node under the torso | 0.889 | 0.893 (0.915) | 0.886 (0.886) |
| r1 | Sleeves 6% thinner and cuffs 6 mm narrower, because the 8-sided sections read wider than the blockout's 6-sided ones; sneaker upper tapers inside the sole; toe box and tongue 2 cm lower; heel 2 cm longer; fingertips 1 cm in | 0.894 | 0.898 (0.921) | 0.887 (0.886) |
| r2 | Hood face opening deleted together with its edges, removing 16 loose edges that Solidify had doubled; back straps run straight from the top of the bag to the shoulder, which closed a 3.8 cm gap in the side profile at 1.60 m | 0.894 | 0.898 (0.922) | 0.887 (0.886) |
| r3 | User-directed (Decision 6): side and back rebuilt against sheet B, scored below. Hood as described in the first check, with its face rim set 5-10 cm forward of the axis behind the mask and cap. Trapezius raised to 1.78 m beside the neck and the upper back 1 cm deeper, with the straps re-routed under the hood's hem. Cap front panel 2 cm forward. Brim 1.5 cm longer, with wider drooped sides and a 2.4 cm tip. Mask front 1.2 cm forward. Bag tilted 32°, 5% larger, with a tapered back face. Sneaker 1 cm forward, toe 2.5 cm longer, heel collar higher | 0.895 | see below | see below |

r0-r2 are scored against 02 and 03, whose heads show the hood down, so their side and back
columns exclude the head. Sheet B has the hood up in every view, so r3 is scored against
02b and 03b with the head included:

| Build | Side vs 02b (below 1.66 m, head) | Back vs 03b (below 1.66 m, head) | Left vs 02b mirrored |
| ----- | -------------------------------- | -------------------------------- | -------------------- |
| r2 (baseline) | 0.901 (0.921, 0.846) | 0.832 (0.811, 0.944) | 0.901 |
| r3 | 0.935 (0.924, 0.967) | 0.835 (0.812, 0.958) | 0.935 |

r3 was built from sheet B measurements (hood back and front per height in 02b, widths
in 03b, the hem where it meets the straps). It was refined in three scratch builds, each
rendered and scored against 02b and 03b, before this one review render: the first built
the hood and the trapezius; the second fixed the back hem, the upper back, the cap, the
brim, the sneaker and the bag depth; the third fixed the cap front, the mask, the brim
sides and the bag tilt. Those scratch checks are not counted as rounds. Counting them as
rounds would put the asset at 8 of 6.

Still outside 1.5 cm after r3, all minor at this pass's tolerance:

- side, 1.32-1.38 m: the bag's lower end is 2.2 cm deeper than 02b, whose bag is a
  rounder pouch (form pass);
- side, 1.62 m: the upper back and strap sit 1.4 cm in front of 02b;
- side, 0.03 m: the toe is 1.2 cm short of 02b;
- back, 2.14 m: the hood tip is 1-2.5 cm wider than 03b, and 01 wants it about as wide
  as it is now;
- back, 1.74-1.76 m: 03b's shoulders and straps reach 2-3 cm further out, where 01's are
  narrower;
- back arms: sheet B's pose (above).

## Part and joint table

| Part | Bone (`rigJoint`) | Parent | Pivot (game m) | Triangles |
| ---- | ----------------- | ------ | -------------- | --------- |
| joggers_hips | hips | hider_hoodie (root) | 0, 0.97, 0 | 92 |
| torso | spine | joggers_hips | 0, 1.10, 0 | 260 |
| head (empty) | head | torso | 0, 1.73, -0.01 | - |
| bag | chest | torso | 0, 1.45, 0 | 296 |
| hood, mask, cap | head | head | 0, 1.73, -0.01 | 828, 164, 236 |
| sleeve.R / .L | upper_arm | torso | ∓0.205, 1.645, -0.01 | 108 |
| forearm.R / .L | forearm | sleeve | ∓0.285, 1.385, -0.02 | 92 |
| glove.R / .L | hand | forearm | ∓0.345, 1.16, 0 | 80 |
| joggers_thigh.R / .L | thigh | joggers_hips | ∓0.115, 0.97, 0 | 88 |
| joggers_shin.R / .L | shin | joggers_thigh | ∓0.192, 0.57, -0.03 | 140 |
| sneaker.R / .L | foot | joggers_shin | ∓0.228, 0.12, -0.095 | 132 |

The character's right side is game -X, and `.R` parts use the upper sign in each ∓.

## Notes for later passes

- Rig: the hood's nape lobe and hem hang below the neck joint onto the trapezius and
  upper back, so its bottom rows need neck and chest weights, not just the head bone;
  the pivot test shows the rigid hood swinging over the shoulders when the head turns.
  The bag and harness bind to the chest; the waist strap sits on the spine part at
  1.35 m.
- Crouch at 1.12 m is still unproven. Pose crouch_idle and slide as extremes straight
  after rigging (brief, "Crouch at 1.12 m"). The deeper hood adds 5 cm behind the head,
  which a pitched-forward crouch carries up and back.
- The pivot test is a rigid-part check only. Joint deformation, such as shoulder and
  hip creasing, belongs to the rig pass.
- The whole-asset refine budget is used up (6 of 6), so passes 3-6 need a new budget.
- Method: guide-free renders are compared with silhouette masks of the references.
  01's mask is the one from pass 1 (see its "Method" section). The masks for 02b and
  03b come from the same GrabCut approach on sheet B, with the backdrop estimated
  smoothly (the sheet has a soft vignette). Enclosed holes are filled unless they are
  flat backdrop, which recovers jogger facets that sit within 6 levels of the backdrop.
  Overlays: magenta is reference only, cyan is model only. The same scratch tools are
  not in the repository.
