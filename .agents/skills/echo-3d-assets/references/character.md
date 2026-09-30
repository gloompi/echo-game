# Character contract

Values come from `shared/rules.json` and `shared/movement.json`; re-read them rather than
trusting the copies here. Current values: collision radius 0.36 m, standing height 2.16 m,
eye 1.76 m, crouch height 1.12 m, crouch eye 0.92 m.

## Folder

```text
assets-src/characters/<id>/
  brief.md  refs/  reviews/  validation-glb.json
  <id>.blend                          source: generated mesh cleaned up live through the MCP
  build-log.py                        generation job IDs and accepted live steps, in order
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
- Skins recolour clothing/armour at runtime. Put the recolourable region on materials named
  `tint_light` (shirt/primary), authored in the `classic` colour; everything else keeps its
  own colour. The asset's definition in `client/character-assets.ts` gives one colour per
  skin (`HIDER_HOODIE.tints`), because the procedural `PALETTES` pairs in `client/models.ts`
  need not suit a new design. `tint_dark` (trousers/armour/secondary) is reserved but not
  applied yet: no authored character uses it.
- The ghost/decoy variant replaces every material at runtime, so do not rely on vertex
  colours or material-specific geometry for readability.

## Rig

- Start from the plugin's auto-rig on the cleaned mesh
  ([live-blender.md](live-blender.md#6-auto-rig-characters)), then conform it to this
  contract live: rename bones, add `root` and sockets, drop unused bones.
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

Implemented for the Hider (`hider-hoodie`) and the Seeker (`seeker-hunter`):

- `client/character-assets.ts` defines each authored character: URL, per-skin tints, the
  speeds its `run` and `crouch_walk` were authored for (measured foot speeds), its upper-body
  `overlay` clip (`wave` or `aim`), and optionally a `weaponSocket` and a `pitchBone`.
  `CharacterModel` loads the GLB once per page and rejects a model without a skinned mesh,
  `tint_light`, any required clip, an overlay that moves the legs, or a named bone it lacks.
  An emissive `tint_light` glows in the skin colour.
- `client/skinned-character.ts` clones the whole scene per player (`SkeletonUtils.clone`;
  three.js makes one SkinnedMesh per primitive, rebound here to one skeleton) and plays the
  clips on one `AnimationMixer`. The legs play the base clip; the upper body plays the same
  clip in step, or the overlay; `hit` is additive. A Seeker holds its weapon at
  `weapon_socket` and leans `chest.upper` into the view pitch. It disposes only its own
  skeleton, never the shared geometry, materials, clips or weapons.
- `client/weapon-assets.ts` loads the four generated weapons once per page (metres, +Z muzzle,
  origin in the grip, `muzzle` node). All four share one layout, front grip 0.31 m ahead of and
  0.03 m above the grip, so one Seeker clip set holds each. The procedural weapons stay as the
  fallback, also in the first-person view.
- `client/game/character-motion.ts` chooses the clip from the `Pose` fields (`moving`,
  `grounded`, `crouched`, `sliding`, `waving`) and scales `run` and `crouch_walk` with the
  ground speed (0.5-2x). The overlay and `hit` never play over a crouch or slide: authored
  standing, they would lift the head above the crouch clearance.
- `Character` in `client/models.ts` keeps the procedural body as the fallback while the
  model loads or if it fails. The ghost echo swaps in the ghost materials.
- Culling uses each mesh's bind-pose bounding sphere grown by 0.4 m. Export with no scaled
  node: three.js culls with the node's world matrix, so a leftover armature scale shrinks the
  sphere. `tests/character-model.test.ts` and `tests/seeker-model.test.ts` check every clip,
  both hands on every weapon, and the crouch clearance with the weapon held.

Observation privacy is unchanged: the character only renders poses the client was
authorized to receive. Not implemented yet: `tint_dark`.
