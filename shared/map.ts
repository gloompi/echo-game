import type { Box, Vec3 } from './types.js';
const box = (id: string, x: number, z: number, w: number, d: number, h: number, kind: Box['kind'] = 'cover', y = 0): Box => ({ id, x, z, w, d, h, kind, y });
// The server and renderer share this exact collision layout. y is the bottom of a box.
export const ARENA: Box[] = [
  box('core-plinth', 0, 0, 5.2, 5.2, 0.75, 'platform'),
  box('core', 0, 0, 1.7, 1.7, 3.5, 'reactor', 0.75),
  box('west-wall', -12, 3, 1.3, 9, 2.6),
  box('east-wall', 12, -3, 1.3, 9, 2.6),
  box('north-wall', -4, -13, 9, 1.3, 2.6),
  box('south-wall', 4, 13, 9, 1.3, 2.6),
  box('crate-a', -7, -6, 2.6, 2.6, 1.45),
  box('crate-b', -9.2, -6, 1.8, 2.3, 2.25),
  box('crate-c', 7, 6, 2.6, 2.6, 1.45),
  box('crate-d', 9.2, 6, 1.8, 2.3, 2.25),
  box('crate-e', -5.5, 8, 2.6, 1.8, 1.5),
  box('crate-f', 5.5, -8, 2.6, 1.8, 1.5),
  box('balcony-n', 13, -13, 7, 4, 2.1, 'platform'),
  box('balcony-s', -13, 13, 7, 4, 2.1, 'platform'),
  box('cover-n', 14, -14, 2.2, 1.4, 1.5, 'cover', 2.1),
  box('cover-s', -14, 14, 2.2, 1.4, 1.5, 'cover', 2.1),
  box('crate-g', 17, 6, 2.5, 2.5, 1.5),
  box('crate-h', -17, -6, 2.5, 2.5, 1.5),
  ...Array.from({ length: 6 }, (_, i) => box(`stair-n-${i}`, 11, -6.5 - i * 0.75, 2.3, 0.78, (i + 1) * 0.35, 'step')),
  ...Array.from({ length: 6 }, (_, i) => box(`stair-s-${i}`, -11, 6.5 + i * 0.75, 2.3, 0.78, (i + 1) * 0.35, 'step')),
];
export const SPAWNS: Vec3[] = [
  { x: -4, y: 0, z: 17 }, { x: -15, y: 0, z: -16 },
  { x: 15, y: 0, z: 16 }, { x: 4, y: 0, z: -17 },
  { x: -18, y: 0, z: 1 }, { x: 18, y: 0, z: -1 },
  { x: -7, y: 0, z: 3 }, { x: 7, y: 0, z: -3 },
];
export const WAYPOINTS = [
  [-18,-18],[-10,-18],[2,-18],[18,-18],[19,-9],[18,3],[18,18],
  [8,18],[-3,18],[-18,18],[-19,9],[-18,-2],[-7,-2],[-6,4],
  [6,-4],[7,2],[-3,-8],[3,8],[-9,-10],[9,10],
].map(([x, z]) => ({ x, z }));
