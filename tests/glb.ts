import * as T from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

/** Parses a shipped GLB under Node. Decoding its texture images needs browser APIs, and these
 * tests check geometry, rigs, clips and materials, so each texture becomes an empty stand-in. */
export function parseGlb(buffer: Buffer): Promise<GLTF> {
  const loader = new GLTFLoader().register((parser) => {
    parser.loadTextureImage = () => Promise.resolve(new T.Texture());
    return { name: 'node-test-textures' };
  });
  return loader.parseAsync(new Uint8Array(buffer).buffer, '');
}
