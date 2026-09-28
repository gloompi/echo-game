"""Rig, skin weights and animation clips for hider-hoodie (passes 5 and 6).

Used by scripts/characters/hider_hoodie.py for its `rig` and `export` stages. Bones sit on
the joints of the structure pass and use the names of
.agents/skills/echo-3d-assets/references/character.md. Clips are in place: `root` never
moves, and the hips move only up, down and back. Every clip is keyed on every frame at
30 fps. Leg poses come from a two-bone IK solve, so a planted foot stays put between keys.

Angles are degrees in game space (+X the character's left, +Y up, +Z forward):
  pitch about +X: the torso leans forward; a limb hanging down swings back; a foot points
                  its toes down
  yaw about +Y:   turns toward the character's left
  roll about +Z:  tips toward the character's right (the right arm moves in; the left out)
Each bone's rotation is relative to its parent, expressed in these axes.
"""
import math

import bpy
from bpy_extras import anim_utils
from mathutils import Quaternion, Vector

FPS = 30
AX = {'x': Vector((1.0, 0.0, 0.0)), 'y': Vector((0.0, 0.0, 1.0)), 'z': Vector((0.0, -1.0, 0.0))}  # game axes


def B(p):
    """Game (x, y-up, z) to Blender (x, -z, y)."""
    return Vector((p[0], -p[2], p[1]))


def smooth(a, b, x):
    """0 at a, 1 at b, smoothstep between (a may be above b)."""
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def game_rotation(pitch=0.0, yaw=0.0, roll=0.0):
    """Blender-space quaternion for yaw @ pitch @ roll about the game axes (degrees)."""
    return (Quaternion(AX['y'], math.radians(yaw)) @ Quaternion(AX['x'], math.radians(pitch))
            @ Quaternion(AX['z'], math.radians(roll)))


# ---------------------------------------------------------------- skeleton

def bone_table(j):
    """(name, head, tail, parent) in game space, from the build's joint positions `j`."""
    table = [('root', (0.0, 0.0, 0.0), (0.0, 0.25, 0.0), None),
             ('hips', j['hips'], j['spine'], 'root'),
             ('spine', j['spine'], j['chest'], 'hips'),
             ('chest', j['chest'], j['neck_base'], 'spine'),
             ('neck', j['neck_base'], j['neck'], 'chest'),
             ('head', j['neck'], (0.0, 2.05, j['neck'][2]), 'neck')]
    for side, sign in (('R', 1), ('L', -1)):
        def m(p):
            return (p[0] * sign, p[1], p[2])  # the joint table is authored on the right (-X)
        table += [(f'upper_arm.{side}', m(j['shoulder']), m(j['elbow']), 'chest'),
                  (f'forearm.{side}', m(j['elbow']), m(j['wrist']), f'upper_arm.{side}'),
                  (f'hand.{side}', m(j['wrist']), m(j['hand_end']), f'forearm.{side}'),
                  (f'thigh.{side}', m(j['hip']), m(j['knee']), 'hips'),
                  (f'shin.{side}', m(j['knee']), m(j['ankle']), f'thigh.{side}'),
                  (f'foot.{side}', m(j['ankle']), m(j['toe']), f'shin.{side}')]
    return table


def create_armature(j, name):
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    for bone, head, tail, parent in bone_table(j):
        eb = data.edit_bones.new(bone)
        eb.head, eb.tail = B(head), B(tail)
        eb.roll = 0.0
        eb.use_deform = bone != 'root'
        if parent:
            eb.parent = data.edit_bones[parent]
            eb.use_connect = False
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


# ---------------------------------------------------------------- skin weights

def along(p, a, b):
    """Parameter t of point p projected on the segment a->b (0 at a, 1 at b)."""
    a, b, p = Vector(a), Vector(b), Vector(p)
    d = b - a
    return (p - a).dot(d) / d.length_squared


def upper_body(y):
    """Weights for the hoodie, harness and bag: spine below the ribs, chest above, and the
    collar partly on the neck, so that the straps and the hood's hem stay on the shoulders."""
    chest = smooth(1.28, 1.50, y)
    neck = chest * 0.5 * smooth(1.74, 1.80, y)
    return {'spine': 1.0 - chest, 'chest': chest - neck, 'neck': neck}


def part_weights(part, p, j):
    """{bone: weight} for a vertex at game position p on the named part."""
    x, y, _ = p
    side = 'L' if x > 0 else 'R'
    sign = -1 if side == 'L' else 1

    def m(q):
        return (q[0] * sign, q[1], q[2])

    if part in ('torso', 'bag'):
        return upper_body(y)
    if part in ('hood', 'mask'):
        # The hood's hem rests on the trapezius, and the mask's chin sits in the collar: both
        # follow the chest and neck at the bottom and turn with the head above 1.8 m.
        head = smooth(1.80, 1.92, y) if part == 'hood' else smooth(1.72, 1.80, y)
        out = {k: v * (1.0 - head) for k, v in upper_body(y).items()}
        out['head'] = head
        return out
    if part == 'cap':
        return {'head': 1.0}
    if part == 'joggers_hips':
        if x > 0.05 and y < 0.97:  # the cyan straps on the left hip hang onto the thigh
            thigh = smooth(0.97, 0.84, y)
            return {'hips': 1.0 - thigh, 'thigh.L': thigh}
        thigh = 0.5 * smooth(1.00, 0.91, y)  # the lower edge follows the thighs halfway
        return {'hips': 1.0 - thigh, f'thigh.{side}': thigh}
    name, _, _ = part.partition('.')
    if name == 'sleeve':
        t = along(p, m(j['shoulder']), m(j['elbow']))
        chest, fore = 0.5 * smooth(0.02, -0.18, t), 0.3 * smooth(0.9, 1.05, t)
        return {'chest': chest, f'upper_arm.{side}': 1.0 - chest - fore, f'forearm.{side}': fore}
    if name == 'forearm':
        t = along(p, m(j['elbow']), m(j['wrist']))
        upper, hand = 0.5 * smooth(0.04, -0.08, t), 0.3 * smooth(0.9, 1.02, t)
        return {f'upper_arm.{side}': upper, f'forearm.{side}': 1.0 - upper - hand, f'hand.{side}': hand}
    if name == 'glove':
        t = along(p, m(j['wrist']), m(j['knuckle']))
        fore = 0.3 * smooth(0.12, -0.05, t)
        return {f'forearm.{side}': fore, f'hand.{side}': 1.0 - fore}
    if name == 'joggers_thigh':
        t = along(p, m(j['hip']), m(j['knee']))
        hips, shin = 0.5 * smooth(0.05, -0.12, t), 0.4 * smooth(0.85, 1.0, t)
        return {'hips': hips, f'thigh.{side}': 1.0 - hips - shin, f'shin.{side}': shin}
    if name == 'joggers_shin':
        t = along(p, m(j['knee']), m(j['ankle']))
        thigh, foot = 0.5 * smooth(0.05, -0.10, t), 0.5 * smooth(0.82, 1.0, t)
        return {f'thigh.{side}': thigh, f'shin.{side}': 1.0 - thigh - foot, f'foot.{side}': foot}
    if name == 'sneaker':
        return {f'foot.{side}': 1.0}
    raise ValueError('no weights for part ' + part)


def skin(obj, part, j, arm):
    """Vertex groups from part_weights (at most 3 bones per vertex), an Armature modifier and
    the armature as parent. The mesh must already be in armature (world) space."""
    groups = {}
    for v in obj.data.vertices:
        w = obj.matrix_world @ v.co
        weights = {k: val for k, val in part_weights(part, (w.x, w.z, -w.y), j).items() if val > 0.01}
        total = sum(weights.values())
        for bone, val in weights.items():
            if bone not in groups:
                groups[bone] = obj.vertex_groups.new(name=bone)
            groups[bone].add([v.index], val / total, 'REPLACE')
    mod = obj.modifiers.new('armature', 'ARMATURE')
    mod.object = arm
    obj.parent = arm


# ---------------------------------------------------------------- posing

class Poser:
    """Turns game-space poses into pose-bone keys on the armature."""

    def __init__(self, arm, j):
        self.arm, self.j = arm, j
        self.previous = {}  # last keyed quaternion per bone in the current clip
        self.rest = {b.name: b.matrix_local.to_quaternion() for b in arm.data.bones}
        hip, knee, ankle = j['hip'], j['knee'], j['ankle']
        self.l1 = math.hypot(knee[1] - hip[1], knee[2] - hip[2])
        self.l2 = math.hypot(ankle[1] - knee[1], ankle[2] - knee[2])
        self.rest_thigh = math.atan2(knee[2] - hip[2], hip[1] - knee[1])  # from straight down, + forward
        self.rest_shin = math.atan2(ankle[2] - knee[2], knee[1] - ankle[1])

    def basis(self, bone, q):
        """Pose basis for a rotation q about the bone's head, given in armature axes."""
        r = self.rest[bone]
        return r.inverted() @ q @ r

    def leg(self, hips_y, hips_z, hips_pitch, ankle_y, ankle_z, foot_pitch):
        """Two-bone IK in the side plane: (thigh, shin, foot) pitches relative to their
        parents that put the ankle at (ankle_y, ankle_z) and the foot at foot_pitch (toes down
        positive, 0 flat). The knee bends forward."""
        hy, hz = self.j['hip'][1] + hips_y, self.j['hip'][2] + hips_z
        dy, dz = hy - ankle_y, ankle_z - hz
        d = math.hypot(dy, dz)
        if not abs(self.l1 - self.l2) < d <= self.l1 + self.l2:  # a clamped ankle would miss its mark
            raise ValueError(f'ankle target {d:.3f} m from the hip is out of the leg\'s reach')
        line = math.atan2(dz, dy)
        beta = math.acos(min(1.0, (self.l1 ** 2 + d * d - self.l2 ** 2) / (2 * self.l1 * d)))
        gamma = math.acos(min(1.0, (self.l2 ** 2 + d * d - self.l1 ** 2) / (2 * self.l2 * d)))
        thigh_abs = -math.degrees(line + beta - self.rest_thigh)
        shin_abs = -math.degrees(line - gamma - self.rest_shin)
        return thigh_abs - hips_pitch, shin_abs - thigh_abs, foot_pitch - shin_abs

    def apply(self, pose):
        """Set the pose bones for pose = {'hips': (dy, dz), 'rot': {bone: (pitch, yaw, roll)},
        'feet': {side: (ankle_y, ankle_z, foot_pitch)}} and return (pose bone, property) for
        each value set. Bones left out keep what they have."""
        rot = dict(pose.get('rot', {}))
        dy, dz = pose.get('hips', (0.0, 0.0))
        hips_pitch = rot.get('hips', (0.0, 0.0, 0.0))[0]
        for side, (ay, az, fp) in pose.get('feet', {}).items():
            ay = max(ay, sole_clearance(fp, self.j['sole']))  # no toe or heel below the ground
            t, s, f = self.leg(dy, dz, hips_pitch, ay, az, fp)
            rot[f'thigh.{side}'], rot[f'shin.{side}'], rot[f'foot.{side}'] = (t, 0, 0), (s, 0, 0), (f, 0, 0)
        bones, done = self.arm.pose.bones, []
        if 'hips' in pose or 'hips' in rot:
            bones['hips'].location = self.rest['hips'].inverted() @ B((0.0, dy, dz))
            done.append((bones['hips'], 'location'))
        for bone, (pitch, yaw, roll) in rot.items():
            pb = bones[bone]
            pb.rotation_mode = 'QUATERNION'
            pb.rotation_quaternion = self.basis(bone, game_rotation(pitch, yaw, roll))
            done.append((pb, 'rotation_quaternion'))
        return done

    def reset(self):
        """Rest pose, and a new clip: no previous keys to stay in a hemisphere with."""
        self.previous = {}
        for pb in self.arm.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)

    def key(self, frame, pose):
        for pb, path in self.apply(pose):
            if path == 'rotation_quaternion':
                # q and -q are the same rotation, but Blender interpolates keys per component:
                # a sign flip between neighbouring keys would spin the bone between frames.
                last = self.previous.get(pb.name)
                if last is not None and pb.rotation_quaternion.dot(last) < 0:
                    pb.rotation_quaternion = -pb.rotation_quaternion
                self.previous[pb.name] = pb.rotation_quaternion.copy()
            pb.keyframe_insert(path, frame=frame)


# ---------------------------------------------------------------- clips

def rest_feet(j):
    return {s: (j['ankle'][1], j['ankle'][2], 0.0) for s in ('R', 'L')}


def sole_clearance(pitch, sole):
    """Ankle height that keeps the lowest of the sole points (forward, up from the ankle)
    on the ground when the foot is pitched toes down by `pitch` degrees."""
    a = math.radians(pitch)
    return -min(up * math.cos(a) - fwd * math.sin(a) for fwd, up in sole)


def arms(r_pitch, l_pitch, r_roll, l_roll, r_fore, l_fore, r_yaw=0.0, l_yaw=0.0, hand=0.0):
    return {'upper_arm.R': (r_pitch, r_yaw, r_roll), 'upper_arm.L': (l_pitch, l_yaw, l_roll),
            'forearm.R': (r_fore, 0, 0), 'forearm.L': (l_fore, 0, 0),
            'hand.R': (hand, 0, 0), 'hand.L': (hand, 0, 0)}


def ease(t):
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def idle(f, n, j):
    p = 2 * math.pi * f / n
    b, s = math.sin(p), math.sin(p + 0.9)
    rot = {'hips': (0, 0, 0), 'spine': (0.6 * b, 0, 0), 'chest': (-1.2 * b, 0, 0.4 * s),
           'neck': (0.4 * s, 0, 0), 'head': (1.0 * s, 3.0 * math.sin(p + 2.0), 0.6 * b)}
    rot.update(arms(2 + 1.5 * b, 2 + 1.5 * b, -2 + 1.2 * b, 2 - 1.2 * b, -3 - 2 * b, -3 - 2 * b, hand=-4))
    return {'hips': (0.0, 0.0), 'rot': rot, 'feet': rest_feet(j)}


def _spline(keys, p):
    """Catmull-Rom through (phase, value...) keys at phase p (keys sorted, p inside)."""
    for i in range(len(keys) - 1):
        if keys[i][0] <= p <= keys[i + 1][0]:
            k0, k1, k2, k3 = keys[max(i - 1, 0)], keys[i], keys[i + 1], keys[min(i + 2, len(keys) - 1)]
            t = (p - k1[0]) / (k2[0] - k1[0])
            out = []
            for c in range(1, len(k1)):
                a, b0, c0, d = k0[c], k1[c], k2[c], k3[c]
                out.append(0.5 * ((2 * b0) + (-a + c0) * t + (2 * a - 5 * b0 + 4 * c0 - d) * t * t
                                  + (-a + 3 * b0 - 3 * c0 + d) * t ** 3))
            return out
    raise ValueError(p)


def stepping_foot(p, gait, ground, centre_z, ball):
    """Ankle (y, z, foot pitch) at phase p of a stepping cycle `gait` = (stance, roll, reach,
    back, roll_pitch, swing). Over the first `stance` share the foot is flat and moves back at
    constant speed from `reach` to `back` (metres in front of centre_z). Over the next `roll`
    share it pivots toes-down to roll_pitch on its ball (`ball`: forward, up from the ankle),
    and the ball keeps moving with the ground. Then it follows the `swing` keys (phase, z from
    the centre, y, pitch) back to the reach."""
    stance, roll, reach, back, roll_pitch, swing = gait
    speed = (back - reach) / stance
    if p <= stance:
        return ground, centre_z + reach + speed * p, 0.0

    def rolled(q):
        a = math.radians(roll_pitch * ease(q))
        f, h = -ball[0], -ball[1]  # the ankle seen from the ball: behind and above it
        ball_z = centre_z + back + ball[0] + speed * roll * q
        return ground + ball[1] + h * math.cos(a) - f * math.sin(a), ball_z + f * math.cos(a) + h * math.sin(a)

    if p <= stance + roll:
        y, z = rolled((p - stance) / roll)
        return y, z, roll_pitch * ease((p - stance) / roll)
    y0, z0 = rolled(1.0)
    keys = [(stance + roll, z0 - centre_z, y0, roll_pitch)] + swing + [(1.0, reach, ground, 0.0)]
    z, y, pitch = _spline(keys, p)
    return max(y, ground), centre_z + z, pitch


RUN_GAIT = (0.2, 0.08, 0.385, -0.385, 40.0,  # the first swing key lifts the toe before it travels
            [(0.32, -0.56, 0.36, 55.0), (0.42, -0.36, 0.50, 62.0), (0.56, 0.02, 0.48, 30.0),
             (0.74, 0.44, 0.30, -5.0), (0.84, 0.46, 0.24, -6.0), (0.93, 0.43, 0.17, -3.0)])  # lands at the frame


def run(f, n, j):
    """Run at 6.4 m/s (hiderSpeed): 0.6 s cycle; each foot is planted flat for 0.12 s while
    it moves 0.77 m back under the hips, then rolls onto its ball. The right foot lands at
    frame 0."""
    p = f / n
    feet = {}
    for side, q in (('R', p), ('L', (p + 0.5) % 1.0)):
        feet[side] = stepping_foot(q, RUN_GAIT, j['ankle'][1], j['hip'][2], j['ball'])
    c = math.cos(2 * math.pi * p)
    dy = -0.10 - 0.02 * math.cos(4 * math.pi * (p - 0.1))
    rot = {'hips': (0, 0, 0), 'spine': (10, 0, 0), 'chest': (2, -9 * c, 0), 'neck': (-4, 0, 0),
           'head': (-10, 7 * c, 0)}
    # A compact swing, biased back, with the hands turned in: big gloves on a wider swing
    # reach 0.7 m from the axis.
    rot.update(arms(14 + 20 * c, 14 - 20 * c, -6, 6, -105 + 10 * c, -105 - 10 * c, 12, -12, hand=-8))
    return {'hips': (dy, 0.0), 'rot': rot, 'feet': feet}


# Crouch (brief, Crouch at 1.12 m): hips low and pushed back behind the heels, the lean spread
# over pelvis, spine and chest, the head tucked so that the hood stays under 1.12 m; right foot
# ahead, left foot back on its toes. Pitches: pelvis, spine, chest, neck, head.
CROUCH = {'hips': (-0.63, -0.40), 'rot': (20, 25, 20, 10, 15), 'stagger': 0.125, 'rear_pitch': 30.0}


def crouch_body(breath=0.0, look=0.0, arm_swing=0.0):
    """The arms hang just outside the knees: in this crouch the folded legs fill the space
    under the shoulders, and arms hanging closer pass through the thighs and shins."""
    hp, sp, ch, nk, hd = CROUCH['rot']
    rot = {'hips': (hp, 0, 0), 'spine': (sp + 0.6 * breath, 0, 0), 'chest': (ch - 1.2 * breath, 0, 0),
           'neck': (nk, 0, 0), 'head': (hd, look, 0)}
    rot.update(arms(-56 + arm_swing, -56 - arm_swing, -20, 20, -20, -20, hand=-10))
    return rot


def crouch_feet(j):
    y, z = j['ankle'][1], j['ankle'][2]
    return {'R': (y, z + CROUCH['stagger'], 0.0), 'L': (y, z - CROUCH['stagger'], CROUCH['rear_pitch'])}


def crouch_idle(f, n, j):
    p = 2 * math.pi * f / n
    return {'hips': CROUCH['hips'], 'rot': crouch_body(math.sin(p), 6 * math.sin(p + 1.0)), 'feet': crouch_feet(j)}


CROUCH_GAIT = (0.5, 0.06, 0.36, -0.36, 20.0,  # low hips: a small roll and a low swing keep the knee up
               [(0.64, -0.32, 0.23, 12.0), (0.76, -0.02, 0.22, 5.0), (0.88, 0.25, 0.16, -2.0),
                (0.95, 0.34, 0.15, -2.0)])


def crouch_walk(f, n, j):
    """Crouched run at 2.88 m/s (hiderSpeed x crouchMultiplier): 0.5 s cycle; each foot is
    planted flat for half the cycle while it moves 0.72 m back, under the body rather than
    under the pushed-back hips, then rolls onto its ball."""
    p = f / n
    feet = {}
    for side, q in (('R', p), ('L', (p + 0.5) % 1.0)):
        feet[side] = stepping_foot(q, CROUCH_GAIT, j['ankle'][1], j['ankle'][2] - 0.05, j['ball'])
    dy, dz = CROUCH['hips']
    dy += 0.012 * math.cos(4 * math.pi * p)
    return {'hips': (dy, dz), 'rot': crouch_body(arm_swing=6 * math.cos(2 * math.pi * p)), 'feet': feet}


JUMP_START = {'spine': (4, 0, 0), 'chest': (-2, 0, 0), 'neck': (0, 0, 0), 'head': (-6, 0, 0),
              **arms(0, 10, -6, 6, -50, -30, hand=-5)}
JUMP_HOLD = {'spine': (8, 0, 0), 'chest': (-4, 0, 0), 'neck': (0, 0, 0), 'head': (-8, 0, 0),
             **arms(10, 0, -10, 10, -80, -50, hand=-8)}


def jump(f, n, j):
    """Airborne: from the take-off stretch to a knee tuck, held on the last frame. The feet
    are placed by IK and never go below the root."""
    t = ease(f / n)
    z = j['ankle'][2]
    start = {'R': (0.20, z + 0.10, 20.0), 'L': (0.18, z - 0.22, 45.0)}
    hold = {'R': (0.52, z + 0.16, 25.0), 'L': (0.40, z - 0.28, 35.0)}
    rot = {b: mix(JUMP_START[b], JUMP_HOLD[b], t) for b in JUMP_HOLD}
    rot['hips'] = (0, 0, 0)
    return {'hips': (0.0, 0.0), 'rot': rot, 'feet': {s: mix(start[s], hold[s], t) for s in start}}


# Slide (character.md: low, forward-leaning, within 1.12 m): from the crouch, the right foot
# slides ahead on its heel and the left knee drops behind with the foot on its toes.
SLIDE = {'hips': (-0.64, -0.40), 'rot': (18, 27, 22, 10, 12), 'front': (0.36, -15.0), 'rear': (-0.38, 40.0)}


def slide(f, n, j):
    """Settles from the crouch into the slide pose in 0.4 s, then holds."""
    t = ease(f / n)
    base = crouch_body()
    rot = {b: (base[b][0] + (a - base[b][0]) * t, 0, 0)
           for b, a in zip(('hips', 'spine', 'chest', 'neck', 'head'), SLIDE['rot'])}
    target = arms(-56, -62, -20, 12, -20, -20, hand=-6)  # outside the knees, as in the crouch
    rot.update({b: mix(base[b], target[b], t) for b in target})
    y, z = j['ankle'][1], j['ankle'][2]
    start = crouch_feet(j)
    feet = {'R': mix(start['R'], (y, z + SLIDE['front'][0], SLIDE['front'][1]), t),
            'L': mix(start['L'], (y, z + SLIDE['rear'][0], SLIDE['rear'][1]), t)}
    return {'hips': mix(CROUCH['hips'], SLIDE['hips'], t), 'rot': rot, 'feet': feet}


HIT_PEAK = {'spine': (-5, 0, 0), 'chest': (-6, 3, 0), 'neck': (-3, 0, 0), 'head': (-8, -5, 3),
            **arms(10, 10, -6, 6, -22, -22, hand=8)}


def hit(f, n, j):
    """0.43 s flinch (runtime hit window 0.42 s): snaps back by frame 3, recovers to the
    idle pose. Feet stay planted."""
    t = f / n
    k = ease(min(t / 0.23, 1.0)) if t < 0.23 else 1.0 - ease((t - 0.23) / 0.77)
    base = idle(0, 1, j)
    # A fixed bone order: the keys' order becomes the exported channel order (a set's order
    # changes from run to run, and so would the GLB).
    bones = list(base['rot']) + [b for b in HIT_PEAK if b not in base['rot']]
    rot = {b: mix(base['rot'].get(b, (0, 0, 0)), HIT_PEAK.get(b, base['rot'].get(b, (0, 0, 0))), k)
           for b in bones}
    return {'hips': (-0.008 * k, -0.03 * k), 'rot': rot, 'feet': rest_feet(j)}


def wave(f, n, j):
    """Right arm raised and waving twice a second; upper body only, so it can play over the
    idle or run of the legs."""
    p = 2 * math.pi * f / n
    w = math.sin(2 * p)
    rot = {'spine': (0, 0, 1.5), 'chest': (0, 3, 2.5), 'neck': (0, 0, 0), 'head': (-4, 6, 4 + 1.5 * w)}
    rot.update(arms(-18, -2, -130, 0, -48 + 4 * w, -9, hand=0))
    rot['forearm.R'] = (-48 + 4 * w, 0, 16 * w)
    rot['hand.R'] = (-6, 0, 14 * w)
    return {'rot': rot}


# name: (function, frames, loops)
CLIPS = {
    'idle': (idle, 72, True),
    'run': (run, 18, True),
    'jump': (jump, 12, False),
    'crouch_idle': (crouch_idle, 60, True),
    'crouch_walk': (crouch_walk, 15, True),
    'slide': (slide, 12, False),
    'hit': (hit, 13, False),
    'wave': (wave, 30, True),
}


def make_clips(arm, j):
    """One action per clip, keyed on every frame (the last frame repeats the first for loops),
    frame range and fps stored on the action, fake user so that unassigned actions persist."""
    scene = bpy.context.scene
    scene.render.fps, scene.render.fps_base = FPS, 1.0
    poser = Poser(arm, j)
    if arm.animation_data is None:
        arm.animation_data_create()
    made = {}
    for name, (fn, frames, loops) in CLIPS.items():
        action = bpy.data.actions.new(name)
        action.use_fake_user = True
        slot = action.slots.new(id_type='OBJECT', name=arm.name)
        arm.animation_data.action = action
        arm.animation_data.action_slot = slot
        poser.reset()  # every clip starts from the rest pose
        for f in range(frames + 1):
            poser.key(f, fn(f % frames if loops else f, frames, j))
        # Keys on every frame, joined linearly: the GLB is sampled per frame and played back
        # with linear interpolation, so Blender shows what the game will. (Python keyframe
        # inserts ignore the new-key interpolation preference, so it is set on the keys.)
        for curve in anim_utils.action_get_channelbag_for_slot(action, slot).fcurves:
            for point in curve.keyframe_points:
                point.interpolation = 'LINEAR'
        action.use_frame_range = True
        action.frame_start, action.frame_end = 0, frames
        action.use_cyclic = loops
        action['fps'] = FPS
        action['loop'] = loops
        made[name] = {'frames': frames, 'seconds': round(frames / FPS, 4), 'loop': loops}
    arm.animation_data.action = None
    poser.reset()
    return made
