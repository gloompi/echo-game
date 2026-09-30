// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVING_SPEED_MPS,
  selectMotion,
  type MotionPose,
} from '../client/game/character-motion.js';

const speeds = { run: 6.4, crouchWalk: 2.88 };
const pose = (fields: Partial<MotionPose> = {}): MotionPose => ({
  moving: 0,
  grounded: true,
  waving: false,
  ...fields,
});
const base = (fields: Partial<MotionPose>) => selectMotion(pose(fields), speeds).base;

void test('grounded speed chooses between idle and run, and airborne poses jump', () => {
  assert.deepEqual(selectMotion(pose(), speeds), {
    base: 'idle',
    overlay: false,
    flinch: true,
    timeScale: 1,
  });
  assert.equal(base({ moving: MOVING_SPEED_MPS - 0.01 }), 'idle');
  assert.deepEqual(selectMotion(pose({ moving: 6.4 }), speeds), {
    base: 'run',
    overlay: false,
    flinch: true,
    timeScale: 1,
  });
  assert.deepEqual(selectMotion(pose({ moving: 6.4, grounded: false }), speeds), {
    base: 'jump',
    overlay: false,
    flinch: true,
    timeScale: 1,
  });
});

void test('crouching picks the crouch clips, also in the air, and a slide overrides all', () => {
  assert.equal(base({ crouched: true }), 'crouch_idle');
  assert.equal(base({ crouched: true, moving: 2.88 }), 'crouch_walk');
  // The crouched collision height applies in the air, so the tall jump pose never shows.
  assert.equal(base({ crouched: true, grounded: false, moving: 6 }), 'crouch_idle');
  for (const fields of [
    { sliding: true, moving: 8 },
    { sliding: true, crouched: true, moving: 8 },
    { sliding: true, grounded: false, moving: 8 },
  ])
    assert.equal(base(fields), 'slide');
});

void test('looping clips play at the actual ground speed within bounded rates', () => {
  const rate = (fields: Partial<MotionPose>) => selectMotion(pose(fields), speeds).timeScale;
  assert.equal(rate({ moving: 8.64 }), 8.64 / 6.4);
  assert.equal(rate({ moving: 1 }), 0.5);
  assert.equal(rate({ moving: 16 }), 2);
  assert.equal(rate({ moving: 2.88, crouched: true }), 1);
  assert.equal(rate({ moving: 1.44, crouched: true }), 0.5);
  assert.equal(rate({ moving: 8, sliding: true }), 1);
  assert.equal(rate({ moving: 12, grounded: false }), 1);
  assert.deepEqual(selectMotion(pose({ moving: Number.NaN }), speeds), {
    base: 'idle',
    overlay: false,
    flinch: true,
    timeScale: 1,
  });
});

void test('the overlay and the hit flinch show when standing, never over a crouch or slide', () => {
  const overlays = (fields: Partial<MotionPose>) => {
    const { overlay, flinch } = selectMotion(pose({ waving: true, ...fields }), speeds);
    return [overlay, flinch];
  };
  assert.deepEqual(overlays({}), [true, true]);
  assert.deepEqual(overlays({ moving: 6.4 }), [true, true]);
  assert.deepEqual(overlays({ grounded: false }), [true, true]);
  assert.deepEqual(overlays({ crouched: true }), [false, false]);
  assert.deepEqual(overlays({ crouched: true, moving: 2.88 }), [false, false]);
  assert.deepEqual(overlays({ sliding: true, moving: 8 }), [false, false]);
  assert.equal(
    selectMotion(pose({ moving: 6.4 }), speeds).overlay,
    false,
    'no overlay unless waving',
  );
});
