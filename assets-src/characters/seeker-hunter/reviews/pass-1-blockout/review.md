# Pass 1: blockout

```text
Pass: 1 blockout        Source: scripts/characters/seeker_hunter.py --stage blockout
                        (script sha256 2f0109a78bf5..., preview GLB sha256 242780a79086...,
                        207,840 bytes; uncommitted, branch art/seeker-hunter). Pass 2 then
                        changed shared tables (hood rim and hem, glove, sole, strap route),
                        so the current script's blockout stage no longer reproduces these
                        renders exactly.
Decision: continue
Overall match: 7/10 (blockout: masses and proportions only)
Feature checks (identity-defining, blockout tolerance ±2 cm unless noted):
  - height and proportions: hood peak 2.160 m at the collision height (re-imported
    preview GLB); visor bar 1.955 m, chin 1.775 m, crotch 0.96 m, fingertips 0.855 m
    (brief: 1.96, 1.78, 0.96, 0.86) ................................................. pass
  - pointed hood with the T visor (S2): peak apex at 2.16 m; side views within 1.4 cm
    from 1.76 to 2.12 m, rim tip +0.210 m at 2.04 m (sheet +0.217); front view within
    1.4 cm except the peak at 2.14 m (2 cm narrow on one side) and 1.90-1.98 m, where
    the rim strips sit outside the hood and widen it by 1.4-2.4 cm per side (moved in
    pass 2) ......................................................................... pass
  - armoured shoulders (S2): 0.711 m across the deltoid plates at 1.54 m (sheet 0.710,
    brief 0.72); top plates reach 0.282 m at 1.70 m (sheet 0.284); front outline within
    1 cm from 1.54 to 1.74 m ........................................................ pass
  - torso gear: chest plates, diagonal strap, belt with front, side and rear pouches;
    side profiles within 1.4 cm (right) and 1.7 cm (left) from 0.90 to 1.70 m, front
    and back edges ................................................................... pass
  - flat back plate (S3): bevelled, 1.37-1.725 m, 0.262 m behind the axis (0.268 m with
    its light; limit 0.27), vertical light in the middle; side view within 1 cm at
    1.40-1.60 m ...................................................................... pass
  - arms and gloves: forearms and gloves within 1.4 cm of 01 at 0.94-1.38 m on both
    edges; wrist 8.5-8.8 cm (sheet 8.8-9.1); gloves 11-11.5 cm wide at 0.96-1.02 m
    against 01's 12-13 cm (the thumb comes in pass 2); upper arm 1.3-2.7 cm narrow at
    1.42-1.50 m, where 01's mask may include the dark arm-torso gap .................. pass
  - legs, knee plates, sneakers: side profiles within 1.4 cm from 0.06 to 0.86 m except
    the back of the knee at 0.70 m (2 cm); knee plate front +0.183 m at 0.64 m (sheet
    +0.186), heel -0.14 m; the sole's toe edge is 2.4-2.7 cm long at 0.02 m. Front shins
    within 2.4 cm. 01's soles spread 3-5 cm wider at 0.02-0.06 m than the model's and
    01 itself is 3 cm lopsided at the feet (perspective render) ..................... pass
  - capsule fit: head and torso inside the 0.36 m cylinder (hood 0.249 m, back plate
    0.275 m, pouches 0.274 m); deltoid plates at the wall (0.36 m in x, 0.40 m at their
    back corner); hands 0.451 m and toe corners 0.44 m, within the 0.15 m allowance ... pass
Silhouette overlap with the references (IoU): front 0.902 (head 0.927, torso 0.950, legs
  0.832); right 0.937 (0.962, 0.970, 0.964); back 0.852 (0.876, 0.870, 0.822); left
  0.934 (0.958, 0.969, 0.958). The right view is compared with 02 mirrored, the left
  view with 02 itself.
Budget: 3,488 triangles (target 6-10k; structure and form add the detail), 4 materials.
Evidence: sheet.png (references 01, 02 mirrored, 03, 02), front/right/back/left.png,
  three-quarter.png, gameplay.png, gameplay-near.png, overlay-front/right/back/left.png,
  overlays.png, overlay-metrics.json
Next change (pass 2): hood rim strips onto the rim of the face opening instead of the
  hood's outer sides; the hood hem 1-2 cm wider at 1.74-1.79 m; the sole's toe 2.5 cm
  shorter; hands with a palm, thumb and finger block; parts split and pivoted at the
  joints with weapon_socket.
```

## Rounds (3 of 3 refine rounds used; asset total 3 of 6)

| Round | Change | Front | Right (02 mirrored) | Back | Left (02) |
| ----- | ------ | ----- | ------------------- | ---- | --------- |
| r0 | First build from the brief's scale plan and landmark table | 0.873 | 0.864 | 0.837 | 0.865 |
| r1 | Top shoulder plates at 28° and shorter, deltoid plates 1.4 cm in and 1.69-1.52 m tall; chest plates tilted back and 2 cm flatter with the strap on them; arms 3.5 cm back (02's deltoid plate is at z -0.02 to -0.16 m); knee plates rebuilt as a shield along the shin; sneaker rebuilt as a sole plus a lofted upper; hood 1.5-2 cm narrower at 1.90-1.98 m with its back hem at 1.70 m; bevelled back plate; front pouches lower and flatter, rear pouches flat; lofted gloves | 0.896 | 0.931 | 0.854 | 0.930 |
| r2 | Upper arm continued 4 cm above the shoulder joint (closes a 4.4 cm torso-arm gap at 1.66 m); chest plates at 8°, up to 1.71 m; lower chest 1 cm forward, lower back 1.5 cm back and waist 1 cm narrower at 1.30-1.38 m; wrists 11 to 9 cm; side pouches 1.5 cm in; hood back fuller at 1.80 m | 0.903 | 0.936 | 0.855 | 0.934 |
| r3 | Toe-out 12° to 9°, sneaker upper 1 cm narrower, fuller toe cap at 0.10 m | 0.902 | 0.937 | 0.852 | 0.934 |

What the overlays showed, in order: shoulders 2.4-3.8 cm too wide at 1.54-1.74 m and the
chest 2-4 cm too far forward (r0); knee pads 8.8 cm proud at 0.50 m and heels 3-4 cm too
far back with no toe box (r0); the box back plate 3.7 cm too deep at 1.42 m (r0); a gap
between the torso and the arm under the shoulder plate, the collar 3 cm short at 1.72 m
and the wrists 2 cm too thick (r1); shoes 2-4 cm too wide at 0.14-0.22 m and the toe
2.7 cm short at 0.10 m (r2). r3 traded 0.003 of front IoU for a side toe within 1.4 cm and
an upper within 3 cm; the remaining front error at the feet is 01's perspective spread.

## Visual notes

- The value split reads in `gameplay-near.png`: a black hooded figure with red marks at
  the visor, hood rim, shoulders, forearms, hips, knees and ankles. At 9 m
  (`gameplay.png`) the red marks still separate head, shoulders, arms and feet.
- The side view now hangs the arms behind the chest, as 02 does; the r0 build had them
  on the chest's midline, which put the deltoid plate 6 cm too far forward.
- Accent strips are blockout placeholders for the D2 groups; their shapes and sizes
  belong to the form and material passes. The hood rim strips are misplaced (above).
- The hands are lofted mittens. Palm, thumb and finger block are pass 2.

## Method

- References: `refs/01-front.png`, `refs/02-side-left.png` (mirrored into
  `refs/02-side-left-mirrored.png` for the right view) and `refs/03-back.png`. They share
  `review_renders.py`'s orthographic framing, so each overlay compares like with like at
  the same scale.
- Overlays: guide-free renders of the same views (Workbench, alpha only) are compared with
  the reference silhouettes. Magenta marks reference only, cyan model only, grey both; the
  dotted lines are 1.76 m and 1.12 m. The model mask is aligned by its body axis and
  ground line; `bestShift` in `overlay-metrics.json` shows at most 2 px left after that.
- Reference silhouettes are cut out automatically (edge density plus OpenCV GrabCut).
  The mask loses the black fingertips below 0.88 m against the dark backdrop, so the
  0.86 m band (±14 cm) is an artifact, not a model error.
- The overlay and IoU scripts are scratch tools, not repository tools.
