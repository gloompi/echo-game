"""Rooftop Market: pass 1 graybox (layout only), authored for the approved brief.

Run with Blender --background --factory-startup --python-exit-code 1 --python this_file.py.
Writes assets-src/worlds/rooftop-market/{map.json, rooftop-market.blend, manifest.json}
and the runtime public/assets/worlds/rooftop-market.glb.

Game coordinates are metres, +Y up, +x east, +z south (north is -z).
Blender authoring maps game (x, y, z) to Blender (x, -z, y); the glTF exporter maps back.
Every collider gets exactly one visible mesh tagged `collisionId` whose bounds equal its box.
This pass contains no decorative art; art passes start after the graybox playtest.
"""
import json
import math
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
RULES = json.loads((ROOT / 'shared/rules.json').read_text(encoding='utf-8'))
MOVEMENT = json.loads((ROOT / 'shared/movement.json').read_text(encoding='utf-8'))
BODY_RADIUS = RULES['radius']
BODY_HEIGHT = RULES['height']
OUT = ROOT / 'assets-src/worlds/rooftop-market'
RUNTIME = ROOT / 'public/assets/worlds/rooftop-market.glb'

HALF = 32
ROOF = 3.0            # roof level of every building on the rooftop loop
DECK = 0.4            # catwalk deck thickness; underside at ROOF - DECK = 2.6 m clear
RISE, RUN, STEPS = 0.3, 0.5, 9   # stairs: 9 x 0.3 m, the roof edge is the 10th rise
RAIL_H, RAIL_T = 1.0, 0.15
MIRROR_EXIT = 2.6

layout = dict(
    id='rooftop-market',
    name='Rooftop Market',
    half=HALF,
    recommended='4–10 players',
    description='Rain-slick night market: two long stall lanes, a rooftop catwalk loop, '
    'a crawl tunnel under the Hall and a cargo-lift jump route.',
    theme='rooftop',
    boxes=[], spawns=[], waypoints=[], mirrors=[], landmarks=[],
)


def box(name, x, z, w, d, h, y=0.0, kind='cover', tone='cover'):
    layout['boxes'].append(dict(id=name, x=x, z=z, w=w, d=d, h=h, y=y, kind=kind, tone=tone))


def span(name, x0, x1, z0, z1, h, y=0.0, kind='cover', tone='cover'):
    """Box from explicit game-space extents (x0 < x1, z0 < z1)."""
    box(name, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, h, y, kind, tone)


def stair(name, x0, z0, axis, direction, width):
    """Nine step boxes from the ground. (x0, z0) is the low end's outer corner line:
    steps advance along `axis` ('x' or 'z') in `direction` (+1/-1); `width` extends
    along the other axis in the positive direction. The top step (2.7 m) meets a 3.0 m roof."""
    for k in range(1, STEPS + 1):
        a = k - 1
        lo, hi = sorted((a * RUN * direction, (a + 1) * RUN * direction))
        if axis == 'x':
            span(f'{name}-{k}', x0 + lo, x0 + hi, z0, z0 + width, k * RISE, kind='step', tone='step')
        else:
            span(f'{name}-{k}', x0, x0 + width, z0 + lo, z0 + hi, k * RISE, kind='step', tone='step')


def catwalk(name, x0, x1, z0, z1, rails_along):
    """Deck at ROOF with rails on the two long edges; open underneath (2.6 m)."""
    span(name, x0, x1, z0, z1, DECK, y=ROOF - DECK, kind='platform', tone='catwalk')
    if rails_along == 'z':
        span(name + '-rail-w', x0, x0 + RAIL_T, z0, z1, RAIL_H, y=ROOF, tone='rail')
        span(name + '-rail-e', x1 - RAIL_T, x1, z0, z1, RAIL_H, y=ROOF, tone='rail')
    else:
        span(name + '-rail-n', x0, x1, z0, z0 + RAIL_T, RAIL_H, y=ROOF, tone='rail')
        span(name + '-rail-s', x0, x1, z1 - RAIL_T, z1, RAIL_H, y=ROOF, tone='rail')


def post(name, x, z, h, size=0.5, y=0.0, tone='post'):
    box(name, x, z, size, size, h, y, tone=tone)


# --- Corner blocks: solid buildings whose roofs are the corners of the rooftop loop.
span('block-nw', -32, -12, -32, -19, ROOF, kind='platform', tone='building')
span('block-ne', 12, 32, -32, -19, ROOF, kind='platform', tone='building')
span('block-sw', -32, -12, 19, 32, ROOF, kind='platform', tone='building')
span('block-se', 12, 32, 19, 32, ROOF, kind='platform', tone='building')

# --- Mid roofs on the loop. The Hall is split by a crouch-only tunnel (1.5 m clear).
span('signal-house', -24, -14, -5, 5, ROOF, kind='platform', tone='building')
span('hall-west', 14, 18.2, -5, 5, ROOF, kind='platform', tone='building')
span('hall-east', 19.8, 24, -5, 5, ROOF, kind='platform', tone='building')
span('hall-tunnel-ceiling', 18.2, 19.8, -5, 5, ROOF - 1.5, y=1.5, kind='platform', tone='building')

# --- Rooftop loop: four bridges over the lanes and two catwalks over the courts.
catwalk('bridge-nw', -20.5, -17.5, -19, -5, 'z')
catwalk('bridge-sw', -20.5, -17.5, 5, 19, 'z')
catwalk('bridge-ne', 17.5, 20.5, -19, -5, 'z')
catwalk('bridge-se', 17.5, 20.5, 5, 19, 'z')
catwalk('catwalk-north', -12, 12, -27, -24, 'x')
catwalk('catwalk-south', -12, 12, 24, 27, 'x')
for sx, sz, x, z in [(-1, -1, -19, -9), (-1, 1, -19, 9), (1, -1, 19, -9), (1, 1, 19, 9)]:
    for side in (-1, 1):
        post(f'bridge-post-{"ns"[sz > 0]}{"we"[sx > 0]}-{"ab"[side > 0]}', x + side * 1.2, z, ROOF - DECK)
for z in (-25.5, 25.5):
    for x in (-4, 4):
        post(f'catwalk-post-{"ns"[z > 0]}-{"we"[x > 0]}', x, z, ROOF - DECK)

# --- Ways down from the loop (stairs) and the cargo-lift jump route.
stair('stair-nw-court', -12, -19.5, 'z', -1, 2)      # NW east face, rises north to the catwalk
stair('stair-se-court', 10, 19.5, 'z', 1, 2)         # SE west face, rises south to the catwalk
stair('stair-ne-lane', 22.5, -19, 'x', 1, 2)         # lane A, against the NE block
stair('stair-sw-lane', -22.5, 17, 'x', -1, 2)        # lane B, against the SW block
stair('stair-signal', -26, 5, 'z', -1, 2)            # west alley onto the Signal house
stair('stair-hall', 24, -5, 'z', 1, 2)               # east alley onto the Hall

# Cargo lift (north court, NE block's west face): car at 1.5 m, jump 0 -> 1.5 -> 3.0.
span('lift-car', 9, 12, -31, -28, 1.5, kind='platform', tone='lift')
post('lift-post-a', 8.85, -28.15, 6.0, 0.3, tone='lift')
post('lift-post-b', 8.85, -30.85, 6.0, 0.3, tone='lift')
span('lift-head', 8.7, 12, -31, -28, 0.4, y=6.0, tone='lift')

# Water tower (NW roof): legs are roof cover, tank is out of reach (6 m).
for i, (dx, dz) in enumerate([(-1.6, -1.6), (1.6, -1.6), (-1.6, 1.6), (1.6, 1.6)]):
    post(f'tower-leg-{i}', -24 + dx, -27 + dz, 3.0, 0.4, y=ROOF, tone='tower')
span('tower-tank', -26, -22, -29, -25, 3.5, y=ROOF + 3.0, tone='tower')

# --- Lantern Lane (sightline A, z -19..-13): stalls intrude 2 m from alternate sides,
# leaving a clear 2 m channel (z -17..-15) broken only by crouch-height counters.
for x in (-27, -8, 7):
    box(f'lane-a-stall-n{x:+d}', x, -18, 3.5, 2, 2.6, tone='stall')
for x in (-15, 1, 14.5, 29):
    box(f'lane-a-stall-s{x:+g}', x, -14, 3.5, 2, 2.6, tone='stall')
for x in (-21, 9.5):
    box(f'lane-a-counter{x:+g}', x, -16, 2.4, 1, 1.1, tone='counter')

# --- Signal Lane (sightline B, z 13..19), different rhythm, crossed by the Neon Arch.
for x in (-28, -9, 8, 23.5):
    box(f'lane-b-stall-n{x:+g}', x, 14, 3.5, 2, 2.6, tone='stall')
for x in (-4.5, 14, 27):
    box(f'lane-b-stall-s{x:+g}', x, 18, 3.5, 2, 2.6, tone='stall')
for x in (-15, 4.5):
    box(f'lane-b-counter{x:+g}', x, 16, 2.4, 1, 1.1, tone='counter')
span('arch-pillar-n', -0.6, 0.6, 13, 14.2, 4.0, tone='arch')
span('arch-pillar-s', -0.6, 0.6, 17.8, 19, 4.0, tone='arch')
span('arch-lintel', -0.6, 0.6, 13, 19, 1.0, y=4.0, tone='arch')

# --- Market core (x -14..14, z -13..13): noodle stand at the centre, four stall clusters.
span('noodle-kitchen', -2, 2, -2.5, -0.5, 2.6, tone='noodle')
span('noodle-counter', -2.5, 2.5, 1.0, 1.8, 1.1, tone='noodle')
span('noodle-awning', -3, 3, -2.5, 2.2, 0.2, y=2.6, tone='noodle')
for name, x, z, w, d in [('core-stall-nw', -8, -8, 3, 2.5), ('core-stall-ne', 8, -7, 3, 2.5),
                         ('core-stall-sw', -7, 7.5, 3, 2.5), ('core-stall-se', 8.5, 8, 3, 2.5)]:
    box(name, x, z, w, d, 2.6, tone='stall')
# Inner stalls and noodle tables break the diagonals across the core (no open plaza).
box('core-stall-w', -7.5, -1, 2.5, 3, 2.6, tone='stall')
box('core-stall-e', 7.5, 1.5, 2.5, 3, 2.6, tone='stall')
box('noodle-table-n', 0, -6, 2.4, 1, 1.1, tone='counter')
box('noodle-table-s', -0.5, 5, 2.4, 1, 1.1, tone='counter')
box('core-counter-ne', 4.5, -9.5, 2.4, 1, 1.1, tone='counter')
box('core-counter-se', 4, 10, 2.4, 1, 1.1, tone='counter')
box('core-crates-nw', -4.5, -10, 1.4, 1.4, 1.2, tone='crate')
box('core-crates-sw', -10.5, 9.5, 1.4, 1.4, 2.4, tone='crate')
box('core-vending-w', -11.5, -1.5, 0.9, 1.4, 2.2, tone='crate')
box('core-vending-e', 11.5, 2, 0.9, 1.4, 2.2, tone='crate')
post('core-lantern-a', -5, 3.5, 3.2, 0.3)
post('core-lantern-b', 5.5, -3.5, 3.2, 0.3)

# --- Courts, alleys and strips around the mid roofs.
box('north-kiosk', -5, -21.5, 2.5, 2, 2.6, tone='stall')
box('north-crates', -6, -29.5, 1.4, 1.4, 1.2, tone='crate')
box('north-generator', 4, -30.5, 3, 1.6, 1.6, tone='crate')
box('south-kiosk', 5, 21.5, 2.5, 2, 2.6, tone='stall')
box('south-crates', 6.5, 29.5, 1.4, 1.4, 2.4, tone='crate')
box('south-generator', -4.5, 30.5, 3, 1.6, 1.6, tone='crate')
box('west-alley-crates-n', -29.5, -9, 1.4, 1.4, 1.2, tone='crate')
box('west-alley-crates-s', -27.5, 9, 1.4, 1.4, 2.4, tone='crate')
box('east-alley-crates-n', 27.5, -9, 1.4, 1.4, 2.4, tone='crate')
box('east-alley-crates-s', 29.5, 9, 1.4, 1.4, 1.2, tone='crate')
box('signal-crates', -11.5, -10.5, 1.4, 1.4, 1.2, tone='crate')
box('hall-crates', 11.5, -10.5, 1.4, 1.4, 1.2, tone='crate')

# --- Roof cover so the loop is not an open deck.
for name, x, z in [('roof-ac-nw-a', -29, -22), ('roof-ac-nw-b', -15.5, -30),
                   ('roof-ac-ne-a', 16, -29.5), ('roof-ac-ne-b', 28.5, -23.5),
                   ('roof-ac-sw-a', -28.5, 23.5), ('roof-ac-sw-b', -16, 29.5),
                   ('roof-ac-se-a', 29, 22), ('roof-ac-se-b', 15.5, 30)]:
    box(name, x, z, 2, 1.4, 1.2, y=ROOF, tone='roofcover')
box('signal-billboard', -14.6, 0, 0.6, 5, 2.6, y=ROOF, tone='sign')
box('hall-vent', 22, 2.5, 2, 2, 1.2, y=ROOF, tone='roofcover')

# --- Mirrors (ground level; the trigger is horizontal only). Exit is 2.6 m in front.
def mirror(label, suffix, target, x, z, yaw):
    layout['mirrors'].append(dict(
        id=f'{label.lower()}-{suffix}', target=f'{label.lower()}-{target}', label=label,
        x=x, y=0, z=z, yaw=yaw,
        exit=dict(x=round(x - math.sin(yaw) * MIRROR_EXIT, 6), y=0,
                  z=round(z - math.cos(yaw) * MIRROR_EXIT, 6))))


mirror('CYAN', 'north', 'south', 0, -31.3, math.pi)
mirror('CYAN', 'south', 'north', 0, 31.3, 0.0)
mirror('MAGENTA', 'west', 'east', -31.3, 0, -math.pi / 2)
mirror('MAGENTA', 'east', 'west', 31.3, 0, math.pi / 2)

# --- Spawns (12, ground, spread over lanes, courts, alleys and the core).
for x, z in [(-30.5, -16), (30, -16.5), (-30.5, 16), (30, 16), (-7, -26), (6, -22),
             (7, 26), (-6, 22), (-28, -5), (28, 5), (-10.5, 3), (10.5, -3)]:
    layout['spawns'].append(dict(x=x, y=0, z=z))

# --- Bot patrol waypoints (ground routes).
for x, z in [(-28, -16), (-12, -16), (0, -16), (12, -16), (28, -16),
             (-28, 16), (-12, 16), (0, 16), (12, 16), (28, 16),
             (0, -22), (-3, -28), (0, 22), (3, 28),
             (-28, -6), (-29, 6), (28, -4), (28, 6),
             (-10, -11), (10, -11), (-11, 11), (10, 11), (-5, 0), (5, 3),
             (19, -8), (19, 8), (-19, -8), (-19, 8)]:
    layout['waypoints'].append(dict(x=x, y=0, z=z))

for name, x, y, z in [('WATER TOWER', -24, 10.5, -27), ('CARGO LIFT', 10.5, 7, -29.5),
                      ('NOODLE STAND', 0, 4, 0), ('NEON ARCH', 0, 6, 16),
                      ('LANTERN LANE', -2, 3.5, -16), ('THE HALL', 19, 5, 0)]:
    layout['landmarks'].append(dict(name=name, x=x, y=y, z=z))


# --- Layout validation (fails the build before anything is written).
def overlaps(p, b, radius=BODY_RADIUS):
    dx = max(abs(p['x'] - b['x']) - b['w'] / 2, 0)
    dz = max(abs(p['z'] - b['z']) - b['d'] / 2, 0)
    return dx * dx + dz * dz < radius * radius


def clear(p, height=BODY_HEIGHT):
    return not any(p['y'] < b['y'] + b['h'] - .001 and p['y'] + height > b['y'] + .001
                   and overlaps(p, b) for b in layout['boxes'])


errors = []
ids = [b['id'] for b in layout['boxes']]
if len(set(ids)) != len(ids):
    errors.append('duplicate box ids')
for b in layout['boxes']:
    if abs(b['x']) + b['w'] / 2 > HALF + 1e-9 or abs(b['z']) + b['d'] / 2 > HALF + 1e-9:
        errors.append('out of bounds ' + b['id'])
    if min(b['w'], b['d'], b['h']) <= 0:
        errors.append('empty box ' + b['id'])
if len(layout['spawns']) != 12:
    errors.append('need 12 spawns')
for p in layout['spawns'] + [m['exit'] for m in layout['mirrors']]:
    if not clear(p) or abs(p['x']) + BODY_RADIUS >= HALF or abs(p['z']) + BODY_RADIUS >= HALF:
        errors.append('blocked point ' + json.dumps(p))
for p in layout['waypoints']:
    if not clear(p):
        errors.append('blocked waypoint ' + json.dumps(p))
if errors:
    raise SystemExit('Layout invalid:\n  ' + '\n  '.join(errors))

# --- Scene.
OUT.mkdir(parents=True, exist_ok=True)
RUNTIME.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.preferences.filepaths.save_version = 0


def xyz(p):
    return (p[0], -p[2], p[1])


def material(name, color, glow=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = 0.8
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m


# Graybox tones: neutral structure, distinct hues only to read roles in playtests.
TONES = {
    'building': material('gb building', (.20, .23, .29)),
    'catwalk': material('gb catwalk', (.33, .38, .46)),
    'rail': material('gb rail', (.46, .52, .60)),
    'post': material('gb post', (.28, .32, .38)),
    'step': material('gb step', (.52, .57, .63)),
    'stall': material('gb stall', (.36, .18, .34)),
    'counter': material('gb counter', (.55, .40, .26)),
    'crate': material('gb crate', (.30, .27, .22)),
    'roofcover': material('gb roof cover', (.30, .34, .38)),
    'sign': material('gb sign', (.05, .55, .70), 1.5),
    'arch': material('gb arch', (.80, .05, .55), 1.5),
    'noodle': material('gb noodle stand', (.85, .42, .10)),
    'lift': material('gb cargo lift', (.85, .66, .08)),
    'tower': material('gb water tower', (.10, .52, .62)),
    'cover': material('gb cover', (.40, .40, .40)),
}
FLOOR = material('gb floor', (.11, .13, .17))
LANE = material('gb lane strip', (.16, .19, .25))


def cube(name, x0, y0, z0, x1, y1, z1, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    data = bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    ob.scale = (x1 - x0, z1 - z0, y1 - y0)
    data.materials.append(mat)
    return ob


for b in layout['boxes']:
    ob = cube(b['id'], b['x'] - b['w'] / 2, b['y'], b['z'] - b['d'] / 2,
              b['x'] + b['w'] / 2, b['y'] + b['h'], b['z'] + b['d'] / 2, TONES[b['tone']])
    ob['collisionId'] = b['id']
# Ground slab below y = 0 and flush lane strips (decals 1 cm deep, inside the slab).
cube('floor', -HALF, -0.3, -HALF, HALF, 0, HALF, FLOOR)
cube('lane-a-strip', -HALF, -0.01, -17, HALF, 0.004, -15, LANE)
cube('lane-b-strip', -HALF, -0.01, 15, HALF, 0.004, 17, LANE)

# Apply scale so exported vertex bounds equal the collider boxes.
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Export runtime meshes only; the map.json `tone` field is authoring data.
bpy.ops.object.select_all(action='DESELECT')
for ob in bpy.context.scene.objects:
    ob.select_set(ob.type == 'MESH')
bpy.ops.export_scene.gltf(filepath=str(RUNTIME), export_format='GLB', use_selection=True,
                          export_yup=True, export_extras=True, export_animations=False,
                          export_cameras=False, export_lights=False, export_apply=True)

for b in layout['boxes']:
    del b['tone']
(OUT / 'map.json').write_text(json.dumps(layout, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
meshes = [ob for ob in bpy.context.scene.objects if ob.type == 'MESH']
meta = dict(id=layout['id'], name=layout['name'], pass_='1-graybox',
            generator='scripts/worlds/rooftop_market.py', blender=bpy.app.version_string,
            units='metres', runtimeUp='+Y', collisionCount=len(layout['boxes']), meshes=len(meshes),
            triangles=sum(len(p.vertices) - 2 for ob in meshes for p in ob.data.polygons),
            glbBytes=RUNTIME.stat().st_size)
meta['pass'] = meta.pop('pass_')
(OUT / 'manifest.json').write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'rooftop-market.blend'), compress=True)
print('WORLD_BUILD_COMPLETE ' + json.dumps(meta))
