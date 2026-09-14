"""Reopen authored Blender sources and verify their saved geometry and runtime GLBs.

Run with Blender --background --python-exit-code 1 --python this_file.py.
This writes source-validation.json reports without modifying either model.
"""
import bpy
import json
import struct
from datetime import datetime, timezone
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_COLLIDERS = {'mirror-yard': 222, 'neon-carnival': 122}


def read_glb(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and total == len(data), 'Invalid GLB header'
    offset, document, binary_bytes = 12, None, 0
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        offset += 8
        chunk = data[offset:offset + size]
        assert len(chunk) == size, 'Truncated GLB chunk'
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary_bytes += size
        offset += size
    assert document is not None and binary_bytes > 0, 'GLB needs JSON and geometry buffer'
    return document, len(data), binary_bytes


def validate(world_id, expected_colliders):
    folder = ROOT / 'assets-src/worlds' / world_id
    source = folder / (world_id + '.blend')
    layout = json.loads((folder / 'map.json').read_text(encoding='utf-8'))
    boxes = {box['id']: box for box in layout['boxes']}
    assert len(boxes) == len(layout['boxes']) == expected_colliders, 'Unexpected or duplicate map colliders'
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False)
    scene = bpy.context.scene
    assert abs(scene.unit_settings.scale_length - 1) < 1e-9, 'Model scale must be one metre per unit'
    meshes = [obj for obj in scene.objects if obj.type == 'MESH']
    tagged = [obj for obj in meshes if obj.get('collisionId')]
    assert len(tagged) == expected_colliders, 'Wrong number of saved collider meshes'
    assert {obj['collisionId'] for obj in tagged} == set(boxes), 'Saved collider IDs differ from map'
    assert all(obj.data.vertices and obj.data.polygons for obj in meshes), 'Empty saved mesh'
    max_error = 0
    for obj in tagged:
        box = boxes[obj['collisionId']]
        corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
        # Blender (x,-z,y) back to the map's (x,y-up,z).
        points = [(v.x, v.z, -v.y) for v in corners]
        actual = [min(p[axis] for p in points) for axis in range(3)]
        actual += [max(p[axis] for p in points) for axis in range(3)]
        expected = [box['x']-box['w']/2, box['y'], box['z']-box['d']/2,
                    box['x']+box['w']/2, box['y']+box['h'], box['z']+box['d']/2]
        error = max(abs(a-b) for a, b in zip(actual, expected))
        max_error = max(max_error, error)
        assert error < .002, 'Collider geometry does not match map: ' + obj['collisionId']

    document, glb_bytes, binary_bytes = read_glb(ROOT / 'public/assets/worlds' / (world_id + '.glb'))
    runtime_tags = [node['extras']['collisionId'] for node in document.get('nodes', [])
                    if node.get('extras', {}).get('collisionId')]
    assert len(runtime_tags) == expected_colliders and set(runtime_tags) == set(boxes), 'Runtime collider tags differ'
    runtime_meshes = document.get('meshes', [])
    primitives = [primitive for mesh in runtime_meshes for primitive in mesh['primitives']]
    accessors = document['accessors']
    assert primitives and all('POSITION' in primitive['attributes'] and
                              accessors[primitive['attributes']['POSITION']]['count'] > 0
                              for primitive in primitives), 'Runtime contains empty or missing geometry'
    assert not document.get('cameras') and not document.get('extensions', {}).get('KHR_lights_punctual'), 'Presentation rig leaked into runtime'
    report = {
        'id': world_id,
        'status': 'passed',
        'checkedAtUtc': datetime.now(timezone.utc).isoformat(),
        'blender': bpy.app.version_string,
        'sourceReopened': True,
        'sourceBytes': source.stat().st_size,
        'sceneUnitSystem': scene.unit_settings.system,
        'metresPerBlenderUnit': scene.unit_settings.scale_length,
        'coordinateTransformVerified': 'Blender (x,-z,y) to game (x,y,z)',
        'sourceMeshCount': len(meshes),
        'sourceColliderTags': len(tagged),
        'runtimeColliderTags': len(runtime_tags),
        'mapColliderCount': len(boxes),
        'maximumColliderBoundsErrorMetres': round(max_error, 9),
        'runtimeMeshCount': len(runtime_meshes),
        'runtimePrimitiveCount': len(primitives),
        'runtimeGlbBytes': glb_bytes,
        'runtimeGeometryBufferBytes': binary_bytes,
        'runtimePresentationRigExcluded': True,
    }
    (folder / 'source-validation.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('SOURCE_VALIDATION ' + json.dumps(report))


for world_id, expected_colliders in EXPECTED_COLLIDERS.items():
    validate(world_id, expected_colliders)
