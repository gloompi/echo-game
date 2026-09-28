# Rooftop Market brief

```text
Asset: world map
ID: rooftop-market
Replaces: new map
Name shown in menu: Rooftop Market
Players: 4-10          Size (half extent m): 32

Theme and mood: rain-slick rooftop night market, cyan/magenta signage
Gameplay goals: two long sightlines broken by stalls, one crouch tunnel, a rooftop loop,
                2 mirror pairs, no dead ends
Landmarks: noodle stand, water tower, neon arch, cargo lift
Avoid: empty plazas, maze corridors
References: generate

Mesh route: scripted
Generation budget: 40 credits
Budgets: default <=150k tris target, <180k hard, <=300 meshes, <12 MB GLB
Done means: graybox playtested with 2 clients first, then art passes, tests + E2E pass
```

## Defaults applied

- Mirror-yard and neon-carnival are technical contracts only, not layout or art targets.
- Identity kept: striped blocky Hider, blue armored Seeker, orange blaster, cyan/magenta.
- Movement metrics from `shared/rules.json` and `shared/movement.json` (0.37 m step-up,
  ~1.76 m jump apex, 2.16 m standing / 1.12 m crouched height).
- Phase 1 scope (requested): references, graybox layout, map registration; then stop for
  the user's two-client playtest before any art pass.

## Layout intent (graybox v1)

Game axes: +x east, +z south (north is -z). Roof level R = 3.0 m.

| Zone | Extent | Role |
| --- | --- | --- |
| Four corner blocks | x 12..32 / z 19..32 each quadrant | Solid buildings, roofs at R, form the loop corners |
| Lantern Lane (sightline A) | z -19..-13, full width | 64 m sightline along shop fronts, broken by staggered tall stalls and low counters |
| Signal Lane (sightline B) | z 13..19, full width | Same, crossed by the Neon Arch |
| Market core | x -14..14, z -13..13 | Noodle stand at the centre, stall rows, crates; no open plaza |
| Signal house / Hall | x -24..-14 and 14..24, z -5..5 | Mid roofs on the loop; the Hall has the N-S crouch tunnel |
| North / south courts | x -12..12 beyond the lanes | Cargo lift (north), mirrors, stairs to roofs |
| Side alleys | x beyond +-24, z -13..13 | Flank routes with mirrors |

Rooftop loop: NW roof -> north catwalk -> NE roof -> east bridge -> Hall roof -> east bridge
-> SE roof -> south catwalk -> SW roof -> west bridge -> Signal house roof -> west bridge ->
NW roof. Bridges are 2.6 m above the ground (walkable underneath). Seven ways down: six
stairs plus the cargo-lift jump route (0 -> 1.5 -> 3.0 m).

Mirrors: CYAN north court <-> south court; MAGENTA west alley <-> east alley.
