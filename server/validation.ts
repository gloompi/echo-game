import type { ClientMessage, Input, Preference } from '../shared/types.js';
import { clamp } from '../shared/physics.js';
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const preference = (v: unknown): v is Preference => v === 'auto' || v === 'hider' || v === 'seeker';
export function parseMessage(raw: string): ClientMessage | null {
  let v: unknown; try { v = JSON.parse(raw); } catch { return null; }
  if (!object(v) || typeof v.type !== 'string') return null;
  if (v.type === 'join') {
    if (typeof v.mode !== 'string' || !['create', 'join', 'quick', 'practice'].includes(v.mode) || typeof v.name !== 'string') return null;
    const name = v.name.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 18) || 'Runner';
    const room = typeof v.room === 'string' ? v.room.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6) : undefined;
    return { type: 'join', mode: v.mode as 'create' | 'join' | 'quick' | 'practice', name, room, preference: preference(v.preference) ? v.preference : 'auto' };
  }
  if (v.type === 'input') {
    if (!object(v.input)) return null;
    const p = v.input;
    if (!['seq', 'mx', 'mz', 'yaw', 'pitch'].every(k => finite(p[k])) || !Number.isSafeInteger(p.seq) || (p.seq as number) < 0) return null;
    if (!['sprint', 'jump', 'dash', 'shoot', 'reload', 'wave'].every(k => typeof p[k] === 'boolean')) return null;
    const input: Input = {
      seq: p.seq as number, mx: clamp(p.mx as number, -1, 1), mz: clamp(p.mz as number, -1, 1),
      yaw: Math.atan2(Math.sin(p.yaw as number), Math.cos(p.yaw as number)), pitch: clamp(p.pitch as number, -1.3, 1.3),
      sprint: p.sprint as boolean, jump: p.jump as boolean, dash: p.dash as boolean,
      shoot: p.shoot as boolean, reload: p.reload as boolean, wave: p.wave as boolean,
    };
    return { type: 'input', input };
  }
  if (v.type === 'start') return { type: 'start' };
  if (v.type === 'preference' && preference(v.value)) return { type: 'preference', value: v.value };
  if (v.type === 'bots' && typeof v.enabled === 'boolean') return { type: 'bots', enabled: v.enabled };
  if (v.type === 'ping' && finite(v.at)) return { type: 'ping', at: v.at };
  return null;
}
