import { randomInt, randomUUID } from 'node:crypto';
import { CFG } from '../shared/config.js';
import { History } from '../shared/history.js';
import { ARENA, SPAWNS, WAYPOINTS } from '../shared/map.js';
import { aimDirection, arenaRay, makeMotor, move, overlaps, rayBox } from '../shared/physics.js';
import { neutralInput, type GameEvent, type Input, type Motor, type Phase, type Pose, type Preference, type Role, type Snapshot, type Vec3 } from '../shared/types.js';
export interface Player {
  id: string; name: string; bot: boolean; preference: Preference; role: Role; motor: Motor;
  alive: boolean; caught: boolean; joinedRound: number; hp: number; ammo: number; tags: number; baits: number;
  input: Input; ack: number; lastInputAt: number; reloadUntil: number; shotAt: number;
  waveUntil: number; waveAt: number; waypoint: number; botDecisionAt: number;
}
export function createPlayer(name: string, now: number, bot = false, pref: Preference = 'auto'): Player {
  return { id: randomUUID(), name, bot, preference: pref, role: 'hider', motor: makeMotor(SPAWNS[0]),
    alive: true, caught: false, joinedRound: 0, hp: CFG.hitPoints, ammo: CFG.magazine, tags: 0, baits: 0,
    input: neutralInput(), ack: 0, lastInputAt: now, reloadUntil: 0, shotAt: -Infinity,
    waveUntil: 0, waveAt: -Infinity, waypoint: randomInt(WAYPOINTS.length), botDecisionAt: 0 };
}
export const poseOf = (p: Player, now: number): Pose => ({
  id: p.id, x: p.motor.x, y: p.motor.y, z: p.motor.z, yaw: p.motor.yaw, pitch: p.motor.pitch,
  role: p.role, alive: p.alive, moving: Math.hypot(p.motor.vx, p.motor.vz), grounded: p.motor.grounded,
  waving: now < p.waveUntil, dashing: p.motor.dashTime > 0,
});
export function playerRay(origin: Vec3, dir: Vec3, target: Vec3): number | null {
  return rayBox(origin, dir, { x: target.x - 0.38, y: target.y + 0.08, z: target.z - 0.38 },
    { x: target.x + 0.38, y: target.y + CFG.height, z: target.z + 0.38 });
}
export class Room {
  readonly players = new Map<string, Player>();
  readonly history = new History();
  events: GameEvent[] = [];
  eventSequence = 0;
  phase: Phase = 'lobby';
  endsAt = 0;
  round = 0;
  winner: Role | null = null;
  host = '';
  botsEnabled = true;
  lastActiveAt: number;
  lastBait = new Map<string, number>();
  constructor(public code: string, public isPublic: boolean, public practice: boolean, now: number) { this.lastActiveAt = now; }
  get humanCount() { return [...this.players.values()].filter(p => !p.bot).length; }
  add(p: Player, now: number): boolean {
    if (this.players.size >= CFG.maxPlayers) return false;
    if (!this.host && !p.bot) this.host = p.id;
    p.motor = makeMotor(SPAWNS[this.players.size % SPAWNS.length]);
    const hotJoin = this.isPublic && (this.phase === 'playing' || this.phase === 'headstart');
    p.alive = this.phase === 'lobby' || hotJoin; p.joinedRound = this.phase === 'lobby' || hotJoin ? this.round : this.round + 1;
    this.players.set(p.id, p); this.lastActiveAt = now; return true;
  }
  remove(id: string): void {
    this.players.delete(id);
    if (this.host === id) this.host = [...this.players.values()].find(p => !p.bot)?.id ?? '';
  }
  addBots(now: number): void {
    if (!this.botsEnabled) return;
    const names = ['Noodle', 'Afterimage', 'Static', 'Wrong Turn'];
    while (this.players.size < 4) { const i = this.players.size; this.add(createPlayer(names[i % names.length], now, true), now); }
  }
  start(now: number): boolean {
    if (this.phase !== 'lobby' && this.phase !== 'finished') return false;
    this.addBots(now);
    if (this.players.size < 2) return false;
    this.round++; this.phase = 'headstart'; this.endsAt = now + CFG.headstartMs; this.winner = null;
    this.history.clear(); this.events.length = 0; this.lastBait.clear();
    const all = [...this.players.values()];
    // Explicit seeker preferences take priority. Automatic rooms rotate the seeker.
    const explicit = all.filter(p => p.preference === 'seeker');
    const candidates = explicit.length ? explicit : all.filter(p => p.preference !== 'hider');
    const pool = candidates.length ? candidates : all;
    const seeker = pool[(this.round - 1) % pool.length];
    all.forEach((p, i) => {
      p.role = p.id === seeker.id ? 'seeker' : 'hider'; p.motor = makeMotor(SPAWNS[i % SPAWNS.length]);
      p.motor.yaw = Math.atan2(p.motor.x, p.motor.z);
      p.hp = CFG.hitPoints; p.alive = true; p.caught = false; p.ammo = CFG.magazine;
      p.reloadUntil = 0; p.waveUntil = 0; p.shotAt = -Infinity; p.joinedRound = this.round;
      p.input = { ...neutralInput(p.ack), yaw: p.motor.yaw };
    });
    this.history.record(now, all.map(p => poseOf(p, now)));
    return true;
  }
  event(e: Omit<GameEvent, 'id'>): void { this.events.push({ ...e, id: ++this.eventSequence }); }
  finish(winner: Role, now: number): void { this.phase = 'finished'; this.winner = winner; this.endsAt = now + CFG.resultsMs; }
  setInput(p: Player, input: Input, now: number): void {
    if (input.seq <= p.input.seq || input.seq > p.ack + 180) return;
    p.input = input; p.lastInputAt = now;
  }
  botInput(p: Player, now: number): Input {
    const input = neutralInput(p.input.seq + 1), s = p.motor;
    let goal = WAYPOINTS[p.waypoint];
    if (p.role === 'seeker') {
      // Bots obey the SAME information boundary as human seekers.
      const visible = this.history.sample(now - CFG.delayMs).filter(q => q.role === 'hider' && q.alive);
      const target = visible.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
      if (target) {
        const previous = this.history.sample(now - CFG.delayMs - 350).find(q => q.id === target.id);
        // A modest, intentionally fallible velocity prediction from delayed observations.
        const lead = 0.65;
        goal = { x: target.x + (previous ? (target.x - previous.x) / 0.35 * lead : 0), z: target.z + (previous ? (target.z - previous.z) / 0.35 * lead : 0) };
        const d = Math.hypot(goal.x - s.x, goal.z - s.z);
        input.yaw = Math.atan2(-(goal.x - s.x), -(goal.z - s.z));
        input.pitch = Math.atan2(target.y + 1.1 - (s.y + CFG.eye), Math.max(0.1, d));
        const ray = aimDirection(input.yaw, input.pitch);
        input.shoot = d < 27 && arenaRay({ x: s.x, y: s.y + CFG.eye, z: s.z }, ray) > d - 0.6 && Math.sin(now / 700) > -0.15;
        input.mz = d > 8 ? 0.7 : 0; input.mx = d < 10 ? Math.sin(now / 1700) * 0.5 : 0;
        if (input.mz > 0 && this.blocked(s, input.yaw)) { input.mx = 1; input.jump = Math.sin(now / 400) > 0.8; }
        input.reload = p.ammo === 0; return input;
      }
    }
    if (now > p.botDecisionAt || Math.hypot(goal.x - s.x, goal.z - s.z) < 1.4) {
      p.waypoint = (p.waypoint + 1 + randomInt(3)) % WAYPOINTS.length; goal = WAYPOINTS[p.waypoint];
      p.botDecisionAt = now + 2800 + randomInt(2000);
    }
    input.yaw = Math.atan2(-(goal.x - s.x), -(goal.z - s.z)); input.mz = 1;
    if (this.blocked(s, input.yaw)) { input.mx = 0.9; input.jump = Math.sin(now / 300 + p.waypoint) > 0; }
    const threat = [...this.players.values()].find(q => q.role === 'seeker' && q.alive && Math.hypot(q.motor.x - s.x, q.motor.z - s.z) < 10);
    input.sprint = !!threat;
    input.dash = !!threat && Math.sin(now / 900 + p.waypoint) > 0.94;
    input.wave = !threat && Math.sin(now / 1500 + p.waypoint) > 0.985;
    return input;
  }
  blocked(s: Motor, yaw: number): boolean {
    return ARENA.some(b => b.y + b.h > s.y + 0.37 && overlaps(s.x - Math.sin(yaw) * 1.2, s.z - Math.cos(yaw) * 1.2, b));
  }
  fire(p: Player, now: number): void {
    if (p.role !== 'seeker' || !p.alive || this.phase !== 'playing' || p.reloadUntil > now || now - p.shotAt < CFG.fireInterval || p.ammo <= 0) return;
    p.shotAt = now; p.ammo--;
    const from = { x: p.motor.x, y: p.motor.y + CFG.eye, z: p.motor.z }, dir = aimDirection(p.motor.yaw, p.motor.pitch);
    let distance = arenaRay(from, dir), victim: Player | undefined;
    // Deliberately no lag compensation / hitbox rewind. Hit the PRESENT, not the echo.
    for (const target of this.players.values()) {
      if (target.role !== 'hider' || !target.alive || target.joinedRound !== this.round) continue;
      const d = playerRay(from, dir, target.motor);
      if (d !== null && d < distance) { distance = d; victim = target; }
    }
    let ghost: Pose | undefined;
    if (!victim) ghost = this.history.sample(now - CFG.delayMs).find(q => {
      if (!q.alive || q.role !== 'hider') return false;
      const d = playerRay(from, dir, q); return d !== null && d < distance;
    });
    const to = { x: from.x + dir.x * distance, y: from.y + dir.y * distance, z: from.z + dir.z * distance };
    this.event({ at: now, actor: p.id, target: victim?.id ?? ghost?.id, kind: 'shot', from, to, hit: !!victim, echo: !!ghost });
    if (victim) {
      victim.hp--; p.tags++;
      this.event({ at: now, actor: p.id, target: victim.id, kind: 'tag' });
      if (victim.hp <= 0) { victim.alive = false; victim.caught = true; this.event({ at: now, actor: p.id, target: victim.id, kind: 'catch' }); }
    } else if (ghost && now - (this.lastBait.get(ghost.id) ?? -Infinity) > 500) {
      const target = this.players.get(ghost.id); if (target?.alive) target.baits++;
      this.lastBait.set(ghost.id, now);
    }
  }
  tick(now: number): void {
    if (this.phase === 'headstart' && now >= this.endsAt) { this.phase = 'playing'; this.endsAt = now + CFG.roundMs; }
    if (this.phase === 'finished' && now >= this.endsAt) this.start(now);
    for (const p of this.players.values()) {
      if (p.bot && p.alive) { p.input = this.botInput(p, now); p.lastInputAt = now; }
      const input = now - p.lastInputAt > 300 ? { ...neutralInput(p.input.seq), yaw: p.motor.yaw, pitch: p.motor.pitch } : p.input;
      p.ack = p.input.seq;
      const playable = (this.phase === 'playing' || this.phase === 'headstart') && p.alive && p.joinedRound === this.round;
      if (playable && !(this.phase === 'headstart' && p.role === 'seeker')) {
        const oldDash = p.motor.dashTime;
        move(p.motor, input, p.role);
        if (oldDash <= 0 && p.motor.dashTime > 0) this.event({ at: now, actor: p.id, kind: 'dash' });
        if (input.wave && now - p.waveAt > 1800) { p.waveAt = now; p.waveUntil = now + 1500; this.event({ at: now, actor: p.id, kind: 'wave' }); }
      } else { p.motor.yaw = input.yaw; p.motor.pitch = input.pitch; p.motor.vx = 0; p.motor.vz = 0; }
      if (p.reloadUntil && now >= p.reloadUntil) { p.ammo = CFG.magazine; p.reloadUntil = 0; }
      if (playable && p.role === 'seeker') {
        if ((input.reload || (input.shoot && p.ammo === 0)) && !p.reloadUntil && p.ammo < CFG.magazine) p.reloadUntil = now + CFG.reloadMs;
        if (input.shoot) this.fire(p, now);
      }
    }
    if (this.phase === 'playing') {
      const active = [...this.players.values()].filter(p => p.joinedRound === this.round);
      if (!active.some(p => p.role === 'hider' && p.alive)) this.finish('seeker', now);
      else if (now >= this.endsAt || !active.some(p => p.role === 'seeker' && p.alive)) this.finish('hider', now);
    }
    this.history.record(now, [...this.players.values()].filter(p => p.joinedRound <= this.round).map(p => poseOf(p, now)));
    this.events = this.events.filter(e => e.at >= now - CFG.historyMs);
  }
  snapshot(viewer: Player, now: number): Snapshot {
    const delayed = viewer.role === 'seeker';
    const viewTime = now - (delayed ? CFG.delayMs : 0);
    const visible = delayed ? this.history.sample(viewTime) : [...this.players.values()].filter(p => p.joinedRound <= this.round).map(p => poseOf(p, now));
    const spectating = viewer.joinedRound > this.round;
    return {
      type: 'snapshot', now, viewTime, room: this.code, host: this.host, public: this.isPublic, practice: this.practice,
      phase: this.phase, endsAt: this.endsAt, round: this.round, winner: this.winner, botsEnabled: this.botsEnabled,
      // Roster metadata intentionally has no transforms, velocity, aim, or spatial audio.
      roster: [...this.players.values()].map(p => ({ id: p.id, name: p.name, role: p.role, preference: p.preference, bot: p.bot, alive: p.alive, caught: p.caught, tags: p.tags, baits: p.baits })),
      self: { ...viewer.motor, id: viewer.id, role: viewer.role, alive: viewer.alive, hp: viewer.hp, ammo: viewer.ammo,
        reloadLeft: Math.max(0, viewer.reloadUntil - now), ack: viewer.ack, waving: viewer.waveUntil > now, spectating },
      players: visible.filter(p => p.id !== viewer.id && this.players.has(p.id)),
      echo: viewer.role === 'hider' && !spectating ? this.history.sample(now - CFG.delayMs).find(p => p.id === viewer.id) ?? null : null,
      // Spatial events from OTHER players are held back too. Deduped by event id on clients.
      events: this.events.filter(e => {
        const delivery = e.at + (delayed && e.actor !== viewer.id ? CFG.delayMs : 0);
        return delivery <= now && delivery > now - 700;
      }),
    };
  }
}
