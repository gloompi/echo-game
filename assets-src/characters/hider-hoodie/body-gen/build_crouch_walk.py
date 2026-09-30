# Rebuilds the hider-hoodie crouch_walk clip (exec'd live in Blender via MCP; namespace needs __file__).
# 0.45 m stride over a 0.67 s cycle, so the runtime's playback scale (<= 2x) reaches the game's ~2.9 m/s
# crouch speed. The stride is shifted forward (0.35 m ahead, 0.10 m behind): a longer trailing step
# drops the back knee to the floor in this deep crouch. Keys every 2 frames solve both feet by IK on an
# explicit path (planted foot slides back on the floor, swing foot arcs forward), so no toe scuffs
# through the floor between keys. Other clips were authored live (see manifest.json).
import math, os

exec(open(os.path.join(os.path.dirname(__file__), "anim_helpers.py")).read())

D, L, SP, BK = 0.72, 45, 22.5, 0.30
ST_F, ST_B, LIFT, SWING = 0.35, 0.10, 0.02, 0.08
FRAMES = 21  # 20-frame (0.67 s) cycle, last frame repeats the first


def foot(phase):
    """(step, lift) of a foot at gait phase 0..1: stance 0..0.5 front->back, swing 0.5..1 back->front."""
    if phase < 0.5:
        s = phase / 0.5
        return -ST_F + (ST_F + ST_B) * s, LIFT * abs(2 * s - 1)  # tilt lift only at the stride ends
    s = (phase - 0.5) / 0.5
    return ST_B - (ST_F + ST_B) * (0.5 - 0.5 * math.cos(math.pi * s)), LIFT + SWING * math.sin(math.pi * s)


new_clip("crouch_walk", FRAMES)
for f in range(1, FRAMES + 1, 2):
    t = ((f - 1) / (FRAMES - 1)) % 1.0
    (sl, ll), (sr, lr) = foot(t), foot((t + 0.5) % 1.0)
    bob = -0.05 + 0.05 * math.sin(2 * math.pi * t) ** 2  # legs extended at contact, hips sink as the feet pass
    arm = 10 * math.cos(2 * math.pi * t)
    hl = hips_offset(D + bob, fwd=BK)
    key(f, crouch(D + bob, L, SP, back=BK, stepL=sl, stepR=sr, liftL=ll, liftR=lr, arm=arm), hips_loc=hl)
RIG.animation_data.action = bpy.data.actions["idle"]
bpy.context.scene.frame_set(1)
