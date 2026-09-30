"""Render Echo's fixed review views and a reference-vs-render comparison sheet.

  blender --background --factory-startup --python-exit-code 1 \
    --python scripts/blender/review_renders.py -- \
    (--glb <runtime.glb> | --blend <source.blend>) --kind character|prop|world \
    --out <review-dir> [--reference <image>]... [--map <map.json>] [--no-guides]

Character/prop views: front, right, back, left (orthographic), three-quarter, and two
gameplay views (about 9 m and 3.5 m) from another player's eye height with the game's
72 degree vertical FOV. Guides: the movement cylinder (magenta wire) on both, plus the
server's shot hit box (yellow dashes) on character views.
World views: plan, four elevated corners and eye-level views from map spawns.
Writes <view>.png, sheet.png (references on the first row) and views.json.
Renders are review evidence only; in-game appearance still needs a browser check.
"""
import argparse
import itertools
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import echo_blender as eb  # noqa: E402

GAME_FOV_Y = math.radians(72)  # client/main.ts PerspectiveCamera
CELLS = {'world': (640, 360), 'character': (512, 512), 'prop': (512, 512)}
# Shots test this box, not the movement cylinder. The values are hard-coded in
# player_ray_crouched (crates/echo-core/src/physics.rs; room/combat.rs repeats 0.38 for
# web projectiles and the hook), not shared data: update the copies if the server
# changes. The top is the standing height from shared/rules.json.
HIT_BOX_HALF_WIDTH = 0.38  # Game x and z; the box does not turn with facing.
HIT_BOX_BOTTOM = 0.08  # Above the feet.


def parse():
    parser = argparse.ArgumentParser(prog='review_renders.py')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--glb')
    source.add_argument('--blend')
    parser.add_argument('--kind', required=True, choices=['character', 'prop', 'world'])
    parser.add_argument('--out', required=True)
    parser.add_argument('--reference', action='append', default=[])
    parser.add_argument('--map', help='map.json for eye-level views from its spawns')
    parser.add_argument('--no-guides', action='store_true',
                        help='Hide the movement cylinder and hit box guides')
    return parser.parse_args(eb.script_args())


def load(args):
    if args.glb:
        eb.import_glb_copy(args.glb)
        # glTF importers pose a model with its first animation (Blender's exporter sorts them
        # by name, so crouch_idle comes first); review views show the rest pose instead.
        for obj in bpy.context.scene.objects:
            if obj.type == 'ARMATURE':
                obj.data.pose_position = 'REST'
        return
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()), load_ui=False)
    for obj in bpy.context.scene.objects:  # Authoring rigs must not change review lighting.
        if obj.type in {'LIGHT', 'CAMERA'}:
            obj.hide_render = True


def emission_material(name, color, strength=2.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    shader = material.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Emission Color'].default_value = (*color, 1)
    shader.inputs['Emission Strength'].default_value = strength
    return material


def setup_render(scene, kind):
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 24
    scene.render.resolution_x, scene.render.resolution_y = (1280, 720) if kind == 'world' else (900, 900)
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'Standard'  # Show authored colours, not a grade.
    world = bpy.data.worlds.new('Review world')
    world.use_nodes = True
    background = world.node_tree.nodes['Background']
    background.inputs['Color'].default_value = (0.16, 0.17, 0.19, 1)
    background.inputs['Strength'].default_value = 0.9
    scene.world = world
    for name, energy, rotation in (('Key', 3.2, (50, 0, -35)), ('Fill', 1.2, (65, 0, 140)),
                                   ('Rim', 1.8, (35, 0, 180))):
        light = bpy.data.lights.new('Review ' + name, 'SUN')
        light.energy = energy if kind != 'world' else energy * 0.8
        obj = bpy.data.objects.new(light.name, light)
        obj.rotation_euler = [math.radians(a) for a in rotation]
        scene.collection.objects.link(obj)


def dashed_box(name, lo, hi, material, dash=0.06, gap=0.04):
    """Outline a Blender-space axis-aligned box in dashes that start and end at each corner."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.004  # 8 mm lines, as thick as the cylinder wire.
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    for a, b in itertools.combinations(corners, 2):
        if sum(p != q for p, q in zip(a, b)) != 1:
            continue  # A diagonal, not one of the 12 edges.
        length = (b - a).length
        count = max(1, round((length + gap) / (dash + gap)))
        step = (length + gap) / count
        for i in range(count):
            spline = curve.splines.new('POLY')
            spline.points.add(1)
            for point, t in zip(spline.points, (i * step, i * step + step - gap)):
                point.co = (*a.lerp(b, t / length), 1)
    curve.materials.append(material)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_guides(scene, lo, hi, kind):
    """Player volumes at the feet origin and a ground plane under the model.

    The movement cylinder (shared/rules.json radius/height) is the collider against map
    boxes; props show it for player scale. Characters also show the separate hit box that
    server shots test. Returns what was drawn, for views.json.
    """
    rules = eb.rules()
    bpy.ops.mesh.primitive_cylinder_add(radius=rules['radius'], depth=rules['height'], vertices=24,
                                        location=(0, 0, rules['height'] / 2))
    cylinder = bpy.context.object
    cylinder.name = 'Review movement cylinder'
    wire = cylinder.modifiers.new('wire', 'WIREFRAME')
    wire.thickness = 0.008
    cylinder.data.materials.append(emission_material('Review movement guide', (1, 0.1, 0.8)))
    guides = [{'name': 'movement cylinder', 'radius': rules['radius'], 'height': rules['height'],
               'source': 'shared/rules.json radius, height'}]
    if kind == 'character':
        half = HIT_BOX_HALF_WIDTH
        dashed_box('Review hit box', Vector((-half, -half, HIT_BOX_BOTTOM)),
                   Vector((half, half, rules['height'])),
                   emission_material('Review hit guide', (1, 0.85, 0.1)))
        guides.append({'name': 'hit box', 'halfWidth': half, 'bottom': HIT_BOX_BOTTOM,
                       'top': rules['height'],
                       'source': 'crates/echo-core/src/physics.rs player_ray_crouched'})
    size = max(hi.x - lo.x, hi.y - lo.y, 1) * 1.6
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, lo.z - 0.001))
    ground = bpy.context.object
    ground.name = 'Review ground'
    mat = bpy.data.materials.new('Review ground')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.3, 0.31, 0.33, 1)
    ground.data.materials.append(mat)
    return guides


def camera(scene, name, location, target, ortho_scale=None):
    data = bpy.data.cameras.new(name)
    if ortho_scale:
        data.type = 'ORTHO'
        data.ortho_scale = ortho_scale
    else:
        data.sensor_fit = 'VERTICAL'
        data.angle_y = GAME_FOV_Y if name.startswith(('gameplay', 'eye')) else math.radians(40)
    data.clip_end = 1000
    obj = bpy.data.objects.new('Review ' + name, data)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    return obj


def actor_views(scene, lo, hi):
    eye = eb.rules()['eye']
    centre = (lo + hi) / 2
    height = hi.z - lo.z
    extent = max(hi.x - lo.x, hi.y - lo.y, height) * 1.15
    far = extent * 4 + 5
    mid = Vector((centre.x, centre.y, lo.z + height / 2))
    # Game (x, y, z) -> Blender (x, -z, y); the actor faces game +Z, i.e. Blender -Y.
    views = [('front', (mid.x, mid.y - far, mid.z)), ('right', (mid.x - far, mid.y, mid.z)),
             ('back', (mid.x, mid.y + far, mid.z)), ('left', (mid.x + far, mid.y, mid.z))]
    cams = [(n, camera(scene, n, loc, mid, extent)) for n, loc in views]
    d = max(extent * 1.6, 3)
    cams.append(('three-quarter', camera(scene, 'three-quarter',
                                         (mid.x - d * 0.7, mid.y - d, mid.z + d * 0.45), mid)))
    # Another player's eye at a typical engagement range and at close range.
    for name, (x, z) in (('gameplay', (-4.5, 7.5)), ('gameplay-near', (-1.6, 3.2))):
        cams.append((name, camera(scene, name, eb.blender_point(x, eye, z),
                                  (centre.x, centre.y, lo.z + height * 0.55))))
    return cams


def world_views(scene, lo, hi, map_path):
    eye = eb.rules()['eye']
    centre = (lo + hi) / 2
    span = max(hi.x - lo.x, hi.y - lo.y)
    cams = [('plan', camera(scene, 'plan', (centre.x, centre.y, hi.z + 50), (centre.x, centre.y, 0),
                            span * 1.05))]
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        loc = (centre.x + sx * span * 0.62, centre.y + sy * span * 0.62, span * 0.55)
        cams.append((f'corner-{i + 1}', camera(scene, f'corner-{i + 1}', loc, (centre.x, centre.y, 0))))
    if map_path:
        spawns = json.loads(Path(map_path).read_text(encoding='utf-8'))['spawns']
        picks = [spawns[round(i * (len(spawns) - 1) / 3)] for i in range(4)] if spawns else []
    else:
        r = span * 0.35
        picks = [{'x': x, 'y': 0, 'z': z} for x, z in ((0, r), (r, 0), (0, -r), (-r, 0))]
    for i, spawn in enumerate(picks):
        loc = eb.blender_point(spawn['x'], spawn.get('y', 0) + eye, spawn['z'])
        cams.append((f'eye-{i + 1}', camera(scene, f'eye-{i + 1}', loc, (centre.x, centre.y, loc.z))))
    return cams


def image_pixels(path, cell):
    image = bpy.data.images.load(str(path), check_existing=False)
    w, h = image.size
    if w == 0 or h == 0:
        raise SystemExit('Unreadable image: ' + str(path))
    scale = min(cell[0] / w, cell[1] / h)
    image.scale(max(1, round(w * scale)), max(1, round(h * scale)))
    w, h = image.size
    pixels = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(pixels)
    bpy.data.images.remove(image)
    return pixels.reshape(h, w, 4)


def contact_sheet(references, renders, out, cell):
    rows = ([references] if references else []) + [renders[i:i + 4] for i in range(0, len(renders), 4)]
    columns = max(len(r) for r in rows)
    pad = 8
    width, height = columns * (cell[0] + pad) + pad, len(rows) * (cell[1] + pad) + pad
    canvas = np.zeros((height, width, 4), dtype=np.float32)
    canvas[..., :3], canvas[..., 3] = 0.06, 1
    for row, paths in enumerate(rows):
        for column, path in enumerate(paths):
            pixels = image_pixels(path, cell)
            h, w = pixels.shape[:2]
            top = height - pad - row * (cell[1] + pad) - (cell[1] - h) // 2  # Rows start at the bottom.
            left = pad + column * (cell[0] + pad) + (cell[0] - w) // 2
            canvas[top - h:top, left:left + w] = pixels
    sheet = bpy.data.images.new('Review sheet', width, height, alpha=True)
    sheet.pixels.foreach_set(canvas.ravel())
    sheet.filepath_raw = str(out)
    sheet.file_format = 'PNG'
    sheet.save()
    return [[Path(p).name for p in r] for r in rows]


def main():
    args = parse()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    references = [Path(r).resolve() for r in args.reference]
    for reference in references:
        if not reference.is_file():
            raise SystemExit('Reference image not found: ' + str(reference))
    load(args)
    scene = bpy.context.scene
    meshes = eb.mesh_objects(scene)
    if not meshes:
        raise SystemExit('Nothing to render: no visible meshes')
    lo, hi = eb.world_bounds(meshes)
    triangles = eb.evaluated_triangles(meshes)
    setup_render(scene, args.kind)
    guides = []
    if args.kind != 'world' and not args.no_guides:
        guides = add_guides(scene, lo, hi, args.kind)
    cams = world_views(scene, lo, hi, args.map) if args.kind == 'world' else actor_views(scene, lo, hi)
    renders = []
    default_size = scene.render.resolution_x, scene.render.resolution_y
    for name, cam in cams:
        scene.camera = cam
        # A square frame keeps the whole footprint in the orthographic plan.
        scene.render.resolution_x, scene.render.resolution_y = (1400, 1400) if name == 'plan' else default_size
        scene.render.filepath = str(out / (name + '.png'))
        bpy.ops.render.render(write_still=True)
        renders.append(out / (name + '.png'))
    layout = contact_sheet(references, renders, out / 'sheet.png', CELLS[args.kind])
    record = {
        'source': str(Path(args.glb or args.blend).resolve()), 'kind': args.kind,
        'renderedAtUtc': datetime.now(timezone.utc).isoformat(), 'blender': bpy.app.version_string,
        'triangles': triangles, 'gameBounds': eb.game_bounds(meshes),
        'references': [str(r) for r in references], 'views': [n for n, _ in cams],
        'sheetRows': layout, 'guides': bool(guides), 'guideVolumes': guides,
        'colourTransform': scene.view_settings.view_transform,
    }
    (out / 'views.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print('REVIEW_RENDERS ' + json.dumps({'out': str(out), 'views': record['views']}))


main()
