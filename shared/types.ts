import type { RoomSettings } from './settings.js';
import type { Skin, Weapon } from './balance.js';
export type Role = 'hider' | 'seeker';
export type Preference = Role | 'auto';
export type Phase = 'lobby' | 'headstart' | 'playing' | 'finished';
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Box {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  y: number;
  h: number;
  kind: 'cover' | 'platform' | 'step' | 'reactor';
}
export interface Input {
  seq: number;
  mx: number;
  mz: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  jump: boolean;
  dash: boolean;
  shoot: boolean;
  reload: boolean;
  wave: boolean;
  crouch: boolean;
  interact: boolean;
  ability?: boolean;
  mine?: boolean;
  scan?: boolean;
  weapon?: Weapon;
}
export interface Motor extends Vec3 {
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  stamina: number;
  dashTime: number;
  dashCooldown: number;
  jumpHeld: boolean;
  dashHeld: boolean;
  crouched: boolean;
  jumpBuffer: number;
  warp: number;
  slideTime?: number;
  slideCooldown?: number;
  crouchHeld?: boolean;
  controlLeft?: number;
  pullLeft?: number;
  pullX?: number;
  pullZ?: number;
  pullSpeed?: number;
}
export interface Pose extends Vec3 {
  id: string;
  yaw: number;
  pitch: number;
  role: Role;
  alive: boolean;
  moving: number;
  grounded: boolean;
  waving: boolean;
  dashing: boolean;
  crouched?: boolean;
  warp?: number;
  sliding?: boolean;
  shielded?: boolean;
  controlled?: boolean;
  hitAt?: number;
  skin?: Skin;
  weapon?: Weapon;
}
export interface PublicPlayer {
  id: string;
  name: string;
  role: Role;
  preference: Preference;
  bot: boolean;
  alive: boolean;
  tags: number;
  baits: number;
  caught: boolean;
  skin?: Skin;
}
export interface AbilityState {
  shieldLeft: number;
  shieldCooldown: number;
  mineCooldown: number;
  hookCooldown: number;
  scanLeft: number;
  scanCooldown: number;
  immuneLeft: number;
  switchLeft: number;
  teleportCastLeft: number;
}
export interface Self extends Motor {
  id: string;
  role: Role;
  alive: boolean;
  hp: number;
  ammo: number;
  reloadLeft: number;
  mirrorLeft: number;
  ack: number;
  waving: boolean;
  spectating: boolean;
  skin?: Skin;
  weapon?: Weapon;
  abilities?: AbilityState;
}
export interface GameEvent {
  id: number;
  at: number;
  kind:
    | 'shot'
    | 'tag'
    | 'catch'
    | 'wave'
    | 'dash'
    | 'round'
    | 'teleport'
    | 'shield'
    | 'hook'
    | 'web'
    | 'mine'
    | 'scan'
    | 'control';
  actor: string;
  target?: string;
  from?: Vec3;
  to?: Vec3;
  hit?: boolean;
  echo?: boolean;
}
export interface MineView extends Vec3 {
  id: number;
  owner: string;
  armed: boolean;
}
export interface ProjectileView extends Vec3 {
  id: number;
  owner: string;
  radius: number;
}
export interface Snapshot {
  type: 'snapshot';
  now: number;
  viewTime: number;
  room: string;
  host: string;
  public: boolean;
  practice: boolean;
  phase: Phase;
  endsAt: number;
  round: number;
  winner: Role | null;
  roster: PublicPlayer[];
  self: Self;
  players: Pose[];
  echo: Pose | null;
  events: GameEvent[];
  botsEnabled: boolean;
  settings: RoomSettings;
  settingsVersion: number;
  mines?: MineView[];
  projectiles?: ProjectileView[];
}
export type ClientMessage =
  | {
      type: 'join';
      mode: 'create' | 'join' | 'quick' | 'practice';
      name: string;
      room?: string;
      preference?: Preference;
      accessKey?: string;
      settings?: RoomSettings;
      skin?: Skin;
    }
  | { type: 'input'; input: Input }
  | { type: 'start' }
  | { type: 'lobby' }
  | { type: 'settings'; settings: RoomSettings }
  | { type: 'skin'; value: Skin }
  | { type: 'preference'; value: Preference }
  | { type: 'bots'; enabled: boolean }
  | { type: 'ping'; at: number };
export type ServerMessage =
  | Snapshot
  | {
      type: 'welcome';
      id: string;
      room: string;
      protocolVersion?: number;
      publicUrl?: string | null;
    }
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'pong'; at: number; now: number };
export const neutralInput = (seq = 0): Input => ({
  seq,
  mx: 0,
  mz: 0,
  yaw: 0,
  pitch: 0,
  sprint: false,
  jump: false,
  dash: false,
  shoot: false,
  reload: false,
  wave: false,
  crouch: false,
  interact: false,
  ability: false,
  mine: false,
  scan: false,
});
