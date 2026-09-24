"""Shared helpers for Echo's Blender review and validation tools.

Import from scripts running inside Blender 5.2 (bpy available). Game/glTF space is
metres, +Y up, characters facing +Z; Blender space maps game (x, y, z) to (x, -z, y).
"""
import shutil
import sys
import tempfile
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]

# Gameplay dimensions, mirrored from shared/rules.json and shared/movement.json.
# Read the JSON rather than trusting these copies when a value matters for a gate.
def rules():
    import json
    data = json.loads((ROOT / 'shared/rules.json').read_text(encoding='utf-8'))
    data.update(json.loads((ROOT / 'shared/movement.json').read_text(encoding='utf-8')))
    return data


def script_args():
    """Arguments after Blender's `--` separator."""
    return sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def game_point(v):
    """Blender (x, y, z) to game (x, y-up, z)."""
    return (v.x, v.z, -v.y)


def blender_point(x, y, z):
    """Game (x, y-up, z) to Blender (x, -z, y)."""
    return Vector((x, -z, y))


def empty_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.unit_settings.scale_length = 1
    return scene


def import_glb_copy(glb):
    """Import from a copied directory so the check cannot depend on files beside the source."""
    glb = Path(glb).resolve()
    if not glb.is_file():
        raise SystemExit('GLB not found: ' + str(glb))
    temp = Path(tempfile.mkdtemp(prefix='echo-glb-'))
    copy = temp / glb.name
    shutil.copy2(glb, copy)
    empty_scene()
    bpy.ops.import_scene.gltf(filepath=str(copy))
    return copy


def mesh_objects(scene=None):
    scene = scene or bpy.context.scene
    return [o for o in scene.objects if o.type == 'MESH' and o.visible_get()]


def evaluated_triangles(objects):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    total = 0
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        total += len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    return total


def world_bounds(objects):
    """Blender-space (min, max) of the evaluated geometry, or None without geometry."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = Vector((float('inf'),) * 3)
    hi = Vector((float('-inf'),) * 3)
    found = False
    for obj in objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        for vertex in mesh.vertices:
            p = evaluated.matrix_world @ vertex.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
            found = True
        evaluated.to_mesh_clear()
    return (lo, hi) if found else None


def game_bounds(objects):
    bounds = world_bounds(objects)
    if bounds is None:
        return None
    lo, hi = bounds
    return {'min': [round(lo.x, 4), round(lo.z, 4), round(-hi.y, 4)],
            'max': [round(hi.x, 4), round(hi.z, 4), round(-lo.y, 4)]}
