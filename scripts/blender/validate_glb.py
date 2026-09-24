"""Reimport a runtime GLB into a clean scene and gate it against Echo's asset budgets.

  blender --background --factory-startup --python-exit-code 1 \
    --python scripts/blender/validate_glb.py -- --glb <file.glb> --kind character|prop|world \
    [--clips idle,run,...] [--map <map.json>] [--out <report.json>]

Exits 1 with every failed check listed. Warnings do not fail. It never modifies the GLB.
Budgets are project policy (docs/3D_ASSET_PIPELINE.md); world limits mirror
tests/world-exports.test.ts, which remains the gate for registered maps.
"""
import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import echo_blender as eb  # noqa: E402

BUDGETS = {
    # hard: fail above; soft: warn above.
    'character': {'triangles': (15000, 10000), 'materials': (8, 5), 'bones': (64, 48),
                  'texture_px': (2048, 1024), 'textures': (6, 4), 'bytes': (6 << 20, 3 << 20)},
    'prop': {'triangles': (6000, 3000), 'materials': (4, 3), 'bones': (0, 0),
             'texture_px': (1024, 1024), 'textures': (3, 2), 'bytes': (2 << 20, 1 << 20)},
    'world': {'triangles': (180000, 150000), 'meshes': (350, 300), 'materials': (64, 48),
              'texture_px': (2048, 2048), 'textures': (24, 16), 'bytes': (12 << 20, 8 << 20)},
}
MAX_INFLUENCES = 4  # Three.js skinning uses four joints per vertex.


def parse():
    parser = argparse.ArgumentParser(prog='validate_glb.py')
    parser.add_argument('--glb', required=True)
    parser.add_argument('--kind', required=True, choices=sorted(BUDGETS))
    parser.add_argument('--clips', default='', help='Comma-separated animation names that must exist')
    parser.add_argument('--map', help='Authored map.json whose boxes must match collisionId visuals')
    parser.add_argument('--out', help='Optional JSON report path (keep reports in assets-src, not public/)')
    return parser.parse_args(eb.script_args())


class Gate:
    def __init__(self):
        self.failures, self.warnings = [], []

    def limit(self, name, value, budget):
        hard, soft = budget
        if value > hard:
            self.failures.append(f'{name} {value} exceeds hard budget {hard}')
        elif value > soft:
            self.warnings.append(f'{name} {value} exceeds target {soft}')

    def require(self, ok, message):
        if not ok:
            self.failures.append(message)


def skin_report(meshes, gate):
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
    skinned = [o for o in meshes if any(m.type == 'ARMATURE' for m in o.modifiers)]
    worst = 0
    for obj in skinned:
        bones = {b.name for a in armatures for b in a.data.bones}
        index_is_bone = {g.index for g in obj.vertex_groups if g.name in bones}
        for vertex in obj.data.vertices:
            count = sum(1 for g in vertex.groups if g.group in index_is_bone and g.weight > 1e-4)
            worst = max(worst, count)
            if count == 0:
                gate.failures.append(f'{obj.name} has unweighted vertices')
                break
    gate.require(worst <= MAX_INFLUENCES, f'max bone influences {worst} > {MAX_INFLUENCES}')
    return {'armatures': len(armatures), 'bones': sum(len(a.data.bones) for a in armatures),
            'skinnedMeshes': len(skinned), 'maxInfluences': worst}


def clip_report():
    fps = bpy.context.scene.render.fps / bpy.context.scene.render.fps_base
    clips = []
    for action in bpy.data.actions:
        start, end = action.frame_range
        clips.append({'name': action.name, 'frames': [round(start, 3), round(end, 3)],
                      'seconds': round((end - start) / fps, 4)})
    return clips


def crouch_report(meshes, clips, gate):
    """A crouch pose taller than the crouch collider would clip through low ceilings."""
    limit = eb.rules()['crouchHeight'] + 0.05
    armatures = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE' and o.animation_data]
    results = {}
    for clip in (c for c in clips if c['name'].startswith('crouch')):
        action = bpy.data.actions[clip['name']]
        for armature in armatures:
            data = armature.animation_data
            data.action = action
            if hasattr(data, 'action_suggested_slots') and data.action_slot is None:
                data.action_slot = data.action_suggested_slots[0]
        tallest = 0.0
        start, end = clip['frames']
        for frame in {int(start), int((start + end) / 2), int(end)}:
            bpy.context.scene.frame_set(frame)
            bounds = eb.game_bounds(meshes)
            tallest = max(tallest, bounds['max'][1] - bounds['min'][1])
        results[clip['name']] = round(tallest, 4)
        gate.require(tallest <= limit,
                     f'{clip["name"]} pose is {tallest:.3f} m tall; crouch clearance is {limit - 0.05} m')
    return results


def map_report(map_path, meshes, gate):
    layout = json.loads(Path(map_path).read_text(encoding='utf-8'))
    boxes = {box['id']: box for box in layout['boxes']}
    tagged = {}
    for obj in bpy.context.scene.objects:
        collision_id = obj.get('collisionId')
        if collision_id is None:
            continue
        gate.require(collision_id not in tagged, f'duplicate collider visual {collision_id}')
        tagged[collision_id] = obj
    gate.require(set(tagged) == set(boxes),
                 f'collider IDs differ: missing {sorted(set(boxes) - set(tagged))[:5]}, '
                 f'extra {sorted(set(tagged) - set(boxes))[:5]}')
    worst = 0.0
    for collision_id, box in boxes.items():
        obj = tagged.get(collision_id)
        parts = [o for o in [obj, *(obj.children_recursive if obj else [])] if o and o.type == 'MESH']
        bounds = eb.game_bounds(parts)
        if bounds is None:
            gate.failures.append(f'{collision_id} has no visible geometry')
            continue
        expected = [box['x'] - box['w'] / 2, box['y'], box['z'] - box['d'] / 2,
                    box['x'] + box['w'] / 2, box['y'] + box['h'], box['z'] + box['d'] / 2]
        error = max(abs(a - b) for a, b in zip(bounds['min'] + bounds['max'], expected))
        worst = max(worst, error)
        gate.require(error < 0.002, f'{collision_id} visual differs from collider by {error:.4f} m')
    return {'mapBoxes': len(boxes), 'taggedVisuals': len(tagged),
            'maxColliderErrorMetres': round(worst, 6)}


def main():
    args = parse()
    source = Path(args.glb).resolve()
    size = source.stat().st_size
    eb.import_glb_copy(source)
    scene = bpy.context.scene
    budget = BUDGETS[args.kind]
    gate = Gate()
    meshes = eb.mesh_objects(scene)
    gate.require(meshes, 'GLB contains no visible mesh')
    triangles = eb.evaluated_triangles(meshes)
    materials = {s.material.name for o in meshes for s in o.material_slots if s.material}
    images = [i for i in bpy.data.images if i.source == 'FILE' or i.packed_file]
    largest = max((max(i.size) for i in images), default=0)
    gate.limit('triangles', triangles, budget['triangles'])
    gate.limit('materials', len(materials), budget['materials'])
    gate.limit('textures', len(images), budget['textures'])
    gate.limit('largest texture px', largest, budget['texture_px'])
    gate.limit('GLB bytes', size, budget['bytes'])
    if 'meshes' in budget:
        gate.limit('mesh objects', len(meshes), budget['meshes'])
    presentation = [o.name for o in scene.objects if o.type in {'CAMERA', 'LIGHT'}]
    gate.require(not presentation, f'authoring cameras/lights exported: {presentation[:5]}')
    bounds = eb.game_bounds(meshes)
    report = {
        'glb': str(source), 'kind': args.kind, 'bytes': size,
        'checkedAtUtc': datetime.now(timezone.utc).isoformat(), 'blender': bpy.app.version_string,
        'importedFromCopiedDirectory': True, 'meshObjects': len(meshes), 'triangles': triangles,
        'materials': sorted(materials), 'textures': [{'name': i.name, 'size': list(i.size)} for i in images],
        'gameBounds': bounds,
    }
    if args.kind in {'character', 'prop'} and bounds:
        lo, hi = bounds['min'], bounds['max']
        gate.require(abs(lo[1]) <= 0.03, f'origin must be at the feet/base: lowest point y={lo[1]}')
        centre = ((lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2)
        gate.require(max(map(abs, centre)) <= 0.15, f'model is not centred on its origin: {centre}')
    if args.kind == 'character' and bounds:
        rules = eb.rules()
        height = bounds['max'][1] - bounds['min'][1]
        report['heightMetres'] = round(height, 4)
        report['collisionHeightMetres'] = rules['height']
        gate.require(0.85 * rules['height'] <= height <= 1.1 * rules['height'],
                     f'height {height:.3f} m outside 85-110% of collision height {rules["height"]} m')
    if args.kind == 'character':
        report['skin'] = skin_report(meshes, gate)
        gate.limit('bones', report['skin']['bones'], budget['bones'])
        gate.require(report['skin']['skinnedMeshes'] > 0, 'character has no skinned mesh')
    report['clips'] = clip_report()
    wanted = [c.strip() for c in args.clips.split(',') if c.strip()]
    names = {c['name'] for c in report['clips']}
    missing = [c for c in wanted if c not in names]
    gate.require(not missing, f'missing animation clips {missing}; found {sorted(names)}')
    if args.kind == 'character':
        report['crouchPoseHeights'] = crouch_report(meshes, report['clips'], gate)
    if args.map:
        report['map'] = map_report(args.map, meshes, gate)
    report['status'] = 'failed' if gate.failures else 'passed'
    report['failures'], report['warnings'] = gate.failures, gate.warnings
    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        print('Report: ' + str(out))
    print('GLB_VALIDATION ' + json.dumps({k: report[k] for k in ('status', 'triangles', 'failures', 'warnings')}))
    if gate.failures:
        sys.exit(1)


main()
