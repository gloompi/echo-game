// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { SKINS } from '../shared/balance.js';
import {
  CharacterModel,
  HIDER_HOODIE,
  prepareCharacterTemplate,
  skinnedMeshes,
  TINT_MATERIAL,
  type CharacterTemplate,
} from '../client/character-assets.js';
import { BASE_CLIPS, type MotionPose } from '../client/game/character-motion.js';
import { Character } from '../client/models.js';
import { SkinnedCharacter } from '../client/skinned-character.js';
import { parseGlb } from './glb.js';

const glb = readFileSync(new URL('../public/assets/characters/hider-hoodie.glb', import.meta.url));
/** The shipped runtime GLB, parsed fresh for every test. */
async function loadGlb(): Promise<{ scene: T.Object3D; animations: T.AnimationClip[] }> {
  const gltf = await parseGlb(glb);
  return { scene: gltf.scene, animations: gltf.animations };
}
async function loadTemplate(): Promise<CharacterTemplate> {
  const { scene, animations } = await loadGlb();
  return prepareCharacterTemplate(scene, animations, HIDER_HOODIE);
}
const bonesOf = (clip: T.AnimationClip) =>
  new Set(clip.tracks.map((track) => T.PropertyBinding.parseTrackName(track.name).nodeName));
function bone(root: T.Object3D, name: string): T.Object3D {
  const found = root.getObjectByName(name);
  assert.ok(found, `missing bone ${name}`);
  return found;
}
const STEP_SECONDS = 1 / 60;
/** Skinned primitives in the shipped GLB: the textured body and the `tint_light` hoodie. */
const MESHES = 2;
/** The speed the run clip was authored for, so it plays at its own rate (time scale 1). */
const RUN = HIDER_HOODIE.speeds.run;
function play(character: SkinnedCharacter, fields: Partial<MotionPose>, seconds: number): void {
  const pose: MotionPose = { moving: 0, grounded: true, waving: false, ...fields };
  for (let step = Math.round(seconds / STEP_SECONDS); step > 0; step--)
    character.update(pose, STEP_SECONDS);
}
/** A plain clone playing one full source clip, the pose the layered instance must reproduce. */
function reference(template: CharacterTemplate, clip: T.AnimationClip) {
  const root = cloneSkinned(template.scene),
    mixer = new T.AnimationMixer(root);
  mixer.clipAction(clip).play();
  return {
    root,
    advance(seconds: number) {
      for (let step = Math.round(seconds / STEP_SECONDS); step > 0; step--)
        mixer.update(STEP_SECONDS);
    },
  };
}
/** Component distance, sign-insensitive. Quaternion.angleTo takes acos of a dot product near 1,
 * which turns float32 key rounding into about 5e-4 rad, so it cannot test equality. */
function rotationDistance(a: T.Quaternion, b: T.Quaternion): number {
  const same = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z, a.w - b.w),
    flipped = Math.hypot(a.x + b.x, a.y + b.y, a.z + b.z, a.w + b.w);
  return Math.min(same, flipped);
}
function assertSameRotation(a: T.Object3D, b: T.Object3D, label: string): void {
  const distance = rotationDistance(a.quaternion, b.quaternion);
  assert.ok(distance < 1e-6, `${label} differs by ${distance}`);
}
/** Posed skinned bounds in world space; clips are in place, so the root stays at the origin. */
function posedBounds(root: T.Object3D): T.Box3 {
  root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  for (const mesh of skinnedMeshes(root)) {
    mesh.computeBoundingBox();
    bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  return bounds;
}
/** The farthest any skinned vertex reaches past its mesh's fixed culling sphere (metres). */
function reachPastSphere(root: T.Object3D): number {
  root.updateMatrixWorld(true);
  const vertex = new T.Vector3(),
    skinned = new T.Vector3(),
    part = new T.Vector3(),
    matrix = new T.Matrix4();
  let worst = -Infinity;
  for (const mesh of skinnedMeshes(root)) {
    mesh.skeleton.update();
    const { position, skinIndex, skinWeight } = mesh.geometry.attributes,
      sphere = mesh.boundingSphere,
      boneMatrices = mesh.skeleton.boneMatrices;
    assert.ok(boneMatrices, 'the skeleton computed its bone matrices');
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
      skinned.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        const weight = skinWeight.getComponent(i, j);
        if (!weight) continue;
        matrix.fromArray(boneMatrices, skinIndex.getComponent(i, j) * 16);
        skinned.addScaledVector(part.copy(vertex).applyMatrix4(matrix), weight);
      }
      skinned.applyMatrix4(mesh.bindMatrixInverse);
      worst = Math.max(worst, skinned.distanceTo(sphere.center) - sphere.radius);
    }
  }
  return worst;
}
/** CIELAB L* and the sRGB HSL hue (degrees) and HSV saturation of a hex colour. */
function readability(hex: number): { lightness: number; hue: number; saturation: number } {
  const channels = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((value) => value / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const lightness = y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
  const hsl = new T.Color(hex).getHSL({ h: 0, s: 0, l: 0 }, T.SRGBColorSpace),
    max = Math.max(...channels);
  return { lightness, hue: hsl.h * 360, saturation: max ? (max - Math.min(...channels)) / max : 0 };
}

void test('the shipped Hider GLB meets the character runtime contract', async () => {
  const { scene, animations } = await loadGlb();
  const template = prepareCharacterTemplate(scene, animations, HIDER_HOODIE);
  const meshes = skinnedMeshes(template.scene);
  assert.equal(meshes.length, MESHES);
  assert.equal(new Set(meshes.map((mesh) => mesh.skeleton)).size, 1);
  const upperBones = bonesOf(template.overlay);
  for (const name of ['spine', 'chest', 'head', 'upper_armR', 'handL'])
    assert.ok(upperBones.has(name));
  for (const name of BASE_CLIPS) {
    const source = animations.find((clip) => clip.name === name);
    assert.ok(source, name);
    const lower = template.lower[name],
      upper = template.upper[name];
    assert.equal(lower.duration, source.duration);
    assert.equal(upper.duration, source.duration);
    assert.equal(lower.tracks.length + upper.tracks.length, source.tracks.length);
    for (const legBone of ['hips', 'thighL', 'shinR', 'footL'])
      assert.ok(bonesOf(lower).has(legBone), `${name} legs keep ${legBone}`);
    for (const upperBone of bonesOf(upper)) assert.ok(upperBones.has(upperBone), upperBone);
  }
  assert.equal(template.hit.blendMode, T.AdditiveAnimationBlendMode);
  assert.equal(
    animations.find((clip) => clip.name === 'hit')?.blendMode,
    T.NormalAnimationBlendMode,
    'the source clip is not rewritten',
  );
  const chest = template.hit.tracks.find((track) => track.name === 'chest.quaternion');
  assert.ok(chest);
  const first = new T.Quaternion().fromArray(chest.values, 0);
  assert.ok(first.angleTo(new T.Quaternion()) < 1e-6, 'the flinch starts from no offset');
});

void test('an invalid model is rejected before any character uses it', async () => {
  const withoutWave = await loadGlb();
  assert.throws(
    () =>
      prepareCharacterTemplate(
        withoutWave.scene,
        withoutWave.animations.filter((clip) => clip.name !== 'wave'),
        HIDER_HOODIE,
      ),
    /missing clips: wave/,
  );
  const withoutTint = await loadGlb();
  for (const mesh of skinnedMeshes(withoutTint.scene))
    if (mesh.material instanceof T.Material && mesh.material.name === TINT_MATERIAL)
      mesh.material = new T.MeshStandardMaterial({ name: 'hoodie' });
  assert.throws(
    () => prepareCharacterTemplate(withoutTint.scene, withoutTint.animations, HIDER_HOODIE),
    /no tint_light material/,
  );
  assert.throws(
    () => prepareCharacterTemplate(new T.Group(), withoutTint.animations, HIDER_HOODIE),
    /no skinned mesh/,
  );
});

void test('each skin recolours only the hoodie with one shared, readable material', async () => {
  const template = await loadTemplate();
  const authored = skinnedMeshes(template.scene)
    .map((mesh) => mesh.material)
    .find(
      (material) => material instanceof T.MeshStandardMaterial && material.name === TINT_MATERIAL,
    );
  assert.ok(authored instanceof T.MeshStandardMaterial);
  assert.equal(
    authored.color.getHex(),
    HIDER_HOODIE.tints.classic,
    'classic is the authored colour',
  );
  const materials = new Set<T.Material>();
  for (const skin of SKINS) {
    const material = template.tint(skin);
    assert.equal(template.tint(skin), material, 'one cached material per skin');
    assert.ok(material instanceof T.MeshStandardMaterial);
    assert.equal(material.color.getHex(), HIDER_HOODIE.tints[skin]);
    materials.add(material);
    // The brief's approved rules: every hoodie L* >= 50 (R1); saturated blues, the Seeker's
    // hue family, L* >= 65 (R2). HSV saturation >= 0.25 counts as saturated, which leaves the
    // carbon grey (0.11) out, as the approved table does.
    const { lightness, hue, saturation } = readability(HIDER_HOODIE.tints[skin]);
    assert.ok(lightness >= 50, `${skin} hoodie L* ${lightness.toFixed(1)} is below 50`);
    if (hue >= 190 && hue <= 240 && saturation >= 0.25)
      assert.ok(lightness >= 65, `${skin} blue hoodie L* ${lightness.toFixed(1)} is below 65`);
  }
  assert.equal(materials.size, SKINS.length);
});

void test('characters share the template resources and release only their own', async (t) => {
  const template = await loadTemplate(),
    templateMeshes = skinnedMeshes(template.scene);
  const geometries = new Set(templateMeshes.map((mesh) => mesh.geometry)),
    sharedMaterials = new Set<T.Material>(SKINS.map((skin) => template.tint(skin)));
  for (const mesh of templateMeshes)
    if (mesh.material instanceof T.Material) sharedMaterials.add(mesh.material);
  let released = 0;
  for (const resource of [...geometries, ...sharedMaterials])
    resource.addEventListener('dispose', () => released++);
  const skeletonDisposals = t.mock.method(T.Skeleton.prototype, 'dispose');

  const scene = new T.Scene(),
    first = new SkinnedCharacter(template),
    second = new SkinnedCharacter(template);
  scene.add(first.root, second.root);
  first.setSkin('ember');
  second.setSkin('ember');
  const skeletons = [first, second].map((character) => {
    const meshes = skinnedMeshes(character.root);
    assert.equal(meshes.length, templateMeshes.length);
    for (const mesh of meshes) {
      assert.ok(geometries.has(mesh.geometry), 'geometry is shared, not copied');
      assert.ok(mesh.material instanceof T.Material && sharedMaterials.has(mesh.material));
      assert.equal(mesh.castShadow, true);
    }
    const skeleton = new Set(meshes.map((mesh) => mesh.skeleton));
    assert.equal(skeleton.size, 1, 'one skeleton per character');
    return [...skeleton][0];
  });
  assert.notEqual(skeletons[0], skeletons[1]);
  assert.equal(
    skinnedMeshes(first.root).filter((mesh) => mesh.material === template.tint('ember')).length,
    1,
  );

  first.dispose();
  assert.equal(first.root.parent, null);
  assert.equal(second.root.parent, scene);
  assert.equal(released, 0, 'shared geometry and materials stay alive');
  assert.equal(skeletonDisposals.mock.callCount(), 1);
  assert.equal(skeletonDisposals.mock.calls[0]?.this, skeletons[0]);
});

void test('the legs keep the base clip in step while the upper body waves', async () => {
  const { scene, animations } = await loadGlb();
  const template = prepareCharacterTemplate(scene, animations, HIDER_HOODIE),
    source = (name: string) => {
      const clip = animations.find((candidate) => candidate.name === name);
      assert.ok(clip, name);
      return clip;
    };
  const character = new SkinnedCharacter(template),
    run = reference(template, source('run')),
    wave = reference(template, source('wave'));
  play(character, { moving: RUN, waving: true }, 0.5);
  run.advance(0.5);
  wave.advance(0.5);
  for (const name of ['hips', 'thighL', 'shinR', 'footL'])
    assertSameRotation(bone(character.root, name), bone(run.root, name), `waving run ${name}`);
  for (const name of ['chest', 'upper_armR', 'forearmR', 'handR', 'head'])
    assertSameRotation(bone(character.root, name), bone(wave.root, name), `waving ${name}`);
  assert.ok(
    bone(character.root, 'hips').position.distanceTo(bone(run.root, 'hips').position) < 1e-6,
  );
  // Once the wave fades out, the upper body rejoins the run on the legs' clock.
  play(character, { moving: RUN }, 0.5);
  run.advance(0.5);
  for (const name of ['thighR', 'chest', 'upper_armL', 'upper_armR', 'head'])
    assertSameRotation(bone(character.root, name), bone(run.root, name), `run ${name}`);
  character.dispose();
});

void test('crouch and slide clips fit the crouch clearance and standing returns to full height', async () => {
  const template = await loadTemplate(),
    character = new SkinnedCharacter(template),
    clearance = 1.12;
  for (const [label, fields] of [
    ['crouch', { crouched: true }],
    ['crouch walk', { crouched: true, moving: 2.88 }],
    ['slide', { sliding: true, moving: 8 }],
    ['waving crouch', { crouched: true, waving: true }],
  ] as const) {
    play(character, fields, 0.6);
    for (let sample = 0; sample < 4; sample++) {
      play(character, fields, 0.13);
      const height = posedBounds(character.root).max.y;
      assert.ok(height <= clearance, `${label} is ${height.toFixed(3)} m tall`);
    }
  }
  play(character, {}, 0.6);
  assert.ok(posedBounds(character.root).max.y > 2.1, 'standing idle is full height');
  character.dispose();
});

void test('the hit flinch shows over standing clips and never lifts a crouch', async () => {
  const template = await loadTemplate(),
    flinching = new SkinnedCharacter(template),
    steady = new SkinnedCharacter(template),
    chests = () =>
      rotationDistance(
        bone(flinching.root, 'chest').quaternion,
        bone(steady.root, 'chest').quaternion,
      );
  const both = (fields: Partial<MotionPose>, seconds: number) => {
    play(flinching, fields, seconds);
    play(steady, fields, seconds);
  };
  both({ moving: 6.4 }, 0.5);
  flinching.hit();
  both({ moving: 6.4 }, 0.1);
  assert.ok(chests() > 0.02, `running chest recoil ${chests()}`);
  both({ moving: 6.4 }, 0.4);
  assert.ok(chests() < 1e-6, 'the flinch settles back into the run');

  const crouch = { crouched: true };
  both(crouch, 0.5);
  flinching.hit();
  for (let frame = 0; frame < 30; frame++) {
    both(crouch, STEP_SECONDS);
    const height = posedBounds(flinching.root).max.y;
    assert.ok(height <= 1.12, `a flinching crouch is ${height.toFixed(3)} m tall`);
    assert.ok(chests() < 1e-6, 'no flinch over a crouch');
  }
  flinching.dispose();
  steady.dispose();
});

void test('the fixed culling sphere encloses every clip, overlay and speed', async () => {
  const template = await loadTemplate();
  for (const fields of [
    {},
    { moving: 6.4 },
    { moving: 16 },
    { grounded: false },
    { crouched: true },
    { crouched: true, moving: 2.88 },
    { sliding: true, moving: 8 },
    { waving: true },
    { waving: true, moving: 6.4 },
  ] satisfies Partial<MotionPose>[]) {
    const character = new SkinnedCharacter(template);
    play(character, fields, 0.2);
    character.hit();
    for (let sample = 0; sample < 5; sample++) {
      play(character, fields, 0.12);
      const reach = reachPastSphere(character.root);
      assert.ok(
        reach <= 0,
        `${JSON.stringify(fields)} reaches ${reach.toFixed(3)} m past the sphere`,
      );
    }
    character.dispose();
  }
});

void test('a ghost echo replaces every material, casts no shadow and ignores skins', async () => {
  const template = await loadTemplate(),
    body = new T.MeshBasicMaterial(),
    shell = new T.MeshBasicMaterial({ side: T.BackSide }),
    ghost = new SkinnedCharacter(template, { body, shell });
  const meshes = skinnedMeshes(ghost.root);
  const bodies = meshes.filter((mesh) => mesh.material === body),
    shells = meshes.filter((mesh) => mesh.material === shell);
  assert.equal(bodies.length, MESHES);
  assert.equal(shells.length, MESHES);
  assert.equal(new Set(meshes.map((mesh) => mesh.skeleton)).size, 1);
  for (const mesh of meshes) {
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
  }
  // Equal-depth transparent objects draw in creation order: each shell after its body.
  for (const [index, mesh] of bodies.entries()) assert.ok(shells[index].id > mesh.id);
  ghost.setSkin('ember');
  assert.ok(
    skinnedMeshes(ghost.root).every((mesh) => mesh.material === body || mesh.material === shell),
  );
  ghost.dispose();
});

void test('the model loads once and a failed load reports the procedural fallback', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const urls: string[] = [];
  const loaded = new CharacterModel(HIDER_HOODIE, (url) => {
    urls.push(url);
    return loadGlb();
  });
  assert.equal(loaded.status.state, 'loading');
  assert.equal(loaded.template, null);
  const template = await loaded.ready;
  assert.ok(template);
  assert.equal(loaded.template, template);
  assert.deepEqual(loaded.status, { url: HIDER_HOODIE.url, state: 'loaded' });
  assert.deepEqual(urls, [HIDER_HOODIE.url]);

  const failed = new CharacterModel(HIDER_HOODIE, () => Promise.reject(new Error('offline')));
  assert.equal(await failed.ready, null);
  assert.equal(failed.template, null);
  assert.deepEqual(failed.status, { url: HIDER_HOODIE.url, state: 'error', error: 'offline' });
  const invalid = new CharacterModel(HIDER_HOODIE, () =>
    Promise.resolve({ scene: new T.Group(), animations: [] }),
  );
  assert.equal(await invalid.ready, null);
  assert.match(invalid.status.error ?? '', /missing clips/);
  assert.equal(warn.mock.callCount(), 2);
});

void test('a Hider keeps its procedural body until the model loads, then swaps once', async () => {
  let resolve!: (gltf: { scene: T.Object3D; animations: T.AnimationClip[] }) => void;
  const request = new Promise<{ scene: T.Object3D; animations: T.AnimationClip[] }>((done) => {
    resolve = done;
  });
  const model = new CharacterModel(HIDER_HOODIE, () => request),
    waiting = new Character('hider', false, model),
    disposed = new Character('hider', true, model);
  assert.equal(waiting.authored, false);
  assert.equal(waiting.body.visible, true);
  disposed.dispose();
  const disposedChildren = disposed.group.children.length;
  resolve(await loadGlb());
  await model.ready;
  assert.equal(waiting.authored, true);
  assert.equal(waiting.body.visible, false);
  assert.equal(skinnedMeshes(waiting.group).length, MESHES);
  assert.equal(disposed.authored, false, 'a disposed character never attaches a late model');
  assert.equal(disposed.group.children.length, disposedChildren);

  const ready = new Character('hider', false, model);
  assert.equal(ready.authored, true, 'a loaded model attaches immediately');
  ready.animate(
    { moving: 0, grounded: true, waving: false, dashing: false, crouched: true },
    0.1,
    1,
  );
  assert.ok(posedBounds(ready.group).max.y <= 1.12, 'the crouch clip lowers the model');
  for (const character of [waiting, ready]) character.dispose();
});

void test('procedural characters still squash for a crouch without a model', () => {
  const character = new Character('hider');
  character.animate(
    { moving: 0, grounded: true, waving: false, dashing: false, crouched: true },
    0.1,
    1,
  );
  assert.equal(character.body.scale.y, 1.12 / 2.16);
  character.animate({ moving: 0, grounded: true, waving: false, dashing: false }, 0.1, 1);
  assert.equal(character.body.scale.y, 1);
  assert.equal(character.authored, false);
  character.dispose();
});
