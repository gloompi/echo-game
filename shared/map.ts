import classic from './arena.json';
import data from './maps.json';
import type { Box, Vec3 } from './types.js';
import type { MapId } from './settings.js';
export interface Mirror extends Vec3 {
  id: string;
  target: string;
  label: string;
  yaw: number;
  exit: Vec3;
}
export interface GameMap {
  id: MapId;
  name: string;
  half: number;
  recommended: string;
  description: string;
  theme: string;
  boxes: Box[];
  spawns: Vec3[];
  waypoints: Vec3[];
  mirrors: Mirror[];
  landmarks: { name: string; x: number; y: number; z: number }[];
}
export const MAPS = data as unknown as Record<MapId, GameMap>;
MAPS.afterhours = {
  ...MAPS.afterhours,
  boxes: classic.boxes as Box[],
  spawns: classic.spawns,
  waypoints: classic.waypoints,
};
export let ACTIVE_MAP: GameMap = MAPS.afterhours;
export let ARENA: Box[] = ACTIVE_MAP.boxes;
export let SPAWNS: Vec3[] = ACTIVE_MAP.spawns;
export let WAYPOINTS: Vec3[] = ACTIVE_MAP.waypoints;
export let MAP_HALF = ACTIVE_MAP.half;
/** Only call with the map id confirmed in an authoritative snapshot. */
export function selectMap(id: MapId): GameMap {
  ACTIVE_MAP = MAPS[id];
  ARENA = ACTIVE_MAP.boxes;
  SPAWNS = ACTIVE_MAP.spawns;
  WAYPOINTS = ACTIVE_MAP.waypoints;
  MAP_HALF = ACTIVE_MAP.half;
  return ACTIVE_MAP;
}
