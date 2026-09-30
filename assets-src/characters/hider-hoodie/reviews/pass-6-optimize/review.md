# Pass 6: optimize and export

```text
Pass: 6 optimize/export Source: scripts/characters/hider_hoodie.py --stage export (sha256
                        723f28ba3f6d... of the committed file, LF line endings; earlier reviews
                        hashed Windows CRLF working copies) with hider_hoodie_rig.py
                        (dc8af04895e6...); runtime GLB public/assets/characters/hider-hoodie.glb,
                        sha256 89aff366cd77..., 829,408 bytes; uncommitted, branch
                        art/hider-hoodie. Three export builds give the same bytes. The rig,
                        material and structure stages rebuild 65d09274b02d (three builds),
                        aa5a69d84589 (pass 4) and e49eec7504fb (pass 2).
Decision: continue: Phase 4 is complete. Not wired into the client; that is a separate
          echo-change task (character.md, "Integration").
Overall match: 8/10 (bind-pose renders of the runtime GLB score as in pass 4: front vs 01
               IoU 0.894, side vs 02b 0.932 (head 0.952), back vs 03b 0.843 (head 0.953),
               left vs 02b mirrored 0.932)
Feature checks:
  - validate_glb.py --kind character --clips idle,run,jump,crouch_idle,crouch_walk,slide,
    hit,wave: passed with no failures and no warnings (../../validation-glb.json) ........ pass
  - one skinned mesh: the 18 parts are joined into `hider_hoodie_mesh`, one primitive per
    material (5 draw calls), 18 joints, at most 3 influences per vertex .................. pass
  - budget: 6,986 triangles (target 10k, hard 15k), 5 materials (target 5), no textures,
    829,408 bytes (target 3 MB) ............................................................. pass
  - runtime contract: +Y up, facing +Z (brim 0.246 m in front, bag 0.269 m behind), soles
    at 0, hood peak 2.16 m, centred (x from -0.415 to 0.415 m); no cameras, lights or extras;
    position, normal, joints and weights only (no UVs: nothing is textured) ................ pass
  - clips: the eight clips with their lengths, LINEAR samplers, 30 keys a second; root never
    animated; wave animates only the spine, chest, neck, head and arms (10 bones), so it can
    play over another clip's legs; the other clips animate 17 bones. The build fails if wave
    keys root, hips or a leg bone ............................................................ pass
  - parity: re-imported at 30 fps, the GLB puts every bone head within 4 micrometres of the
    source and the posed bounds match at every frame of every clip (glb-parity.json) ...... pass
  - three.js 0.186 (the client's version), GLTFLoader and AnimationMixer under Bun: 8 clips
    with the same lengths, 5 SkinnedMesh primitives on 18 bones, rest bounds as validated,
    and per clip the same tallest pose, lowest point and extent as Blender (three-load.json) pass
  - renders match the sheet's front, side and back (sheet.png, from the runtime GLB) ...... pass
Budget: 6,986 triangles, 5 materials, 0 textures, 18 bones, 829,408 bytes (JSON 40,672;
  mesh 722,332; animation 65,224; skin 1,152).
Evidence:
  - views: sheet.png (references 01, 02b, 03b; renders of the runtime GLB), views.json,
    overlay-metrics.json. The individual views match pass 4's and are not kept;
  - motion: the pass-5 strips and extremes; glb-parity.json shows the export poses alike;
  - export: ../../validation-glb.json, glb-parity.json, three-load.json, ../../manifest.json.
Next change: none in this task. Open items are listed in the brief's hand-off.
```

## Optimisation

- **One mesh.** The parts are skinned separately, then joined. The glTF keeps one
  primitive per material, so the character draws in 5 calls and shares one skeleton.
- **Flat colours, no textures.** The 5 materials carry the look (pass 4), so the GLB has
  no UVs or images. Flat shading needs split vertices, which is why the mesh data (722 KB)
  outweighs the triangle count; it is well inside the 3 MB target.
- **No compression.** The client loads plain glTF (no Draco or meshopt decoder is set up),
  and the file is 26% of the 3 MiB target, so none is used.
- **No LOD.** 6,986 triangles is under the 10k target; a lower level of detail can wait
  for a measured need.
- **Animation.** 65 KB for eight clips: only animated channels, linear keys on every frame.

## Rounds (2 of 3 refine rounds for this pass)

| Round | Change | Result |
| ----- | ------ | ------ |
| r0 | Export as built in pass 5: sampled channels for every bone | validate_glb passed (851,684 bytes); every clip carried 54 tracks, so wave held the legs in the rest pose |
| r1 | Keyed channels only, no resampling; the build checks that wave stays on the upper body | wave 10 bones, the others 17; 829,408 bytes; a second build differed |
| r2 | hit keys its bones in a fixed order | Three export builds identical (89aff366cd77) |

**Why r1 was needed.** The exporter's forced sampling wrote translation, rotation and scale
for all 18 bones in every clip. Playing wave over run in three.js would blend run's legs with
wave's rest-pose legs, and root and scale tracks were dead weight. The keys are already
linear on every frame, so exporting the keyed channels as they are loses nothing: parity
with the source stays within 4 micrometres, and three.js measures the same poses.

**Why r2 was needed.** hit builds its bone list from a set union, whose order changes from
one Python process to the next (string hashing is randomised). With forced sampling the
exporter walked the bones in armature order and the difference never showed; exporting the
keyed channels follows the key order, so two builds wrote hit's channels in different
orders. hit now uses a fixed order. The pass-5 clips are unchanged by r1 and r2: the same
keys, exported without resampling (see pass 5's later note).

## Validator and review tooling fixes

`scripts/blender/validate_glb.py` measured size, origin and centring on the scene as the
glTF importer leaves it: posed with the first animation. Blender's exporter sorts animations
by name, so that is `crouch_idle`, and the committed validator fails this GLB with "height
1.071 m outside 85-110% of collision height 2.16 m". It now measures those in the rest pose
and restores the pose for the crouch clips, which it samples on purpose. Negative controls
built from the export .blend, all rejected by the fixed validator:

| Control | Change | Failure |
| ------- | ------ | ------- |
| tall-crouch.glb | crouch_idle replaced by a copy of idle | "crouch_idle pose is 2.162 m tall; crouch clearance is 1.12 m" |
| short.glb | armature scaled to 80% | "height 1.728 m outside 85-110% of collision height 2.16 m" |
| floating.glb | armature raised 0.1 m | "origin must be at the feet/base: lowest point y=0.1" |

`scripts/blender/review_renders.py` shows imported GLBs in the rest pose for the same reason;
before, the runtime GLB's review views would have shown the first frame of crouch_idle.

The validator's crouch_walk height (1.0846 m) is 1.3 mm above the source's tallest key
(1.0833 m). It is not an export error: the validator imports at Blender's default 24 fps and
samples the clip's middle frame, which falls between two 30 fps keys.

## Notes

- **Import frame rate.** Blender imports glTF clips at the scene's frame rate (24 by
  default), so keys land between frames in a default scene. The parity check imports at
  30 fps. The game plays by seconds and is not affected.
- **SkinnedMesh count.** three.js makes one SkinnedMesh per primitive (5 here), all bound
  to one skeleton. A loader that clones per player should clone the whole scene
  (`SkeletonUtils.clone`, character.md) rather than one mesh.
