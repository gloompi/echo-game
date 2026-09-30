# seeker-hunter brief

```text
Asset: character
ID: seeker-hunter
Role: seeker
Replaces in game: no, side-by-side until the user approves

Identity to keep: none from the current blue armoured Seeker (see identity changes); the
  orange blaster and the other current in-game weapons stay as they are
Identity changes (explicit, user-approved 2026-09-25): replace the blue armoured Seeker with
  the supplied design: black hooded tactical suit, glowing red T-shaped visor, angular
  shoulder, forearm and knee armour plates, diagonal chest strap, belt with pouches, red
  accent strips, gloves, black/red sneakers. Red accents replace the cyan/magenta direction
  for the Seeker only.
Style words: faceted low-poly tactical, bevelled angular plates, dark flat materials,
  emissive accent strips
Avoid: the weapons row (assault rifle, shotgun, sidearm, tracker grenade); any change to the
  in-game weapons; noisy textures; parts under ~3 cm that shimmer at 9 m
References: supplied, authoritative: refs/00-sheet.png; crops and provenance in refs/

Mesh route: scripted
Generation budget: 0 (ask before any paid job)
Triangle target: 6-10k, hard cap 15k
Animations: default Seeker set: idle, run, jump, crouch_idle, crouch_walk, slide, hit, aim
Weapon: a weapon_socket on the right hand for the current weapons (blaster, scatter,
  repeater, web)
Skins: the red accents and the visor glow are the recolour region (emissive); map the sheet's
  variations (default red, arctic, void, sand, stealth) onto classic, cobalt, ember, jade,
  violet, arctic, sunset, carbon
Done means: renders match the sheet's front/side/back, clean validate_glb, review sheet for
  every pass
```

## Status

Phase 2 of 4 (pass 1 blockout, pass 2 structure) is done; waiting for the user before pass 3
(form). `scripts/characters/seeker_hunter.py --stage blockout|structure` builds
`seeker-hunter.blend` and a preview GLB (no rig, no clips, not in `public/`); the reviews are
`reviews/pass-1-blockout/` and `reviews/pass-2-structure/`. 5 of the asset's 6 refine rounds
are used (3 in pass 1, 2 in pass 2).

Work happens in a sibling worktree, `C:\Users\MyMUSTEX\Desktop\works\echo-game-seeker-hunter`,
on branch `art/seeker-hunter` from `main` (74c64ee). Nothing is committed.

## Reference pack

| File                     | Use                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `00-sheet.png`           | Byte copy of the supplied sheet (SHA-256 in provenance)                               |
| `01-front.png`           | Front match target; widths and heights are measured here                              |
| `02-side-left.png`       | Side match target. The figure faces image-left, so this is the character's left side  |
| `02-side-left-mirrored.png` | 02 flipped left-right (derived, Phase 2): the reference beside the "right" render  |
| `03-back.png`            | Back match target: back plate and its light, rear pouches, holster strap, knee strips |
| `10-part-hood-visor.png` | Hood facets, face plate, T visor shape, hood rim strips                               |
| `10-part-chest.png`      | Chest plates, sternum light, strap, left chest pouch                                  |
| `10-part-glove.png`      | Glove segments, knuckle plates, framed light bar on the back of the hand              |
| `30-colour-1…5-*.png`    | DEFAULT, ARCTIC, VOID, SAND, STEALTH: colour sources for the skin mapping             |

01-03 are framed like the `review_renders.py` orthographic views (square, 1.15 × model height,
model centred, 1:1 sheet pixels), so a review `sheet.png` shows each reference and its render
at the same scale. The review "left" render compares with 02 directly; the "right" render
compares with 02 mirrored, except the right-thigh holster and the strap. The weapons row is out
of scope and not cropped.

Intake evidence in `reviews/intake/`: `scale-plan.png`, `readability.png`, `skins.png` and
`measurements.json` (every landmark with its sheet pixel, reach, crouch estimate and measured
colours).

## Scale plan

The front view measures 638.5 px from the hood peak to the soles. The back (641.5 px) and the
side (634.5 px) agree within 1%. Scale uniformly with the **hood peak at 2.16 m**, as for
hider-hoodie: 3.38 mm per sheet pixel (295.6 px/m). The sheet views are perspective renders,
not orthographic (in the side view the far foot sits 9 cm above the near one), so the numbers
carry about 2-3% error. Heights and widths come from the front view.

| Landmark                      | Height (m) |
| ----------------------------- | ---------- |
| Hood peak                     | 2.16       |
| Hood rim, top of face opening | 2.03       |
| Visor T bar (centre)          | 1.96       |
| Visor T stem bottom           | 1.81       |
| Face plate chin               | 1.78       |
| Shoulder plate tops           | 1.75       |
| Deltoid plates                | 1.67-1.52  |
| Elbow                         | 1.37       |
| Belt pouches                  | 1.28-1.14  |
| Wrist / glove cuff            | 1.12       |
| Crotch                        | 0.96       |
| Fingertips (A-pose)           | 0.86       |
| Knee pads                     | 0.73-0.48  |
| Shoe collar                   | 0.25       |

About 5.7 heads tall (hood peak to chin 0.38 m); the crotch is at 45% of the height.

Horizontal reach from the body axis, against the 0.36 m movement cylinder:

| Part                          | From axis     | Cylinder        |
| ----------------------------- | ------------- | --------------- |
| Hands, A-pose                 | 0.45-0.46 m   | 0.09-0.10 m out |
| Forearms at the elbow, A-pose | 0.41-0.42 m   | 0.05-0.06 m out |
| Shoe edges, A-pose stance     | 0.38-0.39 m   | 0.02-0.03 m out |
| Deltoid plates                | 0.36 m        | at the wall     |
| Shoulder plate tops           | 0.29 m        | inside          |
| Back plate                    | 0.27 m behind | inside          |
| Toe / heel                    | 0.27 / 0.14 m | inside          |
| Hood rim tip                  | 0.22 m ahead  | inside          |
| Chest plate                   | 0.19 m ahead  | inside          |
| Hood sides                    | 0.19 m        | inside          |

- **Shoulder plates.** Two per side: a plate on top of the shoulder (red top) at 1.70-1.75 m,
  reaching 0.29 m out, and a deltoid plate on the upper arm from 1.67 to 1.52 m (0.15 m tall,
  0.13 m deep) whose outer face sits on the cylinder wall. Across the deltoid plates the
  Seeker is 0.72 m wide; the Hider's shoulders are 0.55 m. That width is the Seeker's main
  front silhouette cue (conflict 1), so it stays. The plates can touch walls in narrow
  passages, which is cosmetic.
- **Hood.** Peak 2.16 m, 0.21 m above the visor bar, so about 8 cm of hood stands above the
  skull. 0.38 m wide and 0.41 m deep: the rim tip is 0.22 m ahead of the axis at 2.03 m and
  the back 0.18 m behind it. The face opening is 0.33 m wide and runs from 2.03 m down to the
  chin at 1.78 m. The visor bar is 0.14 m wide and 2.2 cm thick; the stem is 0.14 m long and
  2 cm wide, under the 3 cm floor, so it is widened to 3 cm.
- **Hands.** Chunky armoured gloves, 0.26 m from the cuff to the fingertips and 0.12-0.14 m
  wide, about 1.3 times a real hand; kept. In the A-pose they reach 0.45-0.46 m from the axis,
  within the 0.15 m allowance for limbs. In play they hold the weapon in front of the chest.
  `weapon_socket` sits in the right palm, at about 0.98 m and 0.39 m from the axis in the bind
  pose.

What the capsule means for this role:

- Shots never test Seekers. `fire` in `crates/echo-core/src/room/combat.rs` skips every player
  who is not a Hider, and Seekers do not block shots, so the ±0.38 m hit box that shaped the
  hider-hoodie plan does not apply here. For a Seeker the cylinder governs how the body sits
  against walls, doorways and crouch gaps. The hook ability aims at the capsule centre (and
  reaches Seekers only with friendly fire). The mesh has no authority either way.
- The visor bar is at 1.96 m, 0.20 m above the 1.76 m camera eye. This is cosmetic: lowering
  it would need a bigger head than the sheet shows.
- Idle and run bob stay at 3 cm or less, because the hood peak can visibly touch a 2.16 m
  lintel.

## Conflicts and proposed handling

### 1. Readability against the white Hider

Measured in `readability.png`, at the same metres per pixel as the hider-hoodie targets
(`01-front`, and sheet B's hood-up `02b-side-right` and `03b-back`):

- **Value and colour separate cleanly.** The Hider's classic hoodie is L\* 91 over black
  joggers. The Seeker's fabric renders at L\* 16-20 and its plates at up to L\* 37, broken by
  red accents at L\* 58. In greyscale the Hider is a light top over dark legs; the Seeker is
  dark all over with bright lines.
- **Silhouette alone is close.** Both roles are now hooded 2.16 m figures. Silhouette overlap
  (IoU) is 0.79 front, 0.78 side and 0.83 back; above 1.70 m (the heads) it is 0.90, 0.74 and
  0.89. In profile both have a forward rim at the head (Hider brim about 0.23 m, Seeker hood
  rim 0.22 m) and a pack on the back at a similar depth (bag about 0.25 m, back plate 0.27 m).
- **What separates them:** the Seeker's 0.72 m armoured shoulders against the Hider's 0.55 m,
  the pointed hood against a round hood over a cap, the knee pads, the glowing visor, and above
  all the orange blaster held in both hands in front of the chest. The references don't show
  the weapon.

Proposed rules:

- **S1:** every Seeker clip (idle, run, jump, crouch_idle, crouch_walk, slide, hit, aim) keeps
  the weapon in both hands in front of the chest. No weapon-down or one-handed poses: the
  weapon and the raised arms are the strongest role silhouette.
- **S2:** keep the sheet's 0.72 m shoulder width and the pointed hood peak; do not slim the
  plates or round the hood. The hood rim projects no more than the sheet's 0.22 m.
- **S3:** the back plate stays flat and tight (no more than 0.27 m from the axis, about 9 cm off
  the back), with its vertical light visible from behind, unlike the Hider's bulky bag.
- **S4:** the form and material passes render seeker-hunter and hider-hoodie together at 9 m,
  weapon attached, as flat silhouettes from the front, side and back, in greyscale, and for all
  eight skin pairings. The role must read from silhouette alone and from value alone.
  `review_renders.py` only shoots gameplay views from the front-left, so the side and back
  views are extra renders.

Skins apply to both roles, so each skin puts the same hue family on both. The ember Hider's
red hoodie (#D8434B) is ΔE 14 from the classic Seeker's red accents; violet, sunset and cobalt
pair up the same way. The structure differs (a large mid-value hoodie against thin glowing
lines on black), so S4 covers it. Red now signals the Seeker, and the approved ember Hider
shares it; changing that approved hoodie is not proposed unless S4 fails.

### 2. Dark on dark in dim maps

On the sheet the suit fabric renders at L\* 16-20, the same as the sheet background (L\* 19);
the figure separates only through edge light and the accents. The game is darker: arena
background #07111E (L\* 5), authored maps #111C2E (L\* 10), garden #10282B (L\* 14). Scenes are
lit by a hemisphere light and one sun (`client/world.ts`, `client/map-world.ts`) with ACES tone
mapping and no bloom, and the procedural characters' outline is near-black (#080D1B), which
adds nothing to a black suit. Faces turned away from the sun will be close to black. Hiders
see Seekers live and need to, as do allied Seekers, so a Seeker that disappears in the dark is
an ambush advantage, not just a look.

- **D1, albedo floor:** no pure black. Fabric base L\* ≥ 18 (about #2C2B31, the sheet's own
  torso value); armour plates L\* ≥ 26 (about #403E46), with lower roughness than the fabric so
  they catch the sun. The face plate may be darker, framed by the visor. The suit still reads
  as black, with a value split between fabric and plates.
- **D2, glow coverage:** keep every accent group on the sheet: visor, hood rim strips, shoulder
  plate tops, deltoid plates, forearm plates, glove bars, sternum light, belt and holster
  strips, back plate light, knee chevrons, strips behind the knees and sole edges. Together
  they mark the head, shoulder line, arms, hips, knees and feet (last column of
  `readability.png`). Strips are at least 3 cm wide (2-3 px at 9 m at 1080p): the visor stem
  widens from 2 to 3 cm and the chest slash becomes a 3 cm block.
- **D3, brightness floor:** no skin's accent is darker than classic red (L\* 58); cobalt and
  violet are lifted to it (skin table).
- **D4, test:** the material pass renders the Seeker at 9 m and 20 m against #07111E, lit to
  approximate `client/world.ts` (hemisphere, sun, magenta rim, cyan fill), sun-facing and
  back-lit, in colour and greyscale, next to hider-hoodie. Acceptance: head, shoulder line and
  feet can be located at 20 m when back-lit. Integration then adds in-game screenshots in
  Afterhours (neon) and Mirror Yard.

The side view is the weak angle: no hood accent faces sideways, so in the dark the head reads
only by the edge of the visor. If D4 loses the head from the side, the first fix is to wrap the
existing hood rim strips a few centimetres round the rim so they show in profile. If D1-D3
still fail D4, the remaining lever is a lighter runtime rim or outline for players, which is an
integration change, flagged here and not planned.

### 3. Crouch at 1.12 m

1.12 m is 52% of the standing height. With shin 0.48 m, thigh 0.40 m, hip to neck 0.74 m and
neck to hood peak 0.42 m, an upright deep squat tops out near 1.6 m. The estimate in
`scale-plan.png` fits only a deep forward stalk: shins 45° forward, hips at 0.32 m, torso 55°
forward and head pitched 30° down put the hood peak at about 1.11 m. With the head 20° down it
reaches 1.14 m (validate_glb passes up to 1.17 m, but the target is 1.12 m); at 40° down,
1.07 m.

- In that pose the visor looks about 30° below the horizon while the local camera looks level.
  This is cosmetic: other players see a stalking pose.
- The knee pads come about 0.42 m forward, up to 0.06 m outside the cylinder.
- The hands hold the weapon about 0.6 m high in front of the knees (S1).
- If a clip does not fit, pitch the head down further first, then lower the hips. The hood
  keeps its shape.
- `crouch_idle` and `slide` are blocked as extreme poses straight after rigging, before the
  rest of the clip set.
- Today's client squashes a crouched procedural character to 52% height (`body.scale.y` in
  `client/main.ts`). A GLB with crouch clips must not also get that squash; this is an
  integration note.

### 4. Weapon socket

Today (`client/models.ts`) the weapon (`makeWeapon`: blaster, scatter, repeater, web, scaled
0.47) hangs from the character root. Its position comes from eye height and camera pitch:
origin (-0.27, 1.43, 0.49) m at pitch 0, rotating about the eye. The arms are turned forward
separately and never hold it. The first-person gun is a separate copy on the camera, and remote
shot tracers start at the server's shot origin, not at this muzzle, so the third-person weapon
position is cosmetic.

Proposed contract:

- `weapon_socket` is a bone (or empty) under `hand.R` with its origin at the grip point in the
  palm. In the aim pose +Z is the muzzle direction, +Y the weapon's top and +X the character's
  left. In the bind pose the right hand holds that frame with +Z forward (low ready), so the
  sheet's relaxed A-pose hands stay as drawn. Each hand gets a finger bone and a thumb bone so
  the clips can close the hand round the grip.
- All four current weapons share the blaster's grip block, centred at (0, -0.29, -0.05) in
  weapon space, which is (0, -0.136, -0.024) m at 0.47 scale. The loader parents the weapon to
  the socket with its root at (0, +0.136, +0.024) m. A named `grip` node in `makeWeapon` would
  replace that hard-coded offset (an echo-change task at integration).
- The aim pose places the socket where today's grip is, about (-0.27, 1.29, 0.47) m, so the
  weapon appears where players see it now. The right hand reaches it (0.62 m from the right
  shoulder; reach about 0.70 m). The left hand cannot reach the fore-end (about 0.9 m), so it
  supports the body of the weapon, with the torso turned 20-30° to the right.
- Camera pitch now rotates the weapon about the eye. With a socket, the loader has to turn the
  upper body instead; the rig provides `spine` and `chest` for that (integration decision).
- The chunky toy blaster (0.70 m long, 0.17 m wide at 0.47 scale) stays as instructed. If it
  looks oversized against the slimmer hands, the knob is the runtime scale, not the model.

### 5. Other findings

- **Strap.** The front shows one diagonal strap from the left shoulder to the right hip. The
  back shows only the back plate's shoulder yoke and no strap. Proposed: the strap runs over
  the left shoulder into the back plate, and nothing crosses the back diagonally, matching 03.
- **Swatch slips.** VOID also tints the hood purple and SAND leaves the chest slash red. Neither
  is followed: the suit stays black on every skin and every accent recolours.
- **Widths.** The back view is about 5% narrower at the hands than the front (perspective and
  pose); the front view governs widths.
- **Name clash.** The sheet's ARCTIC is blue, while the game's arctic skin is icy white. The
  mapping follows colour, not names.
- **Tint contract.** The accents are emissive, which the proposed `tint_light`/`tint_dark`
  contract does not cover yet. Proposed: one `tint_light` material for accents, visor and sole
  edges, authored in classic red, with the emissive colour equal to the base colour (as the
  procedural code does); no `tint_dark`. PALETTES cannot produce these colours (classic's light
  colour is off-white), so, as for hider-hoodie, the model needs its own per-skin table at
  integration.
- **hit clip.** No current game path damages a Seeker, so `hit` never plays today. It stays in
  the set because the default Seeker set and the validation command include it.
- **Run speed.** `run` is authored for 6.0 m/s (`seekerSpeed`), not the Hider's 6.4 m/s in
  `character.md`.
- **Identity documents.** Root `AGENTS.md` and the echo-3d-assets skill name the blue armoured
  Seeker and the cyan/magenta direction as role identity. This asset is an explicit exception
  approved by the user. If it replaces the in-game Seeker, those lines change in the
  integration PR.

## Skin mapping (proposed)

Mapped by colour, so each skin keeps the same colour family on both roles. The suit, plates and
face plate never recolour; accents, visor and sole edges share one emissive colour per skin.

| Skin    | Sheet source     | Accent and visor | L\* | Hider hoodie (approved) | Note                                       |
| ------- | ---------------- | ---------------- | --- | ----------------------- | ------------------------------------------ |
| classic | DEFAULT          | `#FA4E4D`        | 58  | `#EBE3D8`               | authored colour; sets the brightness floor |
| cobalt  | ARCTIC (blue)    | `#5A87FF`        | 59  | `#74A8EA`               | sheet `#4379FF` (L\* 54) lifted            |
| violet  | VOID             | `#CB5EFF`        | 60  | `#9A5DDF`               | sheet `#C64DFA` (L\* 56) lifted            |
| sunset  | SAND             | `#FCC559`        | 83  | `#E3B050`               | gold, like the Hider's sunset              |
| arctic  | STEALTH          | `#EAF2FF`        | 95  | `#DDE8F2`               | cool white, like the Hider's arctic        |
| carbon  | STEALTH, muted   | `#949FAD`        | 65  | `#7C828C`               | steel; PALETTES' own carbon light colour   |
| ember   | not on the sheet | `#FF7A2E`        | 66  | `#D8434B`               | orange, apart from classic red (ΔE 31)     |
| jade    | not on the sheet | `#3DDC84`        | 78  | `#3FAE7F`               | green, 38° away from the Hider's cyan      |

`skins.png` shows each proposal on the sheet's own front view (recoloured pixels, a mockup, not
a render). Values are sRGB material colours; the material pass sets the emissive strength and
tunes them without breaking D3.

- The closest pairs within the Seeker set are arctic/carbon (ΔE 30: bright white against muted
  steel) and classic/ember (ΔE 31: red against orange).
- Ember is ΔE 9 from the blaster's orange (#E87629), so on ember the weapon does not stand out
  from the accents. Acceptable, because it is the Seeker's own weapon.
- Violet is ΔE 20 from the magenta of the Hider's echo ghost (#F452E8). The ghost is
  translucent, full-body and seen only by its own Hider, so the risk is low; S4 checks it.
- Rejected alternatives: following the sheet's names (ARCTIC blue to arctic) leaves cobalt as
  a second blue; STEALTH white to carbon with an ice-blue arctic puts arctic between cobalt and
  the Hider's cyan.

## Defaults applied

- Game space: metres, +Y up, facing +Z, origin between the feet. The bind pose is the sheet's
  A-pose (feet 0.57 m apart centre to centre); `idle` narrows the stance.
- Four materials: `suit` (fabric, hood, gloves, shoe uppers; L\* ≥ 18, rough); `armour`
  (plates, pouches, holster, belt, back plate; L\* ≥ 26, smoother, slightly metallic);
  `faceplate` (glossy near-black); `tint_light` (emissive accents, visor, sole edges).
- Triangle plan about 9.5k: hood, face plate and visor 1.6k; torso, chest plates, strap, collar
  and back plate 1.8k; belt, four pouches and holster 1.1k; arms with shoulder, deltoid and
  forearm plates 1.4k; gloves 1.4k; legs and knee pads 1.2k; shoes 1.0k.
- Rig: the suggested bone list plus `weapon_socket` under `hand.R` and a finger and thumb bone
  per hand, about 30 bones. Plates are rigidly weighted; shoulders and hips are smooth.
- Clips: the default Seeker set, all holding the weapon (S1); review renders parent a stand-in
  blaster to the socket.
- Thin sheet details become readable forms: strips at least 3 cm, the strap at least 5 cm.
- Nothing from the weapons row.
- Build: `scripts/characters/seeker_hunter.py` writes `seeker-hunter.blend` and a preview GLB in
  this folder; a runtime GLB goes to `public/assets/characters/` only when integration is
  approved. Each pass gets a review under `reviews/`.

## Decisions (proposed at intake, accepted 2026-09-28)

1. Scale plan: hood peak 2.16 m (295.6 px/m), shoulder plates kept at the cylinder wall
   (0.72 m across), gloves kept at 0.26 m.
2. Readability rules S1-S4 and dark-map rules D1-D4, including the 3 cm floor (visor stem
   widened from 2 to 3 cm).
3. Crouch as a deep forward stalk with the head pitched down about 30°.
4. Socket contract: grip-point origin in the right palm, aim pose at today's grip position,
   finger and thumb bones.
5. Skin mapping as tabled (by colour: sheet ARCTIC to cobalt, STEALTH to arctic and a muted
   carbon, new orange ember and green jade, cobalt and violet lifted to the classic brightness).
6. Strap over the left shoulder into the back plate, nothing across the back.

## Decision log

- 2026-09-25: brief received. The identity change, scripted route, zero budget, side-by-side
  integration, weapon socket and skin recolour region come from the user.
- 2026-09-25: `art/seeker-hunter` created from `main` (74c64ee) in a separate worktree, because
  the main checkout holds other sessions' uncommitted work (rooftop-market, hider-v2,
  seeker-v2).
- 2026-09-28: the user started Phase 2 without changing the intake proposals, so decisions 1-6
  are taken as accepted: scale plan, S1-S4 and D1-D4, the crouch stalk, the socket contract,
  the skin mapping and the strap over the left shoulder.
- 2026-09-28, pass 1: the arms hang 3.5 cm further back than the scale plan (shoulder joint
  at z -0.065 m) to match 02, where the deltoid plate spans z -0.02 to -0.16 m.
- 2026-09-28, pass 2: the gloves are split into glove, fingers and thumb parts for the
  finger and thumb bones (decision 4); the top shoulder plate is a separate part from the
  deltoid plate so the rig can bind it partly to the chest. Phase 2 stopped for the user
  with one refine round left for the asset.

## Update, 30 September 2026: generated route

On the user's request the in-game Seeker is the generated model in `body-gen/` (Higgsfield picture,
Tripo mesh, auto-rig, clips keyed live in Blender), not the scripted blockout of passes 1-2, which
stays here as history. The user approved: black-and-red generated weapons for all four weapon types
(`weapons-gen/`), the Seeker always holding its weapon, and merging it all into the game. Every
job ID and check is in the `manifest.json` files; `head-gen/` is the earlier head-only experiment.

