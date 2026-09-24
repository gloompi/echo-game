import { SKINS, WEAPONS, isSkin, type Skin } from '../shared/balance.js';
import { resolveSettings } from '../shared/settings.js';
import type { ClientMessage, Input, Motor, Snapshot } from '../shared/types.js';
import './combat.css';
export class CombatUI {
  private panel = document.createElement('div');
  private blood = document.createElement('div');
  private selectors: HTMLSelectElement[] = [];
  private snapshot: Snapshot | null = null;
  private selected: Skin = 'classic';
  private hurtFrame = 0;
  private lastText = '';
  constructor(send: (message: ClientMessage) => unknown) {
    const saved = localStorage.getItem('echo-skin');
    if (isSkin(saved)) this.selected = saved;
    for (const parent of [
      document.getElementById('modal-settings'),
      document.querySelector('.lobby-options'),
    ]) {
      if (!parent) continue;
      const label = document.createElement('label');
      label.className = 'skin-choice';
      label.textContent = 'SKIN · COSMETIC ONLY';
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Character skin');
      for (const skin of SKINS) {
        const option = document.createElement('option');
        option.value = skin;
        option.textContent = skin.toUpperCase();
        select.append(option);
      }
      select.value = this.selected;
      label.append(select);
      parent.append(label);
      this.selectors.push(select);
      select.onchange = () => {
        if (!isSkin(select.value) || (this.snapshot && this.snapshot.phase !== 'lobby')) return;
        this.selected = select.value;
        localStorage.setItem('echo-skin', this.selected);
        for (const peer of this.selectors) peer.value = this.selected;
        if (this.snapshot) send({ type: 'skin', value: this.selected });
      };
    }
    const gore = document.createElement('label');
    gore.className = 'skin-choice';
    gore.textContent = 'Mild blood on damage';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = localStorage.getItem('echo-blood') !== 'off';
    toggle.onchange = () => {
      localStorage.setItem('echo-blood', toggle.checked ? 'on' : 'off');
      this.blood.classList.remove('hit');
    };
    gore.append(toggle);
    document.getElementById('modal-settings')!.append(gore);
    this.panel.id = 'combat-hud';
    this.panel.setAttribute('aria-label', 'Abilities and weapon');
    document.getElementById('hud')!.append(this.panel);
    this.blood.id = 'damage-blood';
    this.blood.setAttribute('aria-hidden', 'true');
    this.blood.innerHTML = '<i></i><i></i><i></i>';
    document.body.append(this.blood);
  }
  get skin(): Skin {
    return this.selected;
  }
  hurt(): void {
    if (localStorage.getItem('echo-blood') === 'off') return;
    this.blood.classList.remove('hit');
    cancelAnimationFrame(this.hurtFrame);
    this.hurtFrame = requestAnimationFrame(() => {
      this.hurtFrame = requestAnimationFrame(() => this.blood.classList.add('hit'));
    });
  }
  clear(): void {
    this.snapshot = null;
    this.panel.replaceChildren();
    this.lastText = '';
    cancelAnimationFrame(this.hurtFrame);
    this.blood.classList.remove('hit');
    for (const select of this.selectors) select.disabled = false;
  }
  receive(snapshot: Snapshot): void {
    this.snapshot = snapshot;
    for (const select of this.selectors) select.disabled = snapshot.phase !== 'lobby';
  }
  input(input: Input, keys: Set<string>): void {
    input.ability = keys.has('KeyG');
    input.mine = keys.has('KeyV');
    input.scan = keys.has('KeyB');
    for (let index = 0; index < WEAPONS.length; index++)
      if (keys.has(`Digit${index + 1}`)) input.weapon = WEAPONS[index];
  }
  update(snapshot: Snapshot, motor: Motor, now: number): void {
    const a = snapshot.self.abilities;
    if (!a) return;
    const b = resolveSettings(snapshot.settings).balance,
      age = Math.max(0, now - snapshot.now);
    const left = (ms: number) => Math.max(0, ms - age),
      label = (ms: number) => (left(ms) > 0 ? `${(left(ms) / 1000).toFixed(1)}s` : 'READY');
    const lines: string[] = [];
    if (snapshot.self.role === 'hider') {
      lines.push(
        `G SHIELD · ${!b.shield.enabled ? 'OFF' : left(a.shieldLeft) > 0 ? 'ACTIVE ' + label(a.shieldLeft) : label(a.shieldCooldown)}`,
      );
      lines.push(
        `SLIDE · ${!b.slide.enabled ? 'OFF' : (motor.slideTime ?? 0) > 0 ? 'ACTIVE' : (motor.slideCooldown ?? 0) > 0 ? (motor.slideCooldown ?? 0).toFixed(1) + 's' : 'SPRINT + CROUCH'}`,
      );
    } else {
      lines.push(
        `1–4 ${(snapshot.self.weapon ?? 'blaster').toUpperCase()}${left(a.switchLeft) > 0 ? ' · RECOVERING' : ''}`,
      );
      lines.push(
        `G HOOK · ${b.hook.enabled ? label(a.hookCooldown) : 'OFF'}   V MINE · ${b.mine.enabled ? label(a.mineCooldown) : 'OFF'}`,
      );
      lines.push(
        `B SCAN · ${!b.scan.enabled ? 'OFF' : left(a.scanLeft) > 0 ? 'ACTIVE ' + label(a.scanLeft) : label(a.scanCooldown)}`,
      );
      if (left(a.scanLeft) > 0) lines.push('Possible areas · conservative outer bounds');
    }
    if ((motor.controlLeft ?? 0) > 0)
      lines.push(
        `${(motor.pullLeft ?? 0) > 0 ? 'PULLED' : 'ROOTED / STUNNED'} · ${(motor.controlLeft ?? 0).toFixed(1)}s`,
      );
    else if (left(a.immuneLeft) > 0) lines.push('CONTROL IMMUNITY · ' + label(a.immuneLeft));
    if (left(a.teleportCastLeft) > 0) lines.push('MIRROR CHANNEL · ' + label(a.teleportCastLeft));
    const text = lines.join('\n');
    if (text !== this.lastText) {
      this.lastText = text;
      this.panel.textContent = text;
    }
  }
}
