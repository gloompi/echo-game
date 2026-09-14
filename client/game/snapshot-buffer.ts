import type { Pose, Snapshot } from '../../shared/types.js';

type Observation = Pick<Snapshot, 'now' | 'viewTime' | 'players' | 'echo'>;
export interface RenderObservation {
  players: Pose[];
  echo: Pose | null;
  sampledAt: number;
}

/** Bounded, presentation-only history. It can only sample observations the server sent.
 * Returned interpolated poses are scratch values valid until the next sample.
 */
export class SnapshotBuffer {
  private readonly frames: Observation[] = [];
  private indexes = new WeakMap<Observation, ReadonlyMap<string, Pose>>();
  private readonly poses = new Map<string, Pose>();
  private readonly output: Pose[] = [];
  private readonly visibleIds = new Set<string>();

  constructor(
    private readonly interpolationMs = 100,
    private readonly capacity = 12,
  ) {
    if (!Number.isFinite(interpolationMs) || interpolationMs < 0)
      throw new Error('Invalid interpolation delay.');
    if (!Number.isInteger(capacity) || capacity < 2)
      throw new Error('Snapshot capacity must be at least two.');
  }

  get size(): number {
    return this.frames.length;
  }
  get retainedPoseCount(): number {
    return this.poses.size;
  }

  clear(): void {
    this.frames.length = 0;
    this.poses.clear();
    this.visibleIds.clear();
    this.output.length = 0;
    this.indexes = new WeakMap();
  }

  push(frame: Observation): boolean {
    const last = this.frames.at(-1);
    if (
      !Number.isFinite(frame.now) ||
      !Number.isFinite(frame.viewTime) ||
      (last && frame.now <= last.now)
    )
      return false;
    this.frames.push(frame);
    if (this.frames.length > this.capacity) this.frames.shift();
    return true;
  }

  sample(serverNow: number): RenderObservation {
    const first = this.frames[0];
    if (!first || !Number.isFinite(serverNow))
      return { players: [], echo: null, sampledAt: serverNow };
    const at = serverNow - this.interpolationMs;
    const last = this.frames[this.frames.length - 1];
    if (this.frames.length < 2 || at >= last.now) return this.direct(last);
    let older = first,
      newer = first;
    for (let index = 0; index < this.frames.length - 1; index++) {
      if (this.frames[index].now <= at) {
        older = this.frames[index];
        newer = this.frames[index + 1];
      }
    }
    const fraction = Math.max(
      0,
      Math.min(1, (at - older.now) / Math.max(1, newer.now - older.now)),
    );
    const next = this.indexPlayers(newer);
    this.output.length = 0;
    for (const pose of older.players) {
      const other = next.get(pose.id);
      this.output.push(other ? this.interpolate(pose, other, fraction) : pose);
    }
    const echo =
      older.echo && newer.echo ? this.interpolate(older.echo, newer.echo, fraction) : older.echo;
    this.retain(older);
    // Keep discrete animation/effect timestamps on the older authorized observation.
    return { players: this.output, echo, sampledAt: older.viewTime };
  }

  private direct(frame: Observation): RenderObservation {
    this.retain(frame);
    return { players: frame.players, echo: frame.echo, sampledAt: frame.viewTime };
  }

  private retain(frame: Observation): void {
    this.visibleIds.clear();
    for (const pose of frame.players) this.visibleIds.add(pose.id);
    if (frame.echo) this.visibleIds.add(frame.echo.id);
    for (const id of this.poses.keys()) {
      if (!this.visibleIds.has(id)) this.poses.delete(id);
    }
  }

  private indexPlayers(frame: Observation): ReadonlyMap<string, Pose> {
    let index = this.indexes.get(frame);
    if (!index) {
      const created = new Map<string, Pose>();
      for (const pose of frame.players) created.set(pose.id, pose);
      this.indexes.set(frame, created);
      index = created;
    }
    return index;
  }

  private interpolate(older: Pose, newer: Pose, fraction: number): Pose {
    if (
      older.id !== newer.id ||
      older.alive !== newer.alive ||
      older.role !== newer.role ||
      (older.warp ?? 0) !== (newer.warp ?? 0)
    )
      return older;
    let output = this.poses.get(older.id);
    if (!output) {
      output = { ...older };
      this.poses.set(older.id, output);
    }
    Object.assign(output, older);
    // Optional fields disappearing from a new observation must not survive in reused scratch state.
    output.crouched = older.crouched;
    output.warp = older.warp;
    output.sliding = older.sliding;
    output.shielded = older.shielded;
    output.controlled = older.controlled;
    output.hitAt = older.hitAt;
    output.skin = older.skin;
    output.weapon = older.weapon;
    output.x = lerp(older.x, newer.x, fraction);
    output.y = lerp(older.y, newer.y, fraction);
    output.z = lerp(older.z, newer.z, fraction);
    output.pitch = lerp(older.pitch, newer.pitch, fraction);
    output.moving = lerp(older.moving, newer.moving, fraction);
    const delta = newer.yaw - older.yaw;
    output.yaw = older.yaw + Math.atan2(Math.sin(delta), Math.cos(delta)) * fraction;
    return output;
  }
}

function lerp(a: number, b: number, fraction: number): number {
  return (1 - fraction) * a + fraction * b;
}
