import test from 'node:test';
import assert from 'node:assert/strict';
import { CFG } from '../shared/config.js';
import { History } from '../shared/history.js';
import { aimDirection, makeMotor, move, rayBox } from '../shared/physics.js';
import { neutralInput, type Box, type Pose } from '../shared/types.js';
import { createPlayer, poseOf, Room } from '../server/room.js';
import { parseMessage } from '../server/validation.js';
const at = 10_000;
function pair(isPublic = false) {
  const room = new Room('ABC234', isPublic, false, at); room.botsEnabled = false;
  const seeker = createPlayer('Seeker', at, false, 'seeker'), hider = createPlayer('Hider', at, false, 'hider');
  room.add(seeker, at); room.add(hider, at); assert.ok(room.start(at));
  room.phase = 'playing'; room.endsAt = at + CFG.roundMs;
  seeker.motor = makeMotor({ x: 20, y: 0, z: 10 }); hider.motor = makeMotor({ x: 20, y: 0, z: 0 });
  return { room, seeker, hider };
}
function pose(x: number, id = 'a'): Pose { return { id, x, y: 0, z: 0, yaw: 0, pitch: 0, role: 'hider', alive: true, moving: 1, grounded: true, waving: false, dashing: false }; }
test('history never exposes a current frame during warm-up', () => {
  const h = new History(); h.record(1000, [pose(9)]); assert.deepEqual(h.sample(999), []);
});
test('history copies input and output and interpolates the requested instant', () => {
  const h = new History(), p = pose(0); h.record(1000, [p]); p.x = 99; h.record(2000, [pose(10)]);
  const sample = h.sample(1500); assert.equal(sample[0].x, 5); sample[0].x = 88; assert.equal(h.sample(1500)[0].x, 5);
});
test('history interpolates yaw over the shortest arc', () => {
  const h = new History(); h.record(0, [{ ...pose(0), yaw: Math.PI - 0.1 }]); h.record(100, [{ ...pose(0), yaw: -Math.PI + 0.1 }]);
  assert.ok(Math.abs(h.sample(50)[0].yaw - Math.PI) < 1e-8);
});
test('history is bounded and clear removes the previous round', () => {
  const h = new History(); for (let i = 0; i < 1000; i++) h.record(i * 100, [pose(i)]);
  assert.ok(h.frames.length <= 53); h.clear(); assert.deepEqual(h.sample(100000), []);
});
test('seeker receives remote poses three seconds old, but their own pose is current', () => {
  const { room, seeker, hider } = pair(); room.history.clear(); room.history.record(at, [poseOf(seeker, at), poseOf(hider, at)]);
  hider.motor.x = 14; seeker.motor.x = 19;
  const s = room.snapshot(seeker, at + 3000);
  assert.equal(s.players[0].x, 20); assert.equal(s.self.x, 19); assert.equal(s.viewTime, at); assert.equal(s.echo, null);
});
test('hider sees live others and receives only their own historical echo', () => {
  const { room, seeker, hider } = pair(); room.history.clear(); room.history.record(at, [poseOf(seeker, at), poseOf(hider, at)]);
  hider.motor.x = 14; seeker.motor.x = 19;
  const s = room.snapshot(hider, at + 3000); assert.equal(s.players[0].x, 19); assert.equal(s.echo?.x, 20); assert.equal(s.self.x, 14);
});
test('roster does not leak transforms, aim, or velocity', () => {
  const { room, seeker } = pair();
  for (const p of room.snapshot(seeker, at).roster) for (const key of ['x', 'y', 'z', 'yaw', 'pitch', 'vx', 'vy', 'vz', 'motor']) assert.ok(!(key in p));
});
test('other-player spatial events are held back for seekers, not hiders', () => {
  const { room, seeker, hider } = pair(); room.event({ actor: hider.id, at, kind: 'wave', from: { x: 14, y: 0, z: 0 } });
  assert.equal(room.snapshot(seeker, at + 2999).events.length, 0); assert.equal(room.snapshot(seeker, at + 3000).events.length, 1);
  assert.equal(room.snapshot(hider, at).events.length, 1);
});
test('seeker receives their own shot immediately', () => {
  const { room, seeker } = pair(); room.fire(seeker, at); assert.ok(room.snapshot(seeker, at).events.some(e => e.kind === 'shot'));
});
test('shooting a historical echo misses the present hider and awards a bait', () => {
  const { room, seeker, hider } = pair(); room.history.clear(); room.history.record(at, [poseOf(hider, at)]); hider.motor.x = 14;
  room.fire(seeker, at + 3000); assert.equal(hider.hp, 2); assert.equal(hider.baits, 1); assert.equal(room.events[0].echo, true); assert.equal(room.events[0].hit, false);
});
test('prediction can hit a current hider even when the delayed pose is elsewhere', () => {
  const { room, seeker, hider } = pair(); room.history.clear(); room.history.record(at, [{ ...poseOf(hider, at), x: 14 }]);
  room.fire(seeker, at + 3000); assert.equal(hider.hp, 1); assert.equal(seeker.tags, 1); assert.equal(room.events[0].hit, true);
});
test('solid cover blocks a shot before a hider', () => {
  const { room, seeker, hider } = pair(); seeker.motor = makeMotor({ x: 0, y: 0, z: 8 }); hider.motor = makeMotor({ x: 0, y: 0, z: -8 });
  room.fire(seeker, at); assert.equal(hider.hp, 2); assert.equal(room.events[0].hit, false);
});
test('only the closest live hider on a ray is damaged', () => {
  const { room, seeker, hider } = pair(); const other = createPlayer('Near', at); room.add(other, at); other.joinedRound = room.round; other.alive = true; other.motor = makeMotor({ x: 20, y: 0, z: 5 });
  room.fire(seeker, at); assert.equal(other.hp, 1); assert.equal(hider.hp, 2);
});
test('fire rate and magazine are server enforced', () => {
  const { room, seeker, hider } = pair(); hider.motor.x = 14;
  room.fire(seeker, at); room.fire(seeker, at + 1); assert.equal(seeker.ammo, 11);
  for (let i = 1; i <= 20; i++) room.fire(seeker, at + i * CFG.fireInterval);
  assert.equal(seeker.ammo, 0); assert.equal(room.events.filter(e => e.kind === 'shot').length, 12);
});
test('two hits catch a hider and finish the round; finished rounds cannot shoot', () => {
  const { room, seeker, hider } = pair(); room.fire(seeker, at); room.fire(seeker, at + 200); assert.equal(hider.alive, false);
  room.tick(at + 201); assert.equal(room.winner, 'seeker'); const ammo = seeker.ammo; room.fire(seeker, at + 500); assert.equal(seeker.ammo, ammo);
});
test('hiders cannot shoot', () => { const { room, hider } = pair(); room.fire(hider, at); assert.equal(hider.ammo, 12); assert.equal(room.events.length, 0); });
test('head start freezes seeker movement and shooting while hiders move', () => {
  const { room, seeker, hider } = pair(); room.phase = 'headstart'; room.endsAt = at + 5000;
  room.setInput(seeker, { ...neutralInput(1), mz: 1, shoot: true }, at); room.setInput(hider, { ...neutralInput(1), mz: 1 }, at);
  room.tick(at + 33); assert.equal(seeker.motor.z, 10); assert.equal(seeker.ammo, 12); assert.ok(hider.motor.z < 0);
});
test('timeout awards hiders and next round starts automatically', () => {
  const { room } = pair(); room.endsAt = at + 100; room.tick(at + 101); assert.equal(room.winner, 'hider'); room.tick(room.endsAt + 1); assert.equal(room.phase, 'headstart'); assert.equal(room.round, 2);
});
test('reload duration is authoritative', () => {
  const { room, seeker } = pair(); seeker.ammo = 3; room.setInput(seeker, { ...neutralInput(1), reload: true }, at);
  room.tick(at); assert.equal(seeker.reloadUntil, at + CFG.reloadMs); room.tick(at + CFG.reloadMs - 1); assert.equal(seeker.ammo, 3); room.tick(at + CFG.reloadMs); assert.equal(seeker.ammo, 12);
});
test('duplicate and implausibly far-ahead inputs are rejected', () => {
  const { room, hider } = pair(); room.setInput(hider, { ...neutralInput(1), mx: 1 }, at); room.setInput(hider, { ...neutralInput(1), mx: -1 }, at); assert.equal(hider.input.mx, 1);
  room.setInput(hider, neutralInput(99999), at); assert.equal(hider.input.seq, 1);
});
test('late private-room joins spectate until the next round', () => {
  const { room, seeker } = pair(); const late = createPlayer('Late', at); room.add(late, at);
  assert.equal(room.snapshot(late, at).self.spectating, true); assert.equal(late.alive, false); assert.ok(!room.snapshot(seeker, at + 3000).players.some(p => p.id === late.id));
});
test('public quick-play joins can enter as live hiders', () => {
  const { room } = pair(true); const late = createPlayer('Late', at); room.add(late, at); assert.equal(late.alive, true); assert.equal(late.joinedRound, room.round);
});
test('capacity is eight; host transfers to the next human', () => {
  const { room, seeker, hider } = pair(); for (let i = 0; i < 6; i++) assert.equal(room.add(createPlayer(`P${i}`, at), at), true);
  assert.equal(room.add(createPlayer('Overflow', at), at), false); room.remove(seeker.id); assert.equal(room.host, hider.id);
});
test('seeker bots cannot shoot without delayed observations', () => {
  const { room, seeker } = pair(); room.history.clear(); const input = room.botInput(seeker, at + 2000); assert.equal(input.shoot, false);
});
test('diagonal movement cannot exceed straight-line speed', () => {
  const a = makeMotor({ x: 0, y: 0, z: 0 }), b = makeMotor(a);
  for (let i = 0; i < 30; i++) { move(a, { ...neutralInput(), mz: 1 }, 'hider', CFG.dt, []); move(b, { ...neutralInput(), mx: 1, mz: 1 }, 'hider', CFG.dt, []); }
  assert.ok(Math.abs(Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)) < 1e-7);
});
test('jump lands and holding jump does not bunny-hop automatically', () => {
  const s = makeMotor({ x: 0, y: 0, z: 0 }); let peak = 0;
  for (let i = 0; i < 90; i++) { move(s, { ...neutralInput(), jump: true }, 'hider', CFG.dt, []); peak = Math.max(peak, s.y); }
  assert.ok(peak > 1.4); assert.equal(s.y, 0); assert.equal(s.grounded, true);
});
test('dash cannot tunnel through thin cover', () => {
  const s = makeMotor({ x: 0, y: 0, z: 2 }); const wall: Box = { id: 'wall', x: 0, z: 0, w: 10, d: 0.2, y: 0, h: 3, kind: 'cover' };
  for (let i = 0; i < 30; i++) move(s, { ...neutralInput(), mz: 1, dash: i === 0 }, 'hider', CFG.dt, [wall]);
  assert.ok(s.z >= 0.46 - 1e-6); assert.ok(s.dashCooldown > 0);
});
test('small stair steps are climbable', () => {
  const s = makeMotor({ x: 0, y: 0, z: 2 }); const step: Box = { id: 'step', x: 0, z: 0, w: 3, d: 3, y: 0, h: 0.35, kind: 'step' };
  for (let i = 0; i < 8; i++) move(s, { ...neutralInput(), mz: 1 }, 'hider', CFG.dt, [step]); assert.equal(s.y, 0.35);
});
test('parallel-axis ray slab test does not divide by zero', () => {
  const min = { x: -1, y: 0, z: -1 }, max = { x: 1, y: 2, z: 1 };
  assert.equal(rayBox({ x: 0, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, min, max), 4);
  assert.equal(rayBox({ x: 3, y: 1, z: 5 }, { x: 0, y: 0, z: -1 }, min, max), null);
});
test('aim convention agrees with movement direction', () => {
  const s = makeMotor({ x: 0, y: 0, z: 0 }), yaw = Math.PI / 2; move(s, { ...neutralInput(), yaw, mz: 1 }, 'hider', CFG.dt, []);
  const dir = aimDirection(yaw, 0); assert.ok(s.x < 0 && dir.x < 0);
});
test('message validation rejects malformed data and normalizes controls', () => {
  for (const s of ['{', 'null', '[]', '{"type":"input"}', '{"type":"oops"}']) assert.equal(parseMessage(s), null);
  const valid = parseMessage(JSON.stringify({ type: 'input', input: { ...neutralInput(1), mx: 999, pitch: 99 } }));
  assert.ok(valid?.type === 'input'); assert.equal(valid.input.mx, 1); assert.equal(valid.input.pitch, 1.3);
  assert.equal(parseMessage(JSON.stringify({ type: 'input', input: { ...neutralInput(), shoot: 'true' } })), null);
  assert.equal(parseMessage('{"type":"input","input":{"seq":1,"mx":1e999,"mz":0,"yaw":0,"pitch":0,"shoot":false,"sprint":false,"jump":false,"dash":false,"reload":false,"wave":false}}'), null);
});
test('names are sanitized and join codes normalized', () => {
  const msg = parseMessage(JSON.stringify({ type: 'join', mode: 'join', name: '<Hi>\u0000', room: 'abc234' }));
  assert.ok(msg?.type === 'join'); assert.equal(msg.name, 'Hi'); assert.equal(msg.room, 'ABC234');
});

test('crafted join-mode objects cannot throw or crash validation', () => {
  for (const mode of [null, {}, { toString: null }, 7, ['create']]) {
    assert.equal(parseMessage(JSON.stringify({ type: 'join', name: 'Bad', mode })), null);
  }
});
