import { CFG } from './config.js';
import { freshBalance, validBalance, type Balance } from './balance.js';
export const MAP_IDS = [
  'afterhours',
  'switchyard',
  'glassworks',
  'mirror-yard',
  'neon-carnival',
] as const;
export type MapId = (typeof MAP_IDS)[number];
export type BunnyHop = 'off' | 'timed' | 'auto';
export interface RoomSettings {
  delayMs: number;
  roundMs: number;
  seekerCount: number;
  mapId?: MapId;
  reloadMs?: number;
  dashCooldownMs?: number;
  mirrorCooldownMs?: number;
  bunnyHop?: BunnyHop;
  balance?: Balance;
}
export const DEFAULT_SETTINGS: Readonly<Required<RoomSettings>> = Object.freeze({
  delayMs: CFG.delayMs,
  roundMs: CFG.roundMs,
  seekerCount: 2,
  mapId: 'afterhours',
  reloadMs: CFG.reloadMs,
  dashCooldownMs: 3200,
  mirrorCooldownMs: 60000,
  bunnyHop: 'timed',
  balance: freshBalance(),
});
export const resolveSettings = (
  settings: RoomSettings = DEFAULT_SETTINGS,
): Required<RoomSettings> => ({ ...DEFAULT_SETTINGS, ...settings });
export function validSettings(value: unknown): value is RoomSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).some((k) => !Object.hasOwn(DEFAULT_SETTINGS, k))) return false;
  const v = value as Record<string, unknown>;
  const integer = (key: string, min: number, max: number, optional = false) =>
    (optional && !(key in v)) ||
    (typeof v[key] === 'number' && Number.isInteger(v[key]) && v[key] >= min && v[key] <= max);
  return (
    integer('delayMs', 0, CFG.maxDelayMs) &&
    integer('roundMs', 30000, 600000) &&
    integer('seekerCount', 1, 3) &&
    integer('reloadMs', 0, 10000, true) &&
    integer('dashCooldownMs', 0, 30000, true) &&
    integer('mirrorCooldownMs', 0, 180000, true) &&
    (!('mapId' in v) || MAP_IDS.includes(v.mapId as MapId)) &&
    (!('bunnyHop' in v) || ['off', 'timed', 'auto'].includes(v.bunnyHop as string)) &&
    (!('balance' in v) || validBalance(v.balance))
  );
}
export const delayLabel = (ms: number) => `${Number((ms / 1000).toFixed(3))}s`;
