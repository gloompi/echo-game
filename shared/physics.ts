import { CFG } from './config.js';
import { ARENA, MAP_HALF } from './map.js';
import M from './movement.json';
import { DEFAULT_SETTINGS, resolveSettings, type RoomSettings } from './settings.js';
import type { Box, Input, Motor, Role, Vec3 } from './types.js';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export const bodyHeight = (crouched = false) => crouched ? M.crouchHeight : CFG.height;
export const eyeHeight = (crouched = false) => crouched ? M.crouchEye : CFG.eye;
let activeSettings: Required<RoomSettings> = { ...DEFAULT_SETTINGS };
export function configureMovement(settings: RoomSettings): void { activeSettings = resolveSettings(settings); }
export const makeMotor = (p: Vec3): Motor => ({ ...p, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true, stamina: 100,
  dashTime: 0, dashCooldown: 0, jumpHeld: false, dashHeld: false, crouched: false, jumpBuffer: 0, warp: 0 });
export function overlaps(x: number, z: number, b: Box, radius: number = CFG.radius): boolean {
  const dx = x - clamp(x, b.x - b.w / 2, b.x + b.w / 2);
  const dz = z - clamp(z, b.z - b.d / 2, b.z + b.d / 2);
  return dx * dx + dz * dz < radius * radius - 1e-7;
}
export function canOccupy(p: Vec3, height: number, boxes: readonly Box[] = ARENA): boolean {
  return !boxes.some(b => p.y < b.y + b.h - .001 && p.y + height > b.y + .001 && overlaps(p.x, p.z, b));
}
function slide(s: Motor, boxes: readonly Box[]): void {
  const height = bodyHeight(s.crouched);
  for (let pass = 0; pass < 3; pass++) for (const b of boxes) {
    if (s.y >= b.y + b.h - .001 || s.y + height <= b.y + .001 || !overlaps(s.x, s.z, b)) continue;
    if (s.grounded && b.y + b.h - s.y <= .37 && canOccupy({ ...s, y: b.y + b.h }, height, boxes)) { s.y = b.y + b.h; continue; }
    const cx = clamp(s.x, b.x - b.w / 2, b.x + b.w / 2), cz = clamp(s.z, b.z - b.d / 2, b.z + b.d / 2);
    const dx = s.x - cx, dz = s.z - cz, d = Math.hypot(dx, dz);
    if (d > .0001) {
      const push = (CFG.radius - d) / d; s.x += dx * push; s.z += dz * push;
      const nx = dx / d, nz = dz / d, dot = s.vx * nx + s.vz * nz;
      if (dot < 0) { s.vx -= dot * nx; s.vz -= dot * nz; }
    } else {
      const options = [[b.x-b.w/2-CFG.radius,s.z],[b.x+b.w/2+CFG.radius,s.z],
        [s.x,b.z-b.d/2-CFG.radius],[s.x,b.z+b.d/2+CFG.radius]];
      let best = options[0], distance = Infinity;
      for (const p of options) { const d = Math.abs(s.x-p[0])+Math.abs(s.z-p[1]); if (d < distance) { best = p; distance = d; } }
      [s.x,s.z] = best;
    }
  }
}
function accelerate(s: Motor, dx: number, dz: number, speed: number, amount: number): void {
  const add = Math.min(amount, Math.max(0, speed - s.vx * dx - s.vz * dz));
  s.vx += dx * add; s.vz += dz * add;
}
/** One fixed input step. Rust's step_configured is its authoritative counterpart. */
export function move(s: Motor, input: Input, role: Role, dt = CFG.dt, boxes: readonly Box[] = ARENA,
  half = MAP_HALF, settings: RoomSettings = activeSettings): void {
  const options = resolveSettings(settings);
  s.yaw = input.yaw; s.pitch = input.pitch;
  s.crouched = !!input.crouch || s.crouched && !canOccupy(s, CFG.height, boxes);
  const height = bodyHeight(s.crouched);
  s.dashCooldown = Math.max(0, s.dashCooldown - dt);
  const len = Math.max(1, Math.hypot(input.mx, input.mz));
  let dx = (Math.cos(input.yaw) * input.mx - Math.sin(input.yaw) * input.mz) / len;
  let dz = (-Math.sin(input.yaw) * input.mx - Math.cos(input.yaw) * input.mz) / len;
  const moving = Math.hypot(dx, dz) > .01;
  const sprint = input.sprint && s.stamina > 1 && moving && !s.crouched;
  s.stamina = clamp(s.stamina + (sprint ? -20 : 16) * dt, 0, 100);
  if (input.jump && !s.jumpHeld) s.jumpBuffer = M.jumpBufferSeconds;
  const jump = options.bunnyHop === 'auto' ? input.jump : options.bunnyHop === 'timed' ? s.jumpBuffer > 0 : input.jump && !s.jumpHeld;
  if (jump && s.grounded) { s.vy = CFG.jumpSpeed; s.grounded = false; s.jumpBuffer = 0; }
  s.jumpBuffer = Math.max(0, s.jumpBuffer - dt); s.jumpHeld = input.jump;
  if (s.crouched) s.dashTime = 0;
  if (input.dash && !s.dashHeld && role === 'hider' && !s.crouched && s.dashCooldown <= 0 && s.dashTime <= 0) {
    s.dashTime = CFG.dashDuration; s.dashCooldown = options.dashCooldownMs / 1000;
    if (!moving) { dx = -Math.sin(input.yaw); dz = -Math.cos(input.yaw); }
    s.vx = dx * CFG.dashSpeed; s.vz = dz * CFG.dashSpeed;
  }
  s.dashHeld = input.dash;
  if (s.dashTime > 0) s.dashTime = Math.max(0, s.dashTime - dt);
  else {
    const speed = (role === 'hider' ? CFG.hiderSpeed : CFG.seekerSpeed) * (sprint ? CFG.sprintMultiplier : 1) * (s.crouched ? M.crouchMultiplier : 1);
    if (options.bunnyHop === 'off' || s.crouched) {
      const a = 1 - Math.exp(-18 * dt); s.vx += (dx * speed - s.vx) * a; s.vz += (dz * speed - s.vz) * a;
    } else {
      if (s.grounded) { const friction = Math.max(0, 1 - M.groundFriction * dt); s.vx *= friction; s.vz *= friction; }
      if (moving) { const strength = Math.hypot(dx,dz); accelerate(s, dx/strength, dz/strength, speed*strength, (s.grounded ? M.groundAcceleration : M.airAcceleration) * dt); }
    }
    const cap = s.crouched ? speed : M.bhopSpeedCap, velocity = Math.hypot(s.vx, s.vz);
    if (velocity > cap) { s.vx *= cap / velocity; s.vz *= cap / velocity; }
  }
  const steps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vz) * dt / .18));
  for (let i = 0; i < steps; i++) { s.x += s.vx * dt / steps; s.z += s.vz * dt / steps; slide(s, boxes); }
  s.x = clamp(s.x, -half + CFG.radius, half - CFG.radius); s.z = clamp(s.z, -half + CFG.radius, half - CFG.radius);
  const oldY = s.y; s.vy -= CFG.gravity * dt; s.y += s.vy * dt; s.grounded = false;
  for (const b of boxes) {
    if (!overlaps(s.x, s.z, b, CFG.radius * .98)) continue;
    const top = b.y + b.h;
    if (s.vy <= 0 && oldY >= top - .001 && s.y <= top) { s.y = top; s.vy = 0; s.grounded = true; }
    else if (s.vy > 0 && oldY + height <= b.y + .001 && s.y + height >= b.y) { s.y = b.y - height; s.vy = 0; }
  }
  if (s.y <= 0) { s.y = 0; s.vy = 0; s.grounded = true; }
}
export function rayBox(origin: Vec3, dir: Vec3, min: Vec3, max: Vec3): number | null {
  let near = 0, far = Infinity;
  for (const k of ['x','y','z'] as const) {
    if (Math.abs(dir[k]) < 1e-9) { if (origin[k] < min[k] || origin[k] > max[k]) return null; }
    else { const a = (min[k]-origin[k])/dir[k], b = (max[k]-origin[k])/dir[k]; near = Math.max(near, Math.min(a,b)); far = Math.min(far,Math.max(a,b)); if (near > far) return null; }
  }
  return far >= 0 ? near : null;
}
export function arenaRay(origin: Vec3, dir: Vec3, range: number = CFG.shotRange): number {
  let distance = range;
  for (const b of ARENA) {
    const d = rayBox(origin,dir,{x:b.x-b.w/2,y:b.y,z:b.z-b.d/2},{x:b.x+b.w/2,y:b.y+b.h,z:b.z+b.d/2});
    if (d !== null) distance = Math.min(distance,d);
  }
  if (dir.y < -1e-6) distance = Math.min(distance,-origin.y/dir.y);
  for (const axis of ['x','z'] as const) if (Math.abs(dir[axis]) > 1e-6) {
    const d = ((dir[axis] > 0 ? MAP_HALF : -MAP_HALF) - origin[axis])/dir[axis]; if (d >= 0) distance = Math.min(distance,d);
  }
  return Math.max(0,distance);
}
export const aimDirection = (yaw: number, pitch: number): Vec3 => ({ x: -Math.sin(yaw)*Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw)*Math.cos(pitch) });
