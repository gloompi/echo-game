import * as T from 'three';
import type { Pose, Role } from '../shared/types.js';
const cube = new T.BoxGeometry(1, 1, 1);
const outlineMat = new T.MeshBasicMaterial({ color: 0x080d1b, side: T.BackSide });
const mats = new Map<number, T.MeshStandardMaterial>();
export function material(color: number, glow = 0): T.MeshStandardMaterial {
  const key = color + glow * 0x1000000;
  if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.12, flatShading: true, emissive: color, emissiveIntensity: glow }));
  return mats.get(key)!;
}
export function block(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], color: number, outlined = false, glow = 0): T.Mesh {
  const mesh = new T.Mesh(cube, material(color, glow)); mesh.scale.set(...size); mesh.position.set(...pos); mesh.castShadow = glow === 0; mesh.receiveShadow = true; parent.add(mesh);
  if (outlined) { const edge = new T.Mesh(cube, outlineMat); edge.scale.set(1.055, 1.055, 1.055); mesh.add(edge); }
  return mesh;
}
export function makeBlaster(): T.Group {
  const gun = new T.Group();
  block(gun, [0.32, 0.32, 0.64], [0, 0, 0.15], 0xffa822, true);
  block(gun, [0.36, 0.12, 0.62], [0, 0.20, 0.19], 0xffce60, true);
  block(gun, [0.22, 0.20, 0.57], [0, 0.13, 0.70], 0xffb331, true);
  block(gun, [0.24, 0.23, 0.07], [0, 0.13, 1], 0xe4582a, true);
  block(gun, [0.14, 0.12, 0.03], [0, 0.13, 1.045], 0xffe79d, false, 1.5);
  block(gun, [0.23, 0.19, 0.40], [0, -0.14, 0.53], 0xd65b30, true);
  for (let i = 0; i < 3; i++) block(gun, [0.245, 0.16, 0.04], [0, -0.17, 0.42 + i * 0.1], 0x833a32);
  const grip = block(gun, [0.19, 0.34, 0.19], [0, -0.29, -0.05], 0x222a41, true); grip.rotation.x = -0.22;
  block(gun, [0.25, 0.23, 0.30], [0, 0, -0.27], 0xe87629, true);
  block(gun, [0.13, 0.05, 0.15], [0, 0.29, 0.06], 0x15283d);
  block(gun, [0.03, 0.05, 0.08], [0, 0.3, 0.64], 0x52ffee, false, 1);
  return gun;
}
export class Character {
  readonly group = new T.Group();
  readonly body = new T.Group();
  readonly arms: T.Group[] = [];
  readonly legs: T.Group[] = [];
  readonly head = new T.Group();
  readonly gun?: T.Group;
  private phase = Math.random() * Math.PI * 2;
  private ownedMaterials: T.Material[] = [];
  constructor(readonly role: Role, readonly ghost = false) {
    const seeker = role === 'seeker', skin = 0xe6b78c;
    this.group.add(this.body); this.body.add(this.head);
    if (!seeker) {
      block(this.body, [0.72, 0.65, 0.40], [0, 1.04, 0], 0xf4eee7, true);
      for (let i = 0; i < 3; i++) block(this.body, [0.735, 0.105, 0.415], [0, 0.82 + i * 0.22, 0], 0x28303b);
      block(this.body, [0.68, 0.16, 0.39], [0, 0.69, 0], 0x3c556a, true);
    } else {
      block(this.body, [0.79, 0.68, 0.49], [0, 1.05, 0], 0x2e4057, true);
      block(this.body, [0.66, 0.31, 0.12], [0, 1.19, 0.28], 0x4e6377, true);
      block(this.body, [0.33, 0.065, 0.02], [0.08, 1.20, 0.35], 0x48dedb, false, 0.7);
      block(this.body, [0.60, 0.22, 0.12], [0, 0.89, 0.28], 0x243147, true);
      block(this.body, [0.84, 0.13, 0.53], [0, 0.73, 0], 0x8a4f3d, true);
      block(this.body, [0.20, 0.15, 0.04], [0, 0.73, 0.30], 0xa9b4c3);
      block(this.body, [0.42, 0.45, 0.20], [0, 1.15, -0.31], 0x172c42, true);
    }
    for (const side of [-1, 1]) {
      const leg = new T.Group(); leg.position.set(side * 0.195, 0.67, 0); this.body.add(leg); this.legs.push(leg);
      block(leg, [0.29, 0.53, 0.32], [0, -0.24, 0], seeker ? 0x495263 : 0x39566f, true);
      if (seeker) block(leg, [0.31, 0.17, 0.10], [0, -0.28, 0.20], 0x233248, true);
      block(leg, [0.32, 0.18, 0.43], [0, -0.57, 0.05], seeker ? 0x152639 : 0xc9bbaa, true);
      block(leg, [0.33, 0.06, 0.44], [0, -0.64, 0.05], 0x162333);
      const arm = new T.Group(); arm.position.set(side * 0.49, 1.30, 0); this.body.add(arm); this.arms.push(arm);
      block(arm, [0.28, 0.32, 0.31], [0, -0.12, 0], seeker ? 0x4e6277 : 0xf3ece5, true);
      if (!seeker) block(arm, [0.29, 0.09, 0.32], [0, -0.11, 0], 0x282c39);
      else block(arm, [0.33, 0.21, 0.35], [0, -0.02, 0], 0x506d86, true);
      block(arm, [0.235, 0.29, 0.25], [0, -0.39, 0], seeker ? 0x273448 : skin, true);
      block(arm, [0.275, 0.24, 0.28], [0, -0.57, 0.01], seeker ? 0x192438 : 0xd4c59d, true);
      block(arm, [0.29, 0.075, 0.29], [0, -0.47, 0], seeker ? 0x4b5e73 : 0xa79276);
      block(arm, [0.085, 0.13, 0.16], [-side * 0.16, -0.56, 0.06], seeker ? 0x192438 : 0xd4c59d);
    }
    block(this.head, [0.68, 0.64, 0.59], [0, 1.71, 0], skin, true);
    block(this.head, [0.085, 0.14, 0.08], [0.02, 1.64, 0.335], 0xca775b);
    for (const side of [-1, 1]) {
      block(this.head, [0.17, 0.17, 0.024], [side * 0.17, 1.77, 0.31], 0xfff8e9);
      block(this.head, [0.062, 0.115, 0.016], [side * 0.17 - 0.014, 1.765, 0.33], 0x171c28);
      const brow = block(this.head, [0.22, 0.068, 0.035], [side * 0.17, 1.9, 0.324], seeker ? 0x1c2029 : 0x563329);
      brow.rotation.z = side * (seeker ? 0.25 : -0.12);
      block(this.head, [0.13, 0.16, 0.18], [side * 0.38, 1.66, 0], 0xdc9e7a, true);
    }
    if (seeker) {
      block(this.head, [0.89, 0.22, 0.76], [0, 2.025, 0], 0x6a879e, true);
      block(this.head, [0.60, 0.06, 0.69], [0, 2.16, 0], 0x8dacbe);
      block(this.head, [0.85, 0.64, 0.14], [0, 1.76, -0.33], 0x344962, true);
      for (const side of [-1, 1]) {
        block(this.head, [0.14, 0.46, 0.70], [side * 0.39, 1.82, 0], 0x49627b, true);
        block(this.head, [0.17, 0.31, 0.37], [side * 0.39, 1.47, 0.13], 0x405772, true);
        block(this.head, [0.13, 0.34, 0.28], [side * 0.515, 1.77, 0], 0x9b8f95, true);
        block(this.head, [0.045, 0.19, 0.16], [side * 0.59, 1.77, 0], 0x655a72);
      }
      block(this.head, [0.29, 0.035, 0.028], [0.025, 1.49, 0.314], 0x7c4040).rotation.z = 0.08;
      this.gun = makeBlaster(); this.gun.position.set(0.16, 1.03, 0.43); this.body.add(this.gun);
    } else {
      block(this.head, [0.76, 0.22, 0.67], [0, 2.005, -0.015], 0x55352b, true);
      block(this.head, [0.74, 0.38, 0.17], [0, 1.86, -0.31], 0x492b28, true);
      block(this.head, [0.16, 0.33, 0.23], [-0.3, 1.88, 0.22], 0x58352b, true);
      block(this.head, [0.26, 0.15, 0.1], [0.04, 1.94, 0.31], 0x573129);
      block(this.head, [0.16, 0.23, 0.11], [0.27, 1.91, 0.31], 0x573129);
      const mouth = block(this.head, [0.36, 0.13, 0.027], [0.03, 1.505, 0.315], 0x552c32); mouth.rotation.z = -0.04;
      block(this.head, [0.30, 0.067, 0.029], [0.03, 1.535, 0.33], 0xfff7e2);
      block(this.head, [0.105, 0.05, 0.03], [-0.25, 1.615, 0.31], 0xd28b77);
    }
    if (ghost) {
      this.group.traverse(o => {
        if (!(o instanceof T.Mesh)) return;
        const isOutline = o.material === outlineMat;
        const mat = new T.MeshBasicMaterial({ color: isOutline ? 0x59ffed : 0xf452e8, transparent: true, opacity: isOutline ? 0.6 : 0.23, depthWrite: false, side: isOutline ? T.BackSide : T.FrontSide });
        o.material = mat; o.castShadow = false; o.receiveShadow = false; this.ownedMaterials.push(mat);
      });
      const ring = new T.Mesh(new T.RingGeometry(0.45, 0.48, 32), new T.MeshBasicMaterial({ color: 0xe657ed, transparent: true, opacity: 0.65, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.025; this.group.add(ring);
    }
  }
  animate(pose: Pick<Pose, 'moving' | 'grounded' | 'waving' | 'dashing'>, dt: number, time: number): void {
    this.phase += dt * (pose.moving > 0.5 ? pose.moving * 2.3 : 2);
    const walk = Math.min(1, pose.moving / 6), swing = Math.sin(this.phase) * 0.70 * walk;
    this.legs[0].rotation.x = pose.grounded ? swing : -0.6;
    this.legs[1].rotation.x = pose.grounded ? -swing : 0.4;
    this.body.position.y = pose.grounded ? Math.abs(Math.sin(this.phase)) * 0.04 * walk + Math.sin(time * 2) * 0.009 : 0;
    this.body.rotation.z = pose.dashing ? 0.1 : Math.sin(this.phase) * walk * 0.022;
    if (this.role === 'seeker') {
      this.arms[0].rotation.set(-1.16, -0.28, -0.16); this.arms[1].rotation.set(-1.03, 0.28, 0.18);
      if (this.gun) this.gun.rotation.x = Math.sin(this.phase) * walk * 0.028;
    } else {
      this.arms[0].rotation.set(-swing * 0.75, 0, -0.08); this.arms[1].rotation.set(swing * 0.75, 0, 0.08);
      if (pose.waving) this.arms[0].rotation.set(0.1, 0, -2.45 + Math.sin(time * 12) * 0.24);
    }
  }
  dispose(): void {
    this.group.removeFromParent();
    this.group.traverse(o => { if (o instanceof T.Mesh && o.geometry instanceof T.RingGeometry) { o.geometry.dispose(); (o.material as T.Material).dispose(); } });
    for (const m of this.ownedMaterials) m.dispose();
  }
}
