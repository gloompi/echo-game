"""Neon Carnival v2 layout: authoritative boxes, spawns, mirrors and waypoints as plain data.

Phase 1 (intake) draft. Pure Python, no Blender. Phase 2 imports `build()` from
scripts/worlds/neon_carnival.py so the graybox, map.json and the plan share one source.

  python scripts/worlds/neon_carnival_layout.py
      writes assets-src/worlds/neon-carnival/reviews/intake/layout-draft.json
      and layout-checks.json (clearances, reachability, maze and outline checks)

Game coordinates: metres, +Y up, +x east, +z south (north is -z). Boxes are axis-aligned:
x/z centre, y bottom, kind cover | platform | step. `role` is plan/art metadata only and is
stripped from the map descriptor.

Concept mapping (u, v are pixels of refs/00-concept.png; refs/20-plan.png is the crop):
x = (u - 1207.5) * 0.18, z = (v - 222.5) * 0.18, carousel centre at the origin. At 0.18 m
per pixel the carousel is 12 m across, the coaster catwalk 3 m wide and the bumper court
floor about 24 x 14 m.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RULES = json.loads((ROOT / 'shared/rules.json').read_text(encoding='utf-8'))
MOVEMENT = json.loads((ROOT / 'shared/movement.json').read_text(encoding='utf-8'))
RADIUS, HEIGHT = RULES['radius'], RULES['height']
CROUCH_HEIGHT = MOVEMENT['crouchHeight']
JUMP_APEX = RULES['jumpSpeed'] ** 2 / (2 * RULES['gravity'])
STEP_UP = 0.37  # resolveCollision in shared/physics.ts

HALF = 40.0
# Playable rectangle inside the square clamp; every edge is a visible collider.
WEST, EAST, NORTH, SOUTH = -37.0, 38.0, -23.5, 26.0

ROOF = 3.3        # upper route: coaster catwalk, workshop and arcade roofs
DECK = 0.3        # deck thickness: 3.0 m standing clearance under upper decks
RISE, RUN = 0.3, 0.5
BOOTH = 2.7       # booth-ring roofs around the carousel: the hop loop
CROUCH = 1.5      # crouch-only clear height (1.12 crouched < 1.5 < 2.16 standing)
RAIL, RAIL_T = 1.0, 0.15
BOUNDARY_H = 7.5  # north, west, east; checked in layout-checks.json
SOUTH_FENCE_H = 5.0  # lower fence keeps the concept's open south edge
MIRROR_EXIT = 2.6

PLAN_SCALE = 0.18
PLAN_ORIGIN = (1207.5, 222.5)


def r(value):
    return round(value + 0.0, 3)


class Layout:
    def __init__(self):
        self.boxes, self.spawns, self.waypoints, self.mirrors, self.landmarks = [], [], [], [], []
        self.zones, self.routes, self.intended_tops, self.intended_roles = [], [], set(), set()

    def intended(self, box):
        return box['id'] in self.intended_tops or box['role'] in self.intended_roles

    def box(self, name, x0, x1, z0, z1, y0, y1, kind='cover', role='wall'):
        x0, x1, z0, z1 = min(x0, x1), max(x0, x1), min(z0, z1), max(z0, z1)
        if x1 - x0 <= 1e-6 or z1 - z0 <= 1e-6 or y1 - y0 <= 1e-6:
            raise ValueError(f'empty box {name}')
        if any(b['id'] == name for b in self.boxes):
            raise ValueError(f'duplicate box id {name}')
        self.boxes.append(dict(id=name, x=r((x0 + x1) / 2), z=r((z0 + z1) / 2), w=r(x1 - x0),
                               d=r(z1 - z0), h=r(y1 - y0), y=r(y0), kind=kind, role=role))

    def wall(self, name, x0, x1, z0, z1, h, y0=0.0, role='wall'):
        self.box(name, x0, x1, z0, z1, y0, y0 + h, 'cover', role)

    def deck(self, name, x0, x1, z0, z1, top=ROOF):
        self.box(name, x0, x1, z0, z1, top - DECK, top, 'platform', 'deck')

    def stairs(self, name, x0, x1, z0, z1, rises_toward, top):
        """Solid steps from the ground; the deck at `top` is the last rise."""
        count = round(top / RISE) - 1
        along_x = rises_toward in ('e', 'w')
        span = (x1 - x0) if along_x else (z1 - z0)
        if abs(span - count * RUN) > 1e-6:
            raise ValueError(f'{name}: run {span} != {count} x {RUN}')
        for k in range(1, count + 1):
            lo, hi = (k - 1) * RUN, k * RUN
            if rises_toward == 'e':
                ext = (x0 + lo, x0 + hi, z0, z1)
            elif rises_toward == 'w':
                ext = (x1 - hi, x1 - lo, z0, z1)
            elif rises_toward == 's':
                ext = (x0, x1, z0 + lo, z0 + hi)
            else:
                ext = (x0, x1, z1 - hi, z1 - lo)
            self.box(f'{name}-{k:02d}', *ext, 0, k * RISE, 'step', 'step')

    def disc(self, name, cx, cz, radius, top, bands=6, straddle=1.075):
        """Low round platform: a symmetric staircase of boxes whose corners lie on a circle
        `straddle` x radius, so the outline alternates just outside and inside the round
        visual (max radial error 0.49 m for r 6.5 with 6 bands). Step height only."""
        for i in range(bands):
            angle = (i + 0.5) / bands * math.pi / 2
            a, b = radius * straddle * math.cos(angle), radius * straddle * math.sin(angle)
            self.box(f'{name}-{i + 1}', cx - a, cx + a, cz - b, cz + b, 0, top, 'step', 'deck-round')

    def spawn(self, x, z, y=0.0):
        self.spawns.append(dict(x=r(x), y=r(y), z=r(z)))

    def waypoint(self, x, z, y=0.0):
        self.waypoints.append(dict(x=r(x), y=r(y), z=r(z)))

    def landmark(self, name, x, z, y):
        self.landmarks.append(dict(name=name, x=r(x), y=r(y), z=r(z)))

    def mirror_pair(self, name, label, a, b):
        """a, b = (x, y, z, facing): facing is the compass side the glass and its exit face."""
        yaw_for = {'s': math.pi, 'n': 0.0, 'e': -math.pi / 2, 'w': math.pi / 2}
        for mid, target, (x, y, z, facing) in ((f'{name}-a', f'{name}-b', a), (f'{name}-b', f'{name}-a', b)):
            yaw = yaw_for[facing]
            self.mirrors.append(dict(
                id=mid, target=target, label=label, x=r(x), y=r(y), z=r(z), yaw=yaw,
                exit=dict(x=r(x - math.sin(yaw) * MIRROR_EXIT), y=r(y),
                          z=r(z - math.cos(yaw) * MIRROR_EXIT))))

    def zone(self, name, x0, x1, z0, z1):
        self.zones.append(dict(name=name, x0=x0, x1=x1, z0=z0, z1=z1))

    def route(self, kind, points):
        self.routes.append(dict(kind=kind, points=[[r(x), r(z)] for x, z in points]))


# Mirror maze: a braid (no dead ends) on a 6 x 7 cell grid; walls are the closed cell edges.
MAZE_X = (24.0, EAST)
MAZE_Z = (-5.5, 10.5)
MAZE_COLS, MAZE_ROWS = 6, 7
MAZE_DOORS = {'north': (2, 0), 'west': (0, 3), 'south': (3, 6)}
MAZE_PASSAGES = [
    # Open cell edges (column, row), row 0 is north. Seeded braid DFS (seed 138), then
    # kept as data so playtest edits are local: every cell has >= 2 openings, 4 loops.
    ((0, 0), (0, 1)), ((0, 0), (1, 0)), ((0, 1), (0, 2)), ((0, 1), (1, 1)), ((0, 2), (0, 3)),
    ((0, 2), (1, 2)), ((0, 3), (1, 3)), ((0, 4), (0, 5)), ((0, 4), (1, 4)), ((0, 5), (0, 6)),
    ((0, 5), (1, 5)), ((0, 6), (1, 6)), ((1, 0), (1, 1)), ((1, 2), (2, 2)), ((1, 3), (1, 4)),
    ((1, 5), (1, 6)), ((2, 0), (2, 1)), ((2, 1), (3, 1)), ((2, 2), (2, 3)), ((2, 2), (3, 2)),
    ((2, 3), (2, 4)), ((2, 4), (3, 4)), ((2, 5), (2, 6)), ((2, 5), (3, 5)), ((2, 6), (3, 6)),
    ((3, 0), (3, 1)), ((3, 0), (4, 0)), ((3, 2), (3, 3)), ((3, 3), (3, 4)), ((3, 4), (3, 5)),
    ((3, 6), (4, 6)), ((4, 0), (5, 0)), ((4, 1), (4, 2)), ((4, 1), (5, 1)), ((4, 2), (5, 2)),
    ((4, 3), (4, 4)), ((4, 3), (5, 3)), ((4, 4), (5, 4)), ((4, 5), (4, 6)), ((4, 5), (5, 5)),
    ((4, 6), (5, 6)), ((5, 0), (5, 1)), ((5, 2), (5, 3)), ((5, 4), (5, 5)), ((5, 5), (5, 6)),
]
MAZE_GLASS = 0.2


def maze_grid():
    xs = [MAZE_X[0] + (MAZE_X[1] - MAZE_X[0]) * i / MAZE_COLS for i in range(MAZE_COLS + 1)]
    zs = [MAZE_Z[0] + (MAZE_Z[1] - MAZE_Z[0]) * i / MAZE_ROWS for i in range(MAZE_ROWS + 1)]
    return xs, zs


def maze_walls():
    """Closed internal edges merged into straight runs: [(orientation, line index, start, end)]."""
    open_edges = {tuple(sorted(p)) for p in MAZE_PASSAGES}
    runs = []
    for k in range(1, MAZE_COLS):          # vertical lines between column k-1 and k
        cells = [r_ for r_ in range(MAZE_ROWS) if tuple(sorted(((k - 1, r_), (k, r_)))) not in open_edges]
        runs += [('v', k, a, b) for a, b in contiguous(cells)]
    for k in range(1, MAZE_ROWS):          # horizontal lines between row k-1 and k
        cells = [c for c in range(MAZE_COLS) if tuple(sorted(((c, k - 1), (c, k)))) not in open_edges]
        runs += [('h', k, a, b) for a, b in contiguous(cells)]
    return runs


def contiguous(indices):
    out, start, prev = [], None, None
    for i in indices:
        if start is None:
            start = prev = i
        elif i == prev + 1:
            prev = i
        else:
            out.append((start, prev + 1))
            start = prev = i
    if start is not None:
        out.append((start, prev + 1))
    return out


def build():
    L = Layout()

    # Boundary: coaster lattice (N, W), building backs (E), carnival fence (S). Heights are
    # checked against every reachable top plus the jump apex in layout-checks.json.
    L.wall('edge-north', WEST - 1, EAST + 1, NORTH - 1, NORTH, BOUNDARY_H, role='boundary')
    L.wall('edge-south', WEST - 1, EAST + 1, SOUTH, SOUTH + 1, SOUTH_FENCE_H, role='boundary')
    L.wall('edge-west', WEST - 1, WEST, NORTH, SOUTH, BOUNDARY_H, role='boundary')
    L.wall('edge-east', EAST, EAST + 1, NORTH, SOUTH, BOUNDARY_H, role='boundary')

    # --- Carousel plaza (centre): ground loop, round carousel, booth-roof hop ring ----------
    L.zone('CAROUSEL PLAZA', -16.5, 16.5, -16.5, 16.5)
    L.disc('carousel-deck', 0, 0, 6.5, RISE)
    L.wall('carousel-core', -1.1, 1.1, -1.1, 1.1, 5.5, y0=RISE, role='prop')
    for name, x, z, w, d in (('n', 0, -4.6, 1.3, 0.45), ('s', 0, 4.6, 1.3, 0.45),
                             ('e', 4.6, 0, 0.45, 1.3), ('w', -4.6, 0, 0.45, 1.3)):
        L.wall(f'carousel-horse-{name}', x - w / 2, x + w / 2, z - d / 2, z + d / 2, 1.6, y0=RISE, role='prop')
    for name, sx, sz in (('ne', 1, -1), ('se', 1, 1), ('sw', -1, 1), ('nw', -1, -1)):
        x, z = sx * 3.2, sz * 3.2
        L.wall(f'carousel-chariot-{name}', x - 0.55, x + 0.55, z - 0.55, z + 0.55, 1.1, y0=RISE, role='prop')
    for name, x0, x1, z0, z1 in (('n', -2.2, 2.2, -7.45, -7.05), ('s', -2.2, 2.2, 7.05, 7.45),
                                 ('e', 7.05, 7.45, -2.2, 2.2), ('w', -7.45, -7.05, -2.2, 2.2)):
        L.wall(f'carousel-rail-{name}', x0, x1, z0, z1, RAIL, role='rail')
    # Twelve booths at r = 11.5 on 15 + 30k degrees; the cardinal gaps are the entrances.
    for k in range(12):
        angle = math.radians(15 + 30 * k)
        cx, cz = 11.5 * math.cos(angle), -11.5 * math.sin(angle)
        if k % 3 == 1:
            w = d = 2.6
        elif abs(math.cos(angle)) > abs(math.sin(angle)):
            w, d = 2.4, 3.0
        else:
            w, d = 3.0, 2.4
        L.wall(f'booth-{k + 1:02d}', cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, BOOTH, role='booth')
    # Crates sit against the N and S booths so the ring lane outside stays clear.
    for name, x, z in (('crate-plaza-s', 3.9, 13.2), ('crate-plaza-n', -3.9, -13.2)):
        L.wall(name, x - 0.6, x + 0.6, z - 0.6, z + 0.6, 1.2, role='crate')

    # --- Coaster catwalks (north), long seeker sightline, mirror landing ------------------
    L.zone('COASTER CATWALKS', -31, 14, NORTH, -18.5)
    L.deck('catwalk', -31, 14, NORTH, -20.5)
    L.deck('catwalk-mirror-landing', -2.5, 3.5, -20.5, -18.5)
    for name, x0, x1 in (('w', -31, -24.2), ('m', -16.8, -2.5), ('e', 3.5, 6.3)):
        L.wall(f'catwalk-rail-{name}', x0, x1, -20.5, -20.5 + RAIL_T, RAIL, y0=ROOF, role='rail')
    for side, x0, x1, z0, z1 in (('w', -2.65, -2.5, -20.5, -18.5), ('e', 3.5, 3.65, -20.5, -18.5),
                                 ('s', -2.5, 3.5, -18.65, -18.5)):
        L.wall(f'catwalk-landing-rail-{side}', x0, x1, z0, z1, RAIL, y0=ROOF, role='rail')
    for x in (-27.5, -13.5, -8.5, 10.5):
        L.wall(f'catwalk-post-{"m" if x < 0 else "p"}{abs(x):04.1f}', x - 0.25, x + 0.25, -21, -20.5,
               ROOF - DECK, role='pillar')
    L.stairs('catwalk-stair-east', 6.5, 9.0, -20.5, -15.5, 'n', ROOF)

    # --- Tunnel slide (north-west): open stepped chute down from the catwalk landing into
    # the tube mouth, a standing tube section, then the crouch-only exit leg. A closed
    # stepped descent would stack its ceiling boxes into a climbable crest (5.6 m perch).
    L.zone('TUNNEL SLIDE', WEST, -29.5, -23.5, -2.1)
    L.deck('slide-top', WEST, -31, NORTH, -19)
    L.wall('slide-top-rail', -34.4, -31, -19, -19 + RAIL_T, RAIL, y0=ROOF, role='rail')
    bore_e, wall_e = -35.0, -34.4     # bore x WEST..-35 (2 m), east shell wall 0.6 m
    for k in range(1, 11):
        z0 = -19 + (k - 1) * RUN
        L.box(f'slide-step-{k:02d}', WEST, bore_e, z0, z0 + RUN, 0, ROOF - k * RISE, 'step', 'step')
    for k in range(5):
        z0 = -19 + 2 * k * RUN
        L.wall(f'slide-chute-rail-{k + 1}', bore_e, bore_e + 0.3, z0, z0 + 2 * RUN,
               ROOF - (2 * k + 1) * RISE + RAIL, role='rail')
    # Tube mouth at z -13.5: a body on the last steps (0.3/0.6 m) must clear the tube roof,
    # so the roof starts 0.5 m past the chute and sits 2.6 m up (motor-checked both ways).
    L.box('slide-roof-mid', WEST, wall_e, -13.5, -4.6, 2.6, 2.9, 'cover', 'tube')
    L.wall('slide-shell-e2', bore_e, wall_e, -14, -4.6, 2.9, role='tube')
    L.box('slide-crouch-roof', WEST, -29.5, -4.6, -2.4, CROUCH, CROUCH + 0.3, 'cover', 'tube-crouch')
    L.wall('slide-shell-n', wall_e, -29.5, -5.2, -4.6, CROUCH + 0.3, role='tube')
    L.wall('slide-shell-s', WEST, -29.5, -2.4, -1.8, CROUCH + 0.3, role='tube')

    # --- NW workshop block ----------------------------------------------------------------
    L.zone('WORKSHOP', -26, -16.5, -20.5, -4.5)
    L.wall('workshop-w', -26, -25.5, -18, -13, ROOF - DECK)
    L.wall('workshop-s-w', -25.5, -23.5, -13.5, -13, ROOF - DECK)
    L.wall('workshop-s-e', -21.5, -20, -13.5, -13, ROOF - DECK)
    L.wall('workshop-e', -20.5, -20, -18, -13.5, ROOF - DECK)
    L.deck('workshop-roof', -26, -20, -18, -13)
    L.deck('workshop-bridge', -24, -21.5, -20.5, -18)
    L.stairs('workshop-stair', -19.5, -17.0, -20.5, -15.5, 'n', ROOF)
    L.wall('gatehouse-w', -23, -21, -8.5, -4.5, 3.0)
    L.wall('gatehouse-e', -18.5, -16.5, -8.5, -4.5, 3.0)
    L.box('gatehouse-lintel', -21, -18.5, -8.5, -4.5, 2.6, 3.0, 'cover', 'roof')
    L.wall('workshop-stage', -25, -21.5, -12, -9.5, 1.2, role='vault')

    # --- West yard (tube exit) --------------------------------------------------------------
    L.zone('WEST YARD', -29.5, -16.5, -4.5, 3.5)
    L.wall('crate-west-1', -25, -23.8, -1.2, 0, 1.2, role='crate')
    L.wall('barrier-west', -24, -21.5, -2.8, -2.3, 0.9, role='barrier')
    L.wall('ride-panel-west', -27, -26.5, -4.2, -1.2, 2.6, role='panel')   # cover at the tube exit

    # --- Bumper court (south-west): east edge at x -16.5 so the plaza loop passes outside --
    L.zone('BUMPER COURT', WEST, -16.5, 3.5, 21)
    L.wall('court-n-w', -35, -30.75, 3.5, 4, RAIL + 0.2, role='rail')
    L.wall('court-n-m', -24.75, -21, 3.5, 4, RAIL + 0.2, role='rail')
    L.wall('court-n-e', -19, -16, 3.5, 4, RAIL + 0.2, role='rail')
    L.wall('court-e-n', -16.5, -16, 4, 9, RAIL + 0.2, role='rail')
    L.wall('court-e-s', -16.5, -16, 13, 21, RAIL + 0.2, role='rail')
    # Arch sign above jump reach from the gatehouse roof (3.0 + 1.76 < 4.9).
    L.box('bump-arch-lintel', -30.5, -25, 3.5, 4, 4.2, 4.9, 'cover', 'sign')
    L.wall('bump-arch-w', -30.75, -30.5, 3.4, 4.1, 4.9, role='post')
    L.wall('bump-arch-e', -25, -24.75, 3.4, 4.1, 4.9, role='post')
    for name, x, z in (('nw', -35.5, 5), ('ne', -18, 5), ('sw', -35.5, 20), ('se', -18, 20)):
        L.wall(f'court-pillar-{name}', x - 0.25, x + 0.25, z - 0.25, z + 0.25, 5.2, role='pillar')
    L.wall('court-booth', -29, -25.5, 10, 13.5, 2.2, role='booth')
    for i, (x, z, along_x) in enumerate(((-33, 7, True), (-21, 8, False), (-19.5, 14, False),
                                          (-27, 19.8, True), (-33.8, 17.2, True), (-23, 11.5, False))):
        w, d = (2.0, 1.2) if along_x else (1.2, 2.0)
        L.wall(f'bumper-car-{i + 1}', x - w / 2, x + w / 2, z - d / 2, z + d / 2, 1.0, role='car')

    # --- Maintenance underpass: service block along the south edge, 2.7 m clear corridor --
    L.zone('MAINTENANCE UNDERPASS', WEST, -9.5, 21, SOUTH)
    under_top = 4.8
    L.wall('underpass-block-w', WEST, -34, 21, SOUTH, under_top)   # solid, so no dead-end pocket
    L.wall('underpass-n-m', -31.5, -23.5, 21, 21.5, under_top)
    L.wall('underpass-n-e', -21, -12, 21, 21.5, under_top)
    L.box('underpass-slab', -34, -9.5, 21.5, SOUTH, 2.7, under_top, 'cover', 'roof')
    for name, x0, x1 in (('w', -34, -31.5), ('m', -23.5, -21), ('e', -12, -9.5)):
        L.box(f'underpass-lintel-{name}', x0, x1, 21, 21.5, 2.7, under_top, 'cover', 'roof')

    # --- Ticket alley (south) ---------------------------------------------------------------
    L.zone('TICKET ALLEY', -9.5, 9.5, 16.5, SOUTH)
    for i, (x, z) in enumerate(((-6.5, 18.2), (-2.2, 18.2), (5.6, 18.2), (-4.5, 23.1), (1.6, 23.1), (7.2, 23.1))):
        L.wall(f'kiosk-{i + 1}', x - 0.9, x + 0.9, z - 0.9, z + 0.9, 2.8, role='kiosk')
    L.wall('counter-alley-1', 0.8, 3.2, 17.6, 18.8, 2.2, role='booth')

    # --- Funhouse (south, east of the alley): clown facade, mouth entrance, 3 doors ---------
    L.zone('FUNHOUSE', 10.5, 21.5, 12.5, 23.2)
    fun_top = 5.0
    L.wall('funhouse-face-w', 10.5, 14.8, 22, 23.2, 7.0, role='facade')
    L.wall('funhouse-face-e', 17.2, 21.5, 22, 23.2, 7.0, role='facade')
    L.box('funhouse-mouth-lintel', 14.8, 17.2, 22, 23.2, 2.8, 7.0, 'cover', 'facade')
    L.wall('funhouse-w', 10.5, 11, 13, 22, fun_top - DECK)
    L.wall('funhouse-n-w', 10.5, 12.5, 12.5, 13, fun_top - DECK)
    L.wall('funhouse-n-e', 14.5, 21.5, 12.5, 13, fun_top - DECK)
    L.wall('funhouse-e-n', 21, 21.5, 13, 16, fun_top - DECK)
    L.wall('funhouse-e-s', 21, 21.5, 18.5, 22, fun_top - DECK)
    L.box('funhouse-roof', 10.5, 21.5, 12.5, 22, fun_top - DECK, fun_top, 'cover', 'roof')
    L.wall('funhouse-panel-1', 13.5, 16, 15.2, 15.7, 2.6, role='panel')
    L.wall('funhouse-panel-2', 16.5, 17, 17.5, 21, 2.6, role='panel')

    # --- Teleport mirror hub (south-east): three mirrors on three walls -------------------
    L.zone('TELEPORT HUB', 25.5, EAST, 12.5, 22.5)
    hub_top = 5.0
    for name, x0, x1, z0, z1 in (('n-w', 25.5, 31, 12.5, 13), ('n-e', 35, EAST, 12.5, 13),
                                 ('w-n', 25.5, 26, 13, 15.5), ('w-s', 25.5, 26, 18.5, 22.5),
                                 ('s-w', 26, 27.5, 22, 22.5), ('s-e', 30.5, EAST, 22, 22.5)):
        L.wall(f'hub-{name}', x0, x1, z0, z1, hub_top - DECK)
    L.box('hub-roof', 25.5, EAST, 12.5, 22.5, hub_top - DECK, hub_top, 'cover', 'roof')
    L.wall('hub-plinth', 31.0, 32.6, 17.0, 18.6, 1.0, role='prop')

    # --- Mirror maze (east): glass braid maze under an opaque roof ------------------------
    L.zone('MIRROR MAZE', 23.5, EAST, -6, 11)
    maze_top = 5.4
    xs, zs = maze_grid()
    north_door = (xs[MAZE_DOORS['north'][0]], xs[MAZE_DOORS['north'][0] + 1])
    south_door = (xs[MAZE_DOORS['south'][0]], xs[MAZE_DOORS['south'][0] + 1])
    west_door = (zs[MAZE_DOORS['west'][1]], zs[MAZE_DOORS['west'][1] + 1])
    L.wall('maze-n-w', 23.5, north_door[0], -6, -5.5, maze_top - DECK)
    L.wall('maze-n-e', north_door[1], EAST, -6, -5.5, maze_top - DECK)
    L.wall('maze-w-n', 23.5, 24, -5.5, west_door[0], maze_top - DECK)
    L.wall('maze-w-s', 23.5, 24, west_door[1], 11, maze_top - DECK)
    L.wall('maze-s-w', 24, south_door[0], 10.5, 11, maze_top - DECK)
    L.wall('maze-s-e', south_door[1], EAST, 10.5, 11, maze_top - DECK)
    L.box('maze-roof', 23.5, EAST, -6, 11, maze_top - DECK, maze_top, 'cover', 'roof')
    g = MAZE_GLASS / 2
    for i, (orient, k, a, b) in enumerate(maze_walls()):
        if orient == 'v':
            L.wall(f'maze-glass-{i + 1:02d}', xs[k] - g, xs[k] + g, zs[a] - (g if a else 0),
                   zs[b] + (g if b < MAZE_ROWS else 0), 3.0, role='glass')
        else:
            L.wall(f'maze-glass-{i + 1:02d}', xs[a] - (g if a else 0), xs[b] + (g if b < MAZE_COLS else 0),
                   zs[k] - g, zs[k] + g, 3.0, role='glass')

    # --- Arcade hall and roof route (north-east) --------------------------------------------
    L.zone('ARCADE', 14, 29, -22, -13)
    for name, x0, x1, z0, z1 in (('n', 14, 26.5, -22, -21.5), ('w-n', 14, 14.5, -21.5, -19.5),
                                 ('w-s', 14, 14.5, -17, -13.5), ('s-w', 14, 17.5, -13.5, -13),
                                 ('s-m', 20, 22, -13.5, -13), ('s-e', 24.5, 26.5, -13.5, -13),
                                 ('e', 26, 26.5, -21.5, -13.5)):
        L.wall(f'arcade-{name}', x0, x1, z0, z1, ROOF - DECK)
    L.deck('arcade-roof-w', 14, 19.5, -22, -13)
    L.deck('arcade-roof-e', 21.5, 26.5, -22, -13)
    L.wall('arcade-cabinets-1', 15, 19, -20.5, -19.7, 1.9, role='cabinets')
    L.wall('arcade-cabinets-2', 17, 23, -17.2, -16.4, 1.9, role='cabinets')
    L.wall('arcade-cabinets-3', 22.5, 25.5, -20.5, -19.7, 1.9, role='cabinets')
    L.deck('arcade-stair-landing', 26.5, 29.0, NORTH, -18.0)
    L.stairs('arcade-stair-east', 26.5, 29.0, -18.0, -13.0, 'n', ROOF)
    L.wall('arcade-kiosk', 17.5, 20.5, -10, -7.5, BOOTH, role='kiosk')
    L.wall('crate-arcade', 16.2, 17.4, -8.6, -7.4, 1.2, role='crate')
    # North-east yard below the arcade stair (concept's east climb route to the maze).
    L.wall('shed-ne', 32, 35.5, -17, -13.5, 2.6, role='kiosk')
    L.wall('crate-ne', 29.8, 31, -11.2, -10, 1.2, role='crate')

    # --- East yard: open seeker sightline from the maze door to the carousel --------------
    L.zone('EAST YARD', 16.5, 23.5, -6, 11)
    L.wall('ride-panel-east', 18, 18.5, -4.5, -1.5, 2.6, role='panel')
    L.wall('barrier-east', 19, 21, 3.8, 4.3, 0.9, role='barrier')
    L.wall('kiosk-east', 16.8, 19.6, 5.5, 7.9, BOOTH, role='kiosk')
    L.wall('crate-east-1', 21.5, 22.7, -3.2, -2, 1.2, role='crate')
    L.wall('ride-panel-se-1', 23, 25, 14.5, 15, 2.6, role='panel')
    L.wall('ride-panel-se-2', 23, 23.5, 18.5, 21, 2.6, role='panel')

    # --- Mirrors: three pairs, each with one end in the hub ("multi-angle") ---------------
    L.mirror_pair('violet', 'VIOLET', (0.5, ROOF, -23.1, 's'), (28.5, 0.0, 13.4, 's'))
    L.mirror_pair('cyan', 'CYAN', (-36.6, 0.0, 12.0, 'e'), (37.6, 0.0, 17.2, 'w'))
    L.mirror_pair('amber', 'AMBER', (-25.1, ROOF, -15.5, 'e'), (34.0, 0.0, 21.7, 'n'))

    # --- Spawns: any prefix of the list stays spread over the map ------------------------
    for x, z in ((-27, 0.2), (31, -8.5), (-3.5, 20.8), (11.5, -17.5),
                 (-15, 11), (19, 9.5), (-11, -18.5), (23.5, 24.2),
                 (-33, 15.5), (5, 11.8), (-23, 19.5), (1.5, -15.5)):
        L.spawn(x, z)

    # --- Waypoints: a ground tour through the doorways; every straight leg is standing-clear,
    # because bots walk straight at the next goal (room.rs bot_input) -----------------------
    for x, z in ((-14.5, -14.5), (0, -14.5), (11.5, -14.8), (14.5, -11), (14.5, 0), (22.5, 2.5),
                 (22.5, 11.8), (22.2, 24.6), (16, 24.9), (9.6, 24.9), (9.6, 20.5), (-8.5, 20.6),
                 (-10.75, 23.7), (-22.25, 23.7), (-22.25, 18.5), (-34.5, 15.5), (-27.75, 6),
                 (-27.75, 1.5), (-14.5, 0), (-19.75, -3), (-19.75, -10)):
        L.waypoint(x, z)

    for name, x, z, y in (('CAROUSEL PLAZA', 0, 0, 8.4), ('COASTER CATWALKS', -12, -22, 6.0),
                          ('TUNNEL SLIDE', -33, -12, 6.6), ('ARCADE ROOF', 20.5, -17.5, 5.8),
                          ('MIRROR MAZE', 30.5, 2.5, 7.0), ('TELEPORT HUB', 31.5, 17.5, 6.2),
                          ('FUNHOUSE', 16, 22.6, 8.0), ('TICKET ALLEY', 0, 21, 4.4),
                          ('BUMPER COURT', -26.75, 12, 6.2), ('MAINTENANCE UNDERPASS', -22, 23.7, 5.6)):
        L.landmark(name, x, z, y)

    # Concept routes redrawn on the layout (plan only).
    L.route('loop', [(-14.5, -14.5), (12.3, -14.5), (13.6, -11), (13.6, 11), (10, 11), (6, 14.5),
                     (-14.5, 14.5), (-14.5, -14.5)])
    L.route('loop', [(-14.5, -10), (-19.75, -10), (-19.75, -2.5), (-14.5, -2.5)])
    # Carousel ring: between the railing ends (r 7.8) and the booth corners (r 9.7).
    L.route('loop', [(8.5 * math.cos(math.radians(a)), -8.5 * math.sin(math.radians(a)))
                     for a in range(0, 361, 30)])
    L.route('climb', [(-3.9, -14.6), (-3.9, -11.4)])
    L.route('climb', [(7.75, -15), (7.75, -20.2), (12, -22), (17, -18)])
    L.route('climb', [(-18.25, -15), (-18.25, -20.5), (-22.75, -19.5), (-23, -15.5)])
    L.route('climb', [(16.8, -8), (19, -8.75), (19, -12.2), (19, -15)])
    L.route('climb', [(27.75, -12.5), (27.75, -19.5)])
    L.route('climb', [(3.9, 14.6), (3.9, 11.4)])
    L.route('slide', [(-33.5, -21), (-36, -18.5), (-36, -3.5), (-29, -3.5), (-26, -1)])
    L.route('slide', [(-27.75, 1.5), (-27.75, 6), (-32.75, 19.5), (-32.75, 23.7), (-10.75, 23.7),
                      (-8.5, 21)])
    L.route('sight', [(23.3, 2.5), (7.5, 2.5)])
    L.route('sight', [(-10, -22), (-30, -22)])
    # Tops players are meant to stand on; any other reachable top is reported for review.
    L.intended_roles.update({'deck', 'deck-round', 'step', 'booth', 'kiosk', 'crate', 'vault',
                             'rail', 'barrier', 'car', 'cabinets', 'panel', 'prop'})
    L.intended_tops.update({'gatehouse-lintel', 'gatehouse-w', 'gatehouse-e', 'slide-roof-mid',
                            'slide-shell-e2', 'slide-crouch-roof', 'slide-shell-n', 'slide-shell-s'})
    return L


def descriptor(layout):
    """The map.json shape consumed by scripts/build-maps.mjs."""
    return dict(
        id='neon-carnival', name='Neon Carnival', half=HALF, recommended='4–12 players',
        description='Night fairground: carousel loop, coaster catwalks, arcade roofs, tunnel '
                    'slide, mirror maze and a teleport hub.',
        theme='carnival',
        boxes=[{k: v for k, v in b.items() if k != 'role'} for b in layout.boxes],
        spawns=layout.spawns, waypoints=layout.waypoints, mirrors=layout.mirrors,
        landmarks=layout.landmarks)


# Checks ------------------------------------------------------------------------------------
def overlaps(x, z, b, radius=RADIUS):
    dx = x - min(max(x, b['x'] - b['w'] / 2), b['x'] + b['w'] / 2)
    dz = z - min(max(z, b['z'] - b['d'] / 2), b['z'] + b['d'] / 2)
    return dx * dx + dz * dz < radius * radius - 1e-7


def can_occupy(p, height, boxes):
    """Port of canOccupy in shared/physics.ts."""
    return not any(p['y'] < b['y'] + b['h'] - 0.001 and p['y'] + height > b['y'] + 0.001
                   and overlaps(p['x'], p['z'], b) for b in boxes)


def footprint_gap(a, b):
    gx = max(0.0, abs(a['x'] - b['x']) - (a['w'] + b['w']) / 2)
    gz = max(0.0, abs(a['z'] - b['z']) - (a['d'] + b['d']) / 2)
    return math.hypot(gx, gz)


class Solids:
    """Spatial hash answering the canOccupy body test for one point and body height."""

    def __init__(self, boxes, cell=2.0):
        self.cell, self.grid = cell, {}
        for b in boxes:
            for i in range(math.floor((b['x'] - b['w'] / 2 - RADIUS) / cell),
                           math.floor((b['x'] + b['w'] / 2 + RADIUS) / cell) + 1):
                for k in range(math.floor((b['z'] - b['d'] / 2 - RADIUS) / cell),
                               math.floor((b['z'] + b['d'] / 2 + RADIUS) / cell) + 1):
                    self.grid.setdefault((i, k), []).append(b)

    def free(self, x, y, z, height):
        for b in self.grid.get((math.floor(x / self.cell), math.floor(z / self.cell)), ()):
            if y < b['y'] + b['h'] - 0.001 and y + height > b['y'] + 0.001 and overlaps(x, z, b):
                return False
        return True


def top_points(b, spacing=0.5):
    top = b['y'] + b['h']
    nx, nz = max(1, math.ceil(b['w'] / spacing)), max(1, math.ceil(b['d'] / spacing))
    return [(b['x'] - b['w'] / 2 + (i + 0.5) * b['w'] / nx, top, b['z'] - b['d'] / 2 + (k + 0.5) * b['d'] / nz)
            for i in range(nx) for k in range(nz)]


def jump_range(rise, speed, dash):
    disc = RULES['jumpSpeed'] ** 2 - 2 * RULES['gravity'] * rise
    if disc < 0:
        return -1.0
    return speed * (RULES['jumpSpeed'] + math.sqrt(disc)) / RULES['gravity'] + dash + 2 * RADIUS


def flight(solids, a, b, speed, dash):
    """A standing jump or drop from point a to point b: the take-off column, one straight
    cruise segment at some height within the apex, and the landing column must be clear."""
    (xa, ya, za), (xb, yb, zb) = a, b
    rise = yb - ya
    if rise > JUMP_APEX - 0.01:
        return False
    distance = math.hypot(xb - xa, zb - za)
    if distance > jump_range(rise, speed, dash):
        return False
    low, high = max(ya, yb) + 0.05, ya + JUMP_APEX - 0.01
    steps = max(1, math.ceil(distance / 0.25))
    for h in sorted({low, low + 0.45, low + 0.9, high}):
        if h < low - 1e-9 or h > high + 1e-9:
            continue
        if not solids.free(xa, ya, za, h - ya + HEIGHT) or not solids.free(xb, yb, zb, h - yb + HEIGHT):
            continue
        if all(solids.free(xa + (xb - xa) * t / steps, h, za + (zb - za) * t / steps, HEIGHT)
               for t in range(1, steps)):
            return True
    return False


def reachability(layout, speed=12.0, dash=3.0):
    """Box tops a player can stand on, from the spawns, by walking, dropping and jumping.

    Ground travel is a crouch-passable 0.5 m grid search from the spawns. Jumps use the
    timed/auto hop cap (12 m/s) plus a Hider dash and one straight flight line, so reach is
    generous for distance but respects walls, ceilings and enclosed interiors."""
    boxes = layout.boxes
    solids = Solids(boxes)
    step = 0.5
    cells, queue = set(), []
    for s in layout.spawns:
        start = (round(s['x'] / step), round(s['z'] / step))
        if start not in cells:
            cells.add(start)
            queue.append(start)
    while queue:
        i, k = queue.pop()
        for di, dk in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (i + di, k + dk)
            x, z = n[0] * step, n[1] * step
            if n in cells or not (WEST < x < EAST and NORTH < z < SOUTH):
                continue
            if solids.free(x, 0.0, z, CROUCH_HEIGHT):
                cells.add(n)
                queue.append(n)
    ground = [(i * step, 0.0, k * step) for i, k in cells
              if i % 2 == 0 and k % 2 == 0 and solids.free(i * step, 0.0, k * step, HEIGHT)]
    points = {}
    for b in boxes:
        usable = [p for p in top_points(b) if solids.free(*p, CROUCH_HEIGHT)]
        if usable:
            points[b['id']] = usable
    by_id = {b['id']: b for b in boxes}
    reached, work = {}, []
    reach_max = jump_range(-8.0, speed, dash)

    def try_reach(sources, target):
        tx, tz = by_id[target]['x'], by_id[target]['z']
        for src in sorted(sources, key=lambda p: (p[0] - tx) ** 2 + (p[2] - tz) ** 2)[:160]:
            landing = sorted(points[target], key=lambda p: (p[0] - src[0]) ** 2 + (p[2] - src[2]) ** 2)[:3]
            for dst in landing:
                if flight(solids, src, dst, speed, dash):
                    return src
        return None

    for target in points:
        src = try_reach(ground, target)
        if src:
            reached[target] = ('ground', src)
            work.append(target)
    while work:
        source = work.pop()
        a = by_id[source]
        stand = [p for p in points[source] if solids.free(*p, HEIGHT)]
        if not stand:
            continue
        for target in points:
            if target in reached or footprint_gap(a, by_id[target]) > reach_max:
                continue
            src = try_reach(stand, target)
            if src:
                reached[target] = (source, src)
                work.append(target)
    return reached, len(cells) * step * step


def _inside(b):
    return WEST < b['x'] < EAST and NORTH < b['z'] < SOUTH


def maze_report():
    cells = {(c, r_) for c in range(MAZE_COLS) for r_ in range(MAZE_ROWS)}
    links = {cell: set() for cell in cells}
    for a, b in MAZE_PASSAGES:
        if abs(a[0] - b[0]) + abs(a[1] - b[1]) != 1:
            raise ValueError(f'maze passage {a}-{b} is not between neighbours')
        links[a].add(b)
        links[b].add(a)
    degree = {cell: len(links[cell]) + sum(1 for door in MAZE_DOORS.values() if door == cell) for cell in cells}
    dead_ends = sorted(cell for cell, n in degree.items() if n < 2)
    seen, stack = {MAZE_DOORS['north']}, [MAZE_DOORS['north']]
    while stack:
        for n in links[stack.pop()]:
            if n not in seen:
                seen.add(n)
                stack.append(n)
    loops = len(MAZE_PASSAGES) - (len(cells) - 1)
    xs, zs = maze_grid()
    return dict(cells=len(cells), passages=len(MAZE_PASSAGES), independentLoops=loops,
                deadEnds=[list(c) for c in dead_ends], connected=len(seen) == len(cells),
                cellSizeMetres=[r(xs[1] - xs[0]), r(zs[1] - zs[0])],
                clearCorridorMetres=r(min(xs[1] - xs[0], zs[1] - zs[0]) - MAZE_GLASS),
                )


def checks(layout):
    boxes = layout.boxes
    report = dict(counts=dict(boxes=len(boxes), spawns=len(layout.spawns), mirrors=len(layout.mirrors),
                              waypoints=len(layout.waypoints), landmarks=len(layout.landmarks)))
    kinds, roles = {}, {}
    for b in boxes:
        kinds[b['kind']] = kinds.get(b['kind'], 0) + 1
        roles[b['role']] = roles.get(b['role'], 0) + 1
    report['boxKinds'], report['boxRoles'] = kinds, dict(sorted(roles.items()))
    problems = []
    for b in boxes:
        if abs(b['x']) + b['w'] / 2 > HALF + 1e-8 or abs(b['z']) + b['d'] / 2 > HALF + 1e-8:
            problems.append(f'box outside half: {b["id"]}')
    for i, p in enumerate(layout.spawns):
        if not can_occupy(p, HEIGHT, boxes):
            problems.append(f'spawn {i} blocked')
    for m in layout.mirrors:
        e = m['exit']
        if not can_occupy(e, HEIGHT, boxes):
            problems.append(f'mirror exit {m["id"]} blocked')
        support = e['y'] == 0 or any(overlaps(e['x'], e['z'], b, RADIUS * 0.98) and abs(b['y'] + b['h'] - e['y']) < 1e-6
                                     for b in boxes)
        if not support:
            problems.append(f'mirror exit {m["id"]} has no floor at y {e["y"]}')
        for n in layout.mirrors:
            if n is not m and math.hypot(n['x'] - e['x'], n['z'] - e['z']) < MOVEMENT['mirrorRadius'] + 0.5 \
                    and abs(n['y'] - e['y']) < 1.3:
                problems.append(f'mirror exit {m["id"]} inside the trigger of {n["id"]}')
    reached, ground_area = reachability(layout)
    top = {b['id']: b['y'] + b['h'] for b in boxes}
    role = {b['id']: b['role'] for b in boxes}
    by_id = {b['id']: b for b in boxes}
    report['groundAreaSquareMetres'] = round(ground_area)
    report['reachableTops'] = sorted(
        (dict(id=i, top=r(top[i]), role=role[i], intended=layout.intended(by_id[i]), via=via)
         for i, (via, _) in reached.items()), key=lambda s: (-s['top'], s['id']))
    boundary = [b for b in boxes if b['role'] == 'boundary']
    report['boundaryReached'] = [b['id'] for b in boundary if b['id'] in reached]
    sides = {}
    for b in boundary:
        highest = max((top[i] for i in reached if footprint_gap(b, by_id[i]) < 12), default=0.0)
        sides[b['id']] = dict(height=r(b['y'] + b['h']), highestReachableWithin12m=r(highest),
                              marginMetres=r(b['y'] + b['h'] - highest - JUMP_APEX))
    report['boundary'] = sides
    report['highestReachableTop'] = r(max((top[i] for i in reached), default=0.0))
    if report['boundaryReached']:
        problems.append(f'boundary reachable: {report["boundaryReached"]}')
    for name, side in sides.items():
        if side['marginMetres'] < 0.3:
            problems.append(f'{name} margin {side["marginMetres"]} m < 0.3 m')
    # Bots walk straight at the next waypoint, and the hider loops are drawn as walkable
    # lanes: every leg must be standing-clear (on the ground or on the 0.3 m carousel deck).
    solids = Solids(boxes)

    def blocked_at(a, b):
        steps = max(1, math.ceil(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2))
        for t in range(steps + 1):
            x, z = a[0] + (b[0] - a[0]) * t / steps, a[1] + (b[1] - a[1]) * t / steps
            if not (solids.free(x, 0.0, z, HEIGHT) or solids.free(x, RISE, z, HEIGHT)):
                return [r(x), r(z)]
        return None

    tour = [(w['x'], w['z']) for w in layout.waypoints]
    legs = [(tour[i], tour[(i + 1) % len(tour)]) for i in range(len(tour))]
    legs += [(tuple(a), tuple(b)) for route in layout.routes if route['kind'] == 'loop'
             for a, b in zip(route['points'], route['points'][1:])]
    report['blockedLegs'] = [dict(leg=[list(a), list(b)], at=hit) for a, b in legs if (hit := blocked_at(a, b))]
    report['clearLegs'] = f'{len(legs) - len(report["blockedLegs"])}/{len(legs)}'
    if report['blockedLegs']:
        problems.append(f'{len(report["blockedLegs"])} waypoint or loop legs blocked')
    report['maze'] = maze_report()
    report['maze']['glassBoxes'] = sum(1 for b in boxes if b['role'] == 'glass')
    if report['maze']['deadEnds'] or not report['maze']['connected']:
        problems.append('maze has dead ends or is disconnected')
    report['problems'] = problems
    return report


def main():
    layout = build()
    out = ROOT / 'assets-src/worlds/neon-carnival/reviews/intake'
    out.mkdir(parents=True, exist_ok=True)
    draft = dict(descriptor(layout), plan=dict(
        zones=layout.zones, routes=layout.routes, roles={b['id']: b['role'] for b in layout.boxes},
        scale=dict(metresPerPlanPixel=PLAN_SCALE, planOriginPixel=list(PLAN_ORIGIN)),
        levels=dict(ground=0.0, booth=BOOTH, roof=ROOF, crouchClear=CROUCH, deck=DECK, rise=RISE,
                    run=RUN, boundary=BOUNDARY_H, southFence=SOUTH_FENCE_H)))
    (out / 'layout-draft.json').write_text(json.dumps(draft, indent=1, ensure_ascii=False) + '\n', encoding='utf-8')
    report = checks(layout)
    (out / 'layout-checks.json').write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(dict(counts=report['counts'], kinds=report['boxKinds'], problems=report['problems'],
                          boundary=report['boundary'], maze=report['maze']), indent=1))
    print('reachable tops above 2 m that are not listed as intended:')
    for s in report['reachableTops']:
        if not s['intended'] and s['top'] > 2.0:
            print(f"  {s['top']:5.2f}  {s['role']:12s} {s['id']:28s} via {s['via']}")


if __name__ == '__main__':
    main()
