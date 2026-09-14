import { DEFAULT_SETTINGS, delayLabel, resolveSettings, validSettings, type RoomSettings } from '../shared/settings.js';
import { MAPS } from '../shared/map.js';
import type { ClientMessage, Snapshot } from '../shared/types.js';
import { BalanceEditor } from './balance-editor.js';
import './room-settings.css';
export class RoomControls {
  private panel = document.createElement('fieldset');
  private key = ''; private lobby = document.createElement('button');
  private balance: BalanceEditor;
  private input<T extends HTMLElement>(id: string): T { return this.panel.querySelector(`#${id}`)!; }
  constructor(send: (message: ClientMessage) => unknown, notice: (text: string) => void) {
    this.panel.id = 'room-settings';
    const timeline = document.querySelector<HTMLElement>('.timeline-label b'); if (timeline) timeline.id = 'configured-delay';
    const pitch = document.querySelector('.hero-description strong'); if (pitch) pitch.textContent = 'the past. You choose how far.';
    const note = document.querySelector('.matchmaking-note'); if (note) note.textContent = `2–12 players · ${Object.keys(MAPS).length} maps · WebTransport`;
    this.panel.innerHTML = `<legend>HOST SETTINGS</legend>
      <label class="wide">Arena<select id="room-map"></select></label>
      <div class="map-card wide"><canvas id="map-preview" width="240" height="240" role="img" aria-label="Static map layout preview"></canvas><div><strong id="map-size"></strong><p id="map-description"></p><small>Cover, spawns and mirrors only. No live players.</small></div></div>
      <label>Echo delay <output id="delay-output">3s</output><input id="room-delay" type="range" min="0" max="10" step="0.25" value="3"></label>
      <label>Round length (seconds)<input id="room-duration" type="number" min="30" max="600" step="1" value="180"></label>
      <label>Seekers<input id="room-seekers" type="number" min="1" max="3" step="1" value="2"></label>
      <label>Bunny hopping<select id="room-bhop"><option value="off">Off</option><option value="timed">Timed jumps + air strafing</option><option value="auto">Hold jump to chain hops</option></select></label>
      <label>Base reload duration (seconds)<input id="room-reload" type="number" min="0" max="10" step="0.1" value="1.5"><small>0 = unlimited magazine for all weapons. Fire rate still applies.</small></label>
      <label>Dash cooldown (seconds)<input id="room-dash" type="number" min="0" max="30" step="0.1" value="3.2"></label>
      <label>Hider mirror cooldown (seconds)<input id="room-mirror" type="number" min="0" max="180" step="1" value="60"><small>Seeker cooldown and cast time are separate below.</small></label>
      <button id="save-room-settings" type="button">APPLY SETTINGS</button>
      <small class="wide" id="room-settings-note">Change settings between rounds. Apply before starting.</small>`;
    const changed = () => { this.input('room-settings-note').textContent = 'Unapplied changes. Press APPLY SETTINGS.'; };
    this.balance = new BalanceEditor(changed); this.input('save-room-settings').before(this.balance.element);
    document.getElementById('lobby-note')!.before(this.panel);
    const select = this.input<HTMLSelectElement>('room-map');
    for (const map of Object.values(MAPS)) { const option = document.createElement('option'); option.value = map.id; option.textContent = `${map.name} · ${map.half*2}×${map.half*2}m`; select.append(option); }
    this.panel.addEventListener('input', () => { this.input<HTMLOutputElement>('delay-output').value = delayLabel(Number(this.input<HTMLInputElement>('room-delay').value)*1000); this.preview(); changed(); });
    this.input<HTMLButtonElement>('save-room-settings').onclick = () => {
      try {
        const seconds = (id: string) => this.input<HTMLInputElement>(id).value.trim() === '' ? NaN : Math.round(Number(this.input<HTMLInputElement>(id).value)*1000);
        const settings = { delayMs:seconds('room-delay'), roundMs:seconds('room-duration'), seekerCount:Number(this.input<HTMLInputElement>('room-seekers').value),
          mapId:select.value, reloadMs:seconds('room-reload'),dashCooldownMs:seconds('room-dash'),mirrorCooldownMs:seconds('room-mirror'),bunnyHop:this.input<HTMLSelectElement>('room-bhop').value, balance:this.balance.read() };
        if (!validSettings(settings)) { notice('Check settings ranges and ability cooldowns.'); return; }
        send({ type:'settings',settings }); this.input('room-settings-note').textContent = 'Applying…';
      } catch (error) { notice(error instanceof Error ? error.message : 'Invalid settings.'); }
    };
    this.lobby.id = 'host-return-lobby'; this.lobby.textContent = 'END ROUND / ROOM SETTINGS'; this.lobby.onclick = () => send({type:'lobby'});
    document.getElementById('pause-invite')!.after(this.lobby); this.explain(DEFAULT_SETTINGS);
    const brand = document.querySelector<HTMLAnchorElement>('a.brand'); if (brand) brand.href = `/${location.hash}`;
  }
  private preview(): void {
    const map = MAPS[this.input<HTMLSelectElement>('room-map').value as keyof typeof MAPS]; if (!map) return;
    this.input('map-size').textContent = `${map.half*2} × ${map.half*2} m · Suggested: ${map.recommended}`;
    this.input('map-description').textContent = map.description;
    const ctx = this.input<HTMLCanvasElement>('map-preview').getContext('2d'); if (!ctx) return;
    const scale = 224/(map.half*2), x = (v:number) => 120+v*scale;
    ctx.fillStyle = '#0b1623';ctx.fillRect(0,0,240,240);ctx.strokeStyle = '#617587';ctx.strokeRect(8,8,224,224);
    for (const b of map.boxes) {ctx.fillStyle = b.y>0?'#586575':'#99a9b3';ctx.fillRect(x(b.x-b.w/2),x(b.z-b.d/2),Math.max(1,b.w*scale),Math.max(1,b.d*scale));}
    for (const p of map.spawns) {ctx.fillStyle = '#72e8be';ctx.beginPath();ctx.arc(x(p.x),x(p.z),2,0,Math.PI*2);ctx.fill();}
    for (const p of map.mirrors) {ctx.strokeStyle = '#fb77dd';ctx.beginPath();ctx.arc(x(p.x),x(p.z),4,0,Math.PI*2);ctx.stroke();}
  }
  private explain(settings: RoomSettings): void {
    const s = resolveSettings(settings), p = document.querySelectorAll('#modal-how .rules section p');
    if (p.length === 3) {
      p[0].textContent = `Hiders see live players. Your echo is ${delayLabel(s.delayMs)} old. Sprint then crouch to slide. G shields before an attack, never while caught in a control effect. Q dashes. F uses mirrors.`;
      p[1].textContent = `Seekers see delayed Hiders; allies stay live. 1–4 select weapons. G hooks, V places mines, B scans possible areas, F channels a mirror for ${delayLabel(s.balance.teleport.seekerCastMs)}. Control effects cannot chain during immunity.`;
      p[2].textContent = `Round: ${s.roundMs/1000}s. Capture every Hider or survive. Scan rings include possible mirror exits and are outer bounds, not live tracking. Weapon switching has recovery. All room balance changes happen between rounds.`;
    }
  }
  update(snapshot: Snapshot): void {
    const s = resolveSettings(snapshot.settings), key = `${snapshot.room}:${snapshot.settingsVersion}`, host = snapshot.self.id === snapshot.host;
    this.panel.disabled = !host || snapshot.phase !== 'lobby'; this.lobby.hidden = !host;
    if (key !== this.key) {
      this.input<HTMLInputElement>('room-delay').value = String(s.delayMs/1000); this.input<HTMLOutputElement>('delay-output').value = delayLabel(s.delayMs);
      this.input<HTMLInputElement>('room-duration').value = String(s.roundMs/1000); this.input<HTMLInputElement>('room-seekers').value = String(s.seekerCount);
      this.input<HTMLSelectElement>('room-map').value = s.mapId; this.input<HTMLSelectElement>('room-bhop').value = s.bunnyHop;
      this.input<HTMLInputElement>('room-reload').value = String(s.reloadMs/1000); this.input<HTMLInputElement>('room-dash').value = String(s.dashCooldownMs/1000);
      this.input<HTMLInputElement>('room-mirror').value = String(s.mirrorCooldownMs/1000); this.balance.load(s.balance); this.key = key;
      this.input('room-settings-note').textContent = 'Settings applied. Change them between rounds.'; this.preview(); this.explain(s);
    }
    const label = document.getElementById('configured-delay'); if (label) label.textContent = `−${delayLabel(s.delayMs)}`;
  }
}
