# hider-v2 brief

```text
Asset: character
ID: hider-v2
Role: hider
Replaces in game: no, side-by-side only until approved

Identity to keep: striped shirt, blocky designer-toy proportions, brown hair
Identity changes (explicit): none
Style words: chunky bevelled blocks, clean flat colours, readable at 15 m
Avoid: realistic anatomy, noisy textures, thin parts
References: generate (3 hero concepts first, approval before turnarounds)

Mesh route: scripted
Generation budget: 30 Higgsfield credits (approved 2026-09-25)
Triangle target: 6-10k, hard cap 15k (default)
Animations: default Hider set: idle, run, jump, crouch_idle, crouch_walk, slide, hit, wave
Skins: keep tint regions (default): tint_light = shirt, tint_dark = trousers
Done means: approved turnaround match + clean validate_glb + review sheets for every pass
```

## Defaults applied

- New design, not derived from the procedural Hider in `client/models.ts`. That model is a
  technical baseline only (scale, facing, origin), not a proportion or detail target.
- Classic skin colours for the tint regions: shirt `#f4eee7`, trousers `#39566f`. The
  stripes stay a dark non-tinted colour so every skin keeps the striped read.
- Scale from `shared/rules.json`: 2.16 m standing height, 0.36 m capsule radius, 1.12 m
  crouch clearance. Head and torso fit inside the capsule; limbs extend at most ~0.15 m.
- Materials at most 5; flat colours, no texture noise.
- Scene art direction is cyan/magenta. The Hider itself stays warm and neutral so it reads
  against that lighting.
- Integration into `client/models.ts` is a separate echo-change task. Nothing replaces the
  current Hider until the user approves it.
