"""Render a world layout draft as a top-down plan with a metre grid (review evidence only).

  python scripts/worlds/render_plan.py --layout <layout-draft.json> --out <plan.png>
      [--underlay <concept.png> --underlay-crop u0 v0 u1 v1]

Runs with the system Python and Pillow, not inside Blender. Reads the map.json shape plus
the optional `plan` block written by a layout module (zones, routes, box roles, concept
scale). With --underlay, the concept image is scaled by plan.scale.metresPerPlanPixel and
placed by plan.scale.planOriginPixel so its drawing sits under the boxes in metres.
North (-z) is up, +x is right.
"""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

PPM = 20  # pixels per metre
EXTENT = (-41.0, 41.0, -29.0, 30.0)  # x0, x1, z0, z1 shown
LEGEND_W = 470

ROLE_STYLE = {
    # role: (fill RGBA, outline RGB, label)
    'boundary': ((58, 66, 92, 255), (120, 130, 170), 'Boundary wall / fence (N, W, E 7.5 m; S 5.0 m)'),
    'wall': ((96, 104, 128, 255), (170, 178, 205), 'Building wall / roof'),
    'facade': ((150, 70, 110, 255), (235, 130, 185), 'Funhouse facade'),
    'deck': ((255, 196, 64, 110), (255, 205, 90), 'Upper deck 3.3 m (open below)'),
    'step': ((210, 190, 150, 255), (120, 100, 70), 'Stair step (0.3 m rise)'),
    'booth': ((226, 88, 150, 255), (255, 170, 210), 'Booth / counter (cover)'),
    'kiosk': ((236, 120, 60, 255), (255, 185, 140), 'Ticket kiosk (cover)'),
    'glass': ((70, 220, 245, 255), (170, 245, 255), 'Maze glass (collider)'),
    'tube': ((180, 90, 230, 170), (225, 170, 255), 'Tunnel slide tube (standing inside)'),
    'tube-crouch': ((180, 90, 230, 170), (225, 170, 255), 'Tube crouch-only leg (hatched)'),
    'roof': ((120, 128, 150, 60), (190, 198, 225), 'Overhead roof (outline; interior shown)'),
    'deck-round': ((210, 190, 150, 255), (120, 100, 70), 'Carousel deck 0.3 m (box staircase)'),
    'rail': ((250, 230, 120, 255), (140, 120, 40), 'Railing 1.0 m (climbable)'),
    'crate': ((160, 110, 70, 255), (230, 190, 150), 'Jump crate 1.2 m'),
    'barrier': ((200, 200, 205, 255), (110, 110, 120), 'Low barrier 0.9 m (vault)'),
    'car': ((90, 200, 140, 255), (170, 245, 200), 'Bumper car 1.0 m (low cover)'),
    'panel': ((120, 80, 170, 255), (190, 160, 235), 'Broken ride panel (cover)'),
    'cabinets': ((70, 120, 210, 255), (150, 190, 255), 'Arcade cabinet row'),
    'pillar': ((140, 140, 150, 255), (220, 220, 230), 'Post / pillar'),
    'post': ((140, 140, 150, 255), (220, 220, 230), 'Post / pillar'),
    'sign': ((240, 80, 200, 200), (255, 150, 230), 'Sign lintel (overhead)'),
    'prop': ((245, 180, 90, 255), (255, 225, 160), 'Carousel / hub prop'),
    'vault': ((200, 140, 60, 255), (250, 200, 120), 'Vault stage 1.2 m'),
    'solid': ((110, 110, 120, 255), (200, 200, 210), 'Solid'),
}
ROUTE_STYLE = {
    'loop': ((80, 230, 90), 'Hider loop route'),
    'climb': ((250, 215, 40), 'Climb / vertical route'),
    'slide': ((60, 180, 255), 'Slide / underpass route'),
    'sight': ((255, 60, 60), 'Seeker sightline'),
}
MIRROR_COLOURS = {'VIOLET': (190, 110, 255), 'CYAN': (60, 235, 245), 'AMBER': (255, 190, 80)}
BG = (12, 20, 32)


def font(size, bold=False):
    for name in (('arialbd.ttf' if bold else 'arial.ttf'), 'DejaVuSans.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


class Plan:
    def __init__(self, extent=EXTENT, ppm=PPM):
        self.x0, self.x1, self.z0, self.z1 = extent
        self.ppm = ppm
        self.w = int((self.x1 - self.x0) * ppm)
        self.h = int((self.z1 - self.z0) * ppm)

    def p(self, x, z):
        return ((x - self.x0) * self.ppm, (z - self.z0) * self.ppm)

    def rect(self, b):
        x0, y0 = self.p(b['x'] - b['w'] / 2, b['z'] - b['d'] / 2)
        x1, y1 = self.p(b['x'] + b['w'] / 2, b['z'] + b['d'] / 2)
        return [x0, y0, x1, y1]


def arrow(draw, a, b, colour, width=3, head=10):
    draw.line([a, b], fill=colour, width=width)
    angle = math.atan2(b[1] - a[1], b[0] - a[0])
    for side in (-1, 1):
        tip = (b[0] - head * math.cos(angle + side * 0.45), b[1] - head * math.sin(angle + side * 0.45))
        draw.line([b, tip], fill=colour, width=width)


def dashed(draw, points, colour, width=3, dash=14, gap=9):
    for a, b in zip(points, points[1:]):
        length = math.dist(a, b)
        if length == 0:
            continue
        ux, uy = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        t = 0.0
        while t < length:
            s = min(t + dash, length)
            draw.line([(a[0] + ux * t, a[1] + uy * t), (a[0] + ux * s, a[1] + uy * s)], fill=colour, width=width)
            t = s + gap


def stair_groups(boxes):
    groups = {}
    for b in boxes:
        if b['kind'] == 'step' and b['id'].rsplit('-', 1)[-1].isdigit() and 'deck' not in b['id']:
            groups.setdefault(b['id'].rsplit('-', 1)[0], []).append(b)
    return {k: v for k, v in groups.items() if len(v) >= 3}


def render(layout, out, underlay=None, crop=None, title=None):
    plan = Plan()
    image = Image.new('RGBA', (plan.w + LEGEND_W, plan.h), BG + (255,))
    extras = layout.get('plan', {})
    roles = extras.get('roles', {})
    if underlay:
        scale = extras['scale']['metresPerPlanPixel']
        u0, v0 = extras['scale']['planOriginPixel']
        concept = Image.open(underlay).convert('RGBA')
        cu0, cv0, cu1, cv1 = crop
        piece = concept.crop((cu0, cv0, cu1, cv1))
        factor = scale * plan.ppm
        piece = piece.resize((round(piece.width * factor), round(piece.height * factor)), Image.LANCZOS)
        piece.putalpha(215)
        x, z = (cu0 - u0) * scale, (cv0 - v0) * scale
        image.alpha_composite(piece, tuple(round(c) for c in plan.p(x, z)))
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    small, label, big = font(13), font(15, True), font(22, True)

    # Metre grid: 1 m minor, 5 m major, labels every 10 m.
    for xm in range(math.ceil(plan.x0), math.floor(plan.x1) + 1):
        colour = (255, 255, 255, 70) if xm % 5 == 0 else (255, 255, 255, 22)
        draw.line([plan.p(xm, plan.z0), plan.p(xm, plan.z1)], fill=colour, width=2 if xm % 10 == 0 else 1)
        if xm % 10 == 0:
            draw.text((plan.p(xm, plan.z0)[0] + 3, 3), f'x {xm}', fill=(255, 255, 255, 200), font=small)
    for zm in range(math.ceil(plan.z0), math.floor(plan.z1) + 1):
        colour = (255, 255, 255, 70) if zm % 5 == 0 else (255, 255, 255, 22)
        draw.line([plan.p(plan.x0, zm), plan.p(plan.x1, zm)], fill=colour, width=2 if zm % 10 == 0 else 1)
        if zm % 10 == 0:
            draw.text((3, plan.p(0, zm)[1] + 2), f'z {zm}', fill=(255, 255, 255, 200), font=small)
    half = layout['half']
    dashed(draw, [plan.p(-half, plan.z0), plan.p(-half, plan.z1)], (255, 120, 120, 170), 2)
    dashed(draw, [plan.p(half, plan.z0), plan.p(half, plan.z1)], (255, 120, 120, 170), 2)

    for zone in extras.get('zones', []):
        a, b = plan.p(zone['x0'], zone['z0']), plan.p(zone['x1'], zone['z1'])
        dashed(draw, [a, (b[0], a[1]), b, (a[0], b[1]), a], (255, 255, 255, 90), 1, 8, 6)
        draw.text((a[0] + 4, a[1] + 3), zone['name'], fill=(255, 255, 255, 190), font=small)

    # Boxes in three composited layers so translucent upper decks and roof outlines blend
    # over what is beneath them: ground-standing solids, upper decks, overhead roofs.
    image.alpha_composite(overlay)
    for layer in ('ground', 'deck', 'roof'):
        sheet = Image.new('RGBA', image.size, (0, 0, 0, 0))
        pen = ImageDraw.Draw(sheet)
        for b in sorted(layout['boxes'], key=lambda b: b['y'] + b['h']):
            role = roles.get(b['id'], 'solid')
            if (role if role in ('deck', 'roof') else 'ground') != layer:
                continue
            fill, outline, _ = ROLE_STYLE.get(role, ROLE_STYLE['solid'])
            if underlay:
                fill = fill[:3] + (min(fill[3], 120),)
            x0, y0, x1, y1 = plan.rect(b)
            if role == 'roof':
                pen.rectangle([x0, y0, x1, y1], outline=outline + (230,), width=2)
                for off in range(int(x0), int(x1), 22):
                    pen.line([(off, y0), (off, y0 + 7)], fill=outline + (150,), width=1)
                continue
            pen.rectangle([x0, y0, x1, y1], fill=fill, outline=outline + (255,), width=1)
            if role == 'tube-crouch':
                for off in range(int(x0) - int(y1 - y0), int(x1), 8):
                    pen.line([(max(x0, off), y0 + max(0, x0 - off)),
                              (min(x1, off + (y1 - y0)), y1 - max(0, off + (y1 - y0) - x1))],
                             fill=(255, 255, 255, 170), width=1)
        image.alpha_composite(sheet)
    overlay = Image.new('RGBA', image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for name, steps in stair_groups(layout['boxes']).items():
        steps.sort(key=lambda b: b['h'])
        a, b = plan.p(steps[0]['x'], steps[0]['z']), plan.p(steps[-1]['x'], steps[-1]['z'])
        arrow(draw, a, b, (255, 255, 255, 255), 4, 11)
        arrow(draw, a, b, (30, 20, 10, 255), 2, 9)
    for b in layout['boxes']:
        role = roles.get(b['id'])
        if role == 'deck':
            x0, y0, x1, y1 = plan.rect(b)
            if (x1 - x0) > 40 and (y1 - y0) > 18:
                draw.text((x0 + 4, y1 - 17), f'{b["y"] + b["h"]:.1f} m', fill=(255, 235, 170, 255), font=small)

    for route in extras.get('routes', []):
        colour = ROUTE_STYLE[route['kind']][0] + (235,)
        points = [plan.p(x, z) for x, z in route['points']]
        dashed(draw, points, colour, 4, 16, 10)
        if len(points) >= 2:
            arrow(draw, points[-2], points[-1], colour, 4, 14)

    tour = [plan.p(w['x'], w['z']) for w in layout['waypoints']]
    for a, b in zip(tour, tour[1:] + tour[:1]):
        draw.line([a, b], fill=(200, 200, 200, 80), width=1)
    for i, p in enumerate(tour):
        draw.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(230, 230, 230, 230))
        draw.text((p[0] + 5, p[1] - 14), f'w{i}', fill=(230, 230, 230, 230), font=small)

    for i, s in enumerate(layout['spawns']):
        x, y = plan.p(s['x'], s['z'])
        draw.ellipse([x - 11, y - 11, x + 11, y + 11], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255), width=2)
        text = str(i)
        tw = draw.textlength(text, font=label)
        draw.text((x - tw / 2, y - 9), text, fill=(0, 0, 0, 255), font=label)

    mirrors = {m['id']: m for m in layout['mirrors']}
    for m in layout['mirrors']:
        colour = MIRROR_COLOURS.get(m['label'], (255, 255, 255)) + (255,)
        x, y = plan.p(m['x'], m['z'])
        exit_point = plan.p(m['exit']['x'], m['exit']['z'])
        arrow(draw, (x, y), exit_point, colour, 3, 10)
        draw.polygon([(x, y - 13), (x + 9, y), (x, y + 13), (x - 9, y)], fill=colour, outline=(255, 255, 255, 255))
        tag = f'{m["label"]} {m["id"][-1].upper()}' + (f' y{m["y"]:.1f}' if m['y'] else '')
        draw.text((x + 12, y - 8), tag, fill=colour, font=label)
        target = mirrors[m['target']]
        if m['id'] < target['id']:
            dashed(draw, [(x, y), plan.p(target['x'], target['z'])], colour[:3] + (70,), 1, 6, 10)

    for mark in layout['landmarks']:
        x, y = plan.p(mark['x'], mark['z'])
        tw = draw.textlength(mark['name'], font=label)
        draw.rectangle([x - tw / 2 - 5, y - 11, x + tw / 2 + 5, y + 10], fill=(8, 14, 26, 200),
                       outline=(120, 240, 230, 255))
        draw.text((x - tw / 2, y - 9), mark['name'], fill=(160, 255, 245, 255), font=label)

    # Legend panel.
    lx = plan.w + 18
    draw.rectangle([plan.w, 0, plan.w + LEGEND_W, plan.h], fill=(9, 15, 26, 255))
    draw.text((lx, 14), title or f'{layout["name"]} - layout plan', fill=(255, 255, 255, 255), font=big)
    draw.text((lx, 44), f'half {half} m (clamp, red dashes)  |  north is up (-z)', fill=(200, 210, 230, 255), font=small)
    y = 72
    seen = set()
    for role in roles.values():
        if role in seen:
            continue
        seen.add(role)
    for role, (fill, outline, text) in ROLE_STYLE.items():
        if role not in seen or text in {ROLE_STYLE[r][2] for r in seen if r != role and ROLE_STYLE[r][2] == text and r < role}:
            continue
        draw.rectangle([lx, y, lx + 26, y + 16], fill=fill, outline=outline + (255,))
        draw.text((lx + 36, y), text, fill=(230, 235, 245, 255), font=small)
        y += 22
    y += 8
    for kind, (colour, text) in ROUTE_STYLE.items():
        draw.line([(lx, y + 8), (lx + 26, y + 8)], fill=colour + (255,), width=4)
        draw.text((lx + 36, y), text, fill=(230, 235, 245, 255), font=small)
        y += 22
    y += 6
    draw.ellipse([lx + 2, y, lx + 22, y + 20], fill=(255, 255, 255, 255), outline=(0, 0, 0, 255))
    draw.text((lx + 36, y + 2), 'Spawn (list order 0-11)', fill=(230, 235, 245, 255), font=small)
    y += 26
    draw.polygon([(lx + 12, y), (lx + 21, y + 11), (lx + 12, y + 22), (lx + 3, y + 11)], fill=(190, 110, 255, 255))
    draw.text((lx + 36, y + 3), 'Mirror (arrow = exit, 2.6 m)', fill=(230, 235, 245, 255), font=small)
    y += 28
    draw.ellipse([lx + 8, y + 4, lx + 16, y + 12], fill=(230, 230, 230, 255))
    draw.text((lx + 36, y), 'Bot waypoint tour (w0..)', fill=(230, 235, 245, 255), font=small)
    y += 26
    arrow(draw, (lx, y + 8), (lx + 26, y + 8), (255, 255, 255, 255), 4, 9)
    draw.text((lx + 36, y), 'Stair: arrow points up the rise', fill=(230, 235, 245, 255), font=small)
    y += 34
    levels = extras.get('levels', {})
    for line in (f'Levels: ground 0 | booth roofs {levels.get("booth")} m | upper {levels.get("roof")} m',
                 f'Deck {levels.get("deck")} m thick -> 3.0 m standing clearance',
                 f'Crouch clear {levels.get("crouchClear")} m (1.12 < h < 2.16)',
                 f'Boxes {len(layout["boxes"])}  spawns {len(layout["spawns"])}  mirrors {len(layout["mirrors"])}  '
                 f'waypoints {len(layout["waypoints"])}'):
        draw.text((lx, y), line, fill=(200, 210, 230, 255), font=small)
        y += 20
    y += 10
    draw.line([(lx, y), (lx + 10 * plan.ppm, y)], fill=(255, 255, 255, 255), width=3)
    for i in range(0, 11, 5):
        draw.line([(lx + i * plan.ppm, y - 6), (lx + i * plan.ppm, y + 6)], fill=(255, 255, 255, 255), width=2)
    draw.text((lx + 10 * plan.ppm + 8, y - 8), '10 m', fill=(255, 255, 255, 255), font=small)
    image.alpha_composite(overlay)
    image.convert('RGB').save(out)
    print(f'wrote {out} ({image.width}x{image.height})')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--layout', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--underlay')
    parser.add_argument('--underlay-crop', nargs=4, type=int, metavar=('U0', 'V0', 'U1', 'V1'))
    parser.add_argument('--title')
    args = parser.parse_args()
    layout = json.loads(Path(args.layout).read_text(encoding='utf-8'))
    render(layout, args.out, args.underlay, args.underlay_crop, args.title)


if __name__ == '__main__':
    main()
