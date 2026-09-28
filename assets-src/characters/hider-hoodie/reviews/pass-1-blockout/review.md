# Pass 1: blockout

```text
Pass: 1 blockout        Source: scripts/characters/hider_hoodie.py --stage blockout
                        (script sha256 e6f961bb7246..., uncommitted, branch
                        art/hider-hoodie). Pass 2 then changed shared proportions (sole
                        0.085 m, sleeves 6% thinner, the knuckle joint), so the current
                        script's blockout stage no longer reproduces these renders exactly.
Decision: continue
Overall match: 7/10 (blockout: masses and proportions only)
Feature checks (identity-defining, blockout tolerance ±2 cm unless noted):
  - height: hood peak 2.160 m at the collision height (re-imported preview GLB) ..... pass
  - proportions: cap crown to chin 0.33 m, 6.5 heads (sheet 0.34 m, 6.3 heads) ..... pass
  - hood up over the cap: front outline within 1.5 cm at 1.80-2.10 m; brim tip
    +0.231 m (sheet +0.236 m); mask and cap front show through the opening ......... pass
  - hoodie: shoulders at 1.70 m within 1.4 cm, sleeves at 1.44 m within 2 cm,
    cyan cuffs 1.28-1.38 m, hem band 1.09-1.16 m .................................. pass
  - bag on the back: 0.255 m behind the axis (sheet 0.25), spans 1.31-1.60 m
    (sheet 1.30-1.59) .............................................................. pass
  - baggy joggers with cargo pockets: 0.80 m within 2 mm, knees within 8 mm,
    cuffs within 1.4 cm (front); back-view calves 2-3 cm narrow, where the back
    view is itself 2-3 cm wider than the front view ................................ pass
  - chunky sneakers: side toe and heel within 1 cm at 0.08-0.24 m; white sole
    0.055 m thick vs about 0.085 m in the sheet, front sole flare 3 cm narrow ...... refine, carried to pass 2
  - capsule fit: head and torso inside the 0.36 m cylinder; only the hands
    (0.386 m) and sole edges (0.36 m) reach it; brim and bag inside ............... pass
Silhouette overlap with the references (IoU): front 0.892; side 0.893, 0.915 below
  1.66 m; back 0.889, 0.888 below 1.66 m. The side and back references show the hood
  down, so the head above 1.66 m is compared with 01 and the hood detail instead
  (brief decision 2).
Evidence: sheet.png, front/right/back/left.png, gameplay.png, gameplay-near.png,
  overlay-front/right/back.png, overlay-metrics.json
Next change: in the pass-2 build, a 0.085 m sole with its flare back to ±0.36 m in the
  front view, and a glove with a palm and curled fingers. The blockout box sits
  2.5 cm inside the sheet at the palm (0.96-1.04 m) and 1 cm outside at the
  fingertips (0.90 m).
```

## Rounds (3 of 3 refine rounds used; asset total 3 of 6)

| Round | Change | Front | Side (below 1.66 m) | Back (below 1.66 m) |
| ----- | ------ | ----- | ------------------- | ------------------- |
| r0 | First build from the measured proportion table | 0.859 | 0.875 (0.895) | 0.842 (0.838) |
| r1 | Shoulders raised 2 cm and hood collar widened to ±0.24 m; brim +12 mm; bag 28° tilt, 15 cm tall; thighs +12 mm with cargo pockets; calves 1.5 cm back; toe +25 mm; hands in 1.5 cm | 0.889 | 0.876 (0.893) | 0.866 (0.861) |
| r2 | Legs 1 cm outward; calves +6 mm; tapered sneaker upper (low heel, taller toe box); bag up 1.5 cm | 0.887 | 0.894 (0.917) | 0.877 (0.874) |
| r3 | Toe-out 18° to 10° with a flared, longer sole (heel and toe now within 1 cm); pockets 1.7 cm in | 0.892 | 0.893 (0.915) | 0.889 (0.888) |

What the overlays showed, in order: shoulders about 6 cm narrow at 1.70 m (r0), thighs
4 cm narrow without pockets (r0), the bag reaching from 1.27 to 1.61 m (r0), a shoe block
too tall at 0.24 m with a toe 3 cm short (r0-r1), and a heel counter 4 cm too far back
(r2). All of these are within 2 cm after r3 except the sole thickness above.

## Visual notes

- The value split reads in `gameplay.png` (9 m) and `gameplay-near.png`: light hood and
  hoodie over black legs, with the hood outline as the head shape.
- In the side views the hood-up head is deeper than the sheet's cap-only head. That is
  by design (brief decision 2), and the depth (0.21 m behind the axis) matches the hood
  detail crop.
- The bag is a plain box and the hands are single boxes. Bag form, harness, fingers and
  the sneaker's sole and upper split belong to pass 2.

## Method

- References: `refs/01-front.png`, `02-side-right.png` and `03-back.png`. They share
  `review_renders.py`'s orthographic framing, so each overlay compares like with like at
  the same scale.
- Overlays: a guide-free render of the same views is compared with the reference
  silhouettes. Magenta marks reference only, cyan marks model only, and the yellow dotted
  line is 1.66 m. The reference silhouettes are cut out automatically (OpenCV GrabCut),
  with strongly coloured regions (skin, cyan) grown back in. GrabCut had dropped the
  black left glove, which is why that step exists.
- The overlays and IoU values come from a scratch script, not a repository tool. The
  render mask threshold is 8 levels: at the original 24, a shaded hood facet 12 levels
  from the background dropped out and made the hood look asymmetric.
