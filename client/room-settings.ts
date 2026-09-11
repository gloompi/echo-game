import { DEFAULT_SETTINGS, delayLabel, validSettings, type RoomSettings } from '../shared/settings.js';
import type { ClientMessage, Snapshot } from '../shared/types.js';
import './room-settings.css';
export class RoomControls {
  private panel = document.createElement('fieldset');
  private delay: HTMLInputElement; private duration: HTMLInputElement; private seekers: HTMLInputElement;
  private save: HTMLButtonElement; private output: HTMLOutputElement; private dirty = false; private key = '';
  private lobby = document.createElement('button');
  constructor(send: (message: ClientMessage) => unknown, notice: (text: string) => void) {
    this.panel.id = 'room-settings';
    const timeline = document.querySelector<HTMLElement>('.timeline-label b'); if (timeline) timeline.id = 'configured-delay';
    const note = document.querySelector('.matchmaking-note'); if (note) note.textContent = '2–12 players · Optional practice bots';
    const pitch = document.querySelector('.hero-description strong'); if (pitch) pitch.textContent = 'the past. You choose how far.';
    const feature = document.querySelectorAll('.feature-strip section p')[1]; if (feature) feature.textContent = 'Hiders leave a configurable delayed echo.';
    const rulesNote = document.querySelector('#modal-how > .subtle'); if (rulesNote) rulesNote.textContent = 'Roles are preferences. No player-to-player collisions. Static cover blocks shots. Server delay is separate from normal network latency and a 100 ms interpolation buffer.';
    const heading = document.querySelector('#modal-how > .eyebrow'); if (heading) heading.textContent = 'ONE TIMELINE. TWO PERSPECTIVES.';
    this.panel.innerHTML = `<legend>HOST SETTINGS</legend>
      <label>Echo delay <output id="delay-output">3s</output><input id="room-delay" type="range" min="0" max="10" step="0.25" value="3"></label>
      <label>Round length (seconds)<input id="room-duration" type="number" min="30" max="600" step="30" value="180"></label>
      <label>Seekers<input id="room-seekers" type="number" min="1" max="3" step="1" value="2"></label>
      <button id="save-room-settings" type="button">APPLY SETTINGS</button>
      <small>0s disables the Echo delay. Settings change only between rounds.</small>`;
    document.getElementById('lobby-note')!.before(this.panel);
    this.delay = this.panel.querySelector<HTMLInputElement>('#room-delay')!; this.duration = this.panel.querySelector<HTMLInputElement>('#room-duration')!;
    this.seekers = this.panel.querySelector<HTMLInputElement>('#room-seekers')!; this.save = this.panel.querySelector<HTMLButtonElement>('#save-room-settings')!;
    this.output = this.panel.querySelector<HTMLOutputElement>('#delay-output')!;
    this.panel.addEventListener('input', () => { this.dirty = true; this.output.value = delayLabel(Number(this.delay.value) * 1000); });
    this.save.onclick = () => {
      const settings = { delayMs: Math.round(Number(this.delay.value) * 1000), roundMs: Math.round(Number(this.duration.value) * 1000), seekerCount: Number(this.seekers.value) };
      if (!validSettings(settings)) { notice('Choose a delay of 0–10s, a round of 30–600s and 1–3 Seekers.'); return; }
      send({ type: 'settings', settings }); this.dirty = false;
    };
    this.lobby.id = 'host-return-lobby'; this.lobby.textContent = 'END ROUND / ROOM SETTINGS';
    this.lobby.onclick = () => send({ type: 'lobby' });
    document.getElementById('pause-invite')!.after(this.lobby);
    this.explain(DEFAULT_SETTINGS);
    const brand = document.querySelector<HTMLAnchorElement>('a.brand'); if (brand) brand.href = `/${location.hash}`;
    const botsLabel = document.querySelector('.lobby-options label');
    if (botsLabel?.lastChild?.nodeType === Node.TEXT_NODE) botsLabel.lastChild.textContent = ' Practice bots (fill to four)';
  }
  private explain(settings: RoomSettings): void {
    const paragraphs = document.querySelectorAll('#modal-how .rules section p');
    if (paragraphs.length === 3) {
      paragraphs[0].textContent = `Hiders see live players. Your magenta echo shows you ${delayLabel(settings.delayMs)} ago. Keep moving, change direction, and wave with E.`;
      paragraphs[1].textContent = `Seekers see Hiders ${delayLabel(settings.delayMs)} late; their own movement and allied Seekers are live. Shoot current positions, not echoes. Two hits catch a Hider.`;
      paragraphs[2].textContent = `Hiders get a ${Math.max(5, settings.delayMs / 1000)}s head start, then ${settings.roundMs / 1000}s to survive. Capture every Hider, or outlast the clock. Results return to the lobby; the host starts the next round.`;
    }
  }
  update(snapshot: Snapshot): void {
    const settings = snapshot.settings ?? DEFAULT_SETTINGS, key = `${snapshot.room}:${snapshot.settingsVersion ?? 0}`;
    const host = snapshot.self.id === snapshot.host;
    this.panel.disabled = !host || snapshot.phase !== 'lobby';
    this.lobby.hidden = !host;
    this.explain(settings);
    if (key !== this.key || !this.dirty) {
      this.delay.value = String(settings.delayMs / 1000); this.duration.value = String(settings.roundMs / 1000);
      this.seekers.value = String(settings.seekerCount); this.output.value = delayLabel(settings.delayMs); this.key = key;
    }
    const label = document.getElementById('configured-delay'); if (label) label.textContent = `−${delayLabel(settings.delayMs)}`;
  }
}
