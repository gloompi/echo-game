// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { SKINS, WEAPONS, type Weapon } from '../shared/balance.js';
import {
  CharacterModel,
  SEEKER_HUNTER,
  nodeName,
  prepareCharacterTemplate,
  skinnedMeshes,
  type CharacterTemplate,
} from '../client/character-assets.js';
import { BASE_CLIPS, type MotionPose } from '../client/game/character-motion.js';
import { Character, makeSeekerWeapon } from '../client/models.js';
import { SkinnedCharacter } from '../client/skinned-character.js';
import { WEAPON_URL, WeaponModels } from '../client/weapon-assets.js';
import { parseGlb } from './glb.js';

const seekerGlb = readFileSync(
  new URL('../public/assets/characters/seeker-hunter.glb', import.meta.url),
);
const weaponGlb = (weapon: Weapon) =>
  readFileSync(new URL(`../public${WEAPON_URL(weapon)}`, import.meta.url));

async function loadSeeker(): Promise<{ scene: T.Object3D; animations: T.AnimationClip[] }> {
  const gltf = await parseGlb(seekerGlb);
  return { scene: gltf.scene, animations: gltf.animations };
}
async function loadTemplate(): Promise<CharacterTemplate> {
  const { scene, animations } = await loadSeeker();
  return prepareCharacterTemplate(scene, animations, SEEKER_HUNTER);
}
async function loadWeapons(): Promise<WeaponModels> {
  const models = new WeaponModels(async (url) => {
    const weapon = WEAPONS.find((name) => WEAPON_URL(name) === url);
    assert.ok(weapon, url);
    return { scene: (await parseGlb(weaponGlb(weapon))).scene };
  });
  await models.ready;
  return models;
}
const bonesOf = (clip: T.AnimationClip) =>
  new Set(clip.tracks.map((track) => T.PropertyBinding.parseTrackName(track.name).nodeName));
function bone(root: T.Object3D, name: string): T.Object3D {
  const found = root.getObjectByName(nodeName(name));
  assert.ok(found, `missing bone ${name}`);
  return found;
}
const STEP_SECONDS = 1 / 60;
function play(character: SkinnedCharacter, fields: Partial<MotionPose>, seconds: number): void {
  const pose: MotionPose = { moving: 0, grounded: true, waving: false, ...fields };
  for (let step = Math.round(seconds / STEP_SECONDS); step > 0; step--)
    character.update(pose, STEP_SECONDS);
}
function worldPosition(object: T.Object3D, local = new T.Vector3()): T.Vector3 {
  object.updateWorldMatrix(true, false);
  return local.clone().applyMatrix4(object.matrixWorld);
}
/** Posed bounds of the skinned body and the held weapon, in world space. */
function posedBounds(root: T.Object3D): T.Box3 {
  root.updateMatrixWorld(true);
  const bounds = new T.Box3();
  for (const mesh of skinnedMeshes(root)) {
    mesh.computeBoundingBox();
    bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  root.traverse((object) => {
    if (object instanceof T.Mesh && !(object instanceof T.SkinnedMesh))
      bounds.union(new T.Box3().setFromObject(object));
  });
  return bounds;
}
/** The weapons share one layout: the support hand's contact is 0.31 m ahead of and 0.03 m above
 * the grip (weapon space: +Z muzzle, +Y up). */
const SUPPORT = new T.Vector3(0, 0.03, 0.31);

void test('the shipped Seeker GLB meets the character contract with an upper-body aim', async () => {
  const { scene, animations } = await loadSeeker();
  const template = prepareCharacterTemplate(scene, animations, SEEKER_HUNTER);
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    const scale = object.getWorldScale(new T.Vector3());
    assert.ok(Math.abs(scale.x - 1) < 1e-3, `${object.name} is exported at scale ${scale.x}`);
  });
  assert.equal(skinnedMeshes(template.scene).length, 2, 'the body and the tint_light accents');
  const upper = bonesOf(template.overlay);
  for (const name of ['spine', 'chest', 'head', 'upper_armR', 'handL', 'weapon_socket'])
    assert.ok(upper.has(name), `aim moves ${name}`);
  for (const name of ['hips', 'thighL', 'shinR', 'footL', 'root'])
    assert.ok(!upper.has(name), `aim leaves ${name} to the base clip`);
  for (const name of BASE_CLIPS)
    for (const leg of ['hips', 'thighL', 'shinR'])
      assert.ok(bonesOf(template.lower[name]).has(leg), `${name} legs keep ${leg}`);
  assert.throws(
    () =>
      prepareCharacterTemplate(
        scene,
        animations.filter((clip) => clip.name !== 'aim'),
        SEEKER_HUNTER,
      ),
    /missing clips: aim/,
  );
});

void test('Seeker skins recolour the glowing accents and keep them glowing', async () => {
  const template = await loadTemplate();
  for (const skin of SKINS) {
    const material = template.tint(skin);
    assert.ok(material instanceof T.MeshStandardMaterial);
    assert.equal(material.color.getHex(), SEEKER_HUNTER.tints[skin]);
    assert.equal(material.emissive.getHex(), SEEKER_HUNTER.tints[skin], `${skin} glows`);
  }
});

void test('each weapon GLB has its grip at the origin and its muzzle ahead of it', async () => {
  const models = await loadWeapons();
  for (const weapon of WEAPONS) {
    assert.equal(models.status[weapon], 'loaded');
    const gun = models.instance(weapon);
    assert.ok(gun);
    gun.updateMatrixWorld(true);
    const muzzle = worldPosition(gun.getObjectByName('muzzle')!),
      bounds = new T.Box3().setFromObject(gun);
    assert.ok(muzzle.z > 0.3 && muzzle.z < 0.8, `${weapon} muzzle ${muzzle.z.toFixed(2)} m ahead`);
    assert.ok(Math.abs(muzzle.x) < 0.02, `${weapon} muzzle is on the centre line`);
    assert.ok(bounds.min.y < -0.02 && bounds.max.y > 0.05, `${weapon} grip straddles the origin`);
    const triangles = (gun.children[0] as T.Mesh).geometry.index!.count / 3;
    assert.ok(triangles <= 3000, `${weapon} has ${triangles} triangles`);
  }
});

void test('both hands stay on every weapon through every clip and overlay', async () => {
  const template = await loadTemplate(),
    models = await loadWeapons(),
    character = new SkinnedCharacter(template);
  const poses: [string, Partial<MotionPose>][] = [
    ['idle', {}],
    ['run', { moving: SEEKER_HUNTER.speeds.run }],
    ['jump', { grounded: false }],
    ['crouch', { crouched: true }],
    ['crouch walk', { crouched: true, moving: SEEKER_HUNTER.speeds.crouchWalk }],
    ['slide', { sliding: true, moving: 8 }],
    ['aim', { waving: true }],
  ];
  for (const weapon of WEAPONS) {
    character.setWeapon(models.instance(weapon));
    const held = character.heldWeapon;
    assert.ok(held);
    for (const [label, fields] of poses) {
      play(character, fields, 0.6);
      for (let sample = 0; sample < 4; sample++) {
        play(character, fields, 0.11);
        const grip = worldPosition(held),
          support = worldPosition(held, SUPPORT),
          rightWrist = worldPosition(bone(character.root, 'hand.R')),
          leftWrist = worldPosition(bone(character.root, 'hand.L'));
        // The grip sits in the fist, about 0.13 m past the wrist; the left palm is about 0.1 m
        // past its wrist, on the front grip.
        assert.ok(
          rightWrist.distanceTo(grip) < 0.2,
          `${weapon} ${label}: right hand ${rightWrist.distanceTo(grip).toFixed(3)} m from the grip`,
        );
        assert.ok(
          leftWrist.distanceTo(support) < 0.18,
          `${weapon} ${label}: left hand ${leftWrist.distanceTo(support).toFixed(3)} m from the front grip`,
        );
        const muzzle = worldPosition(held.getObjectByName('muzzle')!);
        assert.ok(muzzle.z > grip.z, `${weapon} ${label}: the muzzle points forward`);
      }
    }
  }
  character.dispose();
});

void test('crouch, crouch walk and slide fit the clearance with the weapon in hand', async () => {
  const template = await loadTemplate(),
    models = await loadWeapons();
  for (const weapon of WEAPONS) {
    const character = new SkinnedCharacter(template);
    character.setWeapon(models.instance(weapon));
    for (const fields of [
      { crouched: true },
      { crouched: true, moving: 2.7 },
      { sliding: true, moving: 8 },
      { crouched: true, waving: true },
    ] satisfies Partial<MotionPose>[]) {
      play(character, fields, 0.6);
      for (let sample = 0; sample < 4; sample++) {
        play(character, fields, 0.13);
        const height = posedBounds(character.root).max.y;
        assert.ok(height <= 1.12, `${weapon} ${JSON.stringify(fields)} is ${height.toFixed(3)} m`);
      }
    }
    character.dispose();
  }
});

void test('the upper body and the weapon lean into the view pitch', async () => {
  const template = await loadTemplate(),
    models = await loadWeapons();
  const muzzleHeight = (pitch: number) => {
    const character = new SkinnedCharacter(template);
    character.setWeapon(models.instance('blaster'));
    play(character, { waving: true, pitch }, 0.6);
    const height = worldPosition(character.heldWeapon!.getObjectByName('muzzle')!).y;
    character.dispose();
    return height;
  };
  const level = muzzleHeight(0),
    up = muzzleHeight(0.6),
    down = muzzleHeight(-0.6);
  assert.ok(
    up > level + 0.1,
    `looking up raises the muzzle (${level.toFixed(2)} -> ${up.toFixed(2)})`,
  );
  assert.ok(down < level - 0.1, `looking down lowers it (${down.toFixed(2)})`);
});

void test('a Seeker carries its weapon, swaps it, and picks up late-loading models', async () => {
  const { scene, animations } = await loadSeeker();
  const model = new CharacterModel(SEEKER_HUNTER, () => Promise.resolve({ scene, animations }));
  await model.ready;
  let release!: () => void;
  const gate = new Promise<void>((done) => {
    release = done;
  });
  const weapons = new WeaponModels(async (url) => {
    await gate;
    const weapon = WEAPONS.find((name) => WEAPON_URL(name) === url)!;
    return { scene: (await parseGlb(weaponGlb(weapon))).scene };
  });
  const seeker = new Character('seeker', false, model, weapons);
  assert.equal(seeker.authored, true);
  // Until the generated weapons load, the hand holds the procedural blaster.
  const socket = seeker.group.getObjectByName(nodeName('weapon_socket'))!;
  assert.equal(socket.children.length, 1);
  assert.ok(!socket.getObjectByName('blaster'), 'procedural stand-in, not the generated model');
  assert.equal(seeker.gun?.visible, false, 'the free-floating procedural gun is hidden');
  release();
  await weapons.ready;
  assert.ok(socket.getObjectByName('blaster'), 'the generated blaster replaced the stand-in');
  seeker.setWeapon('scatter');
  assert.equal(socket.children.length, 1, 'one weapon in the hand');
  assert.ok(socket.getObjectByName('scatter'));
  seeker.dispose();
});

void test('the first-person weapon uses the generated model and keeps the muzzle socket', async () => {
  const models = await loadWeapons();
  for (const weapon of WEAPONS) {
    const generated = makeSeekerWeapon(weapon, models),
      fallback = makeSeekerWeapon(weapon, null);
    assert.equal(generated.userData.generated, true);
    assert.equal(generated.userData.weapon, weapon);
    assert.equal(fallback.userData.generated, false);
    for (const gun of [generated, fallback]) {
      gun.scale.setScalar(0.47);
      const muzzle = worldPosition(gun.getObjectByName('muzzle')!);
      assert.ok(muzzle.z > 0.2, `${weapon} muzzle ${muzzle.z.toFixed(2)} m ahead`);
    }
  }
});

void test('a failed weapon load keeps the procedural weapon', async (t) => {
  const warn = t.mock.method(console, 'warn', () => {});
  const models = new WeaponModels(() => Promise.reject(new Error('offline')));
  await models.ready;
  for (const weapon of WEAPONS) {
    assert.equal(models.status[weapon], 'error');
    assert.equal(models.has(weapon), false);
    assert.equal(makeSeekerWeapon(weapon, models).userData.generated, false);
  }
  assert.equal(warn.mock.callCount(), WEAPONS.length);
});
