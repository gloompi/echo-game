// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../shared/config.js';
import { MAPS, selectMap } from '../shared/map.js';
import { DEFAULT_SETTINGS, MAP_IDS, resolveSettings, validSettings } from '../shared/settings.js';
import {
  bodyHeight,
  canOccupy,
  makeMotor,
  move,
  arenaRay,
  configureMovement,
} from '../shared/physics.js';
import { changeBinding, DEFAULT_BINDINGS, readBindings, normalizeKey } from '../shared/controls.js';
import { neutralInput, type Box, type Pose } from '../shared/types.js';
import { History } from '../shared/history.js';
const options = { ...DEFAULT_SETTINGS };
const input = (value: Partial<ReturnType<typeof neutralInput>> = {}) => ({
  ...neutralInput(),
  ...value,
});
const roof: Box = { id: 'roof', x: 0, y: 1.25, z: 0, w: 4, d: 6, h: 1, kind: 'cover' };
const ticks = (
  s: ReturnType<typeof makeMotor>,
  i: ReturnType<typeof input>,
  n: number,
  settings = options,
  boxes: Box[] = [],
) => {
  for (let t = 0; t < n; t++) move(s, i, 'hider', CFG.dt, boxes, 1000, settings);
};
const position = { x: 0, y: 0, z: 0 };
void test('new room settings and legacy defaults validate', () => {
  assert.ok(validSettings(options));
  assert.ok(validSettings({ delayMs: 1250, roundMs: 180000, seekerCount: 1 }));
  assert.equal(
    resolveSettings({ delayMs: 0, roundMs: 30000, seekerCount: 1 }).mirrorCooldownMs,
    60000,
  );
  for (const [key, value] of Object.entries({
    reloadMs: 10001,
    dashCooldownMs: -1,
    mirrorCooldownMs: 180001,
    mapId: 'bad',
    bunnyHop: 'fast',
  }))
    assert.equal(validSettings({ ...options, [key]: value }), false);
  for (const k of ['reloadMs', 'dashCooldownMs', 'mirrorCooldownMs']) {
    assert.ok(validSettings({ ...options, [k]: 0 }));
    for (const value of [NaN, Infinity, 0.5, '1000', null])
      assert.equal(validSettings({ ...options, [k]: value }), false);
  }
  assert.equal(validSettings({ ...options, toString: 1 }), false);
});
void test('crouch defaults to either Ctrl key and can be rebound', () => {
  assert.equal(DEFAULT_BINDINGS.crouch, 'ControlLeft');
  assert.equal(normalizeKey('ControlRight'), 'ControlLeft');
  assert.deepEqual(changeBinding(DEFAULT_BINDINGS, 'crouch', 'KeyC'), {
    jump: 'Space',
    crouch: 'KeyC',
  });
  assert.deepEqual(changeBinding(DEFAULT_BINDINGS, 'jump', 'ControlRight'), {
    jump: 'ControlLeft',
    crouch: 'Space',
  });
});
void test('jump accepts wheel; invalid/reserved/colliding held bindings are rejected', () => {
  assert.deepEqual(changeBinding(DEFAULT_BINDINGS, 'jump', 'WheelDown'), {
    jump: 'WheelDown',
    crouch: 'ControlLeft',
  });
  assert.equal(changeBinding(DEFAULT_BINDINGS, 'crouch', 'WheelDown'), null);
  for (const key of ['KeyW', 'KeyF', 'KeyQ', 'Escape', 'Tab'])
    assert.equal(changeBinding(DEFAULT_BINDINGS, 'jump', key), null);
  assert.equal(changeBinding({ jump: 'WheelDown', crouch: 'KeyC' }, 'jump', 'KeyC'), null);
  for (const raw of [
    'no',
    'null',
    '{}',
    '{"jump":"KeyW","crouch":"KeyC"}',
    '{"jump":"Space","crouch":"Space"}',
  ])
    assert.deepEqual(readBindings(raw), DEFAULT_BINDINGS);
});
void test('crouch actually fits under a low ceiling and cannot stand into it', () => {
  const s = makeMotor(position);
  ticks(s, input({ crouch: true }), 1, options, [roof]);
  assert.ok(s.crouched);
  assert.equal(bodyHeight(s.crouched), 1.12);
  assert.ok(canOccupy(s, bodyHeight(s.crouched), [roof]));
  ticks(s, input(), 1, options, [roof]);
  assert.ok(s.crouched);
  s.x = 4;
  ticks(s, input(), 1, options, [roof]);
  assert.equal(s.crouched, false);
});
void test('standing blocks at a crawl opening, crouching passes through', () => {
  const a = makeMotor({ x: 0, y: 0, z: 5 }),
    b = makeMotor(a);
  ticks(a, input({ mz: 1 }), 120, options, [roof]);
  ticks(b, input({ mz: 1, crouch: true }), 240, options, [roof]);
  assert.ok(a.z >= 3 + CFG.radius - 1e-6);
  assert.ok(b.z < -3 - CFG.radius);
});
void test('crouch slows movement and forbids sprint/dash', () => {
  const s = makeMotor(position);
  ticks(s, input({ crouch: true, sprint: true, dash: true, mz: 1 }), 120);
  assert.equal(s.dashCooldown, 0);
  assert.equal(s.dashTime, 0);
  assert.ok(Math.hypot(s.vx, s.vz) <= CFG.hiderSpeed * 0.45 + 1e-8);
  assert.equal(s.stamina, 100);
});
void test('jumping under a roof does not push the body into the ceiling', () => {
  const s = makeMotor(position);
  let peak = 0;
  for (let t = 0; t < 120; t++) {
    move(s, input({ crouch: true, jump: t === 0 }), 'hider', CFG.dt, [roof], 1000, options);
    peak = Math.max(peak, s.y);
    assert.ok(canOccupy(s, bodyHeight(s.crouched), [roof]));
  }
  assert.ok(peak <= 1.25 - 1.12 + 1e-8);
  assert.equal(s.y, 0);
});
void test('dash cooldown is configurable, zero still needs a new press', () => {
  const s = makeMotor(position);
  ticks(s, input({ dash: true }), 1, { ...options, dashCooldownMs: 500 });
  assert.equal(s.dashCooldown, 0.5);
  ticks(s, input(), 31, { ...options, dashCooldownMs: 500 });
  assert.equal(s.dashCooldown, 0);
  const z = makeMotor(position);
  ticks(z, input({ dash: true }), 120, { ...options, dashCooldownMs: 0 });
  assert.equal(z.dashTime, 0);
  ticks(z, input(), 1, { ...options, dashCooldownMs: 0 });
  ticks(z, input({ dash: true }), 1, { ...options, dashCooldownMs: 0 });
  assert.ok(z.dashTime > 0);
});
void test('timed/off require repeated jump presses; auto can hold', () => {
  for (const mode of ['off', 'timed', 'auto'] as const) {
    const s = makeMotor(position);
    let jumps = 0;
    for (let t = 0; t < 180; t++) {
      const was = s.grounded;
      move(s, input({ jump: true }), 'hider', CFG.dt, [], 1000, { ...options, bunnyHop: mode });
      if (was && !s.grounded && s.vy > 0) jumps++;
    }
    assert.ok(mode === 'auto' ? jumps >= 3 : jumps === 1, `${mode}: ${jumps}`);
  }
});
void test('timed hop buffers a fresh press just before landing', () => {
  const s = makeMotor({ x: 0, y: 0.02, z: 0 });
  s.grounded = false;
  s.vy = -2;
  ticks(s, input({ jump: true }), 1);
  assert.ok(s.grounded);
  ticks(s, input({ jump: true }), 1);
  assert.ok(!s.grounded && s.vy > 0);
});
void test('air movement preserves momentum, strafe acceleration is bounded', () => {
  const s = makeMotor({ x: 0, y: 100, z: 0 });
  s.grounded = false;
  s.vx = 9;
  ticks(s, input(), 1);
  assert.equal(s.vx, 9);
  for (let t = 0; t < 600; t++) {
    move(s, input({ mx: 1, mz: 1, yaw: t * 0.17 }), 'hider', CFG.dt, [], 1000, options);
    assert.ok(Math.hypot(s.vx, s.vz) <= 12 + 1e-8);
  }
});
void test('analog input does not exceed full-input ground speed', () => {
  const a = makeMotor(position),
    b = makeMotor(position);
  ticks(a, input({ mz: 0.5 }), 60);
  ticks(b, input({ mz: 1 }), 60);
  assert.ok(Math.abs(a.vz) <= CFG.hiderSpeed * 0.5 + 1e-8);
  assert.ok(Math.abs(b.vz) <= CFG.hiderSpeed + 1e-8);
});
void test('diagonal speed does not exceed straight speed', () => {
  const a = makeMotor(position),
    b = makeMotor(position);
  ticks(a, input({ mz: 1 }), 60);
  ticks(b, input({ mz: 1, mx: 1 }), 60);
  assert.ok(Math.abs(Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)) < 1e-8);
});
void test('thin walls stop a dash', () => {
  const wall: Box = { id: 'wall', x: 0, y: 0, z: 0, w: 10, d: 0.2, h: 3, kind: 'cover' };
  const s = makeMotor({ x: 0, y: 0, z: 2 });
  ticks(s, input({ mz: 1, dash: true }), 60, options, [wall]);
  assert.ok(s.z >= 0.46 - 1e-8);
});
void test('a 35cm step is climbable', () => {
  const step: Box = { id: 'step', x: 0, y: 0, z: 0, w: 3, d: 3, h: 0.35, kind: 'step' };
  const s = makeMotor({ x: 0, y: 0, z: 2 });
  ticks(s, input({ mz: 1 }), 10, options, [step]);
  assert.equal(s.y, 0.35);
});
void test('a step beneath a low roof cannot force a standing body upward', () => {
  const step: Box = { id: 'step', x: 0, y: 0, z: 0, w: 3, d: 3, h: 0.35, kind: 'step' };
  const ceiling = { ...roof, y: 2.3 };
  const s = makeMotor({ x: 0, y: 0, z: 2 });
  ticks(s, input({ mz: 1 }), 30, options, [step, ceiling]);
  assert.equal(s.y, 0);
  assert.ok(s.z >= 1.5 + CFG.radius - 1e-6);
});
const pose = (x: number, warp = 0): Pose => ({
  id: 'h',
  x,
  y: 0,
  z: 0,
  warp,
  yaw: 0,
  pitch: 0,
  role: 'hider',
  alive: true,
  moving: 0,
  grounded: true,
  waving: false,
  dashing: false,
});
void test('history never interpolates a teleport through intervening walls', () => {
  const h = new History();
  h.record(100, [pose(1, 0)]);
  h.record(200, [pose(50, 1)]);
  assert.equal(h.sample(199)[0].x, 1);
  assert.equal(h.sample(200)[0].x, 50);
  assert.equal(h.sample(99).length, 0);
});
void test('every selectable map has authoritative data and valid room settings', () => {
  assert.deepEqual(Object.keys(MAPS).sort(), [...MAP_IDS].sort());
  for (const id of MAP_IDS) {
    assert.equal(MAPS[id].id, id);
    assert.ok(validSettings({ ...options, mapId: id }));
  }
});
for (const layout of Object.values(MAPS)) {
  void test(`${layout.name}: spawns, mirror exits and mirror pairs are valid`, () => {
    assert.ok(Number.isFinite(layout.half) && layout.half > 0);
    assert.ok(layout.boxes.length > 0);
    for (const b of layout.boxes) {
      assert.ok(b.id.length > 0);
      assert.ok(
        [b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite),
        `${layout.name}: non-finite collider ${b.id}`,
      );
      assert.ok(b.w > 0 && b.h > 0 && b.d > 0, `${layout.name}: empty collider ${b.id}`);
      assert.ok(
        Math.abs(b.x) + b.w / 2 <= layout.half + 1e-8 &&
          Math.abs(b.z) + b.d / 2 <= layout.half + 1e-8,
        `${layout.name}: out-of-bounds collider ${b.id}`,
      );
      assert.ok(
        ['cover', 'platform', 'step', 'reactor'].includes(b.kind),
        `${layout.name}: unknown collider kind ${b.id}`,
      );
    }
    assert.equal(layout.spawns.length, 12);
    assert.ok(layout.waypoints.length > 0);
    for (const p of [
      ...layout.spawns,
      ...layout.waypoints,
      ...layout.mirrors,
      ...layout.mirrors.map((m) => m.exit),
    ]) {
      assert.ok([p.x, p.y, p.z].every(Number.isFinite), `${layout.name}: non-finite route point`);
      assert.ok(
        Math.abs(p.x) < layout.half && Math.abs(p.z) < layout.half,
        `${layout.name}: out-of-bounds route point`,
      );
    }
    const ids = new Set(layout.mirrors.map((m) => m.id));
    assert.equal(ids.size, layout.mirrors.length);
    for (const p of [...layout.spawns, ...layout.mirrors.map((m) => m.exit)]) {
      assert.ok(
        Math.abs(p.x) + CFG.radius < layout.half && Math.abs(p.z) + CFG.radius < layout.half,
        JSON.stringify(p),
      );
      assert.ok(
        canOccupy(p, CFG.height, layout.boxes),
        `${layout.name}: blocked ${JSON.stringify(p)}`,
      );
    }
    for (const mirror of layout.mirrors) {
      assert.ok(Number.isFinite(mirror.yaw));
      assert.notEqual(mirror.id, mirror.target);
      const target = layout.mirrors.find((m) => m.id === mirror.target);
      assert.ok(target);
      assert.equal(target.target, mirror.id);
    }
    const boxIds = layout.boxes.map((b) => b.id);
    assert.equal(new Set(boxIds).size, boxIds.length);
  });
}
void test('each new map has connected ground routes between spawns and mirror approaches', () => {
  for (const layout of Object.values(MAPS).filter((m) => m.id !== 'afterhours')) {
    const free = (x: number, z: number) =>
      Math.abs(x) < layout.half - 1 &&
      Math.abs(z) < layout.half - 1 &&
      canOccupy({ x, y: 0, z }, CFG.height, layout.boxes);
    const key = (x: number, z: number) => `${x},${z}`;
    const start = layout.spawns[0];
    const queue: [[number, number]] = [[Math.round(start.x), Math.round(start.z)]];
    const seen = new Set([key(...queue[0])]);
    for (let i = 0; i < queue.length; i++) {
      const [x, z] = queue[i];
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          nz = z + dz,
          k = key(nx, nz);
        if (!seen.has(k) && free(nx, nz)) {
          seen.add(k);
          queue.push([nx, nz]);
        }
      }
    }
    for (const p of [...layout.spawns, ...layout.mirrors.map((m) => m.exit)])
      assert.ok(
        seen.has(key(Math.round(p.x), Math.round(p.z))),
        `${layout.name} unreachable ${JSON.stringify(p)}`,
      );
  }
});
void test('switching maps updates ray bounds, movement bounds, and all shared exports', () => {
  selectMap('glassworks');
  configureMovement(options);
  assert.equal(arenaRay({ x: 50, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }), 6);
  const s = makeMotor({ x: 50, y: 0, z: 0 });
  move(s, input({ mx: 1 }), 'hider');
  assert.ok(s.x > 50);
  selectMap('afterhours');
  assert.equal(arenaRay({ x: 20, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }), 3);
});

void test('authored world stair routes reach their rooftops without jumping', () => {
  for (const route of [
    { id: 'mirror-yard' as const, start: { x: 9, y: 0, z: 5.9 }, mz: -1, roof: 3.6 },
    { id: 'mirror-yard' as const, start: { x: -9, y: 0, z: 5.9 }, mz: -1, roof: 3.6 },
    { id: 'mirror-yard' as const, start: { x: 9, y: 0, z: -5.9 }, mz: 1, roof: 3.6 },
    { id: 'mirror-yard' as const, start: { x: -9, y: 0, z: -5.9 }, mz: 1, roof: 3.6 },
    { id: 'neon-carnival' as const, start: { x: 18, y: 0, z: -4.8 }, mz: 1, roof: 4.24 },
  ]) {
    const layout = MAPS[route.id],
      state = makeMotor(route.start),
      settings = { ...options, mapId: route.id };
    assert.ok(canOccupy(route.start, CFG.height, layout.boxes));
    for (let i = 0; i < 100; i++)
      move(state, input({ mz: route.mz }), 'hider', CFG.dt, layout.boxes, layout.half, settings);
    assert.ok(state.grounded);
    assert.ok(Math.abs(state.y - route.roof) < 1e-8, `${layout.name}: rooftop was not reached`);
    assert.ok(canOccupy(state, CFG.height, layout.boxes));
  }
});

void test('Mirror Yard service tunnel blocks standing but permits a complete crouched passage', () => {
  const layout = MAPS['mirror-yard'],
    state = makeMotor({ x: 0, y: 0, z: -14 }),
    settings = { ...options, mapId: layout.id };
  const walk = (n: number, controls: Partial<ReturnType<typeof neutralInput>>) => {
    for (let i = 0; i < n; i++)
      move(state, input(controls), 'hider', CFG.dt, layout.boxes, layout.half, settings);
  };
  walk(40, { mz: 1 });
  assert.ok(state.z > -15.8);
  walk(100, { mz: 1, crouch: true });
  assert.ok(state.z < -18.5);
  walk(20, {});
  assert.equal(state.crouched, false);
  assert.ok(canOccupy(state, CFG.height, layout.boxes));
});

void test('Neon Carnival tunnel has a complete crouched passage in both directions', () => {
  const layout = MAPS['neon-carnival'],
    ceiling = layout.boxes.find((b) => b.id === 'tunnel-crouch-ceiling')!,
    settings = { ...options, mapId: layout.id };
  for (const route of [
    { z: -19, mz: -1 },
    { z: -4, mz: 1 },
  ]) {
    const state = makeMotor({ x: -21, y: 0, z: route.z });
    const walk = (n: number, controls: Partial<ReturnType<typeof neutralInput>>) => {
      for (let i = 0; i < n; i++)
        move(state, input(controls), 'hider', CFG.dt, layout.boxes, layout.half, settings);
    };
    walk(30, { mz: route.mz });
    const blocked = state.z;
    walk(60, { mz: route.mz });
    assert.ok(Math.abs(state.z - blocked) < 1e-8);
    walk(300, { mz: route.mz, crouch: true });
    assert.ok(
      route.mz < 0
        ? state.z > ceiling.z + ceiling.d / 2 + CFG.radius
        : state.z < ceiling.z - ceiling.d / 2 - CFG.radius,
      'Tunnel exit is blocked',
    );
    walk(20, {});
    assert.equal(state.crouched, false);
    assert.ok(state.grounded);
    assert.ok(canOccupy(state, CFG.height, layout.boxes));
  }
});

void test('Neon Carnival side stairs connect to the tunnel roof without blocking its ground passage', () => {
  const layout = MAPS['neon-carnival'],
    state = makeMotor({ x: -17, y: 0, z: 1.2 }),
    settings = { ...options, mapId: layout.id };
  for (let i = 0; i < 82; i++)
    move(state, input({ mz: 1 }), 'hider', CFG.dt, layout.boxes, layout.half, settings);
  assert.ok(Math.abs(state.y - 4.2) < 1e-8);
  assert.ok(state.grounded);
  for (let i = 0; i < 36; i++)
    move(state, input({ mx: -1 }), 'hider', CFG.dt, layout.boxes, layout.half, settings);
  assert.ok(state.x < -20);
  assert.ok(Math.abs(state.y - 4.2) < 1e-8);
  assert.ok(state.grounded);
  assert.ok(canOccupy(state, CFG.height, layout.boxes));
});
