import { CFG } from './config.js';
import M from './movement.json';
import { resolveSettings, type RoomSettings } from './settings.js';
import type { Vec3 } from './types.js';
export interface ScanPortal extends Vec3 { id: string; target: string; exit: Vec3 }
export interface PossibleRegion extends Vec3 { radius: number; viaMirror: boolean }
/** Uses public movement limits, not hidden speed, stamina, cooldown or live pose. */
export function maximumHiderSpeed(settings: RoomSettings): number {
  const b = resolveSettings(settings).balance;
  return Math.max(CFG.hiderSpeed*CFG.sprintMultiplier, M.bhopSpeedCap, CFG.dashSpeed,
    b.hook.enabled ? b.hook.pullSpeedCm/100 : 0);
}
/** Conservative horizontal outer bound. Obstacles, vertical travel and mirror
 * cooldowns are intentionally ignored, so the result may overestimate reachability.
 * Dijkstra includes every possibly reachable mirror exit, even across mirror chains. */
export function possibleRegions(observed: Vec3, ageMs: number, settings: RoomSettings, portals: readonly ScanPortal[]): PossibleRegion[] {
  if (![observed.x,observed.y,observed.z,ageMs].every(Number.isFinite) || ageMs < 0) return [];
  const seconds = ageMs/1000, speed = maximumHiderSpeed(settings);
  const regions: PossibleRegion[] = [{ ...observed, radius: speed*seconds+CFG.radius, viaMirror: false }];
  const arrival = portals.map(portal => Math.max(0,Math.hypot(portal.x-observed.x,portal.z-observed.z)-M.mirrorRadius)/speed);
  const used = new Set<number>();
  while (used.size < portals.length) {
    let index = -1, earliest = Infinity;
    for (let i=0;i<portals.length;i++) if (!used.has(i)&&arrival[i]<earliest) { index=i;earliest=arrival[i]; }
    if (index<0||earliest>seconds) break;
    used.add(index); const destination = portals.find(p => p.id === portals[index].target); if (!destination) continue;
    regions.push({ ...destination.exit, radius:speed*(seconds-earliest)+CFG.radius,viaMirror:true });
    for (let j=0;j<portals.length;j++) {
      const travel = Math.max(0,Math.hypot(portals[j].x-destination.exit.x,portals[j].z-destination.exit.z)-M.mirrorRadius)/speed;
      arrival[j] = Math.min(arrival[j],earliest+travel);
    }
  }
  return regions;
}
