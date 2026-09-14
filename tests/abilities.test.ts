// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshBalance,
  balanceError,
  BALANCE_LIMITS,
  getBalanceValue,
  setBalanceValue,
  SKINS,
} from '../shared/balance.js';
import { DEFAULT_SETTINGS, validSettings } from '../shared/settings.js';
import { makeMotor, move, bodyHeight, canOccupy } from '../shared/physics.js';
import { neutralInput, type Box } from '../shared/types.js';
import { CFG } from '../shared/config.js';
import { maximumHiderSpeed, possibleRegions } from '../shared/scan.js';
import { changeBinding, DEFAULT_BINDINGS } from '../shared/controls.js';
const options = () => ({ ...DEFAULT_SETTINGS, balance: freshBalance() });
const runner = () => Object.assign(makeMotor({ x: 0, y: 0, z: 0 }), { vz: -8 });
const slideInput = () => ({ ...neutralInput(), sprint: true, mz: 1, crouch: true });
const step = (
  s: ReturnType<typeof makeMotor>,
  i = slideInput(),
  role: 'hider' | 'seeker' = 'hider',
  boxes: Box[] = [],
  settings = options(),
) => move(s, i, role, CFG.dt, boxes, 1000, settings);
void test('default balance is valid, cloned, and accepted by room validation', () => {
  const a = freshBalance(),
    b = freshBalance();
  a.shield.durationMs = 1234;
  assert.notEqual(a.shield.durationMs, b.shield.durationMs);
  assert.equal(balanceError(b), null);
  assert.ok(validSettings(options()));
});
void test('all schema fields have matching values and reject invalid types or bounds', () => {
  for (const [path, rule] of Object.entries(BALANCE_LIMITS)) {
    const b = freshBalance();
    assert.equal(typeof getBalanceValue(b, path), rule.kind === 'boolean' ? 'boolean' : 'number');
    setBalanceValue(b, path, rule.kind === 'boolean' ? 99 : 'max' in rule ? rule.max + 1 : 0);
    assert.ok(balanceError(b), path);
  }
});
void test('balance rejects unknown, missing, nonfinite, fractional and unsafe values', () => {
  const base = freshBalance();
  assert.ok(balanceError({ ...base, hacked: true }));
  const missing = structuredClone(base) as unknown as Record<string, unknown>;
  delete missing.shield;
  assert.ok(balanceError(missing));
  for (const value of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER]) {
    const b = freshBalance();
    b.shield.durationMs = value;
    assert.ok(balanceError(b));
  }
});
void test('cooldown must exceed duration and web remains non-damaging', () => {
  const b = freshBalance();
  b.shield.durationMs = b.shield.cooldownMs;
  assert.ok(balanceError(b));
  const w = freshBalance();
  w.weapons.web.damage = 1;
  assert.ok(balanceError(w));
  const c = freshBalance();
  c.weapons.blaster.enabled = false;
  assert.ok(balanceError(c));
});
void test('new combat keys cannot conflict with rebindable crouch/jump', () => {
  for (const code of ['KeyG', 'KeyV', 'KeyB', 'Digit1', 'Digit2', 'Digit3', 'Digit4'])
    assert.equal(changeBinding({ ...DEFAULT_BINDINGS }, 'crouch', code), null);
  assert.equal(new Set(SKINS).size, 8);
});
void test('sprint plus fresh crouch starts a low slide without losing entry speed', () => {
  const s = runner();
  step(s);
  assert.equal(s.crouched, true);
  assert.ok(s.slideTime! > 0);
  assert.ok(Math.abs(Math.hypot(s.vx, s.vz) - 8) < 1e-10);
  assert.equal(s.stamina, 88);
  assert.equal(bodyHeight(s.crouched), 1.12);
});
void test('slide conserves speed for its active duration on level empty ground', () => {
  const s = runner();
  for (let i = 0; i < 40; i++) {
    step(s);
    assert.ok(Math.abs(Math.hypot(s.vx, s.vz) - 8) < 1e-9);
  }
  assert.ok(s.slideTime! > 0);
  assert.equal(s.stamina, 88);
});
void test('slide steering changes direction but cannot manufacture extra speed', () => {
  const s = runner();
  step(s);
  const input = { ...slideInput(), mx: 1, mz: 0 };
  for (let i = 0; i < 25; i++) step(s, input);
  assert.ok(s.vx > 0);
  assert.ok(Math.abs(Math.hypot(s.vx, s.vz) - 8) < 1e-9);
});
void test('stationary, airborne, exhausted and seeker characters cannot initiate slides', () => {
  const tweaks: Partial<ReturnType<typeof makeMotor>>[] = [
    { vz: 0 },
    { grounded: false, y: 2 },
    { stamina: 0 },
    { crouchHeld: true },
  ];
  for (const tweak of tweaks) {
    const s = Object.assign(runner(), tweak);
    step(s);
    assert.equal(s.slideTime, 0);
  }
  const s = runner();
  step(s, slideInput(), 'seeker');
  assert.equal(s.slideTime, 0);
});
void test('release, duration expiry, disabled ability, jump and control stop slides', () => {
  for (const kind of ['release', 'expiry', 'disabled', 'jump', 'control']) {
    const s = runner(),
      settings = options();
    step(s);
    const i = slideInput();
    if (kind === 'release') i.crouch = false;
    if (kind === 'jump') i.jump = true;
    if (kind === 'control') s.controlLeft = 1;
    if (kind === 'disabled') settings.balance.slide.enabled = false;
    if (kind === 'expiry') for (let n = 0; n < 60; n++) step(s, i, 'hider', [], settings);
    else step(s, i, 'hider', [], settings);
    assert.equal(s.slideTime, 0, kind);
  }
});
void test('repeated crouch presses respect the slide cooldown', () => {
  const s = runner();
  step(s);
  step(s, { ...slideInput(), crouch: false });
  s.vz = -8;
  step(s);
  assert.equal(s.slideTime, 0);
});
void test('sliding uses real crouch clearance and cannot stand inside a low ceiling', () => {
  const b: Box = { id: 'tunnel', x: 0, z: -2, w: 4, d: 4, y: 1.25, h: 2, kind: 'cover' };
  const s = runner();
  step(s, slideInput(), 'hider', [b]);
  assert.ok(s.z < 0);
  assert.equal(s.crouched, true);
  step(s, { ...slideInput(), crouch: false }, 'hider', [b]);
  assert.equal(s.crouched, true);
  assert.equal(canOccupy(s, CFG.height, [b]), false);
});
void test('root disables movement, jump, dash and slide while gravity still works', () => {
  const s = Object.assign(runner(), { y: 2, grounded: false, controlLeft: 1 });
  step(s, { ...slideInput(), jump: true, dash: true });
  assert.equal(s.vx, 0);
  assert.equal(s.vz, 0);
  assert.equal(s.dashTime, 0);
  assert.ok(s.y < 2);
  assert.ok(s.controlLeft < 1);
});
void test('hook pull respects solid cover and never overshoots its stopping radius', () => {
  const s = Object.assign(makeMotor({ x: 0, y: 0, z: 0 }), {
    controlLeft: 2,
    pullLeft: 2,
    pullX: 10,
    pullZ: 0,
    pullSpeed: 14,
  });
  const b: Box = { id: 'wall', x: 2, z: 0, w: 0.5, d: 8, y: 0, h: 4, kind: 'cover' };
  for (let n = 0; n < 90; n++) step(s, neutralInput(), 'hider', [b]);
  assert.ok(s.x < 1.4);
  const q = Object.assign(makeMotor({ x: 0, y: 0, z: 0 }), {
    controlLeft: 2,
    pullLeft: 2,
    pullX: 2,
    pullZ: 0,
    pullSpeed: 14,
  });
  for (let n = 0; n < 30; n++) step(q, neutralInput());
  assert.ok(q.x <= 0.95000001);
  assert.ok(q.x > 0.9);
});
void test('prediction is deterministic including control, slide and held-button state', () => {
  const a = runner(),
    b = runner();
  for (let n = 0; n < 200; n++) {
    const input = {
      ...neutralInput(n),
      mz: 1,
      mx: Math.sin(n),
      yaw: n * 0.01,
      crouch: n > 10 && n < 45,
      sprint: true,
      jump: n % 53 === 0,
    };
    step(a, input);
    step(b, input);
    assert.deepEqual(a, b);
  }
});
void test('scan bound uses public speed limits and measured observation age', () => {
  const settings = options(),
    p = { x: 4, y: 0, z: 5 };
  const speed = maximumHiderSpeed(settings);
  const r = possibleRegions(p, 3100, settings, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].radius, speed * 3.1 + CFG.radius);
  assert.equal(r[0].x, p.x);
  assert.deepEqual(possibleRegions(p, NaN, settings, []), []);
});
void test('scan includes reachable mirror exits and terminates on zero-cost cycles', () => {
  const settings = options();
  const portals = [
    { id: 'a', target: 'b', x: 0, y: 0, z: 0, exit: { x: 0, y: 0, z: 0 } },
    { id: 'b', target: 'a', x: 100, y: 0, z: 0, exit: { x: 100, y: 0, z: 0 } },
  ];
  const regions = possibleRegions({ x: 0, y: 0, z: 0 }, 1000, settings, portals);
  assert.ok(regions.some((r) => r.viaMirror && r.x === 100));
  assert.ok(regions.length <= 3);
  const unreachable = possibleRegions({ x: 50, y: 0, z: 50 }, 1, settings, portals);
  assert.equal(unreachable.length, 1);
});
