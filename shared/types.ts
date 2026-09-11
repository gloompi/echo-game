import type { RoomSettings } from './settings.js';
export type Role = 'hider' | 'seeker';
export type Preference = Role | 'auto';
export type Phase = 'lobby' | 'headstart' | 'playing' | 'finished';
export interface Vec3 { x: number; y: number; z: number }
export interface Box { id: string; x: number; z: number; w: number; d: number; y: number; h: number; kind: 'cover' | 'platform' | 'step' | 'reactor' }
export interface Input {
  seq: number; mx: number; mz: number; yaw: number; pitch: number;
  sprint: boolean; jump: boolean; dash: boolean; shoot: boolean; reload: boolean; wave: boolean;
}
export interface Motor extends Vec3 {
  vx: number; vy: number; vz: number; yaw: number; pitch: number;
  grounded: boolean; stamina: number; dashTime: number; dashCooldown: number;
  jumpHeld: boolean; dashHeld: boolean;
}
export interface Pose extends Vec3 {
  id: string; yaw: number; pitch: number; role: Role; alive: boolean;
  moving: number; grounded: boolean; waving: boolean; dashing: boolean;
}
export interface PublicPlayer {
  id: string; name: string; role: Role; preference: Preference; bot: boolean;
  alive: boolean; tags: number; baits: number; caught: boolean;
}
export interface Self extends Motor {
  id: string; role: Role; alive: boolean; hp: number; ammo: number;
  reloadLeft: number; ack: number; waving: boolean; spectating: boolean;
}
export interface GameEvent {
  id: number; at: number; kind: 'shot' | 'tag' | 'catch' | 'wave' | 'dash' | 'round';
  actor: string; target?: string; from?: Vec3; to?: Vec3; hit?: boolean; echo?: boolean;
}
export interface Snapshot {
  type: 'snapshot'; now: number; viewTime: number; room: string; host: string; public: boolean;
  practice: boolean; phase: Phase; endsAt: number; round: number; winner: Role | null;
  roster: PublicPlayer[]; self: Self; players: Pose[]; echo: Pose | null;
  events: GameEvent[]; botsEnabled: boolean;
  settings: RoomSettings; settingsVersion: number;
}
export type ClientMessage =
  | { type: 'join'; mode: 'create' | 'join' | 'quick' | 'practice'; name: string; room?: string; preference?: Preference; accessKey?: string; settings?: RoomSettings }
  | { type: 'input'; input: Input }
  | { type: 'start' } | { type: 'lobby' }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'preference'; value: Preference }
  | { type: 'bots'; enabled: boolean }
  | { type: 'ping'; at: number };
export type ServerMessage = Snapshot | { type: 'welcome'; id: string; room: string; protocolVersion?: number; publicUrl?: string | null }
  | { type: 'error'; message: string; fatal?: boolean } | { type: 'pong'; at: number; now: number };
export const neutralInput = (seq = 0): Input => ({
  seq, mx: 0, mz: 0, yaw: 0, pitch: 0, sprint: false,
  jump: false, dash: false, shoot: false, reload: false, wave: false,
});
