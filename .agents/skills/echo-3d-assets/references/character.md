# Character contract

Values come from `shared/rules.json` and `shared/movement.json`; re-read them rather than
trusting the copies here. Current values: collision radius 0.36 m, standing height 2.16 m,
eye 1.76 m, crouch height 1.12 m, crouch eye 0.92 m.

## Folder

```text
assets-src/characters/<id>/
  brief.md  refs/  reviews/  <id>.blend  validation-glb.json
scripts/characters/<id>.py            reproducible build (recommended; required for the
                                      scripted route), writes the .blend and the GLB
public/assets/characters/<id>.glb     runtime export only
```

## Geometry

- Metres, origin at the midpoint between the feet on the ground, facing game +Z
  (Blender -Y), +Y up. No object-level scale or rotation left unapplied at export.
- Standing height (top of head or helmet) 85-110% of the collision height; head and torso
  inside the collision capsule; limbs and gear extend at most about 0.15 m.
- Crouch clips must fit within the 1.12 m crouch clearance; players crouch under 1.12-2.16 m
  lintels. `validate_glb.py` samples every `crouch*` clip.
- Triangle target 6-10k (hard cap 15k): up to 12 players are on screen. Spend triangles on
  silhouette (head, hands, gear), not on flat surfaces. Bevel hard edges so the blocky style
  catches light; avoid thin parts that shimmer at 9 m.
- Separate objects are fine while authoring. Export one skinned mesh (or a few) per
  character; keep the material count at 5 or fewer.

## Materials and skins

- Stylized PBR (`Principled BSDF` base colour, roughness, small metallic, optional
  emission). Prefer flat colours or a small palette atlas over noisy textures; textures 1024
  px target, 2048 max.
- Skin palettes recolour clothing/armour at runtime (`PALETTES` in `client/models.ts`: a
  light and a dark colour per skin). Put recolourable regions on materials named
  `tint_light` (shirt/primary) and `tint_dark` (trousers/armour/secondary), authored in the
  `classic` colours. Everything else keeps its own colour. This naming is the proposed
  runtime contract; the loader code that applies it does not exist yet.
- The ghost/decoy variant replaces every material at runtime, so do not rely on vertex
  colours or material-specific geometry for readability.

## Rig

- One armature, at most 64 deform bones, at most 4 influences per vertex (Three.js
  skinning). Suggested names: `root` (at the feet), `hips`, `spine`, `chest`, `neck`,
  `head`, `upper_arm.L/R`, `forearm.L/R`, `hand.L/R`, `thigh.L/R`, `shin.L/R`, `foot.L/R`.
  Seeker adds `weapon_socket` under `hand.R`, oriented so +Z is the muzzle direction.
- Blocky characters may use rigid weighting (one bone per part); organic parts need
  smooth weights around shoulders and hips. Test extremes (crouch, slide, wave) before
  authoring the full clip set.
- Clips are in place: the game moves the character; `root` never translates horizontally.

## Clip set

| Clip                         | Loop | Notes                                                                       |
| ---------------------------- | ---- | --------------------------------------------------------------------------- |
| `idle`                       | yes  | Subtle breathing; no foot sliding                                           |
| `run`                        | yes  | Authored for about 6.4 m/s ground speed; runtime scales playback with speed |
| `jump`                       | hold | Airborne pose                                                               |
| `crouch_idle`, `crouch_walk` | yes  | Fit 1.12 m clearance                                                        |
| `slide`                      | hold | Low, forward-leaning; fits 1.12 m                                           |
| `hit`                        | no   | 0.4-0.45 s reaction (runtime hit window is 0.42 s)                          |
| `wave`                       | yes  | Hider only (upper body)                                                     |
| `aim`                        | hold | Seeker only; weapon raised; runtime still applies camera pitch              |

Store each clip's frame range and fps in the action; `validate_glb.py` reports seconds.
Check loops across the seam and foot contact in the side view.

## Validate

```bash
"$B" --background --factory-startup --python-exit-code 1 --python scripts/blender/validate_glb.py -- \
  --glb public/assets/characters/<id>.glb --kind character \
  --clips idle,run,jump,crouch_idle,crouch_walk,slide,hit,<wave|aim> \
  --out assets-src/characters/<id>/validation-glb.json
```

## Integration (separate echo-change task)

The runtime currently builds characters procedurally in `client/models.ts` (`Character`,
driven by `Pose` fields `moving`, `grounded`, `crouched`, `sliding`, `dashing`, `waving`,
`pitch`, `hitAt`, `skin`, `weapon`). Loading a GLB character needs a cached loader, cloned
skinned instances per player (`SkeletonUtils.clone`), an `AnimationMixer` per character
mapped from those pose fields, tint and ghost handling, weapon attachment at
`weapon_socket`, and disposal that never frees shared cached resources. Keep the
procedural character as the fallback while the model loads or fails. Observation privacy is
unchanged: the character only renders poses the client was authorized to receive.
