// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../shared/config.js';
import { ARENA, SPAWNS } from '../shared/map.js';
import { DEFAULT_SETTINGS, delayLabel, validSettings } from '../shared/settings.js';
import { aimDirection, makeMotor, move, overlaps, rayBox } from '../shared/physics.js';
import { neutralInput, type Box } from '../shared/types.js';
for (const delayMs of [0, 250, 1250, 3000, 10000])
  void test(`delay ${delayMs} ms is accepted`, () =>
    assert.equal(validSettings({ ...DEFAULT_SETTINGS, delayMs }), true));
for (const value of [
  null,
  [],
  {},
  '3000',
  { ...DEFAULT_SETTINGS, delayMs: -1 },
  { ...DEFAULT_SETTINGS, delayMs: 10001 },
  { ...DEFAULT_SETTINGS, delayMs: NaN },
  { ...DEFAULT_SETTINGS, delayMs: 0.5 },
  { ...DEFAULT_SETTINGS, delayMs: '1000' },
  { ...DEFAULT_SETTINGS, seekerCount: 0 },
  { ...DEFAULT_SETTINGS, seekerCount: 4 },
  { ...DEFAULT_SETTINGS, roundMs: 29999 },
  { ...DEFAULT_SETTINGS, roundMs: 600001 },
  { ...DEFAULT_SETTINGS, unexpected: 1 },
])
  void test(`invalid settings ${JSON.stringify(value)}`, () =>
    assert.equal(validSettings(value), false));
void test('delay label supports zero and fractional seconds', () => {
  assert.equal(delayLabel(0), '0s');
  assert.equal(delayLabel(1250), '1.25s');
  assert.equal(delayLabel(1234), '1.234s');
});
void test('snapshot cadence divides the fixed tick rate', () => {
  assert.equal(CFG.tickRate, 60);
  assert.equal(CFG.snapshotRate, 20);
  assert.equal(CFG.tickRate % CFG.snapshotRate, 0);
  assert.ok(CFG.historyMs > CFG.maxDelayMs + 1000);
});
void test('twelve unique spawns are outside cover', () => {
  assert.equal(SPAWNS.length, 12);
  assert.equal(new Set(SPAWNS.map((p) => `${p.x},${p.z}`)).size, 12);
  for (const p of SPAWNS) assert.ok(ARENA.every((b) => !overlaps(p.x, p.z, b) || p.y >= b.y + b.h));
});
void test('diagonal movement has normalized speed', () => {
  const a = makeMotor({ x: 0, y: 0, z: 0 }),
    b = makeMotor(a);
  for (let i = 0; i < 60; i++) {
    move(a, { ...neutralInput(), mz: 1 }, 'hider', CFG.dt, []);
    move(b, { ...neutralInput(), mx: 1, mz: 1 }, 'hider', CFG.dt, []);
  }
  assert.ok(Math.abs(Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)) < 1e-7);
});
void test('jump lands; held jump does not bunny hop', () => {
  const s = makeMotor({ x: 0, y: 0, z: 0 });
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    move(s, { ...neutralInput(), jump: true }, 'hider', CFG.dt, []);
    peak = Math.max(peak, s.y);
  }
  assert.ok(peak > 1.4);
  assert.equal(s.y, 0);
  assert.equal(s.grounded, true);
});
void test('dash cannot tunnel through thin cover', () => {
  const s = makeMotor({ x: 0, y: 0, z: 2 });
  const wall: Box = { id: 'wall', x: 0, z: 0, w: 10, d: 0.2, y: 0, h: 3, kind: 'cover' };
  for (let i = 0; i < 60; i++)
    move(s, { ...neutralInput(), mz: 1, dash: i === 0 }, 'hider', CFG.dt, [wall]);
  assert.ok(s.z >= 0.46 - 1e-6);
  assert.ok(s.dashCooldown > 0);
});
void test('small steps remain climbable at 60Hz', () => {
  const s = makeMotor({ x: 0, y: 0, z: 2 });
  const step: Box = { id: 'step', x: 0, z: 0, w: 3, d: 3, y: 0, h: 0.35, kind: 'step' };
  for (let i = 0; i < 16; i++) move(s, { ...neutralInput(), mz: 1 }, 'hider', CFG.dt, [step]);
  assert.equal(s.y, 0.35);
});
void test('parallel slab rays do not divide by zero', () => {
  const min = { x: -1, y: 0, z: -1 },
    max = { x: 1, y: 2, z: 1 };
  assert.equal(rayBox({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, min, max), 4);
  assert.equal(rayBox({ x: 3, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, min, max), null);
});
void test('aim follows movement convention', () => {
  const s = makeMotor({ x: 0, y: 0, z: 0 }),
    yaw = Math.PI / 2;
  move(s, { ...neutralInput(), yaw, mz: 1 }, 'hider', CFG.dt, []);
  assert.ok(s.x < 0 && aimDirection(yaw, 0).x < 0);
});
