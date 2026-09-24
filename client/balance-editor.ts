import {
  BALANCE_LIMITS,
  balanceError,
  freshBalance,
  getBalanceValue,
  setBalanceValue,
  type Balance,
} from '../shared/balance.js';
const words = (text: string) =>
  text.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
export class BalanceEditor {
  readonly element = document.createElement('details');
  private fields = new Map<string, HTMLInputElement>();
  private value = freshBalance();
  constructor(changed: () => void) {
    this.element.className = 'balance-editor wide';
    const summary = document.createElement('summary');
    summary.textContent = 'ABILITIES & WEAPON BALANCE';
    this.element.append(summary);
    const intro = document.createElement('p');
    intro.textContent =
      'Timing is in seconds; distance in metres. Weapon reload 0 inherits the main reload setting. Global reload 0 disables reloading for every weapon. Changes apply with the room settings.';
    this.element.append(intro);
    const groups = new Map<string, HTMLFieldSetElement>();
    for (const [path, rule] of Object.entries(BALANCE_LIMITS)) {
      const parts = path.split('.'),
        groupName = parts.slice(0, -1).join(' / ');
      let group = groups.get(groupName);
      if (!group) {
        group = document.createElement('fieldset');
        const title = document.createElement('legend');
        title.textContent = words(groupName);
        group.append(title);
        groups.set(groupName, group);
        this.element.append(group);
      }
      const label = document.createElement('label'),
        input = document.createElement('input');
      const boolean = rule.kind === 'boolean',
        field = parts.at(-1)!;
      const factor = field.endsWith('Ms') ? 1000 : field.endsWith('Cm') ? 100 : 1;
      label.textContent =
        words(field.replace(/Ms$|Cm$/, '')) +
        (factor === 1000 ? ' (s)' : factor === 100 ? ' (m)' : '');
      input.type = boolean ? 'checkbox' : 'number';
      input.dataset.factor = String(factor);
      input.dataset.balance = path;
      if ('min' in rule) {
        input.min = String(rule.min / factor);
        input.max = String(rule.max / factor);
        input.step = String(1 / factor);
      }
      input.addEventListener('input', changed);
      label.append(input);
      group.append(label);
      this.fields.set(path, input);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = 'RESET ABILITY BALANCE';
    reset.onclick = () => {
      this.load(freshBalance());
      changed();
    };
    this.element.append(reset);
    this.load(this.value);
  }
  load(value: Balance): void {
    this.value = structuredClone(value);
    for (const [path, input] of this.fields) {
      const value = getBalanceValue(this.value, path);
      if (typeof value === 'boolean') input.checked = value;
      else input.value = String(value / Number(input.dataset.factor));
    }
  }
  read(): Balance {
    const value = structuredClone(this.value);
    for (const [path, input] of this.fields)
      setBalanceValue(
        value,
        path,
        input.type === 'checkbox'
          ? input.checked
          : input.value.trim() === ''
            ? NaN
            : Math.round(Number(input.value) * Number(input.dataset.factor)),
      );
    const error = balanceError(value);
    if (error) throw new Error(error);
    return value;
  }
}
