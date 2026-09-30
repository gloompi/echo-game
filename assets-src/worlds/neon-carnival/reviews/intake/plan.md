# Neon Carnival v2: Phase 1 layout plan

Date 2026-09-25. Branch `art/neon-carnival-v2` (worktree `echo-game-neon-carnival-v2`, base
main 74c64ee), uncommitted. Status: **awaiting approval**; nothing is modelled.

| Evidence | File |
| --- | --- |
| Scaled plan, metre grid (1 m minor, 5 m major) | [layout-plan.png](layout-plan.png) |
| Same draft over the concept plan scaled to metres | [plan-overlay.png](plan-overlay.png) |
| Layout draft (map.json shape + plan metadata) | [layout-draft.json](layout-draft.json) |
| Clearance, reachability, maze and boundary checks | [layout-checks.json](layout-checks.json) |
| Real-motor route checks (40 pass, 0 fail) | [motor-checks.txt](motor-checks.txt) |
| Concept copy, crops, provenance | [../../refs/](../../refs/provenance.json) |
| Source of the draft | `scripts/worlds/neon_carnival_layout.py`, `scripts/worlds/render_plan.py` |

Rebuild: `python scripts/worlds/neon_carnival_layout.py`, then
`python scripts/worlds/render_plan.py --layout <draft> --out <png> [--underlay refs/00-concept.png --underlay-crop 985 60 1440 405]`
(system Python 3.10 with Pillow; no Blender).

## 1. Scale and frame

- Concept plan to game metres: `x = (u - 1207.5) * 0.18`, `z = (v - 222.5) * 0.18` on sheet
  pixels. The carousel centre is the origin; +x east, +z south, north is up in the plans.
- Why 0.18 m/px: the carousel becomes 12 m across, the coaster catwalk 3 m wide, the bumper
  court floor about 24 x 14 m, the teleport hub 10 x 9 m. The drawn content then spans
  x -36..+37.4 and z -23.5..+27 m.
- `half = 40` (the square clamp). The plan is 1.47:1, so the playable area is the
  rectangle x -37..+38, z -23.5..+26 (about 75 x 50 m, 2,731 m2 of walkable ground plus
  upper decks), closed by visible boundary walls inside the clamp. The strips north and
  south of the walls hold coaster and skyline art only.
- Levels: ground 0; carousel deck 0.3; hop roofs 2.2-2.8 (booths, kiosks); upper route
  3.3 (decks 0.3 thick, so 3.0 m clear below); crouch-only clear height 1.5 (1.12 < 1.5 <
  2.16). Stairs are 0.3 m rises on 0.5 m runs (10 steps to 3.3). Railings 1.0 m.

## 2. Zones

| Zone | Extent (x, z m) | Concept | Layout |
| --- | --- | --- | --- |
| Carousel plaza | -16.5..16.5, -16.5..16.5 | centre ring + green loop | Round carousel on a 0.3 m deck (r 6.5), core column, 4 horses, 4 chariots, 4 railing arcs. Twelve booths at r 11.5 (2.7 m roofs, 3 m gaps, cardinal gaps are the entrances) form the hop ring; two jump crates against the N and S booths lead up. Ring walk at r 8.5 inside the booths; ground loop outside them, bending around the arcade and funhouse corners. |
| Coaster catwalks | -31..14, -23.5..-18.5 | top catwalk + diamond | 3.3 m deck along the north wall, covered lane below, railing on the plaza side, mirror landing, stair east (x 6.5-9). Coaster track is outside the wall. |
| Tunnel slide | -37..-29.5, -23.5..-1.8 | pink tube, NW | Slide-top landing (3.3) -> open stepped chute (10 x 0.3 m, side rails) -> tube mouth at z -13.5 -> 9 m tube, 2.6 m clear -> 7 m crouch-only leg east to the west yard. |
| Workshop + gatehouse | -26..-16.5, -20.5..-4.5 | NW blocks, orange vault box | Workshop hall with a 3.3 m roof bridged to the catwalk, stair up to the catwalk, 1.2 m vault stage, gatehouse with a N-S passage (2.6 m clear) on the green loop. |
| West yard | -29.5..-16.5, -4.5..3.5 | tube exit, blue route | Tube exit with a ride panel as cover, crate, low barrier; opens to the plaza and the court's BUMP! gate. |
| Bumper court | -37..-16.5, 3.5..21 | bump court + danger zone | About 20 x 17 m floor (concept about 24 x 14; the east edge stops at x -16.5 so the plaza loop passes outside) with 6 bumper cars (1.0 m), central booth (2.2 m), 4 canopy pillars, 1.2 m railing fence with gaps, BUMP! arch gate (4.2 m clear), cyan mirror on the west wall. |
| Maintenance underpass | -37..-9.5, 21..26 | underpass, south edge | 24.5 m corridor, 2.7 m clear, under a solid service block (4.8 m); two court doorways, one doorway to the plaza's SW corner, open east end into the ticket alley. |
| Ticket alley | -9.5..9.5, 16.5..26 | ticket booths | Two staggered rows of kiosks (2.8 m) and a counter; 3 m alley lane between the rows, 2 m street along the fence. |
| Funhouse | 10.5..21.5, 12.5..23.2 | clown face | 7 m clown facade with a 2.4 m mouth door; interior with two panels; doors north and east. Roof 5.0 (unreachable). |
| Teleport hub | 25.5..38, 12.5..22.5 | purple room + diamond | Room with three mirrors on three walls (multi-angle); doors north (maze), west (SE lane), south (street); plinth in the middle. Roof 5.0. |
| Mirror maze | 23.5..38, -6..11 | glass maze, east | 6 x 7 braid maze (2.1 m corridors, 0 dead ends, 4 loops), 15 glass wall boxes 3.0 m, opaque roof 5.4; doors north, west, south. |
| Arcade + NE yard | 14..29, -23.5..-6 | arcade roof route | Arcade hall (3 cabinet rows, 3 doors) with a 3.3 m roof split by a 2 m skylight gap; stair landing and stair east; arcade kiosk jump route onto the roof; shed and crate in the NE yard. |
| East yard, SE lane | 16.5..25.5, -6..22 | red sightline, tilted panels | Open sightline from the maze's west door to the carousel; kiosk, barrier, crate, ride panels. |

## 3. Routes (concept legend redrawn on the plan)

- **Hider loops (green)**: the ground loop around the booth ring; the loop through the
  gatehouse and west yard; the ring walk around the carousel. Every loop leg is checked
  standing-clear. Ground connectivity uses the repository test's rule (1 m grid, standing
  height): every spawn and mirror exit is connected.
- **Climb / vertical (yellow)**: crates -> booth roofs (plaza N and S); east stair ->
  catwalk -> arcade roof; workshop stair / bridge -> workshop roof; arcade kiosk -> arcade
  roof (running jump); arcade east stair; chute up to the slide-top landing.
- **Slide / underpass (blue)**: catwalk -> chute -> tube -> crouch leg -> west yard ->
  BUMP! gate -> court -> underpass -> alley.
- **Seeker sightlines (red)**: maze west door to the carousel along z 2.5; the 45 m
  catwalk. Danger zones: the court centre and the plaza's south lane.

## 4. Data summary

**Boxes: 211** (157 cover, 46 step, 8 platform). Each collider is one tagged mesh, so
colliders plus merged decoration must stay under 300 meshes (350 hard): the collider budget
is 240, leaving at least 60 merged decoration meshes.

| Zone | Boxes | Cover | Platform | Step |
| --- | --- | --- | --- | --- |
| Boundary | 4 | 4 | 0 | 0 |
| Carousel plaza | 33 | 27 | 0 | 6 |
| Coaster catwalks | 22 | 10 | 2 | 10 |
| Tunnel slide | 22 | 11 | 1 | 10 |
| Workshop + gatehouse | 20 | 8 | 2 | 10 |
| West yard | 3 | 3 | 0 | 0 |
| Bumper court | 19 | 19 | 0 | 0 |
| Maintenance underpass | 7 | 7 | 0 | 0 |
| Ticket alley | 7 | 7 | 0 | 0 |
| Funhouse | 11 | 11 | 0 | 0 |
| Teleport hub | 8 | 8 | 0 | 0 |
| Mirror maze | 22 | 22 | 0 | 0 |
| Arcade + NE yard | 27 | 14 | 3 | 10 |
| East yard + SE lane | 6 | 6 | 0 | 0 |

**Spawns (12, ground, list order is the assignment order, so any prefix stays spread):**
0 west yard (-27, 0.2); 1 NE yard (31, -8.5); 2 ticket alley (-3.5, 20.8); 3 north yard
east (11.5, -17.5); 4 plaza SW lane by the court gap (-15, 11); 5 east yard (19, 9.5); 6 north yard west
(-11, -18.5); 7 south street (23.5, 24.2); 8 court west (-33, 15.5); 9 plaza south (5, 11.8);
10 court south (-23, 19.5); 11 plaza north lane (1.5, -15.5).

**Mirror pairs (3; each has one end in the hub, "multi-angle"):**

| Pair | End A (x, y, z, faces) | Exit A | End B in hub | Exit B |
| --- | --- | --- | --- | --- |
| VIOLET | catwalk landing (0.5, 3.3, -23.1), S | (0.5, 3.3, -20.5) | north wall (28.5, 0, 13.4), S | (28.5, 0, 16.0) |
| CYAN | court west wall (-36.6, 0, 12.0), E | (-34.0, 0, 12.0) | east wall (37.6, 0, 17.2), W | (35.0, 0, 17.2) |
| AMBER | workshop roof (-25.1, 3.3, -15.5), E | (-22.5, 3.3, -15.5) | south wall (34.0, 0, 21.7), N | (34.0, 0, 19.1) |

Exits are 2.6 m in front, standing-clear and grounded (motor-checked, including the two at
3.3 m), and outside every other mirror's 1.8 m trigger. Elevated mirrors are supported:
the server teleport sets y from the exit (`crates/echo-core/src/room.rs`, `mirror_exit`
checks |dy| < 1.3). The concept draws two diamonds (catwalk, hub); the third pair is my
addition for the hub's "multi-angle" description.

**Waypoints (21)**: one ground tour through the doorways. Bots walk straight at the next
goal and switch every 3.5 s, so every leg is standing-clear: plaza NW -> plaza N lane ->
north yard -> east lane -> maze west door -> SE lane -> south street -> funhouse mouth ->
alley -> underpass -> court (middle doorway) -> BUMP! gate -> west yard -> plaza W lane ->
gatehouse passage -> plaza NW.

**Landmarks (10)**: CAROUSEL PLAZA, COASTER CATWALKS, TUNNEL SLIDE, ARCADE ROOF, MIRROR MAZE,
TELEPORT HUB, FUNHOUSE, TICKET ALLEY, BUMPER COURT, MAINTENANCE UNDERPASS.

## 5. Mechanics mapping

| Concept | Echo mechanic | Draft implementation | Checked |
| --- | --- | --- | --- |
| Carousel loop, "multiple levels, ride, railings, booths for cover, chaining movement" | ground loop, step deck, hop roofs, cover | 0.3 m round deck (6-box staircase, outline within 0.49 m of the circle); horses and chariots as cover; ring walk at r 8.5; 12 booth roofs 2.7 m with 3 m gaps; crates 1.2 m | crate -> booth roof lands; booth roof not reachable from the ground without a crate; loop legs clear |
| Rollercoaster catwalks | upper route | 3.3 m deck, railing (1.0 m, climbable), 3 stairs, covered lane under | 3 stairs reach 3.3 m without jumping |
| Coaster track, Ferris wheel, skyline | decoration | outside the boundary walls, no colliders, within fog (50-120 m) | art pass |
| Arcade roof route: jumps, gaps, railings | upper route + running jumps | two roof decks with a 2 m skylight gap into the hall; kiosk -> roof jump; east stair | kiosk -> roof running jump lands on 3.3 |
| Tunnel slide | stepped descent + crouch-only tube; existing Hider slide (crouch + sprint, 0.8 s momentum) | open chute (10 steps) into the tube mouth, 9 m standing tube, 7 m crouch-only leg | up and down the chute; standing blocked at the crouch leg; crouched passage both ways |
| Mirror maze | glass colliders | braid maze, 15 glass boxes, opaque roof | connected, 0 dead ends, 4 loops |
| Bumper court: obstacle cars, ramp edges, central cover | low cover, open floor | cars 1.0 m (vaultable), booth 2.2 m, pillars, railing fence 1.2 m | plan |
| Ticket alley | cover lane | 6 kiosks 2.8 m, counter, barrier | plan |
| Funhouse entrance | interior shortcut | mouth door + 2 doors, interior panels | plan |
| Maintenance underpass | covered standing corridor | 2.7 m clear, 3 doorways + open end | walk-through standing |
| Teleport hub | mirror pairs | 3 mirrors on 3 walls, far ends N, NW, SW | exits clear and grounded |
| Jump / vault spots | jump apex 1.76, step-up 0.37 | crates 1.2, barriers 0.9, stage 1.2, railings 1.0 | plan |
| Prop kit | modular kit | booth counter, low barrier, jump crate, tube entrance, railing, light pole, ride panel, neon arrow, arcade cabinet, ticket kiosk, teleport mirror housing | Phase 3 |

## 6. Unsupported features and replacements

| Concept feature | Why not | Replacement |
| --- | --- | --- |
| Raised round plaza terrace with a swirl ramp | Boxes are axis-aligned with no slopes; a round platform at 1.8 m built from boxes misses the circle by more than 0.5 m (invisible edges or floating feet) | 0.3 m round carousel deck + booth-roof hop ring + catwalk overlooking the plaza |
| Gravity slide | No new slide physics (brief) | Stepped chute + crouch-only leg; the existing Hider slide ability crosses the leg in one burst |
| Closed tube along the whole descent | Stepped ceiling boxes stack into a climbable crest (measured: a 5.6 m perch; 0.14 m boundary margin) | Open chute for the descent; closed tube only on the level part |
| Ramps ("ramp edges", swirl ramp), diagonal stair building, diagonal SE walkway | No slopes or rotated boxes | 0.3 m stairs, railing edges, axis-aligned lanes |
| Rotated props (cars at angles, tilted ride panels) | A rotated visual's bounds must equal its box | Cars at 0/90 degrees; tilt only inside the box |
| Real reflections in the maze | No real-time reflection in the renderer | Baked reflection texture on opaque mirror panels, plus clear glass panels |
| Moving rides (carousel, wheel, coaster cars) | World GLBs are static (matrix updates off) | Static; optional client decor animation later, no gameplay effect |
| Bulb glow, light pools, real lights | No lights in runtime exports; no bloom pass | Emissive materials; optional baked emissive light-pool texture on the ground |
| Street level below the park (retaining walls) | Floor cannot go below y 0 | Visual drop beyond the south fence only |
| One mirror to several destinations | Mirrors are 1:1 pairs | Three separate mirrors in the hub |
| Round gazebo SE of the plaza | Absorbed by the booth ring | Omitted |

## 7. Flag: glass walls and delayed Hider visibility

Facts from the current code:

1. The server sends every Seeker all delayed Hider poses, with no line-of-sight culling
   (`Room::snapshot_for`, `crates/echo-core/src/room.rs`). Glass changes no data and cannot
   expose a current pose: the privacy invariant holds.
2. Rendering: through clear glass a Seeker sees a Hider's delayed echo; a Hider sees
   Seekers live. This is the only visible effect of glass.
3. Shots stop at every box (`physics::map_ray`; pellets, projectiles, bot fire), so glass is
   bulletproof. A Seeker who sees an echo through glass cannot shoot through it; the shot
   still tests the present position, as required.
4. Name labels hide behind any box (`arenaOccluded`, `client/main.ts`): behind glass the
   body is visible but the label is hidden.
5. Glass also blocks the Hider third-person camera ray, mirror-use line of sight and mine
   triggers. The scan ability ignores walls, so glass does not affect it.

Consequence: clear glass everywhere makes the maze a showcase of stale echoes for Seekers
without letting them shoot. That fits "reflection confusion", but an all-clear maze can
be read at a glance and loses its hiding value. **Recommendation:** mirror-finish (opaque)
panels on the maze exterior and most interior walls, plus 4-6 clear "echo windows" at
chosen corners. Glass stays an ordinary `cover` box: no new box kind, no Rust change. The
label/body mismatch in point 4 is a possible later client tweak and is not in scope.

## 8. Reachability and containment

The draft runs a clearance-aware reachability search: ground travel from the spawns, then
jumps with the timed/auto hop cap (12 m/s) plus a Hider dash, a clear take-off column, a
clear straight flight at some height within the apex, and a clear landing. Range is
generous but walls, ceilings and enclosed rooms are respected.

| Boundary | Height | Highest reachable top within 12 m | Margin above apex |
| --- | --- | --- | --- |
| North (coaster lattice) | 7.5 | 4.3 (catwalk railing) | 1.44 m |
| West (coaster lattice) | 7.5 | 4.3 (slide-top railing) | 1.44 m |
| East (building backs) | 7.5 | 3.3 (arcade landing) | 2.44 m |
| South (carnival fence) | 5.0 | 2.8 (kiosks) | 0.44 m |

- Reachable on purpose: upper decks 3.3, railings (4.3 on the upper route), hop roofs
  2.2-2.8, the tube roof 2.9, gatehouse roof 3.0, crates, cars, stage.
- Unreachable by height: maze roof 5.4, hub and funhouse roofs 5.0, underpass block 4.8,
  BUMP! arch 4.9, court pillars 5.2, carousel core 5.8, funhouse facade 7.0.
- Reported and accepted: the arcade wall tops (3.0) exposed inside the roof's skylight gap.
- Fixed during this phase after the checks found them: a stepped-tube crest perch (5.6 m),
  a hop chain onto the underpass roof via the BUMP! arch, an underpass dead-end pocket,
  a hub mirror inside a wall, a tube mouth that blocked the chute in both directions, the
  court's east rail running into the plaza booths, and bot and loop legs through walls.
- Lanes: all 21 waypoint legs and 22 loop legs are standing-clear (`clearLegs` 43/43).

## 9. Tests and fixtures that change

The ID stays, so `shared/settings.ts` (`MAP_IDS`), `crates/echo-core/src/world.rs`
(`MapId::NeonCarnival`), `client/world-assets.ts` (same URL) and `scripts/build-maps.mjs`
(same authored list) need no edits.

| File | Change |
| --- | --- |
| `assets-src/worlds/neon-carnival/map.json`, `.blend`, `manifest.json`, `public/assets/worlds/neon-carnival.glb` | Regenerated by the rewritten `scripts/worlds/neon_carnival.py` |
| `shared/maps.json` | Regenerated by `pnpm run maps` (generated; never hand-edited) |
| `scripts/gameplay-fixtures.ts` | Replace the 4 neon-carnival cases (`arcade-stairs`, `tunnel-north-to-south`, `tunnel-south-to-north`, `side-stairs-and-roof-connection`) with: catwalk stair, workshop stair, arcade stair, chute down and up, crouch leg both directions |
| `tests/fixtures/gameplay.json` | Regenerated by `pnpm fixtures`; consumed by the Rust parity test `new_gameplay_javascript_rust_parity` (`crates/echo-core/tests/gameplay.rs`) |
| `tests/gameplay.test.ts` | The stair-route test's neon-carnival entry (start 18, 0, -4.8; roof 4.24) becomes the new stairs at 3.3; "Neon Carnival tunnel has a complete crouched passage" moves to `slide-crouch-roof` and the new positions; "side stairs connect to the tunnel roof" is replaced by chute and elevated-mirror route tests. Generic map tests (spawns, mirrors, ground routes) run unchanged on the new data |
| `crates/echo-core/tests/gameplay.rs` | No code change: `map_data_has_clear_spawns_and_reciprocal_mirrors` checks the new data (12 spawns, boxes inside half, clear exits) |
| `tests/world-exports.test.ts` | No code change: the new GLB must match 211 colliders within 2 mm, under 350 meshes, 180k triangles, 12 MB |
| `tests/worlds.e2e.ts` | No code change: two clients load and play the map (mesh count > 30); rerun for evidence |
| `scripts/worlds/validate_sources.py` | `EXPECTED_COLLIDERS['neon-carnival']` 122 -> new count (manual Blender tool) |
| `docs/BLENDER_WORLDS.md`, `assets-src/worlds/neon-carnival/README.md`, `assets-src/README.md`, `README.md` | Updated counts, rebuild notes and description |

Merge risk: two other open jobs touch the same files. The main checkout holds uncommitted
rooftop-market work, and the Mirror Yard v2 remake (worktree `echo-game-mirror-yard-v2`,
branch `art/mirror-yard-v2`, also at Phase 1) will change `scripts/gameplay-fixtures.ts`,
`tests/gameplay.test.ts` (the stair-route test lists both maps in one array),
`scripts/worlds/validate_sources.py` (`EXPECTED_COLLIDERS` holds both), `docs/BLENDER_WORLDS.md`
and the generated `shared/maps.json` and `tests/fixtures/gameplay.json`. Whichever branch
lands later merges the hand-written files and regenerates the generated ones
(`pnpm run maps`, `pnpm fixtures`), never merging them by hand. `scripts/worlds/render_plan.py`
reads any layout draft, so the Mirror Yard job could share it instead of a second renderer.

## 10. Performance plan: bulbs and neon

No real lights: the runtime export keeps `export_lights=False`, and the client hides any
embedded light anyway (`client/world-assets.ts`). Glow comes from emissive materials
under the game's ACES tone mapping. There is no bloom pass, so neon halos are baked into
sign textures.

| Item | Estimate | Method | Triangles | Draws |
| --- | --- | --- | --- | --- |
| Hero bulbs (carousel canopy, booths, BUMP! arch, funhouse frame, kiosks, ECHO marquee) | ~1,400 | 8-triangle octahedra, 0.08-0.1 m, three colour materials (warm, magenta, cyan) | ~11k | 3 |
| Bulb strings, catwalk rail, court canopy, distant coaster and wheel lights | ~1,300 bulbs on ~300 segments | Emissive dotted-texture ribbons (crossed quads, 256 x 64 texture) | ~1.2k | 1 |
| Neon outlines (maze frames, arcade roof edge, hub doors, carousel crown) | ~350 m | 4-sided tubes, straight runs one segment, `KHR_materials_emissive_strength` | ~8k | 4 |
| Lettered signs (ARCADE, BUMP!, TICKETS, FUNHOUSE, TELEPORT, MIRROR MAZE, ECHO, arrows) | ~16 | Opaque boards with one 2048 x 1024 emissive atlas, halo baked in | <1k | 1 |
| **Total light decoration** | | | **~20k of 150k** | **~9** |

- "Instanced" in authoring, merged at export: bulbs are placed with Blender collection
  instances / Geometry Nodes on the bulb-string curves, then realized and joined into one
  mesh per material. `EXT_mesh_gpu_instancing` is not used for now. Blender 5.2's importer
  expands each instance into its own object (`io_scene_gltf2/blender/imp/vnode.py`,
  `manage_gpu_instancing`), so `validate_glb.py` would count ~2,700 mesh objects (350
  limit). Three's `GLTFLoader` would instead count one `InstancedMesh`, under-reporting
  triangles in `tests/world-exports.test.ts`. True GPU instancing needs both gates to count
  instances correctly first; that is a separate, reviewed change.
- Every emissive or thin decoration mesh gets `extras.echoCastShadow = false`, which the
  client honours, so thousands of bulbs stay out of the shadow pass.
- Budget gates: ~40-50k triangles for collider visuals, ~85k for all decoration, total
  ~130k (150k target). About 271 meshes (300 target). Materials ~30 (48 target); textures
  4-5 (16 target: sign atlas, bulb strip, maze reflection, optional 2048 light-pool map);
  GLB about 8 MB (12 MB hard). Enforced by `validate_glb.py` and
  `tests/world-exports.test.ts`, and reported per pass.
- Readability: emissive surfaces must not sit behind player silhouettes at eye height in
  the main lanes, and bulbs smaller than 8 cm are avoided (distance shimmer). Both are
  judged in the in-game screenshots, not in renders.

## 11. Decisions for approval

1. **Layout**: zones, levels (0 / 2.2-2.8 hop roofs / 3.3 upper) and the 211-box draft as
   drawn. Change requests are cheap now; after the graybox playtest they restart checks.
2. **Tunnel slide**: open stepped chute + closed tube + crouch-only leg (recommended).
   Alternative: a fully closed tube, which needs a flat hood above 6.1 m over the descent,
   or accepting the tube crest as a climbable perch (and taller boundaries).
3. **Maze panels**: mostly opaque mirror panels plus 4-6 clear echo windows (recommended),
   all clear glass, or all mirror.
4. **Mirror pairs**: three pairs, all anchored in the hub (recommended), or only the
   concept's single catwalk-hub pair plus one more.
5. **South edge**: 5.0 m fence keeping the open look (0.44 m margin, recommended), or 7.5 m
   everywhere.
6. **Bulbs**: merged per material (recommended), or GPU instancing after first making both
   gates count instances.
7. **Night mood**: the map reads as night through dark albedo and emissive under the shared
   client lighting (recommended for Phase 3). An optional per-theme client lighting preset
   is a separate client change that affects player readability and needs its own approval.

## 12. Not verified in this phase

No Blender build, GLB, `validate_glb.py`, `pnpm verify` or in-game session was run: those
start in Phase 2. The route checks used the TypeScript motor only, not the Rust motor; Rust
parity is proven by the Phase 2 fixtures. The reachability search is an approximation;
containment is confirmed in the graybox playtest.
