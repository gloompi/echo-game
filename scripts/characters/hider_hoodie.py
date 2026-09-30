"""Reproducible Blender build of the hider-hoodie character.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
    --python-exit-code 1 --python scripts/characters/hider_hoodie.py -- \
    --stage blockout|structure|form|material [--out-dir DIR]

One stage per review pass (assets-src/characters/hider-hoodie/reviews):
  blockout   pass 1: masses and proportions only, every part at the world origin.
  structure  pass 2: the parts the rig will drive, each with its origin at its joint and
             parented in joint order; custom property `rigJoint` names the future bone.
  form       pass 3: the structure parts with the sheet's faceted low-poly form: jittered
             triangle facets on the cloth, the hood rim, mask planes, brim bevel, logos,
             bag bevels and zip, pocket flaps, jogger folds, split fingers, chunky sneakers.
  material   pass 4: the form geometry with the final palette, roughness and the slightly
             emissive cyan.
Each writes <out-dir>/hider-hoodie.blend, <out-dir>/hider-hoodie-preview.glb and
<out-dir>/manifest.json (default out-dir: the asset folder). The preview GLB has no rig or
clips; it is review evidence, not the runtime export, so it stays out of public/.
The build re-imports the GLB and exits 1 if height, ground contact, facing or symmetry are
wrong or, after the blockout, if any part's origin is more than 1 mm off its joint.

Game space: metres, +Y up, facing +Z, origin between the feet, character's right at -X.
Blender space is (x, -z, y). Dimensions are measured with the hood peak at the 2.16 m
collision height (brief.md): widths on refs/01-front.png; depths, the hood, cap, brim, bag,
trapezius and sneakers on the hood-up refs/02b-side-right.png and refs/03b-back.png.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/blender'))
sys.path.insert(0, str(Path(__file__).resolve().parent))  # hider_hoodie_rig
import echo_blender as eb  # noqa: E402

ASSET = ROOT / 'assets-src/characters/hider-hoodie'
NAME = 'hider-hoodie'
RUNTIME_GLB = ROOT / 'public/assets/characters' / (NAME + '.glb')
FORM_STAGES = ('form', 'material', 'rig', 'export')  # stages built on the pass-3 geometry
RIG_STAGES = ('rig', 'export')

# Colours are sRGB, sampled from the sheet (brief.md); the material pass tunes them.
MATERIALS = {  # name: (sRGB hex, roughness)
    'tint_light': ('EBE3D8', 0.85),  # hoodie, authored in the classic skin colour
    'black': ('2B2C31', 0.8),        # cap, mask, bag, harness, gloves, joggers, socks
    'cyan': ('3CB9C4', 0.55),        # trims, strap sections, sneaker panels
    'skin': ('D9A688', 0.7),         # forearms, fingertips, shins
    'white': ('E4DDD7', 0.6),        # soles
}
# Material pass (pass 4): the palette checked against the sheet's lit facets under the review
# lights (reviews/pass-4-material), roughness per material, and a slight emission on the cyan
# logos and trims (brief). tint_light stays the approved classic colour; the runtime recolours
# it per skin. (sRGB hex, roughness, emission strength)
MATERIALS_TUNED = {
    'tint_light': ('EBE3D8', 0.85, 0.0),
    'black': ('2E2F35', 0.72, 0.0),
    'cyan': ('3CB9C4', 0.45, 0.35),
    'skin': ('DDA98A', 0.65, 0.0),
    'white': ('E6DFD8', 0.55, 0.0),
}

# Joints on the character's right (game space); the left side mirrors x.
NECK = (0.0, 1.73, -0.01)
SPINE = (0.0, 1.10, 0.0)
CHEST = (0.0, 1.45, 0.0)
HIPS = (0.0, 0.97, 0.0)
SHOULDER = (-0.205, 1.645, -0.01)
ELBOW = (-0.285, 1.385, -0.02)
WRIST = (-0.345, 1.16, 0.0)
KNUCKLE = (-0.372, 0.985, 0.055)  # palm tilts out and forward; fingers curl back in
HAND_END = (-0.34, 0.875, 0.07)
HIP = (-0.115, 0.97, 0.0)
KNEE = (-0.192, 0.57, -0.03)
ANKLE = (-0.228, 0.12, -0.095)
TOE_OUT = math.radians(10)  # A-pose stance: feet slightly turned out (front and side soles agree)

# Horizontal sections: (y, half width, front reach, back reach); materials per band. The top
# rings are the trapezius the hood rests on: it rises to about 1.78 m beside the neck (02b).
TORSO = [(1.09, 0.205, 0.125, 0.140), (1.16, 0.205, 0.145, 0.150),
         (1.20, 0.228, 0.168, 0.168), (1.30, 0.218, 0.160, 0.155),
         (1.45, 0.215, 0.150, 0.158), (1.58, 0.222, 0.135, 0.170),
         (1.66, 0.215, 0.115, 0.182), (1.72, 0.215, 0.100, 0.180), (1.755, 0.198, 0.070, 0.155),
         (1.785, 0.145, 0.050, 0.120), (1.80, 0.090, 0.045, 0.090)]
TORSO_BANDS = ['cyan'] + ['tint_light'] * 9  # hem band, then hoodie
PELVIS = [(1.14, 0.195, 0.125, 0.135), (1.04, 0.222, 0.132, 0.140),
          (0.97, 0.248, 0.136, 0.135), (0.91, 0.240, 0.140, 0.118)]
# Hood (refs 02b side, 03b back, 01 front): (y, half width, front, back, face-opening half
# width, tilt, lift). A deep cowl leaning back: a crown lobe reaching 0.25 m behind the axis
# at 1.98 m and a lower lobe at 1.76 m, with a crease between them at 1.88 m. The lower
# edge is a saddle: 1.73 m under the chin, 1.80 m at the sides over the shoulders, 1.69 m
# down the back. The face rim sits 5-10 cm forward of the axis, behind the mask and cap.
HOOD = [(1.73, 0.190, 0.105, 0.212, 0.0, 0.02, 0.09), (1.765, 0.197, 0.098, 0.255, 0.025, 0.005, 0.045),
        (1.80, 0.200, 0.085, 0.242, 0.065, 0.0, 0.012), (1.835, 0.197, 0.075, 0.223, 0.115, 0.0, 0.0),
        (1.88, 0.180, 0.078, 0.204, 0.130, 0.0, 0.0), (1.93, 0.165, 0.100, 0.227, 0.127, 0.0, 0.0),
        (1.98, 0.155, 0.115, 0.253, 0.120, 0.0, 0.0), (2.03, 0.142, 0.128, 0.233, 0.108, 0.0, 0.0),
        (2.075, 0.126, 0.125, 0.205, 0.078, 0.0, 0.0), (2.11, 0.100, 0.112, 0.172, 0.035, 0.0, 0.0),
        (2.135, 0.068, 0.100, 0.130, 0.0, 0.0, 0.0), (2.152, 0.035, 0.055, 0.085, 0.0, 0.0, 0.0),
        (2.16, 0.012, 0.020, 0.045, 0.0, 0.0, 0.0)]
HOOD_THICKNESS = 0.02
MASK = [(1.70, 0.070, 0.060, 0.075), (1.76, 0.085, 0.080, 0.090), (1.80, 0.096, 0.085, 0.100),
        (1.86, 0.108, 0.138, 0.110), (1.92, 0.112, 0.152, 0.115), (1.98, 0.112, 0.135, 0.118),
        (2.03, 0.104, 0.105, 0.115)]
CAP = [(1.965, 0.118, 0.125, 0.128), (2.02, 0.121, 0.150, 0.130), (2.06, 0.110, 0.148, 0.120),
       (2.09, 0.090, 0.130, 0.100), (2.115, 0.060, 0.095, 0.068), (2.13, 0.025, 0.040, 0.030)]
# Limb sections along a joint axis: (t from 0 at the first joint to 1 at the next, radii).
SLEEVE = [(-0.22, 0.055), (-0.12, 0.070), (0.05, 0.083), (0.40, 0.088), (0.75, 0.087),
          (0.93, 0.076), (1.0, 0.056)]
FOREARM = [(-0.06, 0.060), (0.0, 0.062), (0.42, 0.062), (0.44, 0.046), (0.75, 0.043),
           (1.02, 0.040)]
FOREARM_BANDS = ['cyan', 'cyan', 'cyan', 'skin', 'skin']  # cuff, then bare forearm
# (t, half width, front, back) along hip->knee and knee->ankle.
THIGH = [(-0.12, 0.118, 0.130, 0.120), (0.05, 0.138, 0.140, 0.122), (0.35, 0.140, 0.140, 0.120),
         (0.70, 0.126, 0.126, 0.116), (1.0, 0.110, 0.108, 0.114)]
SHIN = [(-0.10, 0.108, 0.105, 0.115), (0.0, 0.108, 0.100, 0.122), (0.18, 0.098, 0.090, 0.118),
        (0.29, 0.074, 0.070, 0.092), (0.30, 0.066, 0.062, 0.084), (0.46, 0.063, 0.058, 0.080),
        (0.475, 0.047, 0.045, 0.052), (0.72, 0.045, 0.043, 0.050), (0.95, 0.045, 0.045, 0.052)]
SHIN_BANDS = ['black'] * 6 + ['skin', 'black']  # jogger, cuff, bare shin, sock
# Sneaker along the foot axis u (m from the ankle), across v: sole outline, upper sections.
SOLE = [(-0.09, 0.0), (-0.082, 0.056), (-0.05, 0.074), (0.06, 0.095), (0.175, 0.105),
        (0.275, 0.090), (0.318, 0.058), (0.33, 0.0)]
SOLE_TOP = 0.085  # chunky white midsole, about 0.085 m thick at the heel in 02
UPPER = [(-0.045, 0.056, 0.215), (0.0, 0.062, 0.268), (0.07, 0.066, 0.255),
         (0.16, 0.066, 0.210), (0.245, 0.062, 0.165), (0.295, 0.050, 0.135), (0.318, 0.030, 0.105)]
# Back bag: centre, long axis in the back plane (down toward the character's right), size.
BAG_CENTRE = (-0.04, 1.45, -0.155)
BAG_TILT = math.radians(32)
BAG_OUTLINE = [(-0.184, 0.0), (-0.131, 0.082), (0.131, 0.082), (0.184, 0.0), (0.131, -0.082),
               (-0.131, -0.082)]
BAG_DEPTH = 0.11
STRAP_WIDTH, STRAP_THICK = 0.045, 0.012

# Form pass (pass 3). Cloth parts get triangle facets with a fixed pseudo-random offset per
# vertex: (normal, tangential) metres. Hard parts (cap, mask, bag, gloves, sneakers) keep
# clean planes.
FACET = {'hood': (0.006, 0.004), 'torso': (0.004, 0.003), 'sleeve': (0.004, 0.003),
         'joggers': (0.006, 0.004)}
TORSO_FORM_RINGS = (1.25, 1.38, 1.52)  # extra sections for facets; the outline is unchanged
# Jogger folds (01, 02b, 03b): a diagonal fold pinching the leg above the knee, a pinch at the
# knee, a diagonal fold below it and the leg bunching over the cuff. Folds cut in from the
# structure outline (01's legs are 1-4 cm narrower than the model at 0.45-0.75 m), not out of
# it. (t, half width, front, back, tilt m, phase degrees): a fold section is tilted so that it
# is highest at `phase` (0 front, 90 toward +X, the inner side of the right leg) and lowest
# opposite; the left leg mirrors the phase.
THIGH_FORM = [(-0.12, 0.118, 0.130, 0.120, 0.0, 0), (0.05, 0.138, 0.140, 0.122, 0.0, 0),
              (0.30, 0.140, 0.140, 0.120, 0.0, 0), (0.50, 0.132, 0.134, 0.114, 0.0, 0),
              (0.63, 0.116, 0.122, 0.100, 0.025, -60), (0.78, 0.123, 0.128, 0.106, 0.03, -60),
              (0.90, 0.112, 0.118, 0.118, 0.0, 0), (1.0, 0.110, 0.108, 0.114, 0.0, 0)]
SHIN_FORM = [(-0.10, 0.108, 0.105, 0.115, 0.0, 0), (0.0, 0.108, 0.100, 0.122, 0.0, 0),
             (0.06, 0.095, 0.090, 0.112, 0.02, 150), (0.17, 0.099, 0.097, 0.124, 0.028, 150),
             (0.245, 0.088, 0.082, 0.106, 0.0, 0), (0.275, 0.084, 0.079, 0.100, 0.0, 0),
             (0.29, 0.074, 0.070, 0.092, 0.0, 0), (0.30, 0.066, 0.062, 0.084, 0.0, 0),
             (0.46, 0.063, 0.058, 0.080, 0.0, 0), (0.475, 0.047, 0.045, 0.052, 0.0, 0),
             (0.72, 0.045, 0.043, 0.050, 0.0, 0), (0.95, 0.045, 0.045, 0.052, 0.0, 0)]
SHIN_FORM_BANDS = ['black'] * 9 + ['skin', 'black']  # jogger and cuff, bare shin, sock
LEG_FORM_SIDES = 10  # sections round the jogger legs in the form pass, for the diagonal folds
FOREARM_FORM = [(-0.06, 0.056), (-0.035, 0.062), (0.0, 0.063), (0.40, 0.062), (0.425, 0.057),
                (0.44, 0.046), (0.75, 0.043), (1.02, 0.040)]
FOREARM_FORM_BANDS = ['cyan'] * 5 + ['skin', 'skin']  # bevelled cuff, then bare forearm
MASK_RIDGE = [0.0, 0.0, 0.3, 1.0, 1.0, 0.8, 0.3]  # per MASK section: 1 = sharp nose ridge
HOOD_RIM = (0.05, 0.03, 0.012)  # rim band width, depth, offset out from the opening edge
# Logo strokes: the sheet's triangles are open outlines, so the strokes stay at 1.7-2 cm with
# the hole showing; at 3 cm (the brief's first default) the cap and bag triangles would close.
LOGO_STROKE = 0.017
# Back bag, form pass: a pouch that thins toward both ends of its long axis, as 02b's rounded
# side profile shows: (distance along the long axis, outer face depth). Its outline is the
# chamfered BAG_OUTLINE, so the back view (03b) keeps the same shape.
BAG_LENS = [(0.0, 0.11), (0.045, 0.107), (0.089, 0.094), (0.1395, 0.07), (0.1755, 0.04)]
BAG_FACE = 0.6  # the flat outer face spans this share of the bag's half height (the logo fits on it)
# Sneaker, form pass (sheet B's four sneaker panels; the top line is measured on 02b): the heel
# counter reaching back over a longer heel, a high tongue, a steep instep and a low toe box.
# (u, half width of the sole) and (u, half width, top) as SOLE and UPPER; the midsole top and
# the toe spring (how far the sole's underside lifts) vary along u.
SOLE_FORM = [(-0.10, 0.0), (-0.094, 0.05), (-0.07, 0.07), (0.06, 0.095), (0.175, 0.105),
             (0.28, 0.092), (0.326, 0.062), (0.342, 0.0)]
UPPER_FORM = [(-0.068, 0.044, 0.13), (-0.045, 0.056, 0.232), (0.0, 0.062, 0.268), (0.07, 0.068, 0.262),
              (0.12, 0.072, 0.232), (0.165, 0.076, 0.19), (0.21, 0.078, 0.16), (0.255, 0.074, 0.14),
              (0.285, 0.064, 0.122), (0.31, 0.05, 0.1), (0.33, 0.028, 0.084)]
# heel counter, collar, quarter (cyan), vamp band, toe box (cyan), toe bumper
UPPER_FORM_BANDS = ['black', 'black', 'black', 'cyan', 'cyan', 'black', 'cyan', 'cyan', 'black', 'black']
MIDSOLE_TOP = [(-0.10, 0.05), (-0.088, 0.075), (-0.07, 0.088), (0.10, 0.088), (0.15, 0.086), (0.27, 0.082),
               (0.318, 0.074), (0.342, 0.058)]  # rounded heel, lower toe tip
TOE_SPRING = [(0.25, 0.0), (0.295, 0.006), (0.323, 0.017), (0.342, 0.034)]
# Cyan straps hanging from the waist on the character's left hip (01 front, 03 and 03b back),
# about 1.4 cm off the joggers.
HIP_STRAP_FRONT = [(0.098, 1.085, 0.127), (0.104, 1.00, 0.134), (0.112, 0.90, 0.144), (0.122, 0.80, 0.133),
                   (0.128, 0.745, 0.120)]
HIP_STRAP_BACK = [(0.098, 1.085, -0.136), (0.104, 1.00, -0.137), (0.112, 0.90, -0.134), (0.122, 0.80, -0.139),
                  (0.128, 0.745, -0.140)]


def args():
    parser = argparse.ArgumentParser(prog='hider_hoodie.py')
    parser.add_argument('--stage', required=True,
                        choices=['blockout', 'structure', 'form', 'material', 'rig', 'export'])
    parser.add_argument('--out-dir', default=str(ASSET))
    parser.add_argument('--runtime-glb', default=str(RUNTIME_GLB),
                        help='where the export stage writes the runtime GLB')
    return parser.parse_args(eb.script_args())


# ---------------------------------------------------------------- geometry helpers

def B(p):
    """Game (x, y-up, z) to Blender (x, -z, y)."""
    return Vector((p[0], -p[2], p[1]))


def V(p):
    return Vector(p)


def spow(t, e):
    return math.copysign(abs(t) ** e, t)


def mirror(p, side):
    """side -1 is the character's right (authored), +1 the left."""
    return (-p[0] if side > 0 else p[0], p[1], p[2])


def ring(y, hw, front, back, n=None, angles=None, cx=0.0, cz=0.0, square=2.0, tilt=0.0, lift=0.0):
    """Horizontal section; angle 0 faces +Z, 90 degrees is +X. `tilt` lowers the back,
    `lift` raises the sides (a saddle: front and back stay at y)."""
    e = 2.0 / square
    angles = angles if angles is not None else [2 * math.pi * i / n for i in range(n)]
    out = []
    for a in angles:
        s, c = math.sin(a), math.cos(a)
        out.append((cx + hw * spow(s, e), y - tilt * (1 - c) + lift * s * s,
                    cz + (front if c >= 0 else back) * spow(c, e)))
    return out


def limb_ring(centre, axis, hw, front, back, n, square=2.0):
    """Section perpendicular to `axis`, front reach toward +Z."""
    a = V(axis).normalized()
    f = V((0.0, 0.0, 1.0))
    f = (f - a * f.dot(a)).normalized()
    side = f.cross(a).normalized()
    e = 2.0 / square
    out = []
    for i in range(n):
        ang = 2 * math.pi * i / n
        s, c = math.sin(ang), math.cos(ang)
        p = V(centre) + side * (hw * spow(s, e)) + f * ((front if c >= 0 else back) * spow(c, e))
        out.append(tuple(p))
    return out


def along(a, b, t):
    return tuple(V(a).lerp(V(b), t))


class Part:
    """One output object: a bmesh in game space plus its joint pivot and parent."""

    def __init__(self, name, joint=None, pivot=(0.0, 0.0, 0.0), parent=None):
        self.name, self.joint, self.pivot, self.parent = name, joint, pivot, parent
        self.bm = bmesh.new()
        self.materials = []
        self.solidify = 0.0

    def mat(self, name):
        if name not in self.materials:
            self.materials.append(name)
        return self.materials.index(name)

    def loft(self, rings, bands, close=True, caps=(True, True), wrap=False):
        """Quads between equal-length sections; one material per band (or one name)."""
        count = len(rings) - (0 if wrap else 1)
        bands = [bands] * count if isinstance(bands, str) else bands
        verts = [[self.bm.verts.new(B(p)) for p in r] for r in rings]
        n = len(rings[0])
        faces = []
        for i in range(count):
            nxt = (i + 1) % len(rings)
            m = self.mat(bands[i])
            row = []
            for j in range(n if close else n - 1):
                k = (j + 1) % n
                face = self.bm.faces.new((verts[i][j], verts[i][k], verts[nxt][k], verts[nxt][j]))
                face.material_index = m
                row.append(face)
            faces.append(row)
        if caps[0] and not wrap:
            self.bm.faces.new(list(reversed(verts[0]))).material_index = self.mat(bands[0])
        if caps[1] and not wrap:
            self.bm.faces.new(verts[-1]).material_index = self.mat(bands[-1])
        return faces

    def box(self, centre, axes, half, material):
        c = V(centre)
        u, v, w = (V(a).normalized() for a in axes)
        quad = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        rings = [[tuple(c + u * (half[0] * a) + v * (half[1] * b) + w * (half[2] * s)) for a, b in quad]
                 for s in (-1, 1)]
        self.loft(rings, material)

    def strap(self, path, normals, bands, width=STRAP_WIDTH, thick=STRAP_THICK):
        """Flat strap following `path`, lying on the surface described by `normals`."""
        rings = []
        for i, p in enumerate(path):
            a = V(path[min(i + 1, len(path) - 1)]) - V(path[max(i - 1, 0)])
            n = V(normals[i]).normalized()
            side = a.cross(n).normalized()
            n = side.cross(a).normalized() if n.dot(side.cross(a)) > 0 else -side.cross(a).normalized()
            c = V(p)
            rings.append([tuple(c + side * (width / 2 * s) + n * (thick / 2 * t))
                          for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        self.loft(rings, bands)

    def slab(self, inner, outer, material):
        """Closed plate between two equal grids of points (rows of columns): an outer skin,
        an inner skin and the walls round the edge."""
        rows, cols = len(outer), len(outer[0])
        vi = [[self.bm.verts.new(B(p)) for p in row] for row in inner]
        vo = [[self.bm.verts.new(B(p)) for p in row] for row in outer]
        m = self.mat(material)
        for r in range(rows - 1):
            for c in range(cols - 1):
                self.bm.faces.new((vo[r][c], vo[r][c + 1], vo[r + 1][c + 1], vo[r + 1][c])).material_index = m
                self.bm.faces.new((vi[r][c], vi[r + 1][c], vi[r + 1][c + 1], vi[r][c + 1])).material_index = m
        edge = ([(0, c) for c in range(cols)] + [(r, cols - 1) for r in range(1, rows)] +
                [(rows - 1, c) for c in range(cols - 2, -1, -1)] + [(r, 0) for r in range(rows - 2, 0, -1)])
        for (r0, c0), (r1, c1) in zip(edge, edge[1:] + edge[:1]):
            self.bm.faces.new((vi[r0][c0], vi[r1][c1], vo[r1][c1], vo[r0][c0])).material_index = m


# ---------------------------------------------------------------- form helpers (pass 3)

def hash01(*ints):
    """Deterministic value in [0, 1) from integers (independent of Python's hash seed)."""
    h = 0x811C9DC5
    for value in ints:
        h = ((h ^ (value & 0xFFFFFFFF)) * 0x01000193) & 0xFFFFFFFF
        h ^= h >> 15
        h = (h * 0x2C1B3C6D) & 0xFFFFFFFF
        h ^= h >> 12
    return h / 2 ** 32


def facet(part, amounts, seed, pinned=None):
    """Low-poly cloth: triangulate, then move every vertex by a fixed pseudo-random offset
    along its normal and the surface. Offsets mirror in x, so the two sides match. Vertices for
    which pinned(co) is true stay where they are."""
    normal, tangent = amounts
    bm = part.bm
    bmesh.ops.triangulate(bm, faces=bm.faces[:], quad_method='BEAUTY', ngon_method='BEAUTY')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    moves = []
    for vert in bm.verts:
        if pinned and pinned(vert.co):
            continue
        sx = -1.0 if vert.co.x < 0 else 1.0
        key = (round(abs(vert.co.x) * 2000), round(vert.co.y * 2000), round(vert.co.z * 2000), seed)
        a, b, c = (hash01(*key, k) * 2 - 1 for k in range(3))
        n = vert.normal.copy()
        n.x *= sx
        t = n.cross(Vector((0.0, 0.0, 1.0)))
        t = t.normalized() if t.length > 1e-6 else Vector((1.0, 0.0, 0.0))
        d = n * (a * normal) + t * (b * tangent) + n.cross(t) * (c * tangent)
        d.x = 0.0 if abs(vert.co.x) < 1e-5 else d.x * sx
        moves.append((vert, d))
    for vert, d in moves:
        vert.co += d


def shell(part, thickness):
    """Thicken an open surface inward: an inner copy offset along the vertex normals, reversed,
    joined to the outer surface along its open edges. Every face is created in a fixed order,
    so the export is reproducible (bmesh.ops.solidify orders its new faces differently from
    run to run, which changed the GLB's index buffer on every build)."""
    bm = part.bm
    bm.normal_update()
    outer_faces = list(bm.faces)
    open_edges = [e for e in bm.edges if e.is_boundary]
    inner = {v: bm.verts.new(v.co - v.normal * thickness) for v in list(bm.verts)}
    for f in outer_faces:
        bm.faces.new([inner[v] for v in reversed(f.verts)]).material_index = f.material_index
    for e in open_edges:
        face = e.link_faces[0]
        loop = next(l for l in face.loops if l.edge == e)
        a, b = loop.vert, loop.link_loop_next.vert  # the face runs a -> b along this edge
        bm.faces.new((b, a, inner[a], inner[b])).material_index = face.material_index


def triangle_outline(half_width, height, stroke, down=False):
    """Outer and inner corners (2D) of a triangle outline whose strokes are `stroke` wide:
    the inner triangle is the outer one scaled about its incentre by (r - stroke) / r."""
    sign = -1.0 if down else 1.0
    outer = [(-half_width, -sign * height / 3), (half_width, -sign * height / 3), (0.0, sign * 2 * height / 3)]
    (ax, ay), (bx, by), (cx, cy) = outer
    a, b, c = math.dist(outer[1], outer[2]), math.dist(outer[0], outer[2]), math.dist(outer[0], outer[1])
    ix, iy = (a * ax + b * bx + c * cx) / (a + b + c), (a * ay + b * by + c * cy) / (a + b + c)
    area = abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2
    r = area / ((a + b + c) / 2)
    k = max(0.12, (r - stroke) / r)
    inner = [(ix + (x - ix) * k, iy + (y - iy) * k) for x, y in outer]
    return outer, inner


def logo(part, frame, shape, material='cyan', proud=0.004, sunk=0.004, steps=4):
    """Outlined triangle wrapped onto a surface: frame(x2, y2) returns a surface point and its
    outward normal; `shape` is triangle_outline()'s pair of corner lists. Each stroke is sampled
    along its length so that it follows a curved surface instead of cutting through it."""
    outer, inner = shape
    rings = []
    for k in range(3):
        j = (k + 1) % 3
        for i in range(steps):
            t = i / steps
            o = (outer[k][0] + (outer[j][0] - outer[k][0]) * t, outer[k][1] + (outer[j][1] - outer[k][1]) * t)
            q = (inner[k][0] + (inner[j][0] - inner[k][0]) * t, inner[k][1] + (inner[j][1] - inner[k][1]) * t)
            (po, no), (pq, nq) = frame(*o), frame(*q)
            rings.append([tuple(V(po) - V(no) * sunk), tuple(V(po) + V(no) * proud),
                          tuple(V(pq) + V(nq) * proud), tuple(V(pq) - V(nq) * sunk)])
    part.loft(rings, material, wrap=True)


def surface_frame(fz, x0, y0):
    """frame(x2, y2) for logo() on a surface z = fz(x, y) facing +Z, centred at (x0, y0)."""
    def frame(x2, y2):
        x, y, h = x0 + x2, y0 + y2, 0.002
        tx = V((2 * h, 0.0, fz(x + h, y) - fz(x - h, y)))
        ty = V((0.0, 2 * h, fz(x, y + h) - fz(x, y - h)))
        n = tx.cross(ty).normalized()
        return (x, y, fz(x, y)), tuple(n if n.z > 0 else -n)
    return frame


def plane_frame(centre, u, v, normal):
    """frame(x2, y2) for logo() on a flat face: centre + u * x2 + v * y2."""
    def frame(x2, y2):
        return tuple(V(centre) + V(u) * x2 + V(v) * y2), tuple(V(normal).normalized())
    return frame


def chamfer(outline, k):
    """Cut every corner of a closed 2D outline, turning each corner into two points."""
    out = []
    for i, p in enumerate(outline):
        p, a, b = V(p), V(outline[i - 1]), V(outline[(i + 1) % len(outline)])
        out += [tuple(p + (a - p) * k), tuple(p + (b - p) * k)]
    return out


def interp(table, x):
    """Piecewise-linear value of (x, value) pairs at x, held flat beyond both ends."""
    if x <= table[0][0]:
        return table[0][1]
    for (x0, a), (x1, b) in zip(table, table[1:]):
        if x <= x1:
            return a + (b - a) * (x - x0) / (x1 - x0)
    return table[-1][1]


def fold_ring(centre, axis, hw, front, back, n, tilt, phase):
    """limb_ring() tilted into a diagonal fold: each point moves along the limb axis by
    tilt * cos(angle - phase), so the section is highest at `phase` (radians; 0 front, pi/2
    toward +X) and lowest opposite it."""
    a = V(axis).normalized()
    return [tuple(V(p) - a * (tilt * math.cos(2 * math.pi * i / n - phase)))
            for i, p in enumerate(limb_ring(centre, axis, hw, front, back, n, square=2.3))]


def limb_surface(start, end, table, t, angle, lift):
    """Point on an untilted limb loft (sections of `table` along start->end, square 2.3) at t
    and section angle `angle`, pushed `lift` metres out from the section's centre."""
    hw, front, back = (interp([(row[0], row[k]) for row in table], t) for k in (1, 2, 3))
    centre = V(along(start, end, t))
    a = (V(end) - V(start)).normalized()
    f = V((0.0, 0.0, 1.0))
    f = (f - a * f.dot(a)).normalized()
    side = f.cross(a).normalized()
    e = 2.0 / 2.3
    s, c = math.sin(angle), math.cos(angle)
    p = centre + side * (hw * spow(s, e)) + f * ((front if c >= 0 else back) * spow(c, e))
    return tuple(p + (p - centre).normalized() * lift)


# ---------------------------------------------------------------- parts

def hood_rings(n):
    """Closed sections whose column between the last and first point spans the face opening."""
    rings, gaps = [], []
    for y, hw, front, back, gap, tilt, lift in HOOD:
        g = max(gap, 0.012)
        a0 = math.asin(min(0.999, g / hw))
        angles = [a0 + (2 * math.pi - 2 * a0) * i / (n - 1) for i in range(n)]
        rings.append(ring(y, hw, front, back, angles=angles, tilt=tilt, lift=lift))
        gaps.append(gap)
    return rings, gaps


def cap_z(x, y):
    """Front surface of the cap crown (CAP sections are ellipses) at (x, y)."""
    for (y0, hw0, f0, _), (y1, hw1, f1, _) in zip(CAP, CAP[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            hw, f = hw0 + (hw1 - hw0) * t, f0 + (f1 - f0) * t
            return f * math.sqrt(max(0.0, 1 - (x / hw) ** 2))
    raise ValueError(y)


def mask_ring(y, hw, front, back, ridge):
    """Faceted mask section (10-part crops): a nose ridge at the front (ridge 1) easing to a
    rounder front (0), flat cheek planes, and a back hidden in the hood."""
    k = 0.2 * ridge
    half = [(0.0, front), (0.45 * hw, front * (0.92 - k)), (0.82 * hw, front * (0.62 - 0.6 * k)),
            (hw, 0.12 * front), (0.8 * hw, -0.55 * back), (0.0, -back)]
    pts = half + [(-x, z) for x, z in reversed(half[1:-1])]
    return [(x, y, z) for x, z in pts]


def hood_rim(hood, rings, gaps):
    """Thick flat rim round the face opening (10-part crops): a band swept along the opening's
    edge, set a little outward so that it frames the opening rather than narrowing it."""
    width, depth, offset = HOOD_RIM
    rows = [i for i in range(len(rings) - 1) if max(gaps[i], gaps[i + 1]) > 0.02]
    lo, hi = rows[0], rows[-1] + 1
    path, normals = [], []
    for i, end in [(i, 0) for i in range(lo, hi + 1)] + [(i, -1) for i in range(hi, lo - 1, -1)]:
        _, hw, front, _, gap, _, _ = HOOD[i]
        a0 = math.asin(min(0.999, max(gap, 0.012) / hw))
        a = a0 if end == 0 else 2 * math.pi - a0
        away = V((hw * math.cos(a), 0.0, -front * math.sin(a))) * (1 if end == 0 else -1)
        normal = V((front * math.sin(a), 0.0, hw * math.cos(a))).normalized()
        path.append(tuple(V(rings[i][end]) + away.normalized() * offset - normal * 0.016))  # flush with the hood
        normals.append(tuple(normal))
    hood.strap(path, normals, 'tint_light', width=width, thick=depth)


def build_head(parts, stage, parent):
    detail = stage != 'blockout'
    form = stage in FORM_STAGES
    pivot = NECK if detail else (0.0, 0.0, 0.0)
    hood = Part('hood', 'head', pivot, parent)
    rings, gaps = hood_rings(16 if detail else 12)
    faces = hood.loft(rings, 'tint_light', caps=(False, True))
    opening = [row[-1] for i, row in enumerate(faces) if max(gaps[i], gaps[i + 1]) > 0.02]
    bmesh.ops.delete(hood.bm, geom=opening, context='FACES')  # also drops the spanning edges
    if form:  # faceted shell, thickened here so that the rim can be added after it
        # The two top rings keep their shape: jittered, they rose above the 2.16 m collision
        # height, and clamping them back folded the tip inside out.
        facet(hood, FACET['hood'], 1, pinned=lambda co: co.z > HOOD[-2][0] - 0.004)
        for vert in hood.bm.verts:  # facets must not lift the peak above the 2.16 m collision height
            vert.co.z = min(vert.co.z, HOOD[-1][0])
        bm = hood.bm
        inside = B((0.0, 1.95, -0.05))
        if sum(f.normal.dot(f.calc_center_median() - inside) for f in bm.faces) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        shell(hood, HOOD_THICKNESS)
        hood_rim(hood, rings, gaps)
    else:
        hood.solidify = HOOD_THICKNESS
    mask = Part('mask', 'head', pivot, parent)
    if form:
        mask.loft([mask_ring(y, hw, f, b, r) for (y, hw, f, b), r in zip(MASK, MASK_RIDGE)], 'black')
    else:
        mask.loft([ring(y, hw, f, b, 12 if detail else 8, square=2.4) for y, hw, f, b in MASK], 'black')
    cap = Part('cap', 'head', pivot, parent)
    cap.loft([ring(y, hw, f, b, 12 if detail else 8) for y, hw, f, b in CAP], 'black')
    # Brim: a plate from the crown front, pitched down to the tip (+0.246 m in 02b) and
    # drooping at the sides; the form pass rounds its lip.
    k = 10 if detail else 6
    sections = []
    for i in range(k + 1):
        phi = math.radians(-80 + 160 * i / k)
        s, c = math.sin(phi), max(math.cos(phi), 0.0)
        inner = (0.119 * s, 2.012, 0.126 * c)
        outer = (0.128 * s, 2.002 - 0.045 * s * s, 0.126 * c + 0.12 * c ** 0.6)
        low = V((0.0, 0.024, 0.0))
        if form:
            radial = V((outer[0] - inner[0], 0.0, outer[2] - inner[2])).normalized() * 0.012
            sections.append([inner, tuple(V(outer) - radial), tuple(V(outer) - low * 0.5),
                             tuple(V(outer) - radial - low), tuple(V(inner) - low)])
        else:  # plain floats, so the structure stage rebuilds its pass-2 GLB byte for byte
            sections.append([inner, outer, (outer[0], outer[1] - 0.024, outer[2]), (inner[0], inner[1] - 0.024, inner[2])])
    cap.loft(sections, 'black')
    if detail:
        cap.box((0.0, 2.132, 0.0), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (0.012, 0.008, 0.012), 'black')
    if form:  # cyan triangle outline on the front panel (sheets A and B)
        logo(cap, surface_frame(cap_z, 0.0, 2.06), triangle_outline(0.05, 0.085, 0.02))
    parts += [hood, mask, cap]


def build_torso(parts, stage, parent):
    detail = stage != 'blockout'
    torso = Part('torso', 'spine', SPINE if detail else (0.0, 0.0, 0.0), parent)
    if stage in FORM_STAGES:
        heights = sorted({y for y, *_ in TORSO} | set(TORSO_FORM_RINGS))
        sections = [(y, *torso_section(y)) for y in heights]
        torso.loft([ring(y, hw, f, b, 16, square=2.6) for y, hw, f, b in sections],
                   ['cyan'] + ['tint_light'] * (len(sections) - 2))
        facet(torso, FACET['torso'], 2)
        # Kangaroo pocket (01): a trapezoid from the hem band up to just under the harness strap,
        # nearly as wide as the belly at the bottom, with slanted openings at the sides. It
        # stands 1-1.5 cm proud, so its top edge and sides catch the light while the side
        # view stays close to 02b's belly: (y, half width, lift).
        rows = ((1.165, 0.19, 0.012), (1.225, 0.185, 0.015), (1.28, 0.155, 0.014), (1.325, 0.11, 0.01))
        cols = (-1.0, -0.72, -0.36, 0.0, 0.36, 0.72, 1.0)
        torso.slab([[on_torso(half * k, y, 1, -0.004) for k in cols] for y, half, _ in rows],
                   [[on_torso(half * k, y, 1, lift) for k in cols] for y, half, lift in rows], 'tint_light')
        # Drawstrings (01, 10b): cyan cords from the chin opening down the chest, with aglets.
        for x in (-0.034, 0.034):
            torso.strap([on_torso(x, y, 1, 0.005) for y in (1.745, 1.70, 1.655, 1.622)], [(0, 0.2, 1)] * 4,
                        'cyan', width=0.025, thick=0.008)
            torso.box(on_torso(x, 1.607, 1, 0.005), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (0.016, 0.02, 0.006),
                      'cyan')
    else:
        torso.loft([ring(y, hw, f, b, 12 if detail else 10, square=2.6) for y, hw, f, b in TORSO], TORSO_BANDS)
    parts.append(torso)
    return torso


def torso_section(y):
    for (y0, *a), (y1, *b) in zip(TORSO, TORSO[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            return [p + (q - p) * t for p, q in zip(a, b)]
    raise ValueError(y)


def on_torso(x, y, sign, lift=0.012):
    """Point on the hoodie surface at (x, y), front (+1) or back (-1), lifted off it."""
    hw, front, back = torso_section(y)
    e = 2.0 / 2.6
    s = min(abs(x) / hw, 0.999) ** (1 / e)
    z = (front if sign > 0 else back) * math.cos(math.asin(s)) ** e
    return (x, y, sign * (z + lift))


def bag_half(a):
    """Half height of the bag's chamfered outline at distance a along its long axis."""
    corners = sorted((x, y) for x, y in chamfer(BAG_OUTLINE, 0.16) if x >= 0 and y >= 0)
    return interp([(0.0, corners[0][1])] + corners, abs(a))


def bag_profile(k):
    """Share of the outer face depth at a share k of the half height: the flat face, a bevel,
    then the side wall."""
    return interp([(0.0, 1.0), (BAG_FACE, 1.0), (0.8, 0.8), (1.0, 0.5)], k)


def bag_sections(c, u, v, w):
    """Sections across the bag's long axis: a flat back inside the hoodie, side walls, bevels
    and an outer face whose depth follows BAG_LENS."""
    ends = [a for a, _ in BAG_LENS]
    out = []
    for a in [-x for x in reversed(ends[1:])] + ends:
        hv, d = bag_half(a), interp(BAG_LENS, abs(a))
        half = [(1.0, -0.03), (1.0, 0.5 * d), (0.8, bag_profile(0.8) * d), (BAG_FACE, d)]
        loop = [(-hv, -0.03)] + [(k * hv, z) for k, z in half] + [(-k * hv, z) for k, z in reversed(half[1:])]
        out.append([tuple(c + u * a + v * b + w * z) for b, z in loop])
    return out


def bag_outer(c, u, v, w, a, b):
    """Point on the bag's outer surface at (a along, b across) and its outward normal."""
    def point(a, b):
        depth = interp(BAG_LENS, abs(a)) * bag_profile(min(abs(b) / bag_half(a), 1.0))
        return c + u * a + v * b + w * depth
    h = 0.002
    n = (point(a + h, b) - point(a - h, b)).cross(point(a, b + h) - point(a, b - h)).normalized()
    return point(a, b), (n if n.dot(w) > 0 else -n)


def build_bag(parts, stage, parent):
    detail = stage != 'blockout'
    form = stage in FORM_STAGES
    bag = Part('bag', 'chest', CHEST if detail else (0.0, 0.0, 0.0), parent)
    u = V((math.cos(BAG_TILT), math.sin(BAG_TILT), 0.0))  # toward the upper end, character's left
    v = V((-math.sin(BAG_TILT), math.cos(BAG_TILT), 0.0))
    w = V((0.0, 0.0, -1.0))
    c = V(BAG_CENTRE)
    if not detail:
        bag.box(tuple(c + w * (BAG_DEPTH / 2)), (u, v, w), (0.17, 0.075, BAG_DEPTH / 2), 'black')
        parts.append(bag)
        return
    if form:  # a pouch thinning toward its ends (02b) with bevelled edges (10-part-sling-bag)
        bag.loft(bag_sections(c, u, v, w), 'black')
        # Zip along the top bevel with its pull at the lower end, and the cyan down-pointing
        # triangle on the outer face, 2 cm toward the upper end as in 03b.
        zip_path = [bag_outer(c, u, v, w, a, 0.7 * bag_half(a)) for a in (-0.11, -0.055, 0.0, 0.055, 0.11)]
        bag.strap([tuple(p + n * 0.002) for p, n in zip_path], [tuple(n) for _, n in zip_path], 'black',
                  width=0.012, thick=0.008)
        pull, normal = bag_outer(c, u, v, w, -0.12, 0.7 * bag_half(0.12))
        bag.box(tuple(pull + normal * 0.004), (u, v, w), (0.008, 0.018, 0.005), 'black')
        logo(bag, lambda x2, y2: tuple(map(tuple, bag_outer(c, u, v, w, 0.024 + x2, y2 - 0.004))),
             triangle_outline(0.045, 0.075, LOGO_STROKE, down=True))
    else:
        outline = BAG_OUTLINE
        steps = ((-0.03, 1.0), (0.07, 1.0), (BAG_DEPTH, 0.62))
        bag.loft([[tuple(c + u * (a * scale) + v * (b * scale) + w * depth) for a, b in outline]
                  for depth, scale in steps], 'black')
    # Harness: shoulder straps from the bag over both shoulders to a strap round the waist.
    for side in (-1, 1):
        x = 0.14 * side
        back_start = (-0.105, 1.50) if side < 0 else (0.11, 1.55)
        # Straight run from the top of the bag (standing off the back) up to the shoulder,
        # then over the trapezius under the hood's lower edge and down the chest. The form
        # pass's bag is thin at its upper end, so the left strap starts closer to the back.
        start_lift = 0.035 if form and side > 0 else 0.07
        back_pts = [on_torso(back_start[0], back_start[1], -1, start_lift),
                    on_torso(0.125 * side, 1.61, -1, 0.035), on_torso(0.138 * side, 1.655, -1, 0.015),
                    on_torso(x, 1.72, -1), on_torso(x, 1.765, -1)]
        top = [(x * 1.03, 1.798, -0.01)]
        front_pts = [on_torso(x, 1.765, 1), on_torso(x, 1.715, 1), on_torso(0.135 * side, 1.62, 1),
                     on_torso(0.128 * side, 1.49, 1), on_torso(0.122 * side, 1.365, 1)]
        path = back_pts + top + front_pts
        normals = [(0, 0.2, -1), (0, 0.3, -1), (0, 0.3, -1), (0, 0.5, -1), (0, 1, -0.8), (0, 1, 0),
                   (0, 1, 0.8), (0, 0.4, 1), (0, 0.2, 1), (0, 0, 1), (0, 0, 1)]
        if side < 0:  # right strap: cyan down the back and on the chest
            bands = ['cyan', 'cyan'] + ['black'] * 6 + ['cyan', 'black']
        else:
            bands = ['black'] * 8 + ['cyan', 'black']
        bag.strap(path, normals, bands)
        if form:  # buckle where the strap meets the bag
            bag.box(back_pts[0], (u, v, w), (0.024, 0.016, 0.01), 'black')
    hw, front, back = torso_section(1.355)
    outer = [ring(y, hw + 0.012, front + 0.012, back + 0.012, 12, square=2.6) for y in (1.335, 1.375)]
    inner = [ring(y, hw, front, back, 12, square=2.6) for y in (1.375, 1.335)]  # on the torso's vertices
    bag.loft([outer[0], outer[1], inner[0], inner[1]], 'black', wrap=True)
    parts.append(bag)


def hand_frame(direction, side):
    """Axes for a hand segment: along it, across the palm (front-back), and out from the body."""
    d = direction.normalized()
    a = V((0.0, 0.0, 1.0))
    a = (a - d * a.dot(d)).normalized()
    o = d.cross(a).normalized()
    return d, a, (o if o.x * side > 0 else -o)


def finger(glove, base, direction, across, out, length, half_w, half_t, curl, bands):
    """Box-section finger (or thumb) from `base`, bending toward -out (the palm) as it goes."""
    sections = []
    for t, k in ((0.0, 1.0), (0.5, 0.96), (0.62, 0.93), (1.0, 0.85)):
        centre = V(base) + direction * (t * length) - out * (curl * t * t)
        sections.append([tuple(centre + across * (half_w * k * a) + out * (half_t * k * b))
                         for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    glove.loft(sections, bands)


def build_arm(parts, stage, side, parent):
    detail = stage != 'blockout'
    form = stage in FORM_STAGES
    n = 8 if detail else 6
    sh, el, wr, end = (mirror(p, side) for p in (SHOULDER, ELBOW, WRIST, HAND_END))
    tag = '.L' if side > 0 else '.R'
    origin = (0.0, 0.0, 0.0)
    sleeve = Part('sleeve' + tag, 'upper_arm' + tag, sh if detail else origin, parent)
    axis = V(el) - V(sh)
    sleeve.loft([limb_ring(along(sh, el, t), axis, r, r, r, n) for t, r in SLEEVE], 'tint_light')
    if form:
        facet(sleeve, FACET['sleeve'], 6)
    forearm = Part('forearm' + tag, 'forearm' + tag, el if detail else origin, sleeve.name if detail else parent)
    axis = V(wr) - V(el)
    table, bands = (FOREARM_FORM, FOREARM_FORM_BANDS) if form else (FOREARM, FOREARM_BANDS)
    forearm.loft([limb_ring(along(el, wr, t), axis, r, r, r, n) for t, r in table], bands)
    glove = Part('glove' + tag, 'hand' + tag, wr if detail else origin, forearm.name if detail else parent)
    if not detail:
        glove.box(along(wr, end, 0.5), hand_frame(V(end) - V(wr), side), (0.145, 0.058, 0.036), 'black')
        parts += [sleeve, forearm, glove]
        return
    # Glove cuff, palm to the knuckles, fingers curling in toward the thigh with bare tips
    # (fingerless), and a thumb on the front edge.
    kn = mirror(KNUCKLE, side)
    palm, across, out = hand_frame(V(kn) - V(wr), side)
    length = (V(kn) - V(wr)).length
    glove.loft([limb_ring(along(wr, kn, t), palm, 0.047, 0.05, 0.05, n) for t in (-0.05, 0.22)], 'black')
    if not form:
        glove.box(along(wr, kn, 0.6), (palm, across, out), (length * 0.42, 0.06, 0.043), 'black')
        _, f_across, f_out = hand_frame(V(end) - V(kn), side)
        quad = ((-1, -1), (1, -1), (1, 1), (-1, 1))
        glove.loft([[tuple(V(along(kn, end, t)) + f_across * (w * a) + f_out * (th * b)) for a, b in quad]
                    for t, w, th in ((0.0, 0.056, 0.038), (0.45, 0.055, 0.035), (0.62, 0.054, 0.033),
                                     (1.0, 0.050, 0.030))], ['black', 'black', 'skin'])
        thumb = V(along(wr, kn, 0.55)) + across * 0.065 - out * 0.01 + palm * 0.035
        glove.box(tuple(thumb), (palm, across, out), (0.04, 0.02, 0.02), 'black')
        parts += [sleeve, forearm, glove]
        return
    # Form (10-part-glove, 10b): tapered palm, wrist strap with a cyan square, the cyan mark
    # on the back of the hand, four split fingers with bare tips, three white knuckle studs
    # and a two-part thumb.
    quad = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    glove.loft([[tuple(V(along(wr, kn, t)) + across * (w * a) + out * (th * b)) for a, b in quad]
                for t, w, th in ((0.16, 0.052, 0.036), (0.6, 0.06, 0.043), (1.02, 0.058, 0.04))], 'black')
    glove.loft([limb_ring(along(wr, kn, t), palm, 0.053, 0.056, 0.056, n) for t in (0.0, 0.15)], 'black')
    glove.box(tuple(V(along(wr, kn, 0.075)) + out * 0.056), (palm, across, out), (0.009, 0.009, 0.004), 'cyan')
    back = V(along(wr, kn, 0.62)) + out * 0.045
    for offset in (-0.028, 0.028):  # an H (10b): two bars along the hand, a crossbar across it
        glove.box(tuple(back + across * offset), (palm, across, out), (0.015, 0.0065, 0.004), 'cyan')
    glove.box(tuple(back), (palm, across, out), (0.0065, 0.028, 0.004), 'cyan')
    f_dir, f_across, f_out = hand_frame(V(end) - V(kn), side)
    reach = (V(end) - V(kn)).length
    for i, (offset, scale) in enumerate(((0.042, 0.93), (0.014, 1.0), (-0.014, 0.95), (-0.042, 0.8))):
        base = V(kn) + f_across * offset
        finger(glove, base, f_dir, f_across, f_out, reach * scale, 0.0125, 0.017, 0.02,
               ['black', 'black', 'skin'])
        if i < 3:  # knuckle studs on the index, middle and ring fingers
            glove.box(tuple(base + f_dir * 0.014 + f_out * 0.021), (f_dir, f_across, f_out),
                      (0.009, 0.009, 0.004), 'white')
    t_dir = (palm * 0.7 + across * 0.5 - out * 0.2).normalized()
    _, t_across, t_out = hand_frame(t_dir, side)
    finger(glove, V(along(wr, kn, 0.45)) + across * 0.058 - out * 0.005, t_dir, t_across, t_out, 0.075,
           0.014, 0.013, 0.01, ['black', 'black', 'skin'])
    parts += [sleeve, forearm, glove]


def sneaker_form(foot, base, fwd, lat):
    """Chunky sneaker (sheet B's sneaker panels; top line measured on 02b): a white midsole in
    two blocks with a toe spring, a black shank in the arch notch, black treads inside cyan
    outsole rims with a cyan triangle under the forefoot, and an upper with a black heel
    counter, a cyan quarter cut diagonally at the back with a black patch, a black vamp band,
    a cyan toe box under a white toe cap, cyan laces down the instep, a tall tongue leaning
    forward and a cyan heel tab."""
    up = V((0.0, 1.0, 0.0))

    def point(u, v, y):
        return tuple(base + fwd * u + lat * v + up * y)

    def spring(u):
        return interp(TOE_SPRING, u)

    def profile(u, bottom, top, bevel, scale=1.0):
        """Bevelled section of one sole layer at u."""
        hw = max(interp(SOLE_FORM, u), 0.03) * scale
        rise, bevel = min(0.01, (top - bottom) * 0.3), min(bevel, (top - bottom) * 0.4)
        return [point(u, a * hw, y) for a, y in ((-0.9, bottom), (0.9, bottom), (1.0, bottom + rise),
                                                  (1.0, top - bevel), (0.9, top), (-0.9, top),
                                                  (-1.0, top - bevel), (-1.0, bottom + rise))]

    def upper_at(u):
        hw = interp([(r[0], r[1]) for r in UPPER_FORM], u)
        top = interp([(r[0], r[2]) for r in UPPER_FORM], u)
        floor = interp(MIDSOLE_TOP, u) - 0.005
        return hw, top, floor, floor + 0.65 * (top - floor)

    def on_upper(u, h, s, lift):
        """Point on the upper at u: h 0-1 runs up side s (+1 toward lat) from the midsole to
        the top edge, h 1-2 across the top to the other side; pushed `lift` out."""
        hw, top, floor, mid = upper_at(u)
        if h <= 0.5:
            a, y = hw * (1 - 0.36 * h), floor + (mid - floor) * 2 * h
        elif h <= 1.0:
            a, y = hw * (0.82 - 0.44 * (h - 0.5)), mid + (top - mid) * 2 * (h - 0.5)
        else:
            a, y = hw * 0.6 * (1 - 2 * (h - 1)), top
        centre, p = V(point(u, 0.0, (floor + top) / 2)), V(point(u, s * a, y))
        return tuple(p + (p - centre).normalized() * lift)

    def panel(grid, material, lift=0.005):
        """Plate on the upper over a grid of (u, h, side) rows."""
        foot.slab([[on_upper(u, h, s, -0.002) for u, h, s in row] for row in grid],
                  [[on_upper(u, h, s, lift) for u, h, s in row] for row in grid], material)

    # Sole: per block a white midsole, a cyan outsole rim and a black tread set inside the rim;
    # a black shank under the arch notch; the cyan triangle under the forefoot.
    for us, ts in (((-0.096, -0.085, -0.06, 0.0, 0.05, 0.098), (-0.084, -0.075, -0.06, 0.0, 0.05, 0.098)),
                   ((0.158, 0.2, 0.25, 0.295, 0.323, 0.339), (0.158, 0.2, 0.25, 0.295, 0.313, 0.327))):
        foot.loft([profile(u, 0.017 + spring(u), interp(MIDSOLE_TOP, u), 0.022) for u in us], 'white')
        foot.loft([profile(u, 0.005 + spring(u), 0.019 + spring(u), 0.004) for u in us], 'cyan')
        foot.loft([profile(u, 0.0015 + spring(u), 0.012 + spring(u), 0.003, 0.86) for u in ts], 'black')
    foot.loft([profile(u, 0.012, interp(MIDSOLE_TOP, u) - 0.002, 0.01, 0.78) for u in (0.09, 0.128, 0.166)],
              'black')
    logo(foot, plane_frame(point(0.215, 0.0, 0.0015), lat, fwd, (0.0, -1.0, 0.0)),
         triangle_outline(0.04, 0.066, 0.014), proud=0.0015)
    # Upper, its panels, laces, tongue and heel tab.
    sections = []
    for u, hw, top in UPPER_FORM:
        _, _, floor, mid = upper_at(u)
        loop = [(-hw, floor), (hw, floor), (hw * 0.82, mid), (hw * 0.6, top), (-hw * 0.6, top), (-hw * 0.82, mid)]
        sections.append([point(u, a, y) for a, y in loop])
    foot.loft(sections, UPPER_FORM_BANDS)
    for s in (-1, 1):
        back = [0.066 - 0.101 * h for h in (0.02, 0.5, 0.95)]  # the quarter's diagonal back edge
        panel([[(b + (0.076 - b) * k, h, s) for k in (0.0, 0.5, 1.0)] for b, h in zip(back, (0.02, 0.5, 0.95))],
              'cyan')
        panel([[(u - 0.03 * (h - 0.3), h, s) for u in (0.085, 0.118)] for h in (0.3, 0.6)], 'black', 0.006)
    panel([[(u, 0.62, -1), (u, 1.0, -1), (u, 1.5, -1), (u, 1.0, 1), (u, 0.62, 1)] for u in (0.222, 0.252, 0.282)],
          'white')  # toe cap
    for u in (0.102, 0.13, 0.158):  # laces, lying on the instep slope
        slope = (upper_at(u + 0.005)[1] - upper_at(u - 0.005)[1]) / 0.01
        run = (fwd + up * slope).normalized()
        normal = run.cross(lat).normalized()
        foot.box(tuple(V(point(u, 0.0, upper_at(u)[1])) + normal * 0.004), (run, lat, normal),
                 (0.009, 0.038, 0.005), 'cyan')
    lean = math.radians(18)
    foot.box(point(0.085, 0.0, 0.262), (fwd * math.cos(lean) - up * math.sin(lean), lat,
                                        up * math.cos(lean) + fwd * math.sin(lean)), (0.011, 0.03, 0.03), 'black')
    foot.box(point(-0.047, 0.0, 0.24), (fwd, lat, up), (0.005, 0.012, 0.022), 'cyan')  # heel tab


def jogger_rings(start, end, table, side):
    """Form-pass jogger sections along start->end, tilted into diagonal folds; the left leg
    (side +1) mirrors the fold phases of the authored right leg."""
    axis = V(end) - V(start)
    return [fold_ring(along(start, end, t), axis, hw, f, b, LEG_FORM_SIDES, tilt, -side * math.radians(phase))
            for t, hw, f, b, tilt, phase in table]


def build_leg(parts, stage, side, parent):
    detail = stage != 'blockout'
    form = stage in FORM_STAGES
    n = 8 if detail else 6
    hip, knee, ankle = (mirror(p, side) for p in (HIP, KNEE, ANKLE))
    tag = '.L' if side > 0 else '.R'
    origin = (0.0, 0.0, 0.0)
    thigh = Part('joggers_thigh' + tag, 'thigh' + tag, hip if detail else origin, parent)
    axis = V(knee) - V(hip)
    if form:
        thigh.loft(jogger_rings(hip, knee, THIGH_FORM, side), 'black')
        facet(thigh, FACET['joggers'], 3)
    else:
        thigh.loft([limb_ring(along(hip, knee, t), axis, hw, f, b, n, square=2.3) for t, hw, f, b in THIGH], 'black')
    # Cargo pocket on the outer thigh: part of the silhouette in the front view, so every stage.
    if form:  # (02b, 03b) a plate following the thigh, with a wider, prouder flap over its top
        outer = math.pi / 2 if side > 0 else 3 * math.pi / 2
        for rows, spread, inner, lift in (((0.12, 0.25, 0.38, 0.52), 0.55, -0.006, 0.013),
                                          ((0.03, 0.09, 0.15), 0.6, 0.004, 0.022)):
            grid = [[(t, outer + spread * k) for k in (-1.0, -0.33, 0.33, 1.0)] for t in rows]
            thigh.slab([[limb_surface(hip, knee, THIGH_FORM, t, a, inner) for t, a in row] for row in grid],
                       [[limb_surface(hip, knee, THIGH_FORM, t, a, lift) for t, a in row] for row in grid],
                       'black')
    else:
        down = axis.normalized()
        outward = V((side, 0.0, 0.0))
        outward = (outward - down * outward.dot(down)).normalized()
        centre = V(along(hip, knee, 0.30)) + outward * 0.113
        thigh.box(tuple(centre), (down, outward.cross(down), outward), (0.11, 0.085, 0.022), 'black')
    shin = Part('joggers_shin' + tag, 'shin' + tag, knee if detail else origin, thigh.name if detail else parent)
    axis = V(ankle) - V(knee)
    if form:
        shin.loft(jogger_rings(knee, ankle, SHIN_FORM, side), SHIN_FORM_BANDS)
        facet(shin, FACET['joggers'], 4)
    else:
        shin.loft([limb_ring(along(knee, ankle, t), axis, hw, f, b, n, square=2.3) for t, hw, f, b in SHIN],
                  SHIN_BANDS)
    foot = Part('sneaker' + tag, 'foot' + tag, ankle if detail else origin, shin.name if detail else parent)
    fwd = V((side * math.sin(TOE_OUT), 0.0, math.cos(TOE_OUT)))
    lat = V((0.0, 1.0, 0.0)).cross(fwd).normalized()
    base = V((ankle[0], 0.0, ankle[2]))
    if form:
        sneaker_form(foot, base, fwd, lat)
        parts += [thigh, shin, foot]
        return
    # Sole slab and a tapering upper: low toe box, high collar at the heel (both stages).
    outline = [(u, v) for u, v in SOLE] + [(u, -v) for u, v in reversed(SOLE[1:-1])]
    foot.loft([[tuple(base + fwd * u + lat * v + V((0, y, 0))) for u, v in outline] for y in (0.0, SOLE_TOP)],
              'white')
    sections = []
    for u, hw, top in (UPPER if detail else UPPER[::2]):  # [::2] keeps the tip section
        mid = SOLE_TOP + 0.65 * (top - SOLE_TOP)
        loop = [(-hw, SOLE_TOP - 0.005), (hw, SOLE_TOP - 0.005), (hw * 0.82, mid), (hw * 0.6, top),
                (-hw * 0.6, top), (-hw * 0.82, mid)]  # tapers inside the flared sole
        sections.append([tuple(base + fwd * u + lat * a + V((0, y, 0))) for a, y in loop])
    foot.loft(sections, 'cyan')
    parts += [thigh, shin, foot]


def build_pelvis(parts, stage, parent):
    detail = stage != 'blockout'
    pelvis = Part('joggers_hips', 'hips', HIPS if detail else (0.0, 0.0, 0.0), parent)
    pelvis.loft([ring(y, hw, f, b, 12 if detail else 10, square=2.4) for y, hw, f, b in PELVIS], 'black')
    if stage in FORM_STAGES:
        facet(pelvis, FACET['joggers'], 5)
        # Cyan straps hanging from the waist on the left hip, front and back, each ending in a
        # black buckle. Their lower half lies on the thigh; the rig pass weights it there.
        for sign, pts in ((1, HIP_STRAP_FRONT), (-1, HIP_STRAP_BACK)):
            pelvis.strap(pts, [(0.3, 0.0, sign)] * len(pts), 'cyan', width=0.035, thick=0.01)
            pelvis.box(tuple(V(pts[-1]) + V((0.0, -0.022, 0.0))), ((1, 0, 0), (0, 1, 0), (0, 0, 1)),
                       (0.021, 0.024, 0.009), 'black')
    parts.append(pelvis)
    return pelvis


# ---------------------------------------------------------------- scene assembly

def srgb_to_linear(hex_rgb):
    out = []
    for i in (0, 2, 4):
        c = int(hex_rgb[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def make_materials(stage):
    made = {}
    tuned = stage in ('material',) + RIG_STAGES
    table = MATERIALS_TUNED if tuned else {k: (*v, 0.0) for k, v in MATERIALS.items()}
    for name, (hex_rgb, roughness, emission) in table.items():
        m = bpy.data.materials.new(name)
        if m.node_tree is None:  # Blender 5 creates node materials; use_nodes goes in 6.0.
            m.use_nodes = True
        colour = (*srgb_to_linear(hex_rgb), 1.0)
        shader = m.node_tree.nodes['Principled BSDF']
        shader.inputs['Base Color'].default_value = colour
        shader.inputs['Roughness'].default_value = roughness
        if emission:  # exported as the glTF emissive factor (colour x strength)
            shader.inputs['Emission Color'].default_value = colour
            shader.inputs['Emission Strength'].default_value = emission
        m.diffuse_color = colour
        made[name] = m
    return made


def assemble(parts, stage):
    materials = make_materials(stage)
    collection = bpy.context.scene.collection
    root = bpy.data.objects.new('hider_hoodie', None)
    root.empty_display_type = 'PLAIN_AXES'
    root['generator'] = 'scripts/characters/hider_hoodie.py'
    root['stage'] = stage
    collection.objects.link(root)
    nodes = {'hider_hoodie': (root, (0.0, 0.0, 0.0))}
    if stage != 'blockout':
        head = bpy.data.objects.new('head', None)
        head.empty_display_type = 'PLAIN_AXES'
        head['rigJoint'] = 'head'
        collection.objects.link(head)
        nodes['head'] = (head, NECK)  # parented to the torso once that object exists
    report = []
    for part in parts:
        bm = part.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bmesh.ops.translate(bm, vec=-B(part.pivot), verts=bm.verts)
        mesh = bpy.data.meshes.new(part.name)
        bm.to_mesh(mesh)
        bm.free()
        for name in part.materials:
            mesh.materials.append(materials[name])
        obj = bpy.data.objects.new(part.name, mesh)
        collection.objects.link(obj)
        parent, parent_pivot = nodes[part.parent or 'hider_hoodie']
        obj.parent = parent
        obj.location = B(part.pivot) - B(parent_pivot)
        if part.joint and stage != 'blockout':
            obj['rigJoint'] = part.joint
        if part.solidify:
            shell = obj.modifiers.new('shell', 'SOLIDIFY')
            shell.thickness = part.solidify
            shell.offset = -1.0
            shell.use_even_offset = True
        nodes[part.name] = (obj, part.pivot)
        if part.name == 'torso' and 'head' in nodes:
            head = nodes['head'][0]
            head.parent = obj
            head.location = B(NECK) - B(part.pivot)
        report.append({'name': part.name, 'joint': part.joint if stage != 'blockout' else None,
                       'parent': part.parent or 'hider_hoodie',
                       'pivot': [round(c, 4) for c in part.pivot]})
    if stage != 'blockout':
        report.insert(2, {'name': 'head', 'joint': 'head', 'parent': 'torso', 'empty': True,
                          'pivot': [round(c, 4) for c in NECK]})
    return report


def build(stage):
    eb.empty_scene()
    bpy.context.preferences.filepaths.save_version = 0
    parts = []
    detail = stage != 'blockout'
    pelvis = build_pelvis(parts, stage, None)
    torso = build_torso(parts, stage, pelvis.name if detail else None)
    build_bag(parts, stage, torso.name if detail else None)
    build_head(parts, stage, 'head' if detail else None)
    for side in (-1, 1):
        build_arm(parts, stage, side, torso.name if detail else None)
        build_leg(parts, stage, side, pelvis.name if detail else None)
    return assemble(parts, stage)


def joints():
    """Joint positions for the rig (game space, on the character's right; hider_hoodie_rig
    mirrors them for the left). The neck bone runs from the base of the collar to the head
    pivot of the structure pass."""
    toe = (ANKLE[0] - math.sin(TOE_OUT) * 0.2, 0.03, ANKLE[2] + math.cos(TOE_OUT) * 0.2)
    return {'hips': HIPS, 'spine': SPINE, 'chest': CHEST, 'neck_base': (0.0, 1.66, NECK[2]), 'neck': NECK,
            'shoulder': SHOULDER, 'elbow': ELBOW, 'wrist': WRIST, 'knuckle': KNUCKLE, 'hand_end': HAND_END,
            'hip': HIP, 'knee': KNEE, 'ankle': ANKLE, 'toe': toe, 'ball': (0.26, -ANKLE[1])}


def sole_profile(sneaker):
    """The right sneaker's side profile as (forward, up) points from the ankle: the lower
    convex hull, on which the lowest point of the foot lies at any pitch. The rig pitches the
    foot about the game x axis, so the profile is the projection on the y-z plane."""
    points = sorted({(round(-p.y - ANKLE[2], 5), round(p.z - ANKLE[1], 5))
                     for p in (sneaker.matrix_world @ v.co for v in sneaker.data.vertices)})
    hull = []
    for p in points:  # Andrew's monotone chain, lower half
        while len(hull) >= 2 and ((hull[-1][0] - hull[-2][0]) * (p[1] - hull[-2][1])
                                  - (hull[-1][1] - hull[-2][1]) * (p[0] - hull[-2][0])) <= 0:
            hull.pop()
        hull.append(p)
    return hull


def rig_stage(stage):
    """Passes 5-6: bake the part hierarchy into world-space meshes, skin them to one armature
    (hider_hoodie_rig), join them into one mesh for the runtime export, and add the clips."""
    import hider_hoodie_rig as rig
    scene = bpy.context.scene
    bpy.context.view_layer.update()  # the joint hierarchy's world matrices are not evaluated yet
    meshes = [o for o in scene.objects if o.type == 'MESH']
    worlds = {o: o.matrix_world.copy() for o in meshes}
    for obj in meshes:
        obj.parent = None
        obj.data.transform(worlds[obj])
        obj.matrix_world = Matrix.Identity(4)
    for obj in [o for o in scene.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(obj)
    j = joints()
    j['sole'] = sole_profile(next(o for o in meshes if o.name == 'sneaker.R'))
    arm = rig.create_armature(j, 'hider_hoodie')
    arm['generator'] = 'scripts/characters/hider_hoodie.py'
    arm['stage'] = stage
    for obj in meshes:
        rig.skin(obj, obj.name, j, arm)
    if stage == 'export':  # one skinned mesh, one draw call per material (character.md)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in meshes:
            obj.select_set(True)
        body = next(o for o in meshes if o.name == 'torso')
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        body.name = body.data.name = 'hider_hoodie_mesh'
        meshes = [body]
    rig.make_clips(arm, j)
    return arm, meshes, j


def rig_fps():
    render = bpy.context.scene.render
    return render.fps / render.fps_base


def measure_clips(arm, meshes):
    """Per clip, over every frame: tallest pose, lowest point, the largest |x| or |z| of the
    bounds (comparable with the axis-aligned box that shots test), and how far the last frame
    of a loop is from its first (bone matrices)."""
    scene = bpy.context.scene
    data = arm.animation_data
    out = {}
    for action in sorted(bpy.data.actions, key=lambda a: a.name):
        for pb in arm.pose.bones:  # an upper-body clip must not inherit the last clip's legs
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
        data.action = action
        data.action_slot = action.slots[0]
        start, end = (int(round(v)) for v in action.frame_range)
        tallest, lowest, extent = 0.0, 1e9, 0.0
        for frame in range(start, end + 1):
            scene.frame_set(frame)
            lo, hi = eb.world_bounds(meshes)
            tallest, lowest = max(tallest, hi.z - min(lo.z, 0.0)), min(lowest, lo.z)
            extent = max(extent, abs(lo.x), abs(hi.x), abs(lo.y), abs(hi.y))
        seam = 0.0
        if action.get('loop'):
            poses = []
            for frame in (start, end):
                scene.frame_set(frame)
                poses.append([pb.matrix.copy() for pb in arm.pose.bones])
            seam = max(max(abs(a - b) for ra, rb in zip(ma, mb) for a, b in zip(ra, rb))
                       for ma, mb in zip(*poses))
        out[action.name] = {'frames': [start, end], 'seconds': round((end - start) / rig_fps(), 4),
                            'loop': bool(action.get('loop')), 'maxHeightMetres': round(tallest, 4),
                            'lowestPointMetres': round(lowest, 4), 'maxHalfExtentMetres': round(extent, 4),
                            'loopSeamMaxDifference': round(seam, 6)}
    data.action = None
    for pb in arm.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    scene.frame_set(0)
    return out


def check_rigged_export(glb, stage, j, clips):
    """Re-import the rigged GLB: rest-pose size, facing and symmetry, bone heads on their
    joints, one armature, and every clip present with its length."""
    import hider_hoodie_rig as rig
    eb.import_glb_copy(glb)
    scene = bpy.context.scene
    arms = [o for o in scene.objects if o.type == 'ARMATURE']
    failures = []
    if len(arms) != 1:
        failures.append(f'expected one armature, found {len(arms)}')
    for arm in arms:
        arm.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    meshes = eb.mesh_objects()
    bounds = eb.game_bounds(meshes)
    lo, hi = bounds['min'], bounds['max']
    height = hi[1] - lo[1]
    if abs(lo[1]) > 0.01:
        failures.append(f'lowest point {lo[1]} m, expected the soles at 0')
    if not 2.14 <= height <= 2.18:
        failures.append(f'height {height:.3f} m, expected the hood peak at 2.16 m')
    if abs(lo[0] + hi[0]) > 0.02:
        failures.append(f'not symmetric in x: {lo[0]} .. {hi[0]}')
    reach = {'head': -1e9, 'chest': 1e9}  # brim tip (+Z) and bag (-Z), found through the weights
    for obj in meshes:
        index = {g.index: g.name for g in obj.vertex_groups}
        for v in obj.data.vertices:
            z = -(obj.matrix_world @ v.co).y
            for g in v.groups:
                name = index.get(g.group)
                if name == 'head' and g.weight > 0.5:
                    reach['head'] = max(reach['head'], z)
                if name == 'chest' and g.weight > 0.5:
                    reach['chest'] = min(reach['chest'], z)
    if reach['head'] < 0.2:
        failures.append(f"facing: the brim must reach past +0.2 m in +Z, got {reach['head']:.3f}")
    if reach['chest'] > -0.2:
        failures.append(f"facing: the bag must sit on the back (-Z), got {reach['chest']:.3f}")
    heads = {name: head for name, head, _, _ in rig.bone_table(j)}
    for arm in arms:
        names = {b.name for b in arm.data.bones}
        for bone in arm.data.bones:
            if bone.name not in heads:
                failures.append(f'unexpected bone {bone.name}')
                continue
            where = eb.game_point(arm.matrix_world @ bone.head_local)
            error = max(abs(a - b) for a, b in zip(where, heads[bone.name]))
            if error > 0.001:
                failures.append(f'bone {bone.name} head {where} is {error:.4f} m off its joint')
        if set(heads) - names:
            failures.append(f'missing bones {sorted(set(heads) - names)}')
    fps = rig_fps()
    found = {a.name: (a.frame_range[1] - a.frame_range[0]) / fps for a in bpy.data.actions}
    for name, clip in clips.items():
        if name not in found:
            failures.append(f'clip {name} missing; found {sorted(found)}')
        elif abs(found[name] - clip['seconds']) > 0.02:
            failures.append(f'clip {name} lasts {found[name]:.3f} s, expected {clip["seconds"]} s')
    animated = {a.name: sorted({c.data_path.split('"')[1] for layer in a.layers for strip in layer.strips
                                for bag in strip.channelbags for c in bag.fcurves if '"' in c.data_path})
                for a in bpy.data.actions}
    lower = [b for b in animated.get('wave', []) if b.startswith(('root', 'hips', 'thigh', 'shin', 'foot'))]
    if lower:
        failures.append(f'wave must animate the upper body only, but moves {lower}')
    return {'stage': stage, 'meshObjects': len(meshes), 'triangles': eb.evaluated_triangles(meshes),
            'bones': sum(len(a.data.bones) for a in arms), 'clips': {k: round(v, 4) for k, v in found.items()},
            'animatedBones': {k: len(v) for k, v in animated.items()},
            'gameBounds': bounds, 'heightMetres': round(height, 4), 'brimMetres': round(reach['head'], 4),
            'bagMetres': round(reach['chest'], 4), 'failures': failures}


def check_export(glb, stage, report):
    """Re-import the preview GLB into an empty scene and check the contract it must keep."""
    eb.import_glb_copy(glb)
    meshes = eb.mesh_objects()
    bounds = eb.game_bounds(meshes)
    lo, hi = bounds['min'], bounds['max']
    failures = []
    height = hi[1] - lo[1]
    if abs(lo[1]) > 0.01:
        failures.append(f'lowest point {lo[1]} m, expected the soles at 0')
    if not 2.14 <= height <= 2.18:
        failures.append(f'height {height:.3f} m, expected the hood peak at 2.16 m')
    by_name = {o.name: o for o in meshes}
    cap, bag = (eb.game_bounds([by_name[n]]) if n in by_name else None for n in ('cap', 'bag'))
    if not cap or cap['max'][2] < 0.2:
        failures.append(f'facing: the cap brim must reach past +0.2 m in +Z, got {cap and cap["max"][2]}')
    if not bag or bag['min'][2] > -0.2:  # the bag body; the harness also reaches the chest
        failures.append(f'facing: the bag must sit on the back (-Z), got {bag and bag["min"][2]}')
    if abs(lo[0] + hi[0]) > 0.02:
        failures.append(f'not symmetric in x: {lo[0]} .. {hi[0]}')
    if stage != 'blockout':  # every part's origin must still sit on its joint after export
        objects = bpy.context.scene.objects
        for entry in report:
            obj = objects.get(entry['name'])
            if obj is None:
                failures.append(f"{entry['name']} missing from the GLB")
                continue
            where = eb.game_point(obj.matrix_world.translation)
            error = max(abs(a - b) for a, b in zip(where, entry['pivot']))
            if error > 0.001:
                failures.append(f"{entry['name']} origin {where} is {error:.4f} m off its joint")
    return {'stage': stage, 'meshObjects': len(meshes), 'triangles': eb.evaluated_triangles(meshes),
            'gameBounds': bounds, 'heightMetres': round(height, 4), 'failures': failures}


def main():
    options = args()
    out = Path(options.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    blend = out / (NAME + '.blend')
    glb = Path(options.runtime_glb).resolve() if options.stage == 'export' else out / (NAME + '-preview.glb')
    glb.parent.mkdir(parents=True, exist_ok=True)
    report = build(options.stage)
    rigged = options.stage in RIG_STAGES
    if rigged:
        arm, meshes, j = rig_stage(options.stage)
        clips = measure_clips(arm, meshes)  # leaves no action active: the .blend opens in the rest pose
    bpy.ops.object.select_all(action='SELECT')
    # Keyed channels only, not resampled: the keys are already linear on every frame, and a
    # clip then carries tracks for the bones it animates, so the upper-body wave can play over
    # another clip's legs.
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_animations=rigged, export_animation_mode='ACTIONS',
                              export_skins=True, export_force_sampling=False, export_reset_pose_bones=True,
                              export_rest_position_armature=True, export_cameras=False, export_lights=False,
                              export_extras=options.stage != 'export')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    triangles = {o.name: eb.evaluated_triangles([o]) for o in eb.mesh_objects()}
    for entry in report:
        entry['triangles'] = triangles.get(entry['name'])
    if rigged:
        exported = check_rigged_export(glb, options.stage, j, clips)
    else:
        exported = check_export(glb, options.stage, report)
    try:
        glb_name = glb.relative_to(ROOT).as_posix()
    except ValueError:
        glb_name = glb.name
    manifest = {
        'id': NAME, 'generator': 'scripts/characters/hider_hoodie.py',
        'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'stage': options.stage, 'blender': bpy.app.version_string, 'units': 'metres',
        'runtimeUp': '+Y', 'facing': '+Z', 'blend': blend.name,
        ('runtimeGlb' if options.stage == 'export' else 'previewGlb'): glb_name,
        'glbBytes': glb.stat().st_size, 'parts': report, 'export': exported,
    }
    if rigged:
        rig_file = Path(__file__).resolve().parent / 'hider_hoodie_rig.py'
        manifest['rig'] = {'generator': 'scripts/characters/hider_hoodie_rig.py',
                           'generatorSha256': hashlib.sha256(rig_file.read_bytes()).hexdigest(),
                           'fps': 30, 'clips': clips}
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('HIDER_HOODIE_BUILD ' + json.dumps({'stage': options.stage, 'triangles': exported['triangles'],
                                              'height': exported['heightMetres'],
                                              'failures': exported['failures']}))
    if exported['failures']:
        sys.exit(1)

main()
