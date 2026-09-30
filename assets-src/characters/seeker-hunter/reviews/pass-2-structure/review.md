# Pass 2: structure

```text
Pass: 2 structure       Source: scripts/characters/seeker_hunter.py --stage structure
                        (script sha256 2d5419c7d6bd..., preview GLB sha256 d681dc051763...,
                        233,428 bytes; uncommitted, branch art/seeker-hunter). .blend hashes
                        change on every save, so the GLB hash identifies the geometry.
Decision: continue (end of Phase 2; waiting for the user)
Overall match: 7/10 (structure: parts, joints and silhouette; no form or material work yet)
Feature checks:
  - part breakdown: hood, hood_trim, face_plate, visor | torso, chest_plates, harness
    (strap and back plate) | pelvis, belt, pouches | per arm: upper_arm, shoulder_plate,
    deltoid_plate, forearm, forearm_plate, glove, fingers, thumb | per leg: thigh, shin,
    knee_plate, sneaker | holster. 35 meshes plus the review-only socket arrow, and 4
    empties (root, chest, head, weapon_socket) ....................................... pass
  - pivots at the joints: each part's origin sits on its joint; after re-importing the
    preview GLB every origin is within 1 mm of it, and no object carries rotation or
    scale (both build checks) ........................................................ pass
  - hierarchy follows the joint chain: hips (pelvis) > spine (torso) > chest > head and
    upper_arm > forearm > hand > fingers, thumb; hips > thigh > shin > foot. Plates,
    pouches, strap and trim ride on their joint's part. Custom property rigJoint names
    each part's bone from character.md, plus fingers and thumb (brief decision 4) .... pass
  - weapon_socket: an empty under glove.R at (-0.39, 0.99, 0.005) m, the grip point in the
    palm (brief: about 0.98 m, 0.39 m from the axis); identity rotation, so +Z is the
    muzzle (forward in the bind pose), +Y the weapon's top and +X the character's left,
    as the socket contract says. The orange arrow (+Z) and tick (+Y) are review-only ... pass
  - pivot test: spine 15° forward, chest twisted 15°, head turned 30° and pitched 15°,
    right arm raised 70° with the elbow at 70° and the fingers curled, left arm out 45°,
    right leg stepping 45° with the knee at 70°, left leg back. Every part still
    intersects its parent or a part on the same joint (pivot-test.png, .json) ....... pass
  - topology: 1,690 quads, 42 n-gon end caps and one 16-triangle fan at the hood peak
    (32 triangles with the shell); every part manifold, no loose edges, with the hood's
    Solidify evaluated. Separate islands are deliberate: strips and plates sit on their
    base parts (pouches 7, harness 3, visor 3, sneaker 3) (structure.json) .......... pass
  - silhouette kept from pass 1: front 0.904 (pass 1: 0.902), right 0.935 (0.937), back
    0.852 (0.852), left 0.936 (0.934). Side views within 1.7 cm from 0.02 to 2.14 m;
    the front head is within 1 cm from 1.74 to 1.98 m now that the rim strips sit on the
    rim (head IoU 0.927 to 0.956) .................................................... pass
  - capsule fit: head and torso inside the 0.36 m cylinder (hood 0.234 m, hood trim
    0.239, harness 0.275, pouches 0.274); deltoid plates at the wall (0.36 m in x,
    0.40 m at the back corner); hands 0.457 m and toe corners 0.418 m, within the
    0.15 m allowance ................................................................ pass
Silhouette overlap with the references (IoU, head/torso/legs): front 0.904 (0.956,
  0.950, 0.828); right vs 02 mirrored 0.935 (0.959, 0.966, 0.963); back 0.852 (0.894,
  0.869, 0.819); left vs 02 0.936 (0.962, 0.971, 0.962).
Budget: 3,808 triangles, 24 of them the review arrow (target 6-10k; the form pass adds the
  faceting and bevels), 4 materials plus the review-only marker.
Evidence: sheet.png (references 01, 02 mirrored, 03, 02), front/right/back/left.png,
  three-quarter.png, gameplay.png, gameplay-near.png, overlay-front/right/back/left.png,
  overlays.png, overlay-metrics.json, pivot-test.png, pivot-test.json, structure.json
Next change (pass 3, form): bevels and the sheet's angular facets on every plate (chest,
  shoulder, deltoid, forearm and knee), the hood's faceted panels and thick rim, the chest
  slash as a 3 cm block, split fingers with knuckle plates and the glove cuff, pouch flaps
  and buckles, the back plate's shoulder yoke (03), sneaker panels, laces and the red
  collar, and the knee chevrons and strips behind the knees (brief D2).
```

## Rounds (2 of 3 refine rounds used; asset total 5 of 6)

| Round | Change | Front | Right (02 mirrored) | Back | Left (02) |
| ----- | ------ | ----- | ------------------- | ---- | --------- |
| r0 | Structure build: joint pivots, hierarchy and rigJoint; chest node; belt and pouches, torso and chest plates split; glove split into glove, fingers and thumb, with a wider palm (11.8-12.2 cm at 0.98-1.02 m; 01: 12.5-12.9); strap carried over the left shoulder toward the back plate (brief decision 6); from pass 1: hood rim strips moved onto the rim of a 1-2.4 cm narrower face opening, hood hem 1.1-1.5 cm wider per side, sole with a rounded toe | 0.902 | 0.931 | 0.851 | 0.936 |
| r1 | Strap routed under the hood's hem and the top shoulder plate (r0: it stood 6.4 cm proud of the left shoulder at 1.78 m); sole and toe cap with 3.5 cm of toe spring (r0: toe 2.3-4.1 cm short at 0.06-0.14 m in profile); hood tip moved forward; back of the thighs 2 cm shallower at the knee (r0: 2.3 cm deep at 0.70 m) | 0.904 | 0.935 | 0.852 | 0.936 |
| r2 | Hood tip back 1.7 cm (r1 overshot: 1.7-2.0 cm forward at 2.14 m); top shoulder plate split from the deltoid plate so the rig can bind them differently | 0.904 | 0.935 | 0.852 | 0.936 |

The remaining front and back differences come from the references themselves: 01's legs
sit 1.2 cm to the character's left and its soles spread 3-6 cm at 0.02-0.06 m (perspective),
and 03 hangs the hands 4-5 cm closer to the body and draws the hood tip 3-5 cm wider on one
side at 2.14 m.
The 0.86 m band is the reference mask losing the black fingertips (pass 1, "Method").

## Part and joint table

| Part | Bone (`rigJoint`) | Parent | Pivot (game m) | Triangles |
| ---- | ----------------- | ------ | -------------- | --------- |
| pelvis | hips | seeker_hunter (root) | 0, 1.00, 0 | 124 |
| belt, pouches | hips | pelvis | 0, 1.00, 0 | 72, 84 |
| torso | spine | pelvis | 0, 1.14, 0 | 348 |
| chest (empty) | chest | torso | 0, 1.42, -0.01 | - |
| chest_plates, harness | chest | chest | 0, 1.42, -0.01 | 36, 252 |
| head (empty) | head | chest | 0, 1.74, -0.01 | - |
| hood, hood_trim, face_plate, visor | head | head | 0, 1.74, -0.01 | 668, 72, 140, 36 |
| upper_arm.R / .L | upper_arm | chest | ∓0.237, 1.655, -0.065 | 76 |
| shoulder_plate, deltoid_plate | upper_arm | upper_arm | ∓0.237, 1.655, -0.065 | 24, 24 |
| forearm.R / .L, forearm_plate | forearm | upper_arm, forearm | ∓0.305, 1.385, -0.085 | 56, 24 |
| glove.R / .L | hand | forearm | ∓0.385, 1.135, -0.03 | 108 |
| fingers.R / .L | fingers | glove | ∓0.388, 0.968, 0.01 | 76 |
| thumb.R / .L | thumb | glove | ∓0.372, 1.07, 0.03 | 44 |
| weapon_socket (empty) | weapon_socket | glove.R | -0.39, 0.99, 0.005 | - |
| thigh.R / .L | thigh | pelvis | ∓0.12, 0.99, 0.025 | 92 |
| holster | thigh.R | thigh.R | -0.12, 0.99, 0.025 | 24 |
| shin.R / .L, knee_plate | shin | thigh, shin | ∓0.186, 0.60, 0.02 | 164, 128 |
| sneaker.R / .L | foot | shin | ∓0.25, 0.13, -0.02 | 148 |

The character's right side is game -X, and `.R` parts use the upper sign in each ∓.

## Notes for later passes

- Rig: the top shoulder plates follow the upper arm here; in the pivot test a 70° raise
  swings them up toward the hood. Binding them partly to the chest (or a helper bone) is
  the rig pass's call. The hood's hem hangs below the neck joint onto the trapezius, so its
  bottom rows need neck and chest weights, not just the head bone. The belt and pouches
  ride on the torso's lower edge but bind to the hips, like the hider's waist.
- Crouch at 1.12 m is still unproven. Pose `crouch_idle` and `slide` as extremes straight
  after rigging (brief, "Crouch at 1.12 m").
- The arms now hang 3.5 cm further back than the intake plan, as in 02 (pass 1). The aim
  pose in the socket contract still works: today's grip point is 0.65 m from the right
  shoulder (0.62 m in the brief) against about 0.70 m of reach.
- The pivot test is a rigid-part check only; joint deformation at the shoulders and hips
  belongs to the rig pass.
- One refine round is left for the whole asset (5 of 6 used), so the form, material, rig
  and optimize passes need a new budget from the user.
- Method: as pass 1. The pivot test poses the structure .blend with the rotations listed
  in `pivot-test.json` and checks, with BVH overlap, that each part still intersects its
  nearest mesh ancestor or a part on the same joint. The scripts are scratch tools, not
  repository tools.
