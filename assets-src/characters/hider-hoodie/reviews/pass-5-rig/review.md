# Pass 5: rig and motion

```text
Pass: 5 rig and motion  Source: scripts/characters/hider_hoodie.py --stage rig (sha256
                        abcf3478fa08...) with scripts/characters/hider_hoodie_rig.py
                        (e732cce359a7...); preview GLB sha256 cdff489e0d76..., 881,820 bytes;
                        uncommitted, branch art/hider-hoodie. Two builds give the same GLB
                        byte for byte (r2 and scratch build r12). The structure and material
                        stages still build their pass-2 and pass-4 GLBs (checked in pass 6).
                        Pass 6 changed the export; see "Later changes" for today's hashes.
Decision: continue to pass 6. The capsule-fit limits below are reported for the user's
          acceptance; they come from the proportions, not from a broken clip.
Overall match: 8/10 (the bind pose is unchanged from pass 4; the clips read clearly, with
               the arm poses constrained by the large gloves, see "Capsule and hit-box fit")
Feature checks:
  - rig per character.md: one armature of 18 bones, `root` at the feet (not deforming, never
    keyed), then hips, spine, chest, neck, head and upper_arm/forearm/hand/thigh/shin/foot
    .L/.R. At most 3 bone influences per vertex (2,871 vertices on one bone, 716 on two,
    110 on three); all 17 deforming bones carry weight .................................. pass
  - clips in place: root never moves; the hips carry the vertical motion. The set is idle
    2.4 s, run 0.6 s, jump 0.4 s, crouch_idle 2.0 s, crouch_walk 0.5 s, slide 0.4 s, hit
    0.433 s (runtime window 0.42 s) and wave 1.0 s, at 30 fps. The frame range, fps and loop
    flag are stored on each action .......................................................... pass
  - loops: the last frame of every loop equals its first (largest bone-matrix difference 0).
    Every frame is keyed, keys are linear like the GLB's playback, and no quaternion key
    changes sign between frames (keys.json) ...................................................... pass
  - foot contact in the side view (contact-side.png): the character travels at the clip's
    speed past two fixed marks at the planted sole's heel and toe. At every key a touching
    sole vertex stays within 2.2 mm of where it touched down in the run and 0.4 mm in the
    crouch walk, then the foot rolls onto its toe tip. idle, crouch_idle and wave feet do not
    move; hit's move 0.1 mm (foot-contact-still.json). Between keys, see the notes ......... pass
  - crouch fit (1.12 m): crouch_idle 1.071 m, crouch_walk 1.083 m, slide 1.071 m tall at their
    tallest frames; no point below the ground at any key ....................................... pass
  - hood and bag at the extremes (extremes.png: crouch_idle, crouch_walk, slide, wave, run,
    jump and hit from the front, side, back and back three-quarter): the hood hem stays on the
    collar, the hood keeps its shape, and the bag and harness stay on the back and chest,
    with no gaps or tears ........................................................................ pass
  - no arm through the body: no triangle of a sleeve, forearm or glove intersects the torso,
    bag, hood, cap, mask, joggers or sneakers at any frame of any clip (arm-overlaps.json) ... pass
  - capsule fit (review-loop.md: head and torso inside, limbs at most 0.15 m out): idle
    passes. hit's recoil puts the hood 0.08 m behind the cylinder, the crouch clips and slide
    put it 0.22 m in front; the hands leave it by 0.10 m (idle) to 0.39 m (wave), 0.23 m in
    the run, and the running feet by 0.52 m (table below) ..................... open, see below
Budget: 6,986 triangles, 5 materials, 0 textures, 18 bones (unchanged geometry).
Evidence:
  - views: sheet.png (bind pose, references 01, 02b, 03b), views.json, overlay-metrics.json.
    The individual views and overlays match pass 4's to within 24 pixels and are not kept;
  - motion: clips-side.png, clips-front.png (six frames of every clip), extremes.png;
  - contact: contact-side.png, contact-side.json, foot-contact.json (quarter frames, stepping
    clips), foot-contact-still.json;
  - fit and integrity: reach.json, arm-overlaps.json, keys.json; the clip measurements are in
    ../../manifest.json (rig.clips).
Next change (pass 6): join the parts into one skinned mesh, export
  public/assets/characters/hider-hoodie.glb, run validate_glb.py with the Hider clip set.
```

## Rig

| Bone | Head (game m) | Parent | Weighted parts |
| ---- | ------------- | ------ | -------------- |
| root | 0, 0, 0 | - | none (the game moves the character) |
| hips | 0, 0.97, 0 | root | joggers at the pelvis (lower edge and left hip straps blended to the thighs) |
| spine | 0, 1.10, 0 | hips | lower hoodie, bag and harness (with chest) |
| chest | 0, 1.45, 0 | spine | upper hoodie, bag, harness, collar |
| neck | 0, 1.66, -0.01 | chest | collar top, hood hem and mask lower edge (blended) |
| head | 0, 1.73, -0.01 | neck | hood, cap, brim, mask |
| upper_arm.L/R | +/-0.205, 1.645, -0.01 | chest | sleeves (blended with chest at the shoulder, forearm at the elbow) |
| forearm.L/R | +/-0.285, 1.385, -0.02 | upper_arm | forearms (blended at the elbow and wrist) |
| hand.L/R | +/-0.345, 1.16, 0 | forearm | gloves (blended with the forearm at the wrist) |
| thigh.L/R | +/-0.115, 0.97, 0 | hips | joggers above the knee (blend at the hip) |
| shin.L/R | +/-0.192, 0.57, -0.03 | thigh | joggers below the knee, shins (blend at the knee) |
| foot.L/R | +/-0.228, 0.12, -0.095 | shin | sneakers |

Weights are rigid per part with smooth blends where parts bend: the hood hem and collar,
shoulders, elbows, wrists, hips, knees and ankles. The legs are posed by two-bone IK in the
side plane; a pose whose ankle target is out of the leg's reach now stops the build instead
of being clamped (a clamped ankle misses its mark, see r2). A ground clamp keeps every foot
above the ground: its sole profile is the lower convex hull of the sneaker's side view, on
which the lowest point of the foot lies at any pitch.

## Clips

| Clip | Frames | Seconds | Loop | Tallest (m) | Largest horizontal extent (m) | Notes |
| ---- | ------ | ------- | ---- | ----------- | ----------------------------- | ----- |
| idle | 0-72 | 2.4 | yes | 2.162 | 0.454 | breathing and a slow head turn; feet still |
| run | 0-18 | 0.6 | yes | 2.074 | 0.826 | 6.4 m/s: each foot planted 0.2 of the cycle, then a toe roll; compact arm swing |
| jump | 0-12 | 0.4 | hold | 2.165 | 0.523 | take-off stretch to a knee tuck, held on the last frame |
| crouch_idle | 0-60 | 2.0 | yes | 1.071 | 0.617 | hips low and back, back rounded, head tucked 15 degrees |
| crouch_walk | 0-15 | 0.5 | yes | 1.083 | 0.665 | 2.88 m/s (hiderSpeed x crouchMultiplier), feet planted half the cycle |
| slide | 0-12 | 0.4 | hold | 1.071 | 0.625 | from the crouch: right foot ahead on its heel, left knee down, held |
| hit | 0-13 | 0.433 | no | 2.165 | 0.484 | snaps back by frame 3, recovers to idle's first frame |
| wave | 0-30 | 1.0 | yes | 2.262 | 0.701 | right arm raised, two waves a second; upper body only |

"Largest horizontal extent" is the largest |x| or |z| of the posed bounds, the measure of
the axis-aligned box that shots test; manifest.json calls it `maxHalfExtentMetres`. Lowest
points are 0 at every key of every clip. wave keys only the upper body, so it can play over
the legs of idle or run.

## Capsule and hit-box fit

Largest distance from the body axis per part group over all frames (reach.json), against
the 0.36 m movement cylinder; in brackets how far the part leaves the +/-0.38 m box that
shots test (`player_ray_crouched` in crates/echo-core/src/physics.rs, see the brief):

| Clip | Head (hood, cap, mask) | Torso and bag | Hips | Hands | Feet |
| ---- | ---------------------- | ------------- | ---- | ----- | ---- |
| idle | 0.252 (in) | 0.303 (in) | 0.302 (in) | 0.461 (+0.074) | 0.407 (in) |
| run | 0.351 (in) | 0.281 (in) | 0.505 (+0.067) | 0.586 (+0.166) | 0.875 (+0.446) |
| jump | 0.296 (in) | 0.282 (in) | 0.494 (+0.053) | 0.641 (+0.116) | 0.582 (+0.143) |
| crouch_idle | 0.579 front (+0.198) | 0.466 (+0.086) | 0.549 back (+0.142) | 0.640 (+0.237) | 0.484 (in) |
| crouch_walk | 0.576 front (+0.196) | 0.465 (+0.085) | 0.547 back (+0.136) | 0.660 (+0.237) | 0.711 (+0.285) |
| slide | 0.577 front (+0.197) | 0.469 (+0.089) | 0.553 back (+0.152) | 0.638 (+0.239) | 0.681 (+0.234) |
| hit | 0.442 back (+0.061) | 0.344 (in) | 0.302 (in) | 0.492 (+0.104) | 0.407 (in) |
| wave | 0.282 (in) | 0.306 (in) | 0.302 (in) | 0.752 (+0.321) | 0.407 (in) |

- **Crouch and slide.** The brief estimated that a crouch fitting 1.12 m would put the
  brim about 0.55 m in front of the axis, 0.15-0.2 m outside the cylinder, and planned to
  pitch the head down 10-15 degrees first. The clips pitch it 15 degrees; the most forward
  point is now the hood (0.579 m), not the brim (0.557 m), so shortening the brim would not
  help. The hips balance it at 0.55 m behind: this crouch spans 1.13 m front to back against
  the cylinder's 0.72 m. In game the hood and hips of a crouched Hider stick out up to 0.2 m
  past the box that shots test.
- **Hands.** Elbow to fingertip is 0.52 m (the sheet's large gloves), so a relaxed A-pose
  already has the hands 0.10 m outside the cylinder, and any elbow bend of 70-90 degrees
  puts them about 0.6 m from the axis. The brief expected the run's hands to stay within
  0.15 m of the cylinder with a 35 degree swing; with these hands that holds only for
  swings that no longer read as running. r2 cut the run to 0.586 m (from 0.711), jump to
  0.641 (0.851), slide to 0.638 (0.850), wave to 0.752 (0.777) and hit to 0.492 (0.547).
  The crouch hands went the other way, from 0.46-0.55 m to 0.64-0.66 m: arms any closer pass
  through the folded legs (r2 below).
- **Feet.** A 6.4 m/s run with a 0.6 s cycle covers 1.9 m per step; the feet reach 0.875 m
  forward at the end of the swing. The box starts 0.08 m above the ground, so the soles
  are not hittable in any pose.

## Rounds (2 of 3 refine rounds for this pass)

| Round | Change | Result |
| ----- | ------ | ------ |
| r0 | Rig, weights and the eight clips | Loops exact, contact holds at the keys; between keys a planted foot slid up to 21 cm and dipped 2.4 cm |
| r1 | Keys made linear, quaternion keys kept in one hemisphere | Between-key slide 1.5 cm (run) and 2.0 cm (crouch walk) |
| r2 | Arms re-posed against overlaps and reach, slide hips back, exact sole hull, IK range check | No arm-body overlap; lowest point 0 at every key |

r0 came out of ten scratch builds (work-r1 to work-r10), not counted as rounds, that fixed
collapsed parts (world matrices read before the scene update), crouch and slide heights
(first 1.46-1.53 m), feet under the ground, toe drag and landing skid.

**Why r1 was needed.** Every key was Bezier: the build set Blender's new-key interpolation
preference, which Python keyframe inserts ignore. Between keys, auto-clamped handles let a
planted foot lag and catch up, and the slide had one thigh key whose quaternion changed
sign (the same rotation, but Blender interpolates each component, so the leg would spin
between the two frames). The GLB was not affected, because the exporter samples every frame,
but the source file showed motion the game never would. The build now sets the keys'
interpolation itself and keeps each bone's quaternions in one hemisphere.

**Why r2 was needed.** A triangle-overlap test of arms against the body found forearms
and gloves passing through the thighs, shins and sneaker tops in crouch_idle and
crouch_walk (40-70 triangle pairs, visible in close-ups), and forearms grazing the hoodie
and harness in idle, hit and wave. The reach table also had the slide's head 0.68 m ahead
of the axis and the run, jump, slide and wave hands at 0.75-0.85 m. Grid searches over the
arm angles picked, per clip, the pose with no overlap and the least reach; in the crouch
only arms outside the knees are clear (between the knees or in front of them gives 620+
pairs or 0.78 m). The slide's hips moved back 0.1 m, which brought its rear ankle within
0.05 m of the hip joint, closer than the leg can fold: the IK clamped it silently and the
foot sank 3.8 mm. The rear foot moved back with the hips, the IK now refuses such targets,
and the ground clamp uses the sneaker's exact side hull (the 2 cm binned profile it replaced
left run, jump and crouch_walk feet 0.5-1.7 mm under the ground at some keys).

## Methods

Scratch scripts in the session (not in the repository) produced the evidence; each opens
the pass's `.blend`, poses it by action and measures the evaluated meshes:
- contact: sneaker vertices within 5 mm of the ground count as touching. The side-view
  sheet adds the root's travel (speed x time) and tracks, per vertex, the drift since
  touchdown. foot-contact.json samples quarter frames and sums the ground-plane travel of
  each vertex over a contact;
- reach: every vertex of every frame, distance from the axis and max(|x|, |z|);
- overlaps: Blender BVH triangle overlap between each arm part and each body part per frame
  (sleeve-torso is left out: they are joined at the shoulder). Penetration depth by
  nearest-surface normals was tried and dropped: the open and concave shells (sneaker collar,
  hood, straps) gave impossible depths.

## Notes and open items

- **Between keys.** The GLB holds 30 keys a second and the game interpolates between them.
  Interpolated joint rotations move a planted foot on an arc, so between keys a sole sinks
  up to 1.5 cm in the run (0.5 cm in the crouch walk) and a planted vertex travels up to
  1.5 cm (2.0 cm) over a contact. At the gameplay distance, 1.5 cm is about 1.3 px at
  1080p for less than a frame. Sampling at 60 fps would shrink it about fourfold for about
  65 KB more animation data (the clips take 65 KB of the 829 KB runtime GLB).
- **Capsule fit** needs the user's call: accept the crouch hood and hand extents above, or
  make a gameplay change (for example a crouched hit box that follows the model), which is
  outside this asset task.
- **Runtime speed.** run is authored at 6.4 m/s and crouch_walk at 2.88 m/s; character.md
  has the runtime scale playback with speed. Foot contact holds only at the authored speed.

## Later changes (pass 6)

Pass 6 exports the keyed channels as they are instead of resampling every bone, and makes
hit key its bones in a fixed order (pass-6 review, r1 and r2). Neither changes a pose: the
clip measurements above are identical in today's build, and the GLB matches the source
within 4 micrometres at every frame. The committed scripts (LF line endings) are
hider_hoodie.py 723f28ba3f6d... and hider_hoodie_rig.py dc8af04895e6... (the hashes above are
of CRLF working copies); the rig stage builds preview GLB 65d09274b02d... (three
builds identical). In that GLB wave animates 10 bones and the other clips 17, where the r2
preview above carried tracks for all 18 bones in every clip.
