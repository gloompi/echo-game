import defaults from './balance.json';
import limits from './balance-limits.json';

export type Balance = typeof defaults;
export type Weapon = keyof Balance['weapons'];
export const WEAPONS = ['blaster', 'scatter', 'repeater', 'web'] as const;
export const SKINS = [
  'classic',
  'cobalt',
  'ember',
  'jade',
  'violet',
  'arctic',
  'sunset',
  'carbon',
] as const;
export type Skin = (typeof SKINS)[number];
export const BALANCE_LIMITS = limits;
// Consumers edit a copy; never mutate the shared defaults during a room update.
export const freshBalance = (): Balance => structuredClone(defaults);
export const isWeapon = (value: unknown): value is Weapon =>
  typeof value === 'string' && WEAPONS.includes(value as Weapon);
export const isSkin = (value: unknown): value is Skin =>
  typeof value === 'string' && SKINS.includes(value as Skin);

export function balanceError(value: unknown): string | null {
  const visit = (sample: unknown, candidate: unknown, path = ''): string | null => {
    if (sample !== null && typeof sample === 'object') {
      if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate))
        return `Invalid ${path || 'balance'} object.`;
      const keys = Object.keys(sample),
        object = candidate as Record<string, unknown>;
      if (
        Object.keys(object).length !== keys.length ||
        keys.some((key) => !Object.hasOwn(object, key))
      )
        return `Missing or unknown ${path || 'balance'} settings.`;
      for (const key of keys) {
        const error = visit(
          (sample as Record<string, unknown>)[key],
          object[key],
          path ? `${path}.${key}` : key,
        );
        if (error) return error;
      }
      return null;
    }
    const rule = limits[path as keyof typeof limits];
    if (!rule) return `Unknown setting: ${path}.`;
    if (rule.kind === 'boolean')
      return typeof candidate === 'boolean' ? null : `${path} must be on or off.`;
    return typeof candidate === 'number' &&
      Number.isSafeInteger(candidate) &&
      'min' in rule &&
      candidate >= rule.min &&
      candidate <= rule.max
      ? null
      : `${path} is outside its supported range.`;
  };
  const shapeError = visit(defaults, value);
  if (shapeError) return shapeError;
  const b = value as Balance;
  if (!b.weapons.blaster.enabled) return 'The fallback blaster must remain enabled.';
  for (const [name, enabled, duration, cooldown] of [
    ['slide', b.slide.enabled, b.slide.durationMs, b.slide.cooldownMs],
    ['shield', b.shield.enabled, b.shield.durationMs, b.shield.cooldownMs],
    ['scan', b.scan.enabled, b.scan.durationMs, b.scan.cooldownMs],
    ['hook', b.hook.enabled, b.hook.pullMs + b.hook.stunMs, b.hook.cooldownMs],
  ] as const)
    if (enabled && duration >= cooldown)
      return `${name}: cooldown must exceed the active duration.`;
  if (b.mine.armMs >= b.mine.lifeMs) return 'Mine arming time must be shorter than its lifetime.';
  return null;
}
export const validBalance = (value: unknown): value is Balance => balanceError(value) === null;

export function getBalanceValue(balance: Balance, path: string): number | boolean {
  if (!Object.hasOwn(limits, path)) throw new Error('Unknown balance setting.');
  let value: unknown = balance;
  for (const part of path.split('.')) value = (value as Record<string, unknown>)[part];
  return value as number | boolean;
}
export function setBalanceValue(balance: Balance, path: string, value: number | boolean): void {
  if (!Object.hasOwn(limits, path)) throw new Error('Unknown balance setting.');
  const parts = path.split('.');
  let object = balance as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) object = object[part] as Record<string, unknown>;
  object[parts.at(-1)!] = value;
}
