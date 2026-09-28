import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Skin } from '../shared/balance.js';
import {
  BASE_CLIPS,
  perBaseClip,
  type AuthoredSpeeds,
  type BaseClip,
} from './game/character-motion.js';

/** Runtime contract of an authored skinned character GLB (echo-3d-assets `character.md`):
 * metres, +Y up, facing +Z, origin at the feet, in-place clips. Visuals never own collision or
 * hits; those use the shared capsule.
 */
export interface CharacterAssetDefinition {
  readonly url: string;
  /** Colour per skin for the materials named `tint_light`; every other material keeps its own. */
  readonly tints: Readonly<Record<Skin, number>>;
  readonly speeds: AuthoredSpeeds;
}

/** The hooded Hider, `assets-src/characters/hider-hoodie`. The hoodie colours are the brief's
 * approved skin mapping: CIELAB L* >= 50, and blues (hue 190-240 degrees) L* >= 65, so no skin
 * reads as the blue Seeker. Run and crouch walk were authored for 6.4 and 2.88 m/s.
 */
export const HIDER_HOODIE: CharacterAssetDefinition = {
  url: '/assets/characters/hider-hoodie.glb',
  tints: {
    classic: 0xebe3d8,
    cobalt: 0x74a8ea,
    ember: 0xd8434b,
    jade: 0x3fae7f,
    violet: 0x9a5ddf,
    arctic: 0xdde8f2,
    sunset: 0xe3b050,
    carbon: 0x7c828c,
  },
  speeds: { run: 6.4, crouchWalk: 2.88 },
};

export const TINT_MATERIAL = 'tint_light';
/** Every clip the runtime plays: the base clips plus the hit and wave overlays. */
export const CHARACTER_CLIPS: readonly string[] = [...BASE_CLIPS, 'hit', 'wave'];
/** Bounding-sphere growth over the bind pose. The clips reach about 0.9 m from the body axis
 * and 2.26 m up (hider-hoodie pass-5 review); a fixed sphere keeps culling from skinning every
 * vertex on the CPU.
 */
const POSE_MARGIN_METRES = 0.3;

export interface CharacterTemplate {
  readonly definition: CharacterAssetDefinition;
  /** Source graph: cloned per character, never added to a scene. */
  readonly scene: T.Object3D;
  /** Base clips split at the bones the wave animates, so the wave can replace the upper body
   * while the legs keep their clip. */
  readonly lower: Readonly<Record<BaseClip, T.AnimationClip>>;
  readonly upper: Readonly<Record<BaseClip, T.AnimationClip>>;
  readonly wave: T.AnimationClip;
  /** Additive, relative to its first (idle) frame, so the flinch plays over any base clip. */
  readonly hit: T.AnimationClip;
  /** The shared `tint_light` material for a skin. The template owns it for the page's lifetime;
   * characters never dispose it. */
  tint(skin: Skin): T.Material;
}

/** Every skinned mesh under `root` (three.js makes one per glTF primitive). */
export function skinnedMeshes(root: T.Object3D): T.SkinnedMesh[] {
  const meshes: T.SkinnedMesh[] = [];
  root.traverse((object) => {
    // Narrow Three.js constructor generics after checking the runtime mesh class.
    if (object instanceof T.SkinnedMesh) meshes.push(object as T.SkinnedMesh);
  });
  return meshes;
}
function isTintMaterial(material: unknown): material is T.MeshStandardMaterial {
  return material instanceof T.MeshStandardMaterial && material.name === TINT_MATERIAL;
}
const boneOf = (track: T.KeyframeTrack): string =>
  T.PropertyBinding.parseTrackName(track.name).nodeName;

/** Validates a loaded GLB against the character contract and prepares the shared clips. */
export function prepareCharacterTemplate(
  scene: T.Object3D,
  animations: readonly T.AnimationClip[],
  definition: CharacterAssetDefinition,
): CharacterTemplate {
  const clips = new Map<string, T.AnimationClip>(animations.map((clip) => [clip.name, clip]));
  const missing = CHARACTER_CLIPS.filter((name) => !clips.has(name));
  if (missing.length) throw new Error(`Character model is missing clips: ${missing.join(', ')}.`);
  const required = (name: string): T.AnimationClip => {
    const found = clips.get(name);
    if (!found) throw new Error(`Character model is missing the ${name} clip.`);
    return found;
  };
  const meshes = skinnedMeshes(scene);
  if (!meshes.length) throw new Error('Character model has no skinned mesh.');
  const tintSource = meshes.map((mesh) => mesh.material).find(isTintMaterial);
  if (!tintSource) throw new Error(`Character model has no ${TINT_MATERIAL} material.`);

  const wave = required('wave'),
    upperBones = new Set(wave.tracks.map(boneOf));
  const split = (upper: boolean) =>
    perBaseClip((name) => {
      const source = required(name);
      const tracks = source.tracks.filter((track) => upperBones.has(boneOf(track)) === upper);
      return new T.AnimationClip(`${name}:${upper ? 'upper' : 'lower'}`, source.duration, tracks);
    });
  const lower = split(false),
    upper = split(true);
  if (BASE_CLIPS.some((name) => !lower[name].tracks.length))
    throw new Error('The wave clip must leave the legs to the base clips.');
  // makeClipAdditive rewrites track values, so it works on a copy.
  const hit = T.AnimationUtils.makeClipAdditive(required('hit').clone());

  const bounds = new T.Box3();
  for (const mesh of meshes) {
    mesh.geometry.computeBoundingBox();
    if (mesh.geometry.boundingBox) bounds.union(mesh.geometry.boundingBox);
  }
  const sphere = bounds.getBoundingSphere(new T.Sphere());
  sphere.radius += POSE_MARGIN_METRES;
  // Clones copy the sphere, so no character recomputes it from skinned vertices.
  for (const mesh of meshes) mesh.boundingSphere = sphere.clone();

  const tints = new Map<Skin, T.Material>();
  return {
    definition,
    scene,
    lower,
    upper,
    wave,
    hit,
    tint(skin) {
      let material = tints.get(skin);
      if (!material) {
        const tinted = tintSource.clone();
        tinted.color.setHex(definition.tints[skin]);
        tints.set(skin, tinted);
        material = tinted;
      }
      return material;
    },
  };
}

export type CharacterAssetState = 'loading' | 'loaded' | 'error';
export interface CharacterAssetStatus {
  readonly url: string;
  state: CharacterAssetState;
  error?: string;
}
interface LoadedGltf {
  scene: T.Object3D;
  animations: T.AnimationClip[];
}
export type LoadCharacterGltf = (url: string) => Promise<LoadedGltf>;
const loadGltf: LoadCharacterGltf = (url) => new GLTFLoader().loadAsync(url);

/** One request for an authored character. The page owns this model: its template, geometry,
 * materials and clips are shared by every character built from it and are never disposed by one.
 */
export class CharacterModel {
  readonly status: CharacterAssetStatus;
  /** Resolves with the template, or with null after a failed load; it never rejects. */
  readonly ready: Promise<CharacterTemplate | null>;
  private loaded: CharacterTemplate | null = null;

  constructor(definition: CharacterAssetDefinition, load: LoadCharacterGltf = loadGltf) {
    this.status = { url: definition.url, state: 'loading' };
    this.ready = this.request(definition, load);
  }

  /** The prepared template; null while loading or after a failure. */
  get template(): CharacterTemplate | null {
    return this.loaded;
  }

  private async request(
    definition: CharacterAssetDefinition,
    load: LoadCharacterGltf,
  ): Promise<CharacterTemplate | null> {
    try {
      const gltf = await load(definition.url);
      this.loaded = prepareCharacterTemplate(gltf.scene, gltf.animations, definition);
      this.status.state = 'loaded';
      return this.loaded;
    } catch (error) {
      // A rejected model was never rendered, so it holds no GPU resources to release.
      this.status.state = 'error';
      this.status.error = error instanceof Error ? error.message : String(error);
      console.warn(`${definition.url} could not load; using the procedural character.`, error);
      return null;
    }
  }
}
