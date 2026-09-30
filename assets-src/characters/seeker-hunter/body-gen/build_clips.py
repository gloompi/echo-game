# Rebuilds every seeker-hunter clip around the two-handed weapon hold. Exec'd live in Blender via MCP
# (namespace needs __file__; BUILD=False only defines the poses, for search_holds.py).
# All four weapons share one grip/front-grip layout, so one clip set fits them all. The grip offset
# (relative to chest.upper) and the world muzzle direction of each hold come from holds.json.
import json, os

HERE = os.path.dirname(__file__)
exec(open(os.path.join(HERE, "anim_helpers.py")).read())
HOLDS = json.load(open(os.path.join(HERE, "holds.json"))) if os.path.exists(os.path.join(HERE, "holds.json")) else {}
BK = 0.27


def held(name, body, hips_loc=None):
    h = HOLDS[name]
    return hold_weapon(body, h["grip"], fdir(h["yaw"], h["pitch"]), hips_loc=hips_loc, fwd_world=True)


def idle_body(b):
    return {"chest": rot("chest", X, -1.5 * b), "chest.upper": rot("chest.upper", X, -1.0 * b),
            "neck": rot("neck", X, 1.0 * b), "head": rot("head", X, 1.0 * b),
            "shoulder.L": rot("shoulder.L", Y, -2 * b), "shoulder.R": rot("shoulder.R", Y, 2 * b)}


PHASES = [(-38, 12, 32, 55, 6), (-2, 25, -18, 105, 0), (32, 55, -38, 12, -6), (-18, 105, -2, 25, 0)]


def run_body(p):
    tl, sl, tr, sr, tw = p
    return {"hips": rot("hips", Z, tw), "spine": rot("spine", X, 7), "chest": combine("chest", (X, 5), (Z, -tw * 1.2)),
            "chest.upper": rot("chest.upper", X, 2), "neck": rot("neck", X, -6), "head": rot("head", X, -6),
            "thigh.L": rot("thigh.L", X, tl), "shin.L": rot("shin.L", X, sl), "foot.L": rot("foot.L", X, -(tl + sl) * 0.6),
            "thigh.R": rot("thigh.R", X, tr), "shin.R": rot("shin.R", X, sr), "foot.R": rot("foot.R", X, -(tr + sr) * 0.6)}


RUN_DROPS = {1: .075, 2: .066, 3: .045, 4: .037, 5: .034, 6: .064, 8: .13, 9: .05, 11: .075, 12: .066, 13: .043,
             14: .035, 15: .034, 16: .064, 18: .13, 19: .05, 21: .075}
# crouch walk: 0.5 m stride over a 0.8 s cycle, about 1.5 m/s at the feet, so the runtime's playback
# scale (<= 2x) reaches the game's ~2.7 m/s crouch speed. The stride is shifted forward (0.30 m ahead,
# 0.20 m behind): a longer trailing step drops the back knee to the floor in this deep crouch.
D, L, SP = 0.72, 45, 19.5
ST_F, ST_B, CW_LIFT = 0.30, 0.20, 0.03
CW_FRAMES = 25
CW_KEYS = [(1, -0.05, dict(stepL=-ST_F, stepR=ST_B, liftL=CW_LIFT, liftR=CW_LIFT)), (7, 0.0, dict(liftR=0.08)),
           (13, -0.05, dict(stepL=ST_B, stepR=-ST_F, liftL=CW_LIFT, liftR=CW_LIFT)), (19, 0.0, dict(liftL=0.08)),
           (25, -0.05, dict(stepL=-ST_F, stepR=ST_B, liftL=CW_LIFT, liftR=CW_LIFT))]


def crouch_walk_body(drop, **kw):
    return crouch(drop, L, SP, back=BK, **kw)


def slide_body(d, sp):
    return crouch(d, 50, sp, stepL=-0.45, stepR=0.22, liftR=0.02, back=0.25)


def P(spine, head, tl, sl, fl, tr, sr, fr):
    return {"spine": rot("spine", X, spine), "chest": rot("chest", X, spine * 0.6), "neck": rot("neck", X, head * 0.5),
            "head": rot("head", X, head * 0.5), "thigh.L": rot("thigh.L", X, tl), "shin.L": rot("shin.L", X, sl),
            "foot.L": rot("foot.L", X, fl), "thigh.R": rot("thigh.R", X, tr), "shin.R": rot("shin.R", X, sr),
            "foot.R": rot("foot.R", X, fr)}


JUMP = [(1, P(-6, -10, 8, 12, 35, 14, 20, 40)), (6, P(-2, -6, -35, 60, 10, -10, 45, 20)),
        (11, P(10, 4, -72, 105, 5, -45, 90, 10)), (18, P(6, 2, -30, 45, -5, -18, 35, 0)),
        (24, P(4, 0, -18, 30, -10, -12, 26, -8))]
HIT_RECOIL = {"spine": rot("spine", X, -9), "chest": combine("chest", (X, -10), (Z, 8)), "neck": rot("neck", X, -8),
              "head": combine("head", (X, -14), (Y, 6))}
HIT_SETTLE = {"spine": rot("spine", X, -3), "chest": rot("chest", X, -3), "head": rot("head", X, -4)}


def aim_body(b):
    # bladed rifle stance: upper body turned 12 deg so the left shoulder comes forward, head faces ahead
    return {"spine": combine("spine", (Z, -12), (X, 3)), "chest": rot("chest", X, 2), "neck": rot("neck", Z, 6),
            "head": combine("head", (Z, 6), (X, -4 + b)), "thigh.L": rot("thigh.L", X, -6), "thigh.R": rot("thigh.R", X, 6)}


# pose samples the hold search runs against: name -> (body, hips offset)
SAMPLES = {
    "ready": lambda: (idle_body(0), hips_offset(0)),
    "run": lambda: (run_body(PHASES[0]), hips_offset(RUN_DROPS[1])),
    "crouch": lambda: (crouch(0.72, 45, 16, back=BK), hips_offset(0.72, fwd=BK)),
    "crouch_walk": lambda: (crouch_walk_body(D - 0.05, stepL=-ST_F, stepR=ST_B, liftL=CW_LIFT, liftR=CW_LIFT), hips_offset(D - 0.05, fwd=BK)),
    "slide": lambda: (slide_body(0.64, 21), hips_offset(0.64, fwd=0.25)),
    "jump": lambda: (JUMP[2][1], None),
    "hit": lambda: (HIT_RECOIL, None),
    "aim": lambda: (aim_body(0), None),
}

if globals().get("BUILD", True):
    new_clip("idle", 61)
    for f, b in ((1, 0), (31, 1), (61, 0)):
        hl = hips_offset(0.008 * b)
        key(f, held("ready", idle_body(b), hl), hips_loc=hl)

    new_clip("run", 21)
    for i, f in enumerate((1, 6, 11, 16, 21)):
        hl = hips_offset(RUN_DROPS[f])
        key(f, held("run", run_body(PHASES[i % 4]), hl), hips_loc=hl)
    for f, d in RUN_DROPS.items():
        bpy.context.scene.frame_set(f)
        hb = RIG.pose.bones["hips"]
        hb.location = hips_offset(d)
        hb.keyframe_insert("location", frame=f)

    new_clip("crouch_idle", 61)
    for f, b in ((1, 0), (31, 1.5), (61, 0)):
        hl = hips_offset(0.72 + 0.006 * b, fwd=BK)
        key(f, held("crouch", crouch(0.72, 45, 16, b, back=BK), hl), hips_loc=hl)

    new_clip("crouch_walk", CW_FRAMES)
    for f, bob, kw in CW_KEYS:
        hl = hips_offset(D + bob, fwd=BK)
        key(f, held("crouch_walk", crouch_walk_body(D + bob, **kw), hl), hips_loc=hl)

    new_clip("slide", 11)
    for f, d, sp in ((1, 0.64, 21), (11, 0.645, 22)):
        hl = hips_offset(d, fwd=0.25)
        key(f, held("slide", slide_body(d, sp), hl), hips_loc=hl)

    new_clip("jump", 24)
    for i, (f, p) in enumerate(JUMP):
        key(f, held(f"jump_{i}", p))  # the gun moves through the jump: one searched hold per key

    new_clip("hit", 13)
    key(1, held("ready", idle_body(0)))
    # no hip dip: the flinch is upper-body only, so the feet stay planted
    key(4, held("hit", HIT_RECOIL))
    key(8, held("ready", HIT_SETTLE))
    key(13, held("ready", idle_body(0)))

    new_clip("aim", 31)
    for f, b in ((1, 0), (16, 1.5), (31, 0)):
        key(f, held("aim", aim_body(b)))

    # aim is the runtime's upper-body overlay (character-assets.ts splits every base clip at its
    # bones), so it must leave the hips and legs to the base clip
    UPPER = ("spine", "chest", "chest.upper", "neck", "head", "head_end", "head_front", "shoulder.", "upper_arm.",
             "forearm.", "hand.", "weapon_socket")
    aim = bpy.data.actions["aim"]
    for fc in list(action_fcurves(aim)):
        bone = fc.data_path.split('"')[1] if '"' in fc.data_path else ""
        if not any(bone == u or (u.endswith(".") and bone.startswith(u)) for u in UPPER):
            action_fcurves(aim).remove(fc)

    RIG.animation_data.action = bpy.data.actions["idle"]
    bpy.context.scene.frame_set(1)
