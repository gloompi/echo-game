import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAPS } from '../shared/map.js';

for (const id of ['mirror-yard', 'neon-carnival'] as const) {
  test(`${id}: actual GLB contains the authoritative solids at metre scale and Y up`, async () => {
    const file = readFileSync(new URL(`../public/assets/worlds/${id}.glb`, import.meta.url));
    assert.equal(file.toString('utf8', 0, 4), 'glTF');
    assert.ok(file.length < 12 * 1024 * 1024, 'World exceeds the uncompressed download budget');
    const source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    const gltf = await new GLTFLoader().parseAsync(source, '');
    gltf.scene.updateMatrixWorld(true);
    const solids = new Map<string, T.Object3D>();
    let meshes = 0, triangles = 0;
    gltf.scene.traverse(object => {
      assert.ok(!(object instanceof T.Camera || object instanceof T.Light), 'Runtime export includes authoring camera/light');
      if (object.userData.collisionId) {
        assert.ok(!solids.has(object.userData.collisionId), 'Duplicate collider visual');
        solids.set(object.userData.collisionId, object);
      }
      if (object instanceof T.Mesh) {
        meshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
      }
    });
    assert.ok(meshes < 350, 'Too many static mesh submissions');
    assert.ok(triangles < 180_000, 'World exceeds triangle budget');
    assert.equal(solids.size, MAPS[id].boxes.length);
    for (const box of MAPS[id].boxes) {
      const object = solids.get(box.id);
      assert.ok(object, `Missing visible collision shape ${box.id}`);
      const bounds = new T.Box3().setFromObject(object);
      const expected = [box.x - box.w / 2, box.y, box.z - box.d / 2, box.x + box.w / 2, box.y + box.h, box.z + box.d / 2];
      const actual = [...bounds.min.toArray(), ...bounds.max.toArray()];
      for (let n = 0; n < 6; n++) assert.ok(Math.abs(actual[n] - expected[n]) < .002, `${box.id}: visual/collider bound ${n} differs (${actual[n]} vs ${expected[n]})`);
    }
    const blend = readFileSync(new URL(`../assets-src/worlds/${id}/${id}.blend`, import.meta.url));
    // Blender 5 can save Zstandard-compressed .blend files; earlier releases used gzip.
    const compressed = blend.subarray(0, 4).toString('hex');
    assert.ok(blend.toString('utf8', 0, 7) === 'BLENDER' || compressed === '28b52ffd' || compressed.startsWith('1f8b'), 'Editable Blender source has no recognized header');
  });
}
