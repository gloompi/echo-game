import { changeBinding, COMBAT_KEYS, DEFAULT_BINDINGS, keyName, normalizeKey, readBindings, type Action } from '../shared/controls.js';
const fixed = ['KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyE','KeyQ','KeyR','KeyF','ArrowUp','ArrowDown','ArrowLeft','ArrowRight', ...COMBAT_KEYS];
export class PlayerControls {
  bindings = readBindings(localStorage.getItem('echo-bindings'));
  sensitivity = 1;
  private waiting: Action | null = null;
  private wheelPulses = 0; private wheelRelease = false;
  private buttons: Record<Action, HTMLButtonElement>;
  constructor(private notice: (message: string) => void) {
    const panel = document.createElement('fieldset'); panel.id = 'player-bindings';
    panel.innerHTML = '<legend>MOVEMENT KEYS</legend><label>Jump <button id="bind-jump" type="button"></button></label><label>Crouch / slide <button id="bind-crouch" type="button"></button></label><button id="reset-controls" type="button">RESET CONTROLS</button><small>Click a binding, then press a key. Jump also accepts the mouse wheel. Sprint then press crouch to slide. G: shield / hook. V: mine. B: scan. 1–4: weapons. F: mirror. Browsers may reserve Ctrl shortcuts; C is an alternative.</small>';
    document.getElementById('modal-settings')!.append(panel);
    this.buttons = { jump: panel.querySelector('#bind-jump')!, crouch: panel.querySelector('#bind-crouch')! };
    for (const action of ['jump','crouch'] as const) this.buttons[action].onclick = () => { this.waiting = action; this.render(); };
    document.getElementById('reset-controls')!.onclick = () => { this.bindings = { ...DEFAULT_BINDINGS }; this.waiting = null; this.save(); this.setSensitivity(1); };
    const slider = document.getElementById('sensitivity') as HTMLInputElement;
    slider.min = '0.1'; slider.max = '4'; slider.step = '0.05';
    const output = document.createElement('output'); output.id = 'sensitivity-output'; slider.after(output);
    this.setSensitivity(Number(localStorage.getItem('echo-sensitivity') ?? 1));
    slider.addEventListener('input', () => this.setSensitivity(Number(slider.value)));
    window.addEventListener('keydown', e => {
      if (!this.waiting || !document.querySelector('#modal-settings[open]')) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code === 'Escape') { this.waiting = null; this.render(); return; }
      this.bind(e.code);
    }, true);
    window.addEventListener('wheel', e => {
      if (!this.waiting || !document.querySelector('#modal-settings[open]')) return;
      e.preventDefault(); e.stopImmediatePropagation(); this.bind(e.deltaY > 0 ? 'WheelDown' : 'WheelUp');
    }, { capture: true, passive: false });
    document.getElementById('modal-settings')!.addEventListener('close', () => { this.waiting = null; this.clear(); this.render(); });
    this.render();
  }
  private setSensitivity(value: number): void {
    this.sensitivity = Number.isFinite(value) ? Math.max(.1,Math.min(4,value)) : 1;
    (document.getElementById('sensitivity') as HTMLInputElement).value = String(this.sensitivity);
    document.getElementById('sensitivity-output')!.textContent = `${this.sensitivity.toFixed(2)}×`;
    localStorage.setItem('echo-sensitivity',String(this.sensitivity));
  }
  private bind(code: string): void {
    if (!this.waiting) return;
    const next = changeBinding(this.bindings,this.waiting,code);
    if (!next) { this.notice('That key is reserved or conflicts with a held action. Choose another key.'); return; }
    this.bindings = next; this.waiting = null; this.save();
  }
  private save(): void { localStorage.setItem('echo-bindings',JSON.stringify(this.bindings)); this.clear(); this.render(); }
  private render(): void {
    for (const action of ['jump','crouch'] as const) this.buttons[action].textContent = this.waiting === action ? 'PRESS A KEY…' : keyName(this.bindings[action]);
    const hint = document.querySelector('#capture small'); if (hint) hint.textContent = `WASD · ${keyName(this.bindings.jump)} jump · ${keyName(this.bindings.crouch)} crouch / slide · G shield / hook · F mirror`;
    const firstHint = document.querySelector('.control-hint span'); if (firstHint) firstHint.textContent = `${keyName(this.bindings.jump)} Jump / ${keyName(this.bindings.crouch)} Crouch / Slide`;
    const guide = document.querySelectorAll('.key-guide span')[3]; if (guide) guide.textContent = 'G Shield / Hook · V Mine · B Scan · 1–4 Weapons';
  }
  handles(code: string): boolean { const key=normalizeKey(code); return fixed.includes(key) || key === this.bindings.jump || key === this.bindings.crouch; }
  crouch(keys: Set<string>): boolean { return keys.has(this.bindings.crouch); }
  jump(keys: Set<string>): boolean {
    if (!this.bindings.jump.startsWith('Wheel')) return keys.has(this.bindings.jump);
    if (this.wheelRelease) { this.wheelRelease = false; return false; }
    if (this.wheelPulses > 0) { this.wheelPulses--; this.wheelRelease = true; return true; }
    return false;
  }
  wheel(delta: number): void {
    if (delta && this.bindings.jump === (delta > 0 ? 'WheelDown' : 'WheelUp')) this.wheelPulses = Math.min(3,this.wheelPulses+1);
  }
  clear(): void { this.wheelPulses = 0; this.wheelRelease = false; }
}
