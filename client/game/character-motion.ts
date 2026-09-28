/** Clip choice for authored skinned characters. It reads only the pose fields the client was
 * authorized to receive, so a delayed Hider animates on the same delayed timeline it is drawn at.
 */
export type BaseClip = 'idle' | 'run' | 'jump' | 'crouch_idle' | 'crouch_walk' | 'slide';
export const BASE_CLIPS: readonly BaseClip[] = [
  'idle',
  'run',
  'jump',
  'crouch_idle',
  'crouch_walk',
  'slide',
];
/** Clips that settle into a pose and hold its last frame instead of looping. */
export const HELD_CLIPS: ReadonlySet<BaseClip> = new Set<BaseClip>(['jump', 'slide']);

/** Builds a complete per-clip record; the compiler rejects a missing clip. */
export function perBaseClip<V>(make: (clip: BaseClip) => V): Record<BaseClip, V> {
  return {
    idle: make('idle'),
    run: make('run'),
    jump: make('jump'),
    crouch_idle: make('crouch_idle'),
    crouch_walk: make('crouch_walk'),
    slide: make('slide'),
  };
}

export interface MotionPose {
  /** Horizontal speed in m/s. */
  moving: number;
  grounded: boolean;
  waving: boolean;
  crouched?: boolean;
  sliding?: boolean;
}
/** Ground speeds in m/s that the looping clips were authored for. */
export interface AuthoredSpeeds {
  run: number;
  crouchWalk: number;
}
export interface Motion {
  base: BaseClip;
  /** The upper body waves over the base clip. */
  wave: boolean;
  /** A hit flinch may show over the base clip. */
  flinch: boolean;
  /** Base clip playback rate, so feet keep pace with the actual ground speed. */
  timeScale: number;
}

/** Below this ground speed the character stands still (the procedural walk cycle's threshold). */
export const MOVING_SPEED_MPS = 0.5;
const MIN_TIME_SCALE = 0.5,
  MAX_TIME_SCALE = 2;

/** The wave and the hit flinch are authored standing and move the upper body up and back. Over
 * a crouch or slide they would lift the head above the 1.12 m crouch clearance, so neither plays.
 */
export function selectMotion(pose: MotionPose, speeds: AuthoredSpeeds): Motion {
  if (pose.sliding) return { base: 'slide', wave: false, flinch: false, timeScale: 1 };
  const moving = pose.grounded && pose.moving >= MOVING_SPEED_MPS;
  // The crouched collision height also applies in the air, so a crouch outranks the jump.
  if (pose.crouched)
    return moving
      ? {
          base: 'crouch_walk',
          wave: false,
          flinch: false,
          timeScale: playback(pose.moving, speeds.crouchWalk),
        }
      : { base: 'crouch_idle', wave: false, flinch: false, timeScale: 1 };
  if (!pose.grounded) return { base: 'jump', wave: pose.waving, flinch: true, timeScale: 1 };
  return moving
    ? { base: 'run', wave: pose.waving, flinch: true, timeScale: playback(pose.moving, speeds.run) }
    : { base: 'idle', wave: pose.waving, flinch: true, timeScale: 1 };
}

function playback(speedMps: number, authoredMps: number): number {
  const scale = speedMps / authoredMps;
  if (!Number.isFinite(scale)) return 1;
  return Math.min(MAX_TIME_SCALE, Math.max(MIN_TIME_SCALE, scale));
}
