import { CFG } from './config.js';
export interface RoomSettings { delayMs: number; roundMs: number; seekerCount: number }
export const DEFAULT_SETTINGS: RoomSettings = { delayMs: CFG.delayMs, roundMs: CFG.roundMs, seekerCount: 2 };
export function validSettings(value: unknown): value is RoomSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.keys(value).some(k => !['delayMs', 'roundMs', 'seekerCount'].includes(k))) return false;
  const v = value as Partial<RoomSettings>;
  return Number.isInteger(v.delayMs) && v.delayMs! >= 0 && v.delayMs! <= CFG.maxDelayMs
    && Number.isInteger(v.roundMs) && v.roundMs! >= 30_000 && v.roundMs! <= 600_000
    && Number.isInteger(v.seekerCount) && v.seekerCount! >= 1 && v.seekerCount! <= 3;
}
export const delayLabel = (delayMs: number) => `${Number((delayMs / 1000).toFixed(3))}s`;
