// Node owns test completion; register synchronously so suite hooks bracket every test.
import assert from 'node:assert/strict';
import test from 'node:test';
import { SnapshotBuffer } from '../client/game/snapshot-buffer.js';
import type { Pose } from '../shared/types.js';

const pose = (x = 0, id = 'hider'): Pose => ({
  id,
  x,
  y: 0,
  z: 0,
  yaw: 0,
  pitch: 0,
  role: 'hider',
  alive: true,
  moving: 0,
  grounded: true,
  waving: false,
  dashing: false,
});
const frame = (now: number, players: Pose[], echo: Pose | null = null) => ({
  now,
  viewTime: now - 3000,
  players,
  echo,
});

void test('empty history never invents positions', () => {
  assert.deepEqual(new SnapshotBuffer().sample(1000), { players: [], echo: null, sampledAt: 1000 });
});
void test('interpolates received observations without mutating them', () => {
  const buffer = new SnapshotBuffer(0);
  const older = pose(0),
    newer = pose(10);
  buffer.push(frame(100, [older]));
  buffer.push(frame(200, [newer]));
  assert.equal(buffer.sample(150).players[0].x, 5);
  assert.equal(older.x, 0);
  assert.equal(newer.x, 10);
  assert.equal(buffer.sample(150).sampledAt, -2900);
});
void test('does not extrapolate beyond the newest authorized observation', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [pose(1)]));
  buffer.push(frame(200, [pose(2)]));
  assert.equal(buffer.sample(500).players[0].x, 2);
  assert.equal(buffer.sample(0).players[0].x, 1);
});
void test('interpolation latency is separate from the gameplay echo delay', () => {
  const buffer = new SnapshotBuffer(100);
  buffer.push(frame(100, [pose(0)]));
  buffer.push(frame(200, [pose(10)]));
  assert.equal(buffer.sample(250).players[0].x, 5);
});
void test('warps, death and role changes hold the older pose', () => {
  for (const change of [{ warp: 1 }, { alive: false }, { role: 'seeker' as const }]) {
    const buffer = new SnapshotBuffer(0);
    buffer.push(frame(100, [pose(0)]));
    buffer.push(frame(200, [{ ...pose(10), ...change }]));
    assert.equal(buffer.sample(150).players[0].x, 0);
  }
});
void test('rotation takes the shortest arc across pi', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [{ ...pose(), yaw: (179 * Math.PI) / 180 }]));
  buffer.push(frame(200, [{ ...pose(), yaw: (-179 * Math.PI) / 180 }]));
  assert.ok(Math.abs(buffer.sample(150).players[0].yaw - Math.PI) < 1e-9);
});
void test('newly visible players do not appear before their historical frame', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [pose(0)]));
  buffer.push(frame(200, [pose(10, 'new')]));
  assert.deepEqual(
    buffer.sample(150).players.map((p) => p.id),
    ['hider'],
  );
});
void test('clear releases previous rooms and interpolation caches', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [pose(0)]));
  buffer.push(frame(200, [pose(10)]));
  buffer.sample(150);
  assert.equal(buffer.retainedPoseCount, 1);
  buffer.clear();
  assert.equal(buffer.size, 0);
  assert.equal(buffer.retainedPoseCount, 0);
  assert.equal(buffer.sample(300).players.length, 0);
});
void test('history and cached poses remain bounded across player churn', () => {
  const buffer = new SnapshotBuffer(0, 3);
  for (let i = 0; i < 100; i++) {
    const id = String(i);
    buffer.push(frame(i * 200, [pose(0, id)]));
    buffer.push(frame(i * 200 + 100, [pose(10, id)]));
    buffer.sample(i * 200 + 50);
  }
  assert.equal(buffer.size, 3);
  assert.ok(buffer.retainedPoseCount <= 1);
});
void test('rejects duplicate, stale and non-finite timestamps', () => {
  const buffer = new SnapshotBuffer();
  assert.equal(buffer.push(frame(100, [])), true);
  for (const now of [100, 99, NaN, Infinity]) assert.equal(buffer.push(frame(now, [])), false);
  assert.equal(buffer.size, 1);
});
void test('echo interpolation does not change its historical discrete fields', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [], pose(0, 'self')));
  buffer.push(frame(200, [], { ...pose(10, 'self'), shielded: true }));
  const echo = buffer.sample(150).echo;
  assert.equal(echo?.x, 5);
  assert.equal(echo?.shielded, undefined);
});
void test('invalid buffer configuration is rejected', () => {
  assert.throws(() => new SnapshotBuffer(-1));
  assert.throws(() => new SnapshotBuffer(Infinity));
  assert.throws(() => new SnapshotBuffer(0, 1));
});

void test('reused scratch poses do not retain optional state from an older frame', () => {
  const buffer = new SnapshotBuffer(0);
  buffer.push(frame(100, [{ ...pose(0), shielded: true }]));
  buffer.push(frame(200, [pose(1)]));
  assert.equal(buffer.sample(150).players[0].shielded, true);
  buffer.push(frame(300, [pose(2)]));
  assert.equal(buffer.sample(250).players[0].shielded, undefined);
});
