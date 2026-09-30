"""Reproducible Blender build of the seeker-hunter character.

  "/c/Program Files/Blender Foundation/Blender 5.2/blender.exe" --background --factory-startup \
    --python-exit-code 1 --python scripts/characters/seeker_hunter.py -- \
    --stage blockout|structure [--out-dir DIR]

One stage per review pass (assets-src/characters/seeker-hunter/reviews):
  blockout   pass 1: masses and proportions only, every part at the world origin.
  structure  pass 2: the parts the rig will drive, each with its origin on its joint and
             parented in joint order (hips > spine > chest > head, arms and hands, hips >
             legs); custom property `rigJoint` names the future bone. A `weapon_socket`
             empty sits in the right palm with the brief's frame (+Z muzzle, forward in the
             bind pose; +Y the weapon's top; +X the character's left) and a review-only arrow.
Both write <out-dir>/seeker-hunter.blend, <out-dir>/seeker-hunter-preview.glb and
<out-dir>/manifest.json (default out-dir: the asset folder). The preview GLB has no rig or
clips; it is review evidence, not the runtime export, so it stays out of public/.
The build re-imports the GLB and exits 1 if height, ground contact, facing or symmetry are
wrong, if any object carries rotation or scale or, for the structure stage, if a part's
origin is more than 1 mm off its joint or the socket is missing.

Game space: metres, +Y up, facing +Z, origin between the feet, character's right at -X.
Blender space is (x, -z, y). Dimensions come from brief.md and
reviews/intake/measurements.json, with the hood peak at the 2.16 m collision height.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

sys.dont_write_bytecode = True  # keep the tracked scripts/blender/__pycache__ unchanged
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts/blender'))
import echo_blender as eb  # noqa: E402

NAME = 'seeker-hunter'
ASSET = ROOT / 'assets-src/characters' / NAME

# Colours are sRGB. brief.md D1 sets the floors (fabric L* >= 18, plates L* >= 26); the
# material pass tunes them. tint_light is the emissive recolour region, in classic red.
MATERIALS = {  # name: (sRGB hex, roughness, metallic, emission strength)
    'suit': ('2C2B31', 0.85, 0.0, 0.0),        # hood, suit, gloves, shoe uppers
    'armour': ('403E46', 0.55, 0.15, 0.0),     # plates, belt, pouches, holster, back plate
    'faceplate': ('1B1A20', 0.3, 0.2, 0.0),    # glossy face plate behind the visor
    'tint_light': ('FA4E4D', 0.45, 0.0, 3.0),  # visor, accent strips, soles
    'marker': ('FFA822', 0.5, 0.0, 0.0),       # review-only weapon_socket arrow
}

# Joints on the character's right (game space); the left side mirrors x.
HIPS = (0.0, 1.00, 0.0)
SPINE = (0.0, 1.14, 0.0)
CHEST = (0.0, 1.42, -0.01)
NECK = (0.0, 1.74, -0.01)
SHOULDER = (-0.237, 1.655, -0.065)  # the arms hang behind the chest (02: deltoid plate at z -0.02..-0.16)
ELBOW = (-0.305, 1.385, -0.085)
WRIST = (-0.385, 1.135, -0.03)
HAND_END = (-0.39, 0.865, 0.035)
HIP = (-0.12, 0.99, 0.025)
KNEE = (-0.186, 0.60, 0.02)
ANKLE = (-0.25, 0.13, -0.02)
KNUCKLE = (-0.388, 0.968, 0.010)  # finger block pivot, 0.62 of the way from wrist to fingertips
THUMB = (-0.372, 1.070, 0.030)     # thumb base on the palm's front edge
THUMB_END = (-0.366, 0.985, 0.078)
SOCKET = (-0.39, 0.99, 0.005)  # weapon_socket: grip point in the right palm, bind pose
TOE_OUT = math.radians(9)
ORIGIN = (0.0, 0.0, 0.0)

# Hood shell sections: (y, half width, back, z at the widest point, front or rim z, half gap
# of the face opening, tilt). A zero gap closes the ring; `tilt` lowers the back of the hem
# over the upper back. The peak is a single apex.
HOOD = [
    (1.735, 0.185, 0.190, 0.00, 0.105, 0.070, 0.035),  # hem drapes over the trapezius
    (1.785, 0.176, 0.185, 0.00, 0.135, 0.105, 0.0),
    (1.830, 0.168, 0.140, 0.01, 0.160, 0.140, 0.0),   # nape notch above the hem (02 side view)
    (1.870, 0.180, 0.158, 0.02, 0.180, 0.150, 0.0),
    (1.925, 0.160, 0.163, 0.03, 0.188, 0.138, 0.0),
    (1.980, 0.143, 0.148, 0.03, 0.200, 0.118, 0.0),
    (2.020, 0.132, 0.135, 0.03, 0.210, 0.070, 0.0),
    (2.050, 0.124, 0.128, 0.03, 0.214, 0.0, 0.0),
    (2.100, 0.100, 0.105, 0.02, 0.128, 0.0, 0.0),
    (2.135, 0.066, 0.050, 0.015, 0.068, 0.0, 0.0),  # the tip leans slightly forward (02)
]
HOOD_PEAK = (0.0, 2.160, 0.015)
HOOD_SHELL = 0.022
# Face plate sections (y, half width, front z); flat back at z -0.02 inside the hood. The
# edges tuck behind the rim of the face opening.
FACE = [(1.775, 0.040, 0.118), (1.800, 0.115, 0.130), (1.860, 0.162, 0.148),
        (1.920, 0.156, 0.158), (1.980, 0.136, 0.162), (2.030, 0.085, 0.158)]
VISOR_BAR_Y, VISOR_BAR_HALF, VISOR_STEM_BOTTOM = 1.955, 0.07, 1.81
# Torso and pelvis sections: (y, half width, front, back). The chest plates, strap and back
# plate sit on top; 1.73-1.80 m is the trapezius slope between the hood and shoulder plates.
TORSO = [(1.120, 0.215, 0.170, 0.160), (1.260, 0.195, 0.170, 0.160), (1.320, 0.178, 0.170, 0.176),
         (1.380, 0.192, 0.172, 0.180), (1.460, 0.228, 0.170, 0.176), (1.540, 0.232, 0.160, 0.172),
         (1.620, 0.222, 0.143, 0.168), (1.680, 0.212, 0.132, 0.165), (1.730, 0.195, 0.122, 0.160),
         (1.765, 0.160, 0.110, 0.150), (1.795, 0.110, 0.095, 0.125)]
PELVIS = [(0.920, 0.200, 0.165, 0.120), (0.960, 0.235, 0.185, 0.140), (1.050, 0.228, 0.185, 0.172),
          (1.140, 0.215, 0.175, 0.162)]
# Back plate sections (y, half width, centre z, half depth): bevelled top and bottom (02).
BACK_PLATE = [(1.37, 0.100, -0.170, 0.035), (1.42, 0.120, -0.180, 0.048), (1.47, 0.130, -0.190, 0.055),
              (1.52, 0.135, -0.200, 0.062), (1.64, 0.135, -0.200, 0.062), (1.69, 0.130, -0.195, 0.053),
              (1.725, 0.110, -0.180, 0.035)]
# Limb sections along joint segments: (t, half width, front, back); front faces +Z.
# The upper arm starts above the shoulder joint (t < 0) so the shoulder is solid under the plate.
UPPER_ARM = [(-0.15, 0.052, 0.056, 0.056), (0.0, 0.068, 0.068, 0.068), (0.5, 0.064, 0.064, 0.064),
             (1.0, 0.062, 0.062, 0.062)]
FOREARM = [(0.0, 0.060, 0.060, 0.060), (0.4, 0.058, 0.058, 0.058), (1.0, 0.046, 0.050, 0.050)]
# Hand along the wrist-fingertip axis: (t, half thickness across the palm, front, back). The
# glove runs from the thin wrist over the cuff to the knuckles; the finger block overlaps it
# and turns about KNUCKLE (01: 8.8 cm at the wrist, 12.5-12.9 cm at 0.98-1.02 m).
GLOVE = [(0.0, 0.045, 0.050, 0.050), (0.14, 0.047, 0.056, 0.056), (0.28, 0.060, 0.064, 0.064),
         (0.45, 0.063, 0.068, 0.068), (0.64, 0.063, 0.066, 0.066)]
FINGERS = [(0.58, 0.058, 0.062, 0.058), (0.75, 0.056, 0.062, 0.058), (0.88, 0.044, 0.056, 0.052),
           (1.0, 0.030, 0.046, 0.044)]
THUMB_SECTIONS = [(0.0, 0.022, 0.024, 0.024), (0.6, 0.020, 0.022, 0.022), (1.0, 0.015, 0.017, 0.017)]
THIGH = [(0.0, 0.125, 0.160, 0.150), (0.35, 0.123, 0.160, 0.150), (0.7, 0.108, 0.140, 0.112),
         (1.0, 0.088, 0.105, 0.095)]
SHIN = [(0.0, 0.085, 0.100, 0.115), (0.13, 0.087, 0.105, 0.140), (0.25, 0.090, 0.108, 0.152),
        (0.38, 0.078, 0.095, 0.137), (0.5, 0.068, 0.080, 0.118), (0.75, 0.058, 0.080, 0.092),
        (1.0, 0.055, 0.072, 0.085)]
# Knee plate sections (y, half width, centre z, half depth); x follows the shin line.
KNEE_PLATE = [(0.740, 0.070, 0.120, 0.040), (0.680, 0.088, 0.140, 0.052), (0.620, 0.088, 0.135, 0.048),
              (0.560, 0.082, 0.120, 0.038), (0.500, 0.060, 0.100, 0.024)]
# Sneaker upper along the foot: (distance forward of the ankle, top height, half width).
SHOE = [(-0.105, 0.065, 0.048), (-0.095, 0.140, 0.052), (-0.070, 0.235, 0.045), (0.000, 0.245, 0.044),
        (0.085, 0.225, 0.047), (0.130, 0.180, 0.053), (0.200, 0.150, 0.058), (0.245, 0.135, 0.057),
        (0.272, 0.112, 0.050), (0.288, 0.085, 0.034)]
# Sole outline along the foot: (distance forward of the ankle, half width); 3.5 cm thick, with
# the toe spring of toe_lift().
SOLE_PLAN = [(-0.110, 0.050), (-0.095, 0.060), (-0.050, 0.064), (0.100, 0.062), (0.200, 0.066),
             (0.245, 0.062), (0.272, 0.050), (0.288, 0.028)]
SOLE_THICK = 0.035
STRIP = 0.03  # minimum accent strip width (brief.md D2)


def args():
    parser = argparse.ArgumentParser(prog='seeker_hunter.py')
    parser.add_argument('--stage', required=True, choices=['blockout', 'structure'])
    parser.add_argument('--out-dir', default=str(ASSET))
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


def ring(y, hw, front, back, n, square=2.0, cx=0.0, cz=0.0):
    """Closed horizontal section round (cx, cz); angle 0 faces +Z, 90 degrees is +X."""
    e = 2.0 / square
    out = []
    for i in range(n):
        a = 2 * math.pi * i / n
        s, c = math.sin(a), math.cos(a)
        out.append((cx + hw * spow(s, e), y, cz + (front if c >= 0 else back) * spow(c, e)))
    return out


def hood_section(y, hw, back, z_side, z_front, gap, tilt=0.0, k=4, m=8):
    """Open ring from the left edge of the face opening, round the back, to the right edge.
    With gap 0 both ends meet at the front and are welded later. `tilt` lowers the back."""
    left = []
    for i in range(k + 1):
        u = i / k
        x = gap + (hw - gap) * math.sin(math.pi * u / 2)
        left.append((x, y, z_side + (z_front - z_side) * math.cos(math.pi * u / 2)))
    back_arc = [(hw * math.cos(math.pi * j / m), y, z_side - (back + z_side) * math.sin(math.pi * j / m))
                for j in range(1, m)]
    points = left + back_arc + [(-x, yy, z) for x, yy, z in reversed(left)]
    return [(x, yy - tilt * max(0.0, -z) / back, z) for x, yy, z in points]


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
        out.append(tuple(V(centre) + side * (hw * spow(s, e)) + f * ((front if c >= 0 else back) * spow(c, e))))
    return out


def along(a, b, t):
    return tuple(V(a).lerp(V(b), t))


def outward(a, b, side):
    """Unit vector in the x-y plane, perpendicular to segment a->b, pointing away from the body."""
    d = (V(b) - V(a))
    d = V((d.x, d.y, 0.0)).normalized()
    n = V((d.y, -d.x, 0.0))
    return n if n.x * side > 0 else -n


class Part:
    """One output object: a bmesh in game space plus its joint pivot and parent."""

    def __init__(self, name, joint=None, pivot=(0.0, 0.0, 0.0), parent=None):
        self.name, self.joint, self.pivot, self.parent = name, joint, pivot, parent
        self.bm = bmesh.new()
        self.materials = []
        self.solidify = 0.0
        self.weld = False

    def mat(self, name):
        if name not in self.materials:
            self.materials.append(name)
        return self.materials.index(name)

    def loft(self, rings, bands, close=True, caps=(True, True)):
        """Quads between equal-length sections; one material per band (or one name)."""
        bands = [bands] * (len(rings) - 1) if isinstance(bands, str) else bands
        verts = [[self.bm.verts.new(B(p)) for p in r] for r in rings]
        n = len(rings[0])
        for i in range(len(rings) - 1):
            m = self.mat(bands[i])
            for j in range(n if close else n - 1):
                k = (j + 1) % n
                face = self.bm.faces.new((verts[i][j], verts[i][k], verts[i + 1][k], verts[i + 1][j]))
                face.material_index = m
        if caps[0]:
            self.bm.faces.new(list(reversed(verts[0]))).material_index = self.mat(bands[0])
        if caps[1]:
            self.bm.faces.new(verts[-1]).material_index = self.mat(bands[-1])
        return verts

    def fan(self, ring_verts, apex, material):
        top = self.bm.verts.new(B(apex))
        m = self.mat(material)
        for j in range(len(ring_verts) - 1):
            self.bm.faces.new((ring_verts[j], ring_verts[j + 1], top)).material_index = m

    def box(self, centre, axes, half, material):
        """Box with half extents along three (not necessarily unit) axes."""
        c = V(centre)
        u, v, w = (V(a).normalized() for a in axes)
        quad = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        rings = [[tuple(c + u * (half[0] * a) + v * (half[1] * b) + w * (half[2] * s)) for a, b in quad]
                 for s in (-1, 1)]
        self.loft(rings, material)

    def slab(self, p0, p1, normal, width, thick, material):
        """Box from p0 to p1, `width` across and `thick` along `normal`."""
        a = V(p1) - V(p0)
        n = V(normal)
        side = a.cross(n).normalized()
        n = side.cross(a).normalized() * (1 if side.cross(a).dot(n) > 0 else -1)
        self.box(along(p0, p1, 0.5), (side, n, a), (width / 2, thick / 2, a.length / 2), material)

    def strap(self, path, normals, material, width, thick):
        """Flat strap following `path`, lying on the surface described by `normals`."""
        rings = []
        for i, p in enumerate(path):
            a = V(path[min(i + 1, len(path) - 1)]) - V(path[max(i - 1, 0)])
            side = a.cross(V(normals[i])).normalized()
            n = side.cross(a).normalized()
            if n.dot(V(normals[i])) < 0:
                n = -n
            c = V(p)
            rings.append([tuple(c + side * (width / 2 * s) + n * (thick / 2 * t))
                          for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
        self.loft(rings, material)


class Empty:
    """A joint or socket node without geometry."""

    def __init__(self, name, joint, pivot, parent):
        self.name, self.joint, self.pivot, self.parent = name, joint, pivot, parent


def toe_lift(f):
    """Toe spring: sole and upper curve up over the last 9 cm of the foot (02)."""
    return 0.035 * max(0.0, (f - 0.20) / 0.088) ** 2


def limb(part, a, b, sections, material, n=10, square=2.4):
    axis = V(b) - V(a)
    rings = [limb_ring(along(a, b, t), axis, hw, f, bk, n, square) for t, hw, f, bk in sections]
    part.loft(rings, material)


# ---------------------------------------------------------------- parts

def build_head(parts, detail):
    parent = 'head' if detail else None
    pivot = NECK if detail else ORIGIN
    if detail:
        parts.append(Empty('head', 'head', NECK, 'chest'))
    hood = Part('hood', 'head', pivot, parent)
    rings = [hood_section(*s) for s in HOOD]
    verts = hood.loft(rings, 'suit', close=False, caps=(False, False))
    hood.fan(verts[-1], HOOD_PEAK, 'suit')
    hood.weld = True
    hood.solidify = HOOD_SHELL
    parts.append(hood)

    # Accent strips on the rim of the face opening (10-part-hood-visor), turned 45° outward so
    # they read from the front and in profile (brief D4 note on the side view).
    trim = Part('hood_trim', 'head', pivot, parent)
    rim = [(y, gap, z_front) for y, _, _, _, z_front, gap, _ in HOOD if 1.83 <= y <= 1.98] + [(2.0, 0.10, 0.205)]
    for side in (-1, 1):
        path = [(side * (gap + 0.010), y, z_front - 0.010) for y, gap, z_front in rim]
        trim.strap(path, [(side * 0.7, 0.0, 0.7)] * len(path), 'tint_light', STRIP, 0.010)
    parts.append(trim)

    face = Part('face_plate', 'head', pivot, parent)
    face.loft([ring(y, hw, f, 0.02, 12, square=1.6) for y, hw, f in FACE], 'faceplate')
    parts.append(face)

    visor = Part('visor', 'head', pivot, parent)
    z = face_front(VISOR_BAR_Y, 0.0) + 0.004
    for side in (-1, 1):  # the bar's halves follow the plate's central ridge
        end = (side * VISOR_BAR_HALF, VISOR_BAR_Y - 0.008, face_front(VISOR_BAR_Y, side * VISOR_BAR_HALF) + 0.004)
        visor.slab((0.0, VISOR_BAR_Y, z), end, (0.0, 0.0, 1.0), 0.022, 0.010, 'tint_light')
    top = (0.0, VISOR_BAR_Y - 0.011, z)
    bottom = (0.0, VISOR_STEM_BOTTOM, face_front(VISOR_STEM_BOTTOM, 0.0) + 0.004)
    visor.slab(top, bottom, (0.0, 0.0, 1.0), STRIP, 0.010, 'tint_light')
    parts.append(visor)


def face_front(y, x):
    """Front surface z of the face plate at (x, y), from the FACE sections."""
    for (y0, hw0, f0), (y1, hw1, f1) in zip(FACE, FACE[1:]):
        if y0 <= y <= y1:
            t = (y - y0) / (y1 - y0)
            hw, front = hw0 + (hw1 - hw0) * t, f0 + (f1 - f0) * t
            s = min(1.0, abs(x) / hw) ** (1 / 1.25)  # square 1.6 -> e = 1.25
            return front * (1 - s * s) ** (1.25 / 2)
    raise ValueError(y)


def torso_front(y):
    for (y0, _, f0, _), (y1, _, f1, _) in zip(TORSO, TORSO[1:]):
        if y0 <= y <= y1:
            return f0 + (f1 - f0) * (y - y0) / (y1 - y0)
    raise ValueError(y)


def build_torso(parts, detail):
    torso = Part('torso', 'spine', SPINE if detail else ORIGIN, 'pelvis' if detail else None)
    torso.loft([ring(y, hw, f, b, 16, square=3.0) for y, hw, f, b in TORSO], 'suit')
    parts.append(torso)
    if detail:
        parts.append(Empty('chest', 'chest', CHEST, 'torso'))
    plates = Part('chest_plates', 'chest', CHEST if detail else ORIGIN, 'chest' if detail else None)
    t = math.radians(8)  # chest plates, 1.52-1.71 m, x 0.02-0.19 m, top edge forward at the collar (02)
    plate_axes = ((1, 0, 0), (0, math.cos(t), -math.sin(t)), (0, math.sin(t), math.cos(t)))
    for side in (-1, 1):
        plates.box((side * 0.105, 1.615, 0.148), plate_axes, (0.085, 0.100, 0.016), 'armour')
    plates.box((0.0, 1.59, 0.152), plate_axes, (0.017, 0.02, 0.006), 'tint_light')  # sternum light between them
    parts.append(plates)


def build_harness(parts, detail):
    harness = Part('harness', 'chest', CHEST if detail else ORIGIN, 'chest' if detail else None)
    # Diagonal strap from the right hip over the left chest plate and the left shoulder into the
    # back plate's upper corner; nothing crosses the back (01, 03; brief decision 6).
    # Over the shoulder it runs under the hood's hem and the top plate, as in 01.
    path = [(-0.165, 1.33, 0.108), (-0.12, 1.40, 0.165), (-0.03, 1.49, 0.173), (0.10, 1.625, 0.168),
            (0.175, 1.705, 0.125), (0.198, 1.742, 0.050), (0.203, 1.748, -0.040), (0.192, 1.732, -0.105),
            (0.168, 1.712, -0.140), (0.135, 1.688, -0.168)]
    normals = [(-0.7, 0, 0.7), (-0.2, 0, 1), (0, 0, 1), (0, 0.3, 1), (0.2, 0.5, 0.8), (0.3, 0.9, 0.3),
               (0.3, 1, -0.2), (0.3, 0.7, -0.6), (0.3, 0.3, -0.9), (0.1, 0.2, -1)]
    harness.strap(path, normals, 'armour', 0.06, 0.010)
    harness.loft([ring(y, hw, d, d, 12, square=4.0, cz=cz) for y, hw, cz, d in BACK_PLATE], 'armour')
    harness.box((0.0, 1.565, -0.264), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (STRIP / 2, 0.06, 0.004), 'tint_light')
    parts.append(harness)


def build_pelvis(parts, detail):
    pelvis = Part('pelvis', 'hips', HIPS if detail else ORIGIN, None)
    pelvis.loft([ring(y, hw, f, b, 16, square=2.6) for y, hw, f, b in PELVIS], 'suit')
    parts.append(pelvis)


def build_belt(parts, detail):
    belt = Part('belt', 'hips', HIPS if detail else ORIGIN, 'pelvis' if detail else None)
    belt.loft([ring(y, 0.214, 0.180, 0.165, 16, square=3.0) for y in (1.195, 1.262)], 'armour')
    I = ((1, 0, 0), (0, 1, 0), (0, 0, 1))
    belt.box((0.0, 1.228, 0.188), I, (0.045, 0.03, 0.012), 'armour')  # buckle
    parts.append(belt)
    pouches = Part('pouches', 'hips', HIPS if detail else ORIGIN, 'pelvis' if detail else None)
    for side in (-1, 1):  # front pouches hang below the belt (01, 02)
        pouches.box((side * 0.115, 1.180, 0.180), I, (0.036, 0.085, 0.026), 'armour')
        a = side * math.radians(38)
        pouches.box((side * 0.185, 1.175, 0.140), ((math.cos(a), 0, -math.sin(a)), (0, 1, 0), (math.sin(a), 0, math.cos(a))),
                    (0.038, 0.075, 0.032), 'armour')
        pouches.box((side * 0.120, 1.190, -0.162), I, (0.042, 0.065, 0.012), 'armour')  # rear pouches, flat (03)
    pouches.box((-0.115, 1.185, 0.210), I, (0.008, 0.050, 0.004), 'tint_light')  # strip on the right front pouch
    parts.append(pouches)


def build_arm(parts, detail, side):
    tag = '.R' if side < 0 else '.L'
    sh, el, wr, he, kn, th, te = (mirror(p, side) for p in (SHOULDER, ELBOW, WRIST, HAND_END, KNUCKLE, THUMB, THUMB_END))
    origin = ORIGIN
    upper = Part('upper_arm' + tag, 'upper_arm' + tag, sh if detail else origin, 'chest' if detail else None)
    limb(upper, sh, el, UPPER_ARM, 'suit')
    parts.append(upper)

    # Two plates per shoulder, both on the upper arm for now; the rig pass may bind the top
    # plate partly to the chest so a raised arm does not push it into the hood.
    plate = Part('shoulder_plate' + tag, 'upper_arm' + tag, sh if detail else origin, upper.name if detail else None)
    slope = math.radians(28)  # top plate: from the trapezius at 1.78 m down to 0.29 m out at 1.70 m (01)
    u = (side * math.cos(slope), -math.sin(slope), 0.0)  # outward and down
    v = (side * math.sin(slope), math.cos(slope), 0.0)
    w = (0.0, 0.0, 1.0)
    top = V((side * 0.225, 1.728, sh[2] - 0.015))
    plate.box(tuple(top), (u, v, w), (0.062, 0.024, 0.105), 'armour')
    plate.box(tuple(top + V(u) * 0.03 + V(v) * 0.026 + V(w) * 0.07), (u, v, w), (0.030, 0.004, 0.030), 'tint_light')
    parts.append(plate)
    deltoid = Part('deltoid_plate' + tag, 'upper_arm' + tag, sh if detail else origin, upper.name if detail else None)
    d = (V(el) - V(sh)).normalized()
    out = outward(sh, el, side)
    centre = V(along(sh, el, 0.26)) + out * 0.070 + V((0.0, 0.0, -0.02))
    deltoid.box(tuple(centre), (d, out, w), (0.085, 0.018, 0.075), 'armour')  # 1.69-1.52 m
    deltoid.box(tuple(centre + out * 0.020), (d, out, w), (0.065, 0.004, 0.062), 'tint_light')  # red panel (02)
    parts.append(deltoid)

    fore = Part('forearm' + tag, 'forearm' + tag, el if detail else origin, upper.name if detail else None)
    limb(fore, el, wr, FOREARM, 'suit')
    parts.append(fore)

    fplate = Part('forearm_plate' + tag, 'forearm' + tag, el if detail else origin, fore.name if detail else None)
    d = (V(wr) - V(el)).normalized()
    out = outward(el, wr, side)
    centre = V(along(el, wr, 0.30)) + out * 0.058
    fplate.box(tuple(centre), (d, out, w), (0.085, 0.016, 0.056), 'armour')
    fplate.box(tuple(centre + out * 0.018), (d, out, w), (0.065, 0.004, STRIP / 2), 'tint_light')
    parts.append(fplate)

    # Palm facing the thigh: the back of the hand and its bar face outward, the thumb forward.
    glove = Part('glove' + tag, 'hand' + tag, wr if detail else origin, fore.name if detail else None)
    limb(glove, wr, he, GLOVE, 'suit', n=10, square=2.6)
    out = outward(wr, he, side)
    d = (V(he) - V(wr)).normalized()
    glove.box(tuple(V(along(wr, he, 0.40)) + out * 0.064), (d, out, w), (0.030, 0.004, 0.035), 'tint_light')  # glove bar
    parts.append(glove)
    fingers = Part('fingers' + tag, 'fingers' + tag, kn if detail else origin, glove.name if detail else None)
    limb(fingers, wr, he, FINGERS, 'suit', n=10, square=2.6)
    parts.append(fingers)
    thumb = Part('thumb' + tag, 'thumb' + tag, th if detail else origin, glove.name if detail else None)
    limb(thumb, th, te, THUMB_SECTIONS, 'suit', n=8, square=2.4)
    parts.append(thumb)
    if detail and side < 0:
        parts.append(Empty('weapon_socket', 'weapon_socket', SOCKET, glove.name))
        marker = Part('weapon_socket_marker', None, SOCKET, 'weapon_socket')
        marker.box((SOCKET[0], SOCKET[1], SOCKET[2] + 0.07), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (0.006, 0.006, 0.07), 'marker')
        marker.box((SOCKET[0], SOCKET[1] + 0.035, SOCKET[2]), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (0.004, 0.035, 0.004), 'marker')
        parts.append(marker)


def build_leg(parts, detail, side):
    tag = '.R' if side < 0 else '.L'
    hip, knee, ankle = (mirror(p, side) for p in (HIP, KNEE, ANKLE))
    origin = ORIGIN
    thigh = Part('thigh' + tag, 'thigh' + tag, hip if detail else origin, 'pelvis' if detail else None)
    limb(thigh, hip, knee, THIGH, 'suit', n=12, square=2.2)
    parts.append(thigh)
    if side < 0:  # holster on the right thigh (front view, image left)
        holster = Part('holster', 'thigh.R', hip if detail else origin, thigh.name if detail else None)
        d = (V(knee) - V(hip)).normalized()
        out = outward(hip, knee, side)
        centre = V(along(hip, knee, 0.25)) + out * 0.117
        holster.box(tuple(centre), (d, out, (0, 0, 1)), (0.12, 0.025, 0.06), 'armour')
        holster.box(tuple(centre + out * 0.027 + d * -0.02), (d, out, (0, 0, 1)), (0.07, 0.004, STRIP / 2), 'tint_light')
        parts.append(holster)

    shin = Part('shin' + tag, 'shin' + tag, knee if detail else origin, thigh.name if detail else None)
    limb(shin, knee, ankle, SHIN, 'suit', n=12, square=2.2)
    parts.append(shin)

    pad = Part('knee_plate' + tag, 'shin' + tag, knee if detail else origin, shin.name if detail else None)
    slope = (ankle[0] - knee[0]) / (ankle[1] - knee[1])  # x follows the shin line

    def x_at(y):
        return knee[0] + slope * (y - knee[1])

    pad.loft([ring(y, hw, dz, dz, 12, square=3.0, cx=x_at(y), cz=cz) for y, hw, cz, dz in KNEE_PLATE], 'armour')
    pad.box((x_at(0.49), 0.49, 0.121), ((1, 0, 0), (0, 1, 0), (0, 0, 1)), (0.05, 0.012, 0.005), 'tint_light')  # chevron
    parts.append(pad)

    shoe = Part('sneaker' + tag, 'foot' + tag, ankle if detail else origin, shin.name if detail else None)
    s, c = math.sin(TOE_OUT), math.cos(TOE_OUT)
    fwd = V((side * s, 0.0, c))  # toes turn outward
    lat = V((c, 0.0, -side * s))
    base = V((ankle[0], 0.0, ankle[2]))
    up = V((0.0, 1.0, 0.0))
    corners = ((-1, False), (1, False), (1, True), (-1, True))
    sole = [[tuple(base + fwd * f + lat * (hw * sx) + up * (toe_lift(f) + (SOLE_THICK if top else 0.0)))
             for sx, top in corners] for f, hw in SOLE_PLAN]
    shoe.loft(sole, 'tint_light')  # sole with a rounded, sprung toe
    sections = [[tuple(base + fwd * f + lat * (hw * sx * (0.85 if top else 1.0)) + up * (h if top else 0.03 + toe_lift(f)))
                 for sx, top in corners] for f, h, hw in SHOE]
    shoe.loft(sections, 'suit')  # upper, heel to toe
    shoe.box(tuple(base + fwd * 0.0075 + up * 0.2225), (lat, up, fwd), (0.052, 0.0225, 0.083), 'tint_light')  # ankle strap
    parts.append(shoe)


# ---------------------------------------------------------------- assembly and export

def srgb_to_linear(hex_rgb):
    out = []
    for i in (0, 2, 4):
        c = int(hex_rgb[i:i + 2], 16) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return out


def make_materials():
    made = {}
    for name, (hex_rgb, roughness, metallic, emission) in MATERIALS.items():
        m = bpy.data.materials.new(name)
        if m.node_tree is None:  # Blender 5 creates node materials; use_nodes goes in 6.0.
            m.use_nodes = True
        colour = (*srgb_to_linear(hex_rgb), 1.0)
        shader = m.node_tree.nodes['Principled BSDF']
        shader.inputs['Base Color'].default_value = colour
        shader.inputs['Roughness'].default_value = roughness
        shader.inputs['Metallic'].default_value = metallic
        if emission:
            shader.inputs['Emission Color'].default_value = colour
            shader.inputs['Emission Strength'].default_value = emission
        m.diffuse_color = colour
        made[name] = m
    return made


def orient_outward(bm, centre):
    """Open shells: make face normals point away from `centre` on average."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    c = B(centre)
    score = sum((f.calc_center_median() - c).dot(f.normal) for f in bm.faces)
    if score < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)


def assemble(nodes, stage):
    materials = make_materials()
    collection = bpy.context.scene.collection
    root = bpy.data.objects.new('seeker_hunter', None)
    root.empty_display_type = 'PLAIN_AXES'
    root['generator'] = 'scripts/characters/seeker_hunter.py'
    root['stage'] = stage
    collection.objects.link(root)
    made = {'seeker_hunter': (root, (0.0, 0.0, 0.0))}
    report = []
    for node in nodes:
        if isinstance(node, Empty):
            obj = bpy.data.objects.new(node.name, None)
            obj.empty_display_type = 'ARROWS'
            obj.empty_display_size = 0.08
        else:
            bm = node.bm
            if node.weld:
                bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
                orient_outward(bm, (0.0, 1.95, 0.0))
            else:
                bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            bmesh.ops.translate(bm, vec=-B(node.pivot), verts=bm.verts)
            mesh = bpy.data.meshes.new(node.name)
            bm.to_mesh(mesh)
            bm.free()
            for name in node.materials:
                mesh.materials.append(materials[name])
            obj = bpy.data.objects.new(node.name, mesh)
            if node.solidify:
                shell = obj.modifiers.new('shell', 'SOLIDIFY')
                shell.thickness = node.solidify
                shell.offset = -1.0
                shell.use_even_offset = True
        collection.objects.link(obj)
        parent, parent_pivot = made[node.parent or 'seeker_hunter']
        obj.parent = parent
        obj.location = B(node.pivot) - B(parent_pivot)
        if node.joint and stage == 'structure':
            obj['rigJoint'] = node.joint
        made[node.name] = (obj, node.pivot)
        report.append({'name': node.name, 'joint': node.joint if stage == 'structure' else None,
                       'parent': node.parent or 'seeker_hunter', 'empty': isinstance(node, Empty),
                       'pivot': [round(c, 4) for c in node.pivot]})
    return report


def build(stage):
    eb.empty_scene()
    bpy.context.preferences.filepaths.save_version = 0
    detail = stage == 'structure'
    nodes = []
    build_pelvis(nodes, detail)
    build_belt(nodes, detail)
    build_torso(nodes, detail)
    build_harness(nodes, detail)
    build_head(nodes, detail)
    for side in (-1, 1):
        build_arm(nodes, detail, side)
        build_leg(nodes, detail, side)
    return assemble(nodes, stage)


def check_export(glb, stage, report):
    """Re-import the preview GLB into an empty scene and check the contract it must keep."""
    eb.import_glb_copy(glb)
    meshes = eb.mesh_objects()
    bounds = eb.game_bounds(meshes)
    lo, hi = bounds['min'], bounds['max']
    failures = []
    height = hi[1] - lo[1]
    if abs(lo[1]) > 0.005:
        failures.append(f'lowest point {lo[1]} m, expected the soles at 0')
    if not 2.155 <= height <= 2.165:
        failures.append(f'height {height:.3f} m, expected the hood peak at 2.16 m')
    by_name = {o.name: o for o in meshes}
    face, harness = (eb.game_bounds([by_name[n]]) if n in by_name else None for n in ('face_plate', 'harness'))
    if not face or face['max'][2] < 0.12:
        failures.append(f'facing: the face plate must reach +0.12 m in +Z, got {face and face["max"][2]}')
    if not harness or harness['min'][2] > -0.2:
        failures.append(f'facing: the back plate must sit behind -0.2 m, got {harness and harness["min"][2]}')
    if abs(lo[0] + hi[0]) > 0.02:
        failures.append(f'not symmetric in x: {lo[0]} .. {hi[0]}')
    objects = bpy.context.scene.objects
    for obj in objects:  # character contract: no object rotation or scale left at export
        loc, rot, scale = obj.matrix_world.decompose()
        if rot.angle > 1e-4 or max(abs(s - 1.0) for s in scale) > 1e-4:
            failures.append(f'{obj.name} carries rotation or scale')
    if stage == 'structure':  # every node's origin must still sit on its joint after export
        for entry in report:
            obj = objects.get(entry['name'])
            if obj is None:
                failures.append(f"{entry['name']} missing from the GLB")
                continue
            where = eb.game_point(obj.matrix_world.translation)
            error = max(abs(a - b) for a, b in zip(where, entry['pivot']))
            if error > 0.001:
                failures.append(f"{entry['name']} origin {where} is {error:.4f} m off its joint")
        socket = objects.get('weapon_socket')
        if socket is None or socket.parent is None or socket.parent.name != 'glove.R':
            failures.append('weapon_socket must exist under glove.R')
    return {'stage': stage, 'meshObjects': len(meshes), 'triangles': eb.evaluated_triangles(meshes),
            'gameBounds': bounds, 'heightMetres': round(height, 4), 'failures': failures}


def main():
    options = args()
    out = Path(options.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)
    blend, glb = out / (NAME + '.blend'), out / (NAME + '-preview.glb')
    report = build(options.stage)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_animations=False, export_cameras=False,
                              export_lights=False, export_extras=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    triangles = {o.name: eb.evaluated_triangles([o]) for o in eb.mesh_objects()}
    for entry in report:
        entry['triangles'] = triangles.get(entry['name'])
    exported = check_export(glb, options.stage, report)
    manifest = {
        'id': NAME, 'generator': 'scripts/characters/seeker_hunter.py',
        'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'stage': options.stage, 'blender': bpy.app.version_string, 'units': 'metres',
        'runtimeUp': '+Y', 'facing': '+Z', 'blend': blend.name, 'previewGlb': glb.name,
        'glbBytes': glb.stat().st_size, 'parts': report, 'export': exported,
    }
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('SEEKER_HUNTER_BUILD ' + json.dumps({'stage': options.stage, 'triangles': exported['triangles'],
                                               'height': exported['heightMetres'],
                                               'failures': exported['failures']}))
    if exported['failures']:
        sys.exit(1)


main()
