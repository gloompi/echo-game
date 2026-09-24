// Node owns test completion; register synchronously so suite hooks bracket every test.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mountWorldAsset } from '../client/world-assets.js';

function setup() {
  const scene = new T.Scene(),
    fallback = new T.Group(),
    mirrors = new T.Group(),
    light = new T.HemisphereLight();
  scene.add(fallback, mirrors, light);
  return { scene, fallback, mirrors, light };
}
function model() {
  const root = new T.Group(),
    geometry = new T.BoxGeometry(),
    texture = new T.Texture();
  const material = new T.MeshStandardMaterial({ map: texture });
  root.add(new T.Mesh(geometry, material), new T.Mesh(geometry, material));
  let geometryDisposals = 0,
    materialDisposals = 0,
    textureDisposals = 0;
  geometry.addEventListener('dispose', () => geometryDisposals++);
  material.addEventListener('dispose', () => materialDisposals++);
  texture.addEventListener('dispose', () => textureDisposals++);
  return { root, disposals: () => [geometryDisposals, materialDisposals, textureDisposals] };
}

void test('maps without authored art retain their procedural world without a request', async () => {
  const { scene, fallback } = setup();
  const asset = mountWorldAsset(scene, 'unconfigured-test-map', fallback, {
    load: () => Promise.reject(new Error('Must not request a model.')),
  });
  await asset.ready;
  assert.equal(asset.status.state, 'unavailable');
  assert.equal(fallback.parent, scene);
  assert.equal(scene.userData.worldAsset, asset.status);
});

void test('a loaded world replaces only fallback art and releases its shared resources once', async () => {
  const { scene, fallback, mirrors, light } = setup(),
    loaded = model();
  const exportedLight = new T.PointLight();
  loaded.root.add(exportedLight);
  const asset = mountWorldAsset(scene, 'test-map', fallback, {
    asset: { url: '/world.glb' },
    load: (url) => {
      assert.equal(url, '/world.glb');
      return Promise.resolve(loaded.root);
    },
  });
  assert.equal(asset.status.state, 'loading');
  assert.equal(fallback.parent, scene);
  await asset.ready;
  assert.equal(asset.status.state, 'loaded');
  assert.equal(asset.status.meshCount, 2);
  assert.equal(fallback.parent, null);
  assert.equal(loaded.root.parent, scene);
  assert.equal(mirrors.parent, scene);
  assert.equal(light.parent, scene);
  assert.equal(exportedLight.visible, false);
  asset.dispose();
  asset.dispose();
  assert.equal(loaded.root.parent, null);
  assert.deepEqual(loaded.disposals(), [1, 1, 1]);
  assert.equal(mirrors.parent, scene);
  assert.equal(light.parent, scene);
});

void test('an arena disposed during a request never attaches the late model', async () => {
  const { scene, fallback } = setup(),
    loaded = model();
  let resolve!: (root: T.Object3D) => void;
  const request = new Promise<T.Object3D>((done) => {
    resolve = done;
  });
  const asset = mountWorldAsset(scene, 'old-map', fallback, {
    asset: { url: '/old.glb' },
    load: () => request,
  });
  asset.dispose();
  resolve(loaded.root);
  await asset.ready;
  assert.equal(asset.status.state, 'disposed');
  assert.equal(loaded.root.parent, null);
  assert.equal(fallback.parent, scene);
  assert.deepEqual(loaded.disposals(), [1, 1, 1]);
});

void test('failed and empty exports keep the visible fallback and expose the failure', async (t) => {
  t.mock.method(console, 'warn', () => {});
  for (const load of [
    () => Promise.reject(new Error('Network unavailable')),
    () => Promise.resolve(new T.Group()),
  ]) {
    const { scene, fallback } = setup();
    const asset = mountWorldAsset(scene, 'test-map', fallback, {
      asset: { url: '/world.glb' },
      load,
    });
    await asset.ready;
    assert.equal(asset.status.state, 'error');
    assert.ok(asset.status.error);
    assert.equal(fallback.parent, scene);
    assert.equal(asset.status.meshCount, 0);
  }
});
