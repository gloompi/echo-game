import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { WEAPONS, type Weapon } from '../shared/balance.js';

/** Generated Seeker weapons (`assets-src/characters/seeker-hunter/weapons-gen`). Each GLB is in
 * metres, +Z muzzle, +Y up, with its origin in the pistol grip and a `muzzle` node. All four
 * share one layout (front grip 0.31 m ahead of and 0.03 m above the grip), so one set of Seeker
 * clips holds every weapon. They are visuals only: shots use the authoritative server events.
 */
export const WEAPON_URL = (weapon: Weapon): string => `/assets/weapons/${weapon}.glb`;

export type LoadWeaponGltf = (url: string) => Promise<{ scene: T.Object3D }>;
const loadGltf: LoadWeaponGltf = (url) => new GLTFLoader().loadAsync(url);

/** One request per weapon for the page. Clones share the loaded geometry and materials, which
 * the page owns for its lifetime; callers never dispose them. */
export class WeaponModels {
  readonly status: Record<Weapon, 'loading' | 'loaded' | 'error'>;
  /** Resolves once every weapon has loaded or failed; it never rejects. */
  readonly ready: Promise<void>;
  private readonly loaded = new Map<Weapon, T.Object3D>();

  constructor(load: LoadWeaponGltf = loadGltf) {
    this.status = Object.fromEntries(WEAPONS.map((weapon) => [weapon, 'loading'])) as Record<
      Weapon,
      'loading' | 'loaded' | 'error'
    >;
    this.ready = Promise.all(WEAPONS.map((weapon) => this.request(weapon, load))).then(() => {});
  }

  private async request(weapon: Weapon, load: LoadWeaponGltf): Promise<void> {
    try {
      const { scene } = await load(WEAPON_URL(weapon));
      if (!scene.getObjectByName('muzzle')) throw new Error(`${weapon} has no muzzle node.`);
      scene.traverse((object) => {
        if (object instanceof T.Mesh) object.castShadow = true;
      });
      this.loaded.set(weapon, scene);
      this.status[weapon] = 'loaded';
    } catch (error) {
      this.status[weapon] = 'error';
      console.warn(`${WEAPON_URL(weapon)} could not load; using the procedural weapon.`, error);
    }
  }

  /** Whether the generated model for `weapon` is available. */
  has(weapon: Weapon): boolean {
    return this.loaded.has(weapon);
  }

  /** A new instance in metres with its origin in the grip, or null while unavailable. */
  instance(weapon: Weapon): T.Object3D | null {
    const source = this.loaded.get(weapon);
    return source ? source.clone() : null;
  }
}
