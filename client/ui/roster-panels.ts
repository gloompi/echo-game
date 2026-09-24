import { CFG } from '../../shared/config.js';
import { delayLabel, type RoomSettings } from '../../shared/settings.js';
import type { Snapshot } from '../../shared/types.js';
import { setText, type ElementLookup } from './dom.js';

export class RosterPanels {
  private lastLobbyKey = '';
  private lastScoreKey = '';
  constructor(private readonly element: ElementLookup) {}
  reset(): void {
    this.lastLobbyKey = '';
    this.lastScoreKey = '';
  }
  lobby(s: Snapshot, roomSettings: Required<RoomSettings>): void {
    const key = JSON.stringify([s.room, s.roster, s.host, s.botsEnabled, s.settingsVersion]);
    if (this.lastLobbyKey === key) return;
    this.lastLobbyKey = key;
    const container = this.element('lobby-players');
    container.replaceChildren();
    for (const p of s.roster) {
      const row = document.createElement('div');
      row.className = 'lobby-player';
      const dot = document.createElement('span'),
        name = document.createElement('span'),
        badge = document.createElement('small');
      name.textContent = p.name + (p.id === s.self.id ? ' (you)' : '');
      badge.textContent = p.bot ? 'BOT' : p.id === s.host ? 'HOST' : 'CONNECTED';
      row.append(dot, name, badge);
      container.append(row);
    }
    this.element<HTMLInputElement>('fill-bots').checked = s.botsEnabled;
    this.element<HTMLInputElement>('fill-bots').disabled = s.self.id !== s.host;
    this.element<HTMLButtonElement>('start-round').disabled = s.self.id !== s.host;
    this.element('start-round').firstChild!.textContent =
      s.self.id === s.host ? 'START ROUND ' : 'WAITING FOR HOST ';
    setText(
      this.element('lobby-note'),
      s.self.id === s.host
        ? `${roomSettings.seekerCount} seeker slots · ${roomSettings.roundMs / 1000}s rounds · ${delayLabel(roomSettings.delayMs)} echo · up to ${CFG.maxPlayers} players`
        : 'The host will start the round. Your role preference is saved.',
    );
  }
  scores(s: Snapshot): void {
    const key = JSON.stringify([s.roster, s.winner, s.phase]);
    if (key === this.lastScoreKey) return;
    this.lastScoreKey = key;
    setText(
      this.element('score-title'),
      s.phase === 'finished'
        ? s.winner === 'hider'
          ? 'THE PRESENT WINS.'
          : 'THE PAST CAUGHT UP.'
        : 'THE FREQUENCY.',
    );
    const container = this.element('score-rows');
    container.replaceChildren();
    for (const p of [...s.roster].sort((a, b) => b.tags + b.baits - a.tags - a.baits)) {
      const row = document.createElement('div');
      row.className = 'score-row';
      const name = document.createElement('span');
      name.textContent = p.name + (p.id === s.self.id ? ' / YOU' : p.bot ? ' / BOT' : '');
      name.className = p.caught ? 'caught' : p.id === s.self.id ? 'you' : '';
      const role = document.createElement('span');
      role.textContent = p.role.toUpperCase();
      role.className = `role-${p.role}`;
      const tags = document.createElement('span');
      tags.textContent = String(p.tags);
      const baits = document.createElement('span');
      baits.textContent = String(p.baits);
      row.append(name, role, tags, baits);
      container.append(row);
    }
  }
}
