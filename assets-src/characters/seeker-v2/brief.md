# seeker-v2 brief

```text
Asset: character
ID: seeker-v2
Role: seeker
Replaces in game: no, side-by-side only until approved

Identity to keep: blue armoured Seeker with orange blaster (root AGENTS.md), plus the
  shared toy-line traits: striped shirt visible under the armour, blocky designer-toy
  proportions, brown hair
Identity changes (explicit): none. The armour stays the primary read; stripes and hair
  are secondary and must not make the Seeker read as a Hider at 15 m.
Style words: chunky bevelled blocks, clean flat colours, readable at 15 m
Avoid: realistic anatomy, noisy textures, thin parts
References: generate (3 hero concepts first, stop for approval)

Mesh route: scripted
Generation budget: 40 credits for the reference pack (hero concepts + up to 2 retries);
  turnarounds need a new budget after concept approval
Triangle target: 6-10k, hard cap 15k (default)
Animations: default seeker set (idle, run, jump, crouch_idle, crouch_walk, slide, hit, aim)
Skins: keep tint regions tint_light / tint_dark (default)
Done means: approved turnaround match, clean validate_glb, review sheets for every pass
```

## Decisions

- 2026-09-25: the request listed "striped shirt, brown hair" as the Seeker identity, which
  conflicts with the blue-armoured Seeker contract. The user chose to keep blue armour and
  the orange blaster, with the striped shirt showing under the armour and brown hair.
- 2026-09-25: budget set at up to 40 credits for the reference pack.
- The procedural Seeker in `client/models.ts` is a technical baseline only, not a design
  source.
