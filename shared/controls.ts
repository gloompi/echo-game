export type Action = 'jump' | 'crouch';
export interface Bindings {
  jump: string;
  crouch: string;
}
export const DEFAULT_BINDINGS: Readonly<Bindings> = Object.freeze({
  jump: 'Space',
  crouch: 'ControlLeft',
});
export const COMBAT_KEYS = [
  'KeyG',
  'KeyV',
  'KeyB',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
] as const;
const reserved = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyQ',
  'KeyE',
  'KeyR',
  'KeyF',
  ...COMBAT_KEYS,
]);
export const normalizeKey = (code: string) =>
  code === 'ControlRight' ? 'ControlLeft' : code === 'AltRight' ? 'AltLeft' : code;
export function bindable(action: Action, code: string): boolean {
  code = normalizeKey(code);
  return (
    !reserved.has(code) &&
    (/^Key[A-Z]$/.test(code) ||
      /^Digit[0-9]$/.test(code) ||
      ['Space', 'ControlLeft', 'AltLeft'].includes(code) ||
      (action === 'jump' && ['WheelUp', 'WheelDown'].includes(code)))
  );
}
export function changeBinding(bindings: Bindings, action: Action, code: string): Bindings | null {
  code = normalizeKey(code);
  if (!bindable(action, code)) return null;
  const other: Action = action === 'jump' ? 'crouch' : 'jump';
  const next = { ...bindings, [action]: code };
  if (next[other] === code) {
    if (!bindable(other, bindings[action])) return null;
    next[other] = bindings[action];
  }
  return next;
}
export function readBindings(raw: string | null): Bindings {
  try {
    const v: unknown = JSON.parse(raw ?? 'null');
    if (!v || typeof v !== 'object') return { ...DEFAULT_BINDINGS };
    const b = v as Bindings;
    if (
      typeof b.jump !== 'string' ||
      typeof b.crouch !== 'string' ||
      !bindable('jump', b.jump) ||
      !bindable('crouch', b.crouch)
    )
      return { ...DEFAULT_BINDINGS };
    const result = { jump: normalizeKey(b.jump), crouch: normalizeKey(b.crouch) };
    return result.jump === result.crouch ? { ...DEFAULT_BINDINGS } : result;
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}
export const keyName = (code: string) =>
  (
    ({
      Space: 'Space',
      ControlLeft: 'Ctrl',
      AltLeft: 'Alt',
      WheelDown: 'Wheel ↓',
      WheelUp: 'Wheel ↑',
    }) as Record<string, string>
  )[code] ?? code.replace(/^Key|^Digit/, '');
