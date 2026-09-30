import * as T from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import type { Skin } from '../shared/balance.js';
import {
  TINT_MATERIAL,
  nodeName,
  skinnedMeshes,
  type CharacterTemplate,
} from './character-assets.js';
import {
  HELD_CLIPS,
  perBaseClip,
  selectMotion,
  type BaseClip,
  type MotionPose,
} from './game/character-motion.js';

/** Cross-fade time between clips, in seconds. */
const FADE_SECONDS = 0.15;
/** Share of the view pitch the pitch bone takes; the clip's own pose carries the rest. */
const PITCH_SHARE = 0.8;
const MAX_PITCH = 1.2;

/** Actions animating the same bones. The target fades in linearly while the others fade out,
 * and weights are normalized, so an interrupted fade never blends toward the bind pose.
 */
class BlendLayer {
  private readonly weights = new Map<T.AnimationAction, number>();
  private target: T.AnimationAction | null = null;

  /** Fades to `action`; an action that is not already playing starts at its first frame. */
  fadeTo(action: T.AnimationAction): void {
    if (action === this.target) return;
    if (!this.weights.has(action)) {
      action.reset().play();
      // With nothing to fade from, the first clip starts at full weight.
      this.weights.set(action, this.weights.size ? 0 : 1);
    }
    this.target = action;
  }

  update(dt: number): void {
    const step = dt / FADE_SECONDS;
    let total = 0;
    for (const [action, weight] of this.weights) {
      const next = action === this.target ? Math.min(1, weight + step) : Math.max(0, weight - step);
      if (next === 0 && action !== this.target) {
        action.stop();
        this.weights.delete(action);
      } else {
        this.weights.set(action, next);
        total += next;
      }
    }
    const scale = total > 0 ? 1 / total : 0;
    for (const [action, weight] of this.weights) action.setEffectiveWeight(weight * scale);
  }
}

/** Materials of the ghost echo: a translucent body and a back-face pass drawn after it, as the
 * procedural ghost's outline blocks are. */
export interface GhostMaterials {
  body: T.Material;
  shell: T.Material;
}

/** One player's instance of an authored character. It shares the template's geometry,
 * materials and clips, and owns its skeleton and mixer. The legs always play the base clip; the
 * upper body plays the same clip in step, or the overlay (wave or aim); the hit flinch is added
 * over both where the motion policy allows it. A character with a weapon socket holds the weapon
 * it is given, and one with a pitch bone leans into the view pitch.
 */
export class SkinnedCharacter {
  readonly root: T.Object3D;
  private readonly skeleton: T.Skeleton;
  private readonly tinted: T.Mesh[] = [];
  private readonly mixer: T.AnimationMixer;
  private readonly lowerBody = new BlendLayer();
  private readonly upperBody = new BlendLayer();
  private readonly lower: Record<BaseClip, T.AnimationAction>;
  private readonly upper: Record<BaseClip, T.AnimationAction>;
  private readonly overlay: T.AnimationAction;
  private readonly flinch: T.AnimationAction;
  private readonly socket: T.Object3D | null;
  private readonly pitchBone: T.Object3D | null;
  private weapon: T.Object3D | null = null;
  private flinchWeight = 0;
  private skin: Skin | null = null;

  /** A ghost replaces every material, ignores skins and casts no shadow. */
  constructor(
    private readonly template: CharacterTemplate,
    private readonly ghost: GhostMaterials | null = null,
  ) {
    this.root = cloneSkinned(template.scene);
    const meshes = skinnedMeshes(this.root),
      first = meshes[0];
    if (!first) throw new Error('Character template has no skinned mesh.');
    // SkeletonUtils gives every primitive its own skeleton copy; share one, as the template does.
    this.skeleton = first.skeleton;
    for (const mesh of meshes) {
      if (mesh.skeleton !== this.skeleton) mesh.bind(this.skeleton, mesh.bindMatrix);
      mesh.castShadow = mesh.receiveShadow = !ghost;
      if (!ghost) {
        if (mesh.material instanceof T.Material && mesh.material.name === TINT_MATERIAL)
          this.tinted.push(mesh);
        continue;
      }
      mesh.material = ghost.body;
      // Created later, so equal-depth transparent sorting draws it after the body.
      const shell = new T.SkinnedMesh(mesh.geometry, ghost.shell);
      shell.bind(this.skeleton, mesh.bindMatrix);
      shell.position.copy(mesh.position);
      shell.quaternion.copy(mesh.quaternion);
      shell.scale.copy(mesh.scale);
      shell.boundingSphere = mesh.boundingSphere.clone();
      mesh.parent?.add(shell);
    }
    this.mixer = new T.AnimationMixer(this.root);
    this.lower = perBaseClip((name) => this.baseAction(name, template.lower[name]));
    this.upper = perBaseClip((name) => this.baseAction(name, template.upper[name]));
    this.overlay = this.mixer.clipAction(template.overlay);
    const { weaponSocket, pitchBone } = template.definition;
    this.socket = weaponSocket ? (this.root.getObjectByName(nodeName(weaponSocket)) ?? null) : null;
    this.pitchBone = pitchBone ? (this.root.getObjectByName(nodeName(pitchBone)) ?? null) : null;
    this.flinch = this.mixer.clipAction(template.hit).setLoop(T.LoopOnce, 1);
  }

  private baseAction(name: BaseClip, clip: T.AnimationClip): T.AnimationAction {
    const action = this.mixer.clipAction(clip);
    if (HELD_CLIPS.has(name)) {
      action.setLoop(T.LoopOnce, 1);
      action.clampWhenFinished = true;
    }
    return action;
  }

  setSkin(skin: Skin): void {
    if (this.ghost || skin === this.skin) return;
    this.skin = skin;
    const material = this.template.tint(skin);
    for (const mesh of this.tinted) mesh.material = material;
  }

  /** Puts `weapon` (metres, +Z muzzle, origin in the grip) in the hand, replacing the previous
   * one; null empties the hand. The caller owns the weapon's shared resources. */
  setWeapon(weapon: T.Object3D | null): void {
    this.weapon?.removeFromParent();
    this.weapon = null;
    if (!weapon || !this.socket) return;
    // The socket inherits the armature's export scale; undo it so the weapon stays in metres.
    this.root.updateMatrixWorld(true);
    const socketScale = this.socket.getWorldScale(new T.Vector3()).x,
      rootScale = this.root.getWorldScale(new T.Vector3()).x;
    weapon.scale.setScalar(rootScale / socketScale);
    weapon.position.set(0, 0, 0);
    weapon.quaternion.identity();
    this.socket.add(weapon);
    this.weapon = weapon;
  }

  /** Whether this character has a hand socket for a weapon. */
  get hasWeaponSocket(): boolean {
    return this.socket !== null;
  }

  /** The weapon in the hand, if any. */
  get heldWeapon(): T.Object3D | null {
    return this.weapon;
  }

  /** Restarts the flinch; it shows over any base clip the motion policy allows it on. */
  hit(): void {
    this.flinch.reset().play();
  }

  update(pose: MotionPose, dt: number): void {
    const motion = selectMotion(pose, this.template.definition.speeds),
      lower = this.lower[motion.base],
      upper = this.upper[motion.base];
    this.lowerBody.fadeTo(lower);
    this.upperBody.fadeTo(motion.overlay ? this.overlay : upper);
    lower.timeScale = upper.timeScale = motion.timeScale;
    // The base clip's upper half runs on the legs' clock, also while it fades back from a wave.
    upper.time = lower.time;
    const step = dt / FADE_SECONDS;
    this.flinchWeight = Math.min(
      Math.max(this.flinchWeight + (motion.flinch ? step : -step), 0),
      1,
    );
    this.flinch.setEffectiveWeight(this.flinchWeight);
    this.lowerBody.update(dt);
    this.upperBody.update(dt);
    this.mixer.update(dt);
    this.leanIntoPitch(pose.pitch ?? 0);
  }

  /** Tilts the pitch bone about the character's own side axis after the clips have posed it,
   * so the upper body and the held weapon follow the view up and down. */
  private leanIntoPitch(pitch: number): void {
    const bone = this.pitchBone,
      parent = bone?.parent;
    if (!bone || !parent || !pitch) return;
    const angle = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch)) * PITCH_SHARE;
    this.root.updateMatrixWorld(true);
    // The character's side axis in the bone's parent space; a positive turn about it raises the
    // front of a character facing +Z.
    const toParent = parent.getWorldQuaternion(new T.Quaternion()).invert(),
      side = new T.Vector3(1, 0, 0)
        .applyQuaternion(this.root.getWorldQuaternion(new T.Quaternion()))
        .applyQuaternion(toParent);
    bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(side, angle));
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    // Geometry, materials and clips belong to the template and the ghost materials to their
    // module; the skeleton and its bone texture belong to this character.
    this.skeleton.dispose();
  }
}
