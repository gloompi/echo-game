import { CFG } from './config.js';
import { angleLerp } from './physics.js';
import type { Pose } from './types.js';
interface Frame {
  at: number;
  players: Pose[];
}
/** Private history. Never substitute a future pose during warm-up or interpolate across a teleport. */
export class History {
  frames: Frame[] = [];
  record(at: number, players: Pose[]): void {
    this.frames.push({ at, players: players.map((p) => ({ ...p })) });
    while (this.frames.length > 1 && this.frames[1].at < at - CFG.historyMs) this.frames.shift();
  }
  sample(at: number): Pose[] {
    if (!this.frames.length || this.frames[0].at > at) return [];
    let i = this.frames.length - 1;
    while (i > 0 && this.frames[i].at > at) i--;
    const a = this.frames[i],
      b = this.frames[i + 1];
    if (!b || b.at === a.at) return a.players.map((p) => ({ ...p }));
    const t = Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at)));
    const next = new Map(b.players.map((p) => [p.id, p]));
    return a.players.map((p) => {
      const q = next.get(p.id);
      if (!q || p.alive !== q.alive || p.role !== q.role || (p.warp ?? 0) !== (q.warp ?? 0))
        return { ...p };
      return {
        ...p,
        x: p.x + (q.x - p.x) * t,
        y: p.y + (q.y - p.y) * t,
        z: p.z + (q.z - p.z) * t,
        yaw: angleLerp(p.yaw, q.yaw, t),
        pitch: p.pitch + (q.pitch - p.pitch) * t,
      };
    });
  }
  clear(): void {
    this.frames.length = 0;
  }
}
