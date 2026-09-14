import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Visual assets use metres and +Y up. Collision always comes from shared map data. */
export interface WorldAssetDefinition { url: string }
export const WORLD_ASSETS: Readonly<Record<string, WorldAssetDefinition>> = {
  'mirror-yard': { url: '/assets/worlds/mirror-yard.glb' },
  'neon-carnival': { url: '/assets/worlds/neon-carnival.glb' },
};

export interface WorldAssetStatus {
  mapId: string;
  state: 'unavailable' | 'loading' | 'loaded' | 'error' | 'disposed';
  url?: string;
  error?: string;
  meshCount: number;
}
export interface WorldAssetHandle {
  readonly status: WorldAssetStatus;
  /** Resolves after loading or fallback selection; inspect status for the outcome. */
  readonly ready: Promise<void>;
  dispose(): void;
}
interface WorldAssetOptions {
  asset?: WorldAssetDefinition;
  load?: (url: string) => Promise<T.Object3D>;
}
const loadModel = async (url: string): Promise<T.Object3D> => (await new GLTFLoader().loadAsync(url)).scene;

/** Only call for a model owned by this load, never the gameplay scene or actor assets. */
function disposeModel(root: T.Object3D): void {
  const geometries = new Set<T.BufferGeometry>(), materials = new Set<T.Material>(), textures = new Set<T.Texture>();
  root.traverse(object => {
    if (object instanceof T.Mesh) {
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
      if (object instanceof T.InstancedMesh) object.dispose();
      if (object instanceof T.SkinnedMesh) object.skeleton.dispose();
    }
    if (object instanceof T.Light && 'shadow' in object) {
      const shadow = object.shadow as T.LightShadow;
      shadow.map?.dispose(); shadow.mapPass?.dispose();
    }
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
  const images = new Set<ImageBitmap>();
  for (const texture of textures) {
    const source: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) images.add(source);
    texture.dispose();
  }
  for (const image of images) image.close();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.removeFromParent(); root.clear();
}

/** Mounts static art only. It never reads actors, selects a map, or creates colliders. */
export function mountWorldAsset(scene: T.Scene, mapId: string, fallback: T.Group, options: WorldAssetOptions = {}): WorldAssetHandle {
  const definition = options.asset ?? WORLD_ASSETS[mapId];
  const status: WorldAssetStatus = { mapId, state: definition ? 'loading' : 'unavailable', meshCount: 0 };
  if (definition) status.url = definition.url;
  scene.userData.worldAsset = status;
  let disposed = false, model: T.Object3D | null = null;
  const ready = (async () => {
    if (!definition) return;
    let loaded: T.Object3D | null = null;
    try {
      loaded = await (options.load ?? loadModel)(definition.url);
      if (disposed) { disposeModel(loaded); return; }
      const embeddedLights: T.Object3D[] = [];
      loaded.traverse(object => {
        // Game lights remain stable while art loads; exported cameras have no gameplay role.
        if (object instanceof T.Light || object instanceof T.Camera) embeddedLights.push(object);
        if (object instanceof T.Mesh) {
          status.meshCount++;
          object.castShadow = object.userData.echoCastShadow !== false;
          object.receiveShadow = true;
        }
        object.updateMatrix(); object.matrixAutoUpdate = false;
      });
      if (!status.meshCount) throw new Error('World asset contains no meshes.');
      for (const object of embeddedLights) { object.visible = false; }
      loaded.name = `world-asset:${mapId}`;
      loaded.updateMatrixWorld(true);
      scene.add(loaded);
      fallback.removeFromParent();
      model = loaded;
      status.state = 'loaded';
    } catch (error) {
      if (loaded) disposeModel(loaded);
      if (disposed) return;
      status.state = 'error'; status.meshCount = 0;
      status.error = error instanceof Error ? error.message : String(error);
      console.warn(`World art for ${mapId} could not load; using the arena fallback.`, error);
    }
  })();
  return {
    status, ready,
    dispose() {
      if (disposed) return;
      disposed = true; status.state = 'disposed';
      if (model) { disposeModel(model); model = null; }
    },
  };
}
