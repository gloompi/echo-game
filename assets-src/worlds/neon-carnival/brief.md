# Neon Carnival v2 brief

```text
Asset: world map
ID: neon-carnival (keep the ID and replace the current map)
Replaces: neon-carnival. The current version was built from this same concept and falls
          far short. Its layout, script art and detail level are not reused; it is a
          technical contract only.
Name shown in menu: Neon Carnival
Players: 4-12          Size: from the concept's top-down plan, half extent at most 40 m

References (supplied, authoritative): refs/00-concept.png
  (echo-character-assets/assets/e7b92f37-2831-4988-a077-5e5aa945c25f.png): isometric
  overview, top-down MAP LAYOUT with routes and legend, 6 location details, prop kit.
Theme and mood: as the concept: night fairground, magenta/cyan/purple neon, bulb strings,
  carousel, coaster, Ferris wheel and city skyline as backdrop.
Gameplay goals: the concept's areas and routes: carousel plaza (multi-level loop),
  rollercoaster catwalks, arcade roof route, tunnel slide, mirror maze, bumper court,
  ticket alley, funhouse entrance, maintenance underpass, teleport mirror hub.
Mechanics mapping: the tunnel slide is a crouch-only or stepped tube passage (no new slide
  physics). Coaster track, Ferris wheel and skyline are decoration outside or above play.
  Round shapes are round visually but colliders are box segments. Mirror-maze glass walls
  are real colliders: flag how see-through glass interacts with delayed Hider visibility.
  Bumper cars are low cover. Mirrors = map mirror pairs.
Mesh route: scripted, as a modular kit built from the prop row
Generation budget: 0 unless the user approves
Budgets: defaults, <=150k tris target (<180k hard), <=300 meshes (<350 hard), <12 MB GLB
Done means: graybox playtested first, art passes matching the location-detail images,
  clean validate_glb, pnpm verify, in-game screenshots next to the concept
```

## Defaults applied

- Branch `art/neon-carnival-v2` in the sibling worktree
  `C:\Users\MyMUSTEX\Desktop\works\echo-game-neon-carnival-v2`, from main 74c64ee. The
  main checkout holds uncommitted rooftop-market work and was not touched.
- Identity kept: striped blocky Hider, blue armored Seeker, orange blaster, cyan/magenta.
- Movement metrics from `shared/rules.json` and `shared/movement.json`: 0.37 m step-up,
  1.76 m jump apex, 2.16 m standing and 1.12 m crouched height, 0.36 m radius.
- The v1 files in this folder (`reference.png`, renders, `map.json`, `.blend`) stay as
  history until Phase 2 regenerates `map.json`, the `.blend` and the GLB.

## Phases

1. **Intake and layout plan** (this phase): refs and provenance, scaled plan with a metre
   grid, layout draft, mechanics mapping, test impact, bulb/neon performance plan. Stop.
2. **Graybox**: `scripts/worlds/neon_carnival.py` builds collider-only meshes from
   `scripts/worlds/neon_carnival_layout.py`, writes `map.json`, `.blend` and GLB; tests and
   fixtures updated; two-client playtest with screenshots. Stop.
3. **Art passes** (form, material, dressing) with review sheets against `refs/21-26` and
   the prop crops. Stop.
4. **Optimize and hand-off**: budgets, `validate_glb.py`, `pnpm verify`, in-game
   screenshots next to the concept, docs. Stop.

## Status

Phase 1 delivered on 2026-09-25; awaiting approval. The layout plan, checks and open
decisions are in [reviews/intake/plan.md](reviews/intake/plan.md). Nothing is modelled yet.
