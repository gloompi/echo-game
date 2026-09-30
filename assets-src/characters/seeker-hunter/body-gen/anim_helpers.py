# Posing helpers for the seeker-hunter clips, exec'd inside Blender by each live MCP call.
# Rotations are deltas relative to the parent, around rest-pose armature axes
# (X = pitch, character faces -Y; +angle about X swings a hanging limb backwards).
import bpy, math
from mathutils import Matrix, Quaternion, Vector

RIG = bpy.data.objects["seeker_rig"]
FPS = 30
S = RIG.scale.x  # armature units -> metres; all public arguments are metres


def rest_q(name):
    return RIG.data.bones[name].matrix_local.to_quaternion()


def rot(name, axis, deg):
    """Local quaternion for a rotation of `deg` about armature axis `axis` (relative to parent)."""
    r = rest_q(name)
    return r.inverted() @ Quaternion(Vector(axis), math.radians(deg)) @ r


def combine(name, *rots):
    q = Quaternion()
    for axis, deg in rots:
        q = rot(name, axis, deg) @ q
    return q


def _pitch_of(v):
    # angle of a (y, z) vector measured from straight down (-Z), positive toward +Y
    return math.atan2(v.y, -v.z)


def leg_ik(side, hips_drop, hips_pitch, ankle_y=0.0, ankle_z=None, hips_back=0.0):
    """Sagittal two-bone IK: pitch angles (deg) for thigh, shin, foot so the ankle lands at
    its rest height (raised by ankle_z) offset by ankle_y, after the hips move down by hips_drop and
    pitch by hips_pitch degrees (about X, around the hips head)."""
    b = RIG.data.bones
    th, sh, ft = b[f"thigh.{side}"], b[f"shin.{side}"], b[f"foot.{side}"]
    hips_head = b["hips"].head_local
    hip = th.head_local - hips_head
    hip = Quaternion((1, 0, 0), math.radians(hips_pitch)) @ hip + hips_head
    hip = hip - Vector((0, -hips_back / S, hips_drop / S))
    ankle = sh.tail_local.copy()
    ankle.y += ankle_y / S
    if ankle_z is not None:
        ankle.z += ankle_z / S  # lift above the rest ankle height
    l1 = (th.tail_local - th.head_local).length
    l2 = (sh.tail_local - sh.head_local).length
    d = ankle - hip
    dist = min(math.hypot(d.y, d.z), l1 + l2 - 1e-4)
    base = math.atan2(d.y, -d.z)
    # knee forward (-Y): thigh swings toward -Y by the triangle angle
    a1 = math.acos(max(-1, min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))))
    a2 = math.acos(max(-1, min(1, (l1 * l1 + l2 * l2 - dist * dist) / (2 * l1 * l2))))
    thigh_world = base - a1
    shin_world = thigh_world + (math.pi - a2)
    rest_th = _pitch_of(th.tail_local - th.head_local)
    rest_sh = _pitch_of(sh.tail_local - sh.head_local)
    # rotation about +X maps "down" toward +Y for positive angles
    t = math.degrees(thigh_world - rest_th) - hips_pitch
    s = math.degrees(shin_world - rest_sh) - math.degrees(thigh_world - rest_th)
    f = -(hips_pitch + t + s)
    return t, s, f


_LAST_KEYS = {}


def new_clip(name, frames):
    act = bpy.data.actions.get(name)
    if act:
        bpy.data.actions.remove(act)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    _LAST_KEYS.pop(name, None)
    RIG.animation_data_create()
    RIG.animation_data.action = act
    act.use_frame_range = True
    act.frame_range = (1, frames)
    for pb in RIG.pose.bones:
        pb.rotation_mode = "QUATERNION"
    s = bpy.context.scene
    s.render.fps = FPS
    s.frame_start, s.frame_end = 1, frames
    return act


def key(frame, pose, root_loc=None, hips_loc=None):
    """pose: {bone: Quaternion}. Unlisted bones are keyed at rest so clips never inherit."""
    act = RIG.animation_data.action
    last = _LAST_KEYS.setdefault(act.name, {})
    for pb in RIG.pose.bones:
        q = pose.get(pb.name, Quaternion()).normalized()
        prev = last.get(pb.name)
        if prev is not None and prev.dot(q) < 0:
            q.negate()  # same hemisphere as the previous key, so interpolation takes the short way
        last[pb.name] = q.copy()
        pb.rotation_quaternion = q
        pb.scale = (1, 1, 1)
        pb.keyframe_insert("rotation_quaternion", frame=frame)
    hb = RIG.pose.bones["hips"]
    hb.location = hips_loc or (0, 0, 0)
    hb.keyframe_insert("location", frame=frame)
    rb = RIG.pose.bones["root"]
    rb.location = root_loc or (0, 0, 0)
    rb.keyframe_insert("location", frame=frame)


def hips_offset(drop, fwd=0.0):
    """Armature-space translation of the hips as a local location vector for the hips bone."""
    m = RIG.data.bones["hips"].matrix_local.to_3x3().inverted()
    return m @ Vector((0, fwd / S, -drop / S))


def mesh_top():
    """Highest point of the deformed body (world z)."""
    ob = bpy.data.objects["seeker_body.rigged"]
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mw = ob.matrix_world
    return max((mw @ v.co).z for v in ev.data.vertices)


X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def crouch(drop, lean, sp, b=0.0, stepL=0.0, stepR=0.0, liftL=None, liftR=None, arm=0.0, back=0.0):
    """Crouch pose that fits the 1.12 m clearance at drop 0.72, lean 45, sp 16 (hood 1.106 m)."""
    # back: shift hips and feet together toward +Y so the leaning body stays over the origin;
    # key the hips with hips_offset(drop, fwd=back)
    tl, sl, fl = leg_ik("L", drop, lean, ankle_y=stepL + back, ankle_z=liftL, hips_back=back)
    tr, sr, fr = leg_ik("R", drop, lean, ankle_y=stepR + back, ankle_z=liftR, hips_back=back)
    return {
        "hips": rot("hips", X, lean),
        "spine": rot("spine", X, sp + b), "chest": rot("chest", X, sp * 0.8), "chest.upper": rot("chest.upper", X, 6),
        "neck": rot("neck", X, -(lean + sp * 1.8) * 0.45), "head": rot("head", X, -(lean + sp * 1.8) * 0.35),
        "thigh.L": combine("thigh.L", (X, tl), (Y, -8)), "shin.L": rot("shin.L", X, sl), "foot.L": rot("foot.L", X, fl),
        "thigh.R": combine("thigh.R", (X, tr), (Y, 8)), "shin.R": rot("shin.R", X, sr), "foot.R": rot("foot.R", X, fr),
        "upper_arm.L": combine("upper_arm.L", (Y, 24), (X, 22 + arm)), "upper_arm.R": combine("upper_arm.R", (Y, -24), (X, 22 - arm)),
        "forearm.L": rot("forearm.L", X, -45), "forearm.R": rot("forearm.R", X, -45),
    }


def body_extent(frames):
    """(frame, top z, lowest z) of the deformed body for each frame."""
    ob = bpy.data.objects["seeker_body.rigged"]
    out = []
    for f in frames:
        bpy.context.scene.frame_set(f)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        zs = [(ob.matrix_world @ v.co).z for v in ev.data.vertices]
        xs = [(ob.matrix_world @ v.co).x for v in ev.data.vertices]
        ys = [(ob.matrix_world @ v.co).y for v in ev.data.vertices]
        out.append((f, round(max(zs), 3), round(min(zs), 3),
                    round((min(xs) + max(xs)) / 2, 3), round((min(ys) + max(ys)) / 2, 3)))
    return out


def point_bone(name, world_dir):
    """Rotate a pose bone (after its parents are posed) so its Y axis points along world_dir."""
    pb = RIG.pose.bones[name]
    pb.rotation_quaternion = Quaternion()
    bpy.context.view_layer.update()
    m = pb.matrix.copy()
    cur = m.to_3x3().col[1].normalized()
    d = cur.rotation_difference(Vector(world_dir).normalized())
    new = (d.to_matrix() @ m.to_3x3()).to_4x4()
    new.translation = m.translation
    pb.matrix = new
    pb.scale = (1, 1, 1)  # setting .matrix can leak a tiny scale; keep bones unscaled
    pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return pb.rotation_quaternion.copy()


def twist_bone_to(name, child, want_z):
    """Roll `name` about its own Y axis so that `child`'s Z axis best matches world want_z."""
    import math as _m
    pb = RIG.pose.bones[name]
    base = pb.rotation_quaternion.copy()
    best = None
    for deg in range(-180, 180, 5):
        pb.rotation_quaternion = base @ Quaternion((0, 1, 0), _m.radians(deg))
        bpy.context.view_layer.update()
        z = (RIG.pose.bones[child].matrix.to_3x3().col[2]).normalized()
        sc = z.dot(Vector(want_z).normalized())
        if best is None or sc > best[0]:
            best = (sc, deg)
    pb.rotation_quaternion = base @ Quaternion((0, 1, 0), _m.radians(best[1]))
    bpy.context.view_layer.update()
    return pb.rotation_quaternion.copy(), best[0]


def set_bone_frame(name, x_axis, y_axis):
    """Orient a pose bone so its local X/Y axes point along world x_axis/y_axis (Y wins; X is orthogonalised)."""
    pb = RIG.pose.bones[name]
    pb.rotation_quaternion = Quaternion()
    bpy.context.view_layer.update()
    y = Vector(y_axis).normalized()
    x = (Vector(x_axis) - y * Vector(x_axis).dot(y)).normalized()
    z = x.cross(y)
    m = pb.matrix.copy()
    new = Matrix((x, y, z)).transposed().to_4x4()
    new.translation = m.translation
    pb.matrix = new
    pb.scale = (1, 1, 1)
    pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return pb.rotation_quaternion.copy()


def wrist_bend(side):
    """Angle in degrees between forearm and hand directions."""
    fa, ha = RIG.pose.bones[f"forearm.{side}"], RIG.pose.bones[f"hand.{side}"]
    return math.degrees(fa.matrix.to_3x3().col[1].angle(ha.matrix.to_3x3().col[1]))


def world_head(name):
    return RIG.matrix_world @ RIG.pose.bones[name].head


# ---- Two-handed weapon hold (Seeker always carries the blaster) ----
BLASTER_SCALE = 0.47  # client/models.ts renders makeWeapon() at 0.47
GRIP_UP = 0.29 * BLASTER_SCALE  # blaster origin sits this far above the grip centre
FOREGRIP = 0.53 * BLASTER_SCALE  # (old procedural blaster, kept for reference)
SUPPORT_FWD, SUPPORT_UP = 0.31, 0.03
MAX_WRIST = 40  # degrees between forearm and hand; beyond this a wrist reads as broken  # shared weapon layout: front-grip contact relative to the grip


def _apply(pose, hips_loc=None):
    for pb in RIG.pose.bones:
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = pose.get(pb.name, Quaternion())
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    if hips_loc is not None:
        RIG.pose.bones["hips"].location = hips_loc
    bpy.context.view_layer.update()


def _world(pb):
    return RIG.matrix_world @ pb.matrix


def arm_ik(side, wrist, pole):
    """Point upper_arm/forearm so the wrist reaches `wrist` (world), elbow toward `pole`."""
    ua, fa = RIG.pose.bones[f"upper_arm.{side}"], RIG.pose.bones[f"forearm.{side}"]
    s = world_head(f"upper_arm.{side}")
    l1 = ((RIG.matrix_world @ ua.tail) - s).length
    l2 = ((RIG.matrix_world @ fa.tail) - (RIG.matrix_world @ fa.head)).length
    d = wrist - s
    dist = min(d.length, l1 + l2 - 1e-4)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
    h = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = Vector(pole) - dn * Vector(pole).dot(dn)
    elbow = s + dn * a + pv.normalized() * h
    q1 = point_bone(f"upper_arm.{side}", elbow - s)
    q2 = point_bone(f"forearm.{side}", wrist - world_head(f"forearm.{side}"))
    return q1, q2


def _align_socket(fwd, up):
    hb = RIG.pose.bones["hand.R"]
    hb.rotation_quaternion = Quaternion()
    bpy.context.view_layer.update()
    sm = (RIG.matrix_world.to_3x3().normalized() @ RIG.pose.bones["weapon_socket"].matrix.to_3x3()).normalized()
    d1 = sm.col[2].normalized().rotation_difference(fwd)
    y = (d1.to_matrix() @ sm.col[1]).normalized()
    yp = (y - fwd * y.dot(fwd)).normalized()
    upp = (up - fwd * up.dot(fwd)).normalized()
    ang = math.atan2(yp.cross(upp).dot(fwd), yp.dot(upp))
    D = Quaternion(fwd, ang) @ d1
    m = hb.matrix.copy()
    new = (D.to_matrix() @ m.to_3x3()).to_4x4()
    new.translation = m.translation
    hb.matrix = new
    hb.scale = (1, 1, 1)
    hb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    return hb.rotation_quaternion.copy()


def hold_weapon(pose, grip, fwd, hips_loc=None, anchor="chest.upper", fwd_world=False):
    """Add both arms to `pose` so the right hand holds the blaster grip and the left hand
    supports its foregrip. grip (metres) and fwd are given in the anchor bone's REST
    orientation relative to its head, so the weapon follows the torso in every clip."""
    pose = {k: v for k, v in pose.items() if not k.split(".")[0] in ("upper_arm", "forearm", "hand")}
    _apply(pose, hips_loc)
    ab = RIG.pose.bones[anchor]
    rest = (RIG.matrix_world.to_3x3().normalized() @ RIG.data.bones[anchor].matrix_local.to_3x3()).normalized()
    now = (RIG.matrix_world.to_3x3().normalized() @ ab.matrix.to_3x3()).normalized()
    R = now @ rest.inverted()
    head = RIG.matrix_world @ ab.head
    G = head + R @ Vector(grip)
    F = Vector(fwd).normalized() if fwd_world else (R @ Vector(fwd)).normalized()
    up = (Vector((0, 0, 1)) - F * F.dot(Vector((0, 0, 1)))).normalized()
    # right hand: iterate so weapon_socket lands on the grip
    w = G.copy()
    for _ in range(4):
        q1, q2 = arm_ik("R", w, (-0.7, 0.3, -0.6))
        qh = _align_socket(F, up)
        sk = RIG.matrix_world @ RIG.pose.bones["weapon_socket"].head
        w += G - sk
    pose["upper_arm.R"], pose["forearm.R"], pose["hand.R"] = q1, q2, qh
    # left hand: palm under the foregrip, fingers wrapping forward-up
    side = F.cross(up).normalized()  # gun-right in world
    # every weapon is laid out so its front grip sits 0.31 m ahead of and 3 cm above the grip
    target = G + F * SUPPORT_FWD + up * SUPPORT_UP
    w = target.copy()
    for _ in range(4):
        a1, a2 = arm_ik("L", w, (0.7, 0.2, -0.7))
        # left hand local -X is its palm: palm toward the gun (gun-right), knuckles forward and a little down
        ql = set_bone_frame("hand.L", -side, F * 0.85 - up * 0.35 + side * 0.25)
        hl = RIG.pose.bones["hand.L"]
        mid = RIG.matrix_world @ (hl.head + (hl.tail - hl.head) * 0.35)
        w += target - mid
    pose["upper_arm.L"], pose["forearm.L"], pose["hand.L"] = a1, a2, ql
    return pose


def socket_world():
    m = RIG.matrix_world @ RIG.pose.bones["weapon_socket"].matrix
    return m.translation.copy(), (RIG.matrix_world.to_3x3().normalized() @ RIG.pose.bones["weapon_socket"].matrix.to_3x3()).col[2].normalized()


def attach_weapon(name):
    """Bone-parent weapon.<name> (muzzle -Y, up +Z, origin at the grip) to weapon_socket (+Z muzzle, +Y up)."""
    b = RIG.data.bones["weapon_socket"]
    for o in bpy.data.collections["Weapons"].objects:
        if o.type == "MESH" and not o.name.endswith(".raw"):
            o.hide_set(o.name != f"weapon.{name}")
    o = bpy.data.objects[f"weapon.{name}"]
    o.parent = RIG
    o.parent_type = "BONE"
    o.parent_bone = "weapon_socket"
    o.matrix_parent_inverse.identity()
    o.rotation_mode = "XYZ"
    o.rotation_euler = (-math.pi / 2, 0, 0)
    o.location = (0, -b.length, 0)
    o.scale = (1 / S,) * 3
    bpy.context.view_layer.update()
    return o


# ---- Hold quality checks ----
def _body_mask():
    """Body polygon indices that are NOT hands/forearms (the hands are meant to touch the weapon)."""
    ob = bpy.data.objects["seeker_body.rigged"]
    names = {g.index: g.name for g in ob.vertex_groups}
    dom = []
    for v in ob.data.vertices:
        g = max(v.groups, key=lambda g: g.weight) if v.groups else None
        dom.append(names[g.group] if g else "")
    skip = {i for i, p in enumerate(ob.data.polygons)
            if all(dom[j].split(".")[0] in ("hand", "forearm") for j in p.vertices)}
    return skip


_SKIP = None


def hold_errors(weapon="scatter"):
    """(right socket error m, left hand gap m, weapon-vs-body face pairs excluding hands) for the current pose."""
    from mathutils.bvhtree import BVHTree
    global _SKIP
    if _SKIP is None:
        _SKIP = _body_mask()
    ob = bpy.data.objects["seeker_body.rigged"]
    dg = bpy.context.evaluated_depsgraph_get()
    w = bpy.data.objects[f"weapon.{weapon}"]
    hl = RIG.pose.bones["hand.L"]
    mid = RIG.matrix_world @ (hl.head + (hl.tail - hl.head) * 0.35)
    gap = (mid - w.matrix_world @ Vector((0, -SUPPORT_FWD, SUPPORT_UP))).length
    ev = ob.evaluated_get(dg)
    bt = BVHTree.FromObject(ev, dg)
    inv = ob.matrix_world.inverted() @ w.matrix_world
    wt = BVHTree.FromPolygons([inv @ v.co for v in w.data.vertices], [p.vertices[:] for p in w.data.polygons])
    pairs = [a for a, b in bt.overlap(wt) if a not in _SKIP]
    return gap, len(pairs)


def front_stock_pen(weapon):
    """(front pairs, stock pairs): weapon faces ahead of the grip / behind it overlapping the body (hands excluded)."""
    from mathutils.bvhtree import BVHTree
    global _SKIP
    if _SKIP is None:
        _SKIP = _body_mask()
    ob = bpy.data.objects["seeker_body.rigged"]
    w = bpy.data.objects[f"weapon.{weapon}"]
    dg = bpy.context.evaluated_depsgraph_get()
    bt = BVHTree.FromObject(ob.evaluated_get(dg), dg)
    inv = ob.matrix_world.inverted() @ w.matrix_world
    wt = BVHTree.FromPolygons([inv @ v.co for v in w.data.vertices], [p.vertices[:] for p in w.data.polygons])
    front = {i for i, p in enumerate(w.data.polygons) if p.center.y < 0.03}
    fr = st = 0
    for a, b in bt.overlap(wt):
        if a in _SKIP:
            continue
        if b in front:
            fr += 1
        else:
            st += 1
    return fr, st


def fdir(yaw, pitch):
    """Muzzle direction from yaw (deg toward the character's left, +X) and pitch (deg, up +)."""
    y, p = math.radians(yaw), math.radians(pitch)
    return (math.sin(y) * math.cos(p), -math.cos(y) * math.cos(p), math.sin(p))


def search_hold(body, hips_loc=None, world=False, grips=None, yaws=(10, 25, 40), pitches=(-8, -18, -30),
                weapons=("scatter", "blaster", "repeater", "web"), prefer_yaw=25):
    """Grid-search a grip offset and muzzle direction where the left hand reaches the front grip and no
    weapon's front part enters the body. Returns (score, grip, yaw, pitch, details)."""
    import itertools
    grips = grips or list(itertools.product((-0.06, -0.11, -0.16), (-0.30, -0.36, -0.42), (-0.22, -0.29, -0.36)))
    attach_weapon(weapons[0])  # measure against a weapon that is actually on the socket
    best = None
    for g in grips:
        for yaw in yaws:
            for pitch in pitches:
                hold_weapon(body, g, fdir(yaw, pitch), hips_loc=hips_loc, fwd_world=world)
                gap, _ = hold_errors(weapons[0])
                if gap > 0.02 or wrist_bend("R") > MAX_WRIST or wrist_bend("L") > MAX_WRIST:
                    continue
                fr = st = 0
                for k in weapons:
                    attach_weapon(k)
                    a, b = front_stock_pen(k)
                    fr += a
                    st = max(st, b)
                attach_weapon(weapons[0])
                bend = max(wrist_bend("R"), wrist_bend("L"))
                score = fr * 100 + gap * 100 + st * 0.02 + abs(yaw - prefer_yaw) * 0.05 + bend * 0.05
                if best is None or score < best[0]:
                    best = (score, g, yaw, pitch, {"gap_cm": round(gap * 100, 1), "front": fr, "stock": st})
    return best


def action_fcurves(action):
    """F-curves of an action, for Blender 4.4+ layered actions (slots) and older flat ones."""
    if hasattr(action, "layers") and action.layers:
        return action.layers[0].strips[0].channelbag(action.slots[0]).fcurves
    return action.fcurves


def srgb_to_linear(c):
    """Exact sRGB transfer, so an exported colour round-trips to the same hex."""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def apply_rig_scale(body_name):
    """Bake the auto-rig's import scale into the armature so the exported GLB has no scaled node.
    three.js culls a skinned mesh with its node's world matrix, so a 0.0127 armature scale would
    shrink the fixed culling sphere to centimetres. Pose-bone location keys are in armature units
    and are rescaled with it."""
    s = RIG.scale.x
    if abs(s - 1) < 1e-6:
        return 1.0
    for act in bpy.data.actions:
        for fc in action_fcurves(act):
            if fc.data_path.endswith(".location"):
                for kp in fc.keyframe_points:
                    kp.co[1] *= s
                    kp.handle_left[1] *= s
                    kp.handle_right[1] *= s
    RIG.animation_data.action = None
    for pb in RIG.pose.bones:
        pb.location = (0, 0, 0)
    body = bpy.data.objects[body_name]
    area = [a for a in bpy.context.window.screen.areas if a.type == "VIEW_3D"][0]
    reg = [r for r in area.regions if r.type == "WINDOW"][0]
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    RIG.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = RIG
    with bpy.context.temp_override(area=area, region=reg, active_object=RIG, selected_objects=[RIG, body],
                                   selected_editable_objects=[RIG, body]):
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return s
