import map from './arena.json';
import type { Box, Vec3 } from './types.js';
// Same data is embedded in echo-core; bottom-aligned boxes, +Y up, metres.
export const ARENA: Box[] = map.boxes as Box[];
export const SPAWNS: Vec3[] = map.spawns;
export const WAYPOINTS: Vec3[] = map.waypoints;
