import { readFileSync, writeFileSync } from 'node:fs';
import { MAPS } from '../shared/map.js';
import { makeMotor, move } from '../shared/physics.js';
import { DEFAULT_SETTINGS, type RoomSettings } from '../shared/settings.js';
import { neutralInput, type Input, type Role, type Vec3 } from '../shared/types.js';
interface Definition {
  name: string;
  start: Vec3;
  role: Role;
  settings: RoomSettings;
  segments: { ticks: number; input: Partial<Input> }[];
}
const definitions: Definition[] = [
  {
    name: 'switchyard-crawl-headroom',
    start: { x: -26, y: 0, z: -17 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'switchyard' },
    segments: [
      { ticks: 45, input: { mx: 1, crouch: true } },
      { ticks: 20, input: { mx: 1 } },
      { ticks: 70, input: { mx: 1 } },
    ],
  },
  {
    name: 'glassworks-auto-hop',
    start: { x: -50, y: 0, z: 49 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'glassworks', bunnyHop: 'auto' },
    segments: [
      { ticks: 60, input: { mx: 1 } },
      { ticks: 90, input: { mx: 1, jump: true } },
      { ticks: 100, input: { mx: 1, mz: 1, yaw: 1.1, jump: true } },
    ],
  },
  {
    name: 'glassworks-timed-air-strafe',
    start: { x: 45, y: 0, z: 40 },
    role: 'seeker',
    settings: { ...DEFAULT_SETTINGS, mapId: 'glassworks' },
    segments: [
      { ticks: 40, input: { mz: 1 } },
      { ticks: 15, input: { jump: true, mz: 1 } },
      { ticks: 25, input: { mx: 1, yaw: 0.7 } },
      { ticks: 4, input: { jump: true, mx: 1 } },
      { ticks: 45, input: { mz: 1 } },
    ],
  },
  {
    name: 'afterhours-custom-dash',
    start: { x: 20, y: 0, z: 20 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, dashCooldownMs: 500 },
    segments: [
      { ticks: 1, input: { dash: true, mz: 1 } },
      { ticks: 32, input: { mz: 1 } },
      { ticks: 1, input: { dash: true, mx: -1 } },
      { ticks: 60, input: { crouch: true, mz: 1 } },
    ],
  },
  {
    name: 'legacy-movement-off',
    start: { x: 20, y: 0, z: 20 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, bunnyHop: 'off' },
    segments: [
      { ticks: 60, input: { mz: 0.5 } },
      { ticks: 100, input: { jump: true, mz: 1 } },
      { ticks: 15, input: { crouch: true } },
    ],
  },
  {
    name: 'mirror-yard-crawl-through',
    start: { x: 0, y: 0, z: -14 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'mirror-yard' },
    segments: [
      { ticks: 40, input: { mz: 1 } },
      { ticks: 100, input: { mz: 1, crouch: true } },
      { ticks: 20, input: {} },
    ],
  },
  {
    name: 'mirror-yard-stairs-to-rooftop',
    start: { x: 9, y: 0, z: 5.9 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'mirror-yard' },
    segments: [
      { ticks: 35, input: { mz: -1 } },
      { ticks: 35, input: { mz: -1 } },
      { ticks: 30, input: { mz: -1 } },
    ],
  },
  {
    name: 'neon-carnival-arcade-stairs',
    start: { x: 18, y: 0, z: -4.8 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'neon-carnival' },
    segments: [
      { ticks: 35, input: { mz: 1 } },
      { ticks: 35, input: { mz: 1 } },
      { ticks: 30, input: { mz: 1 } },
    ],
  },
  {
    name: 'neon-carnival-tunnel-north-to-south',
    start: { x: -21, y: 0, z: -19 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'neon-carnival' },
    segments: [
      { ticks: 30, input: { mz: -1 } },
      { ticks: 150, input: { mz: -1, crouch: true } },
      { ticks: 150, input: { mz: -1, crouch: true } },
      { ticks: 20, input: {} },
    ],
  },
  {
    name: 'neon-carnival-tunnel-south-to-north',
    start: { x: -21, y: 0, z: -4 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'neon-carnival' },
    segments: [
      { ticks: 30, input: { mz: 1 } },
      { ticks: 150, input: { mz: 1, crouch: true } },
      { ticks: 150, input: { mz: 1, crouch: true } },
      { ticks: 20, input: {} },
    ],
  },
  {
    name: 'neon-carnival-side-stairs-and-roof-connection',
    start: { x: -17, y: 0, z: 1.2 },
    role: 'hider',
    settings: { ...DEFAULT_SETTINGS, mapId: 'neon-carnival' },
    segments: [
      { ticks: 41, input: { mz: 1 } },
      { ticks: 41, input: { mz: 1 } },
      { ticks: 36, input: { mx: -1 } },
    ],
  },
];
const cases = definitions.map((d) => {
  const motor = makeMotor(d.start),
    layout = MAPS[d.settings.mapId ?? 'afterhours'];
  return {
    ...d,
    segments: d.segments.map((s) => {
      const input = { ...neutralInput(), ...s.input };
      for (let i = 0; i < s.ticks; i++)
        move(motor, input, d.role, 1 / 60, layout.boxes, layout.half, d.settings);
      return { ticks: s.ticks, input, expected: { ...motor } };
    }),
  };
});
const path = 'tests/fixtures/gameplay.json';
const text =
  JSON.stringify({
    description:
      'Generated from TypeScript movement. Verify with the Rust parity test; do not edit expected values.',
    cases,
  }) + '\n';
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== text)
    throw new Error('Run npm run fixtures, review the results and run cargo test.');
  console.log('Gameplay fixtures match.');
} else {
  writeFileSync(path, text);
  console.log(`Wrote ${cases.length} gameplay scenarios.`);
}
