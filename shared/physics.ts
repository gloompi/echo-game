import { CFG } from './config.js';
import { ARENA } from './map.js';
import type { Box, Input, Motor, Role, Vec3 } from './types.js';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const angleLerp = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
export const makeMotor = (p: Vec3): Motor => ({ ...p, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, grounded: true, stamina: 100, dashTime: 0, dashCooldown: 0, jumpHeld: false, dashHeld: false });
export function overlaps(x: number, z: number, b: Box, radius: number = CFG.radius): boolean {
  const dx = x - clamp(x, b.x - b.w / 2, b.x + b.w / 2);
  const dz = z - clamp(z, b.z - b.d / 2, b.z + b.d / 2);
  return dx * dx + dz * dz < radius * radius - 1e-7;
}
function slide(s: Motor, boxes: readonly Box[]) {
  for (let pass = 0; pass < 3; pass++) for (const b of boxes) {
    if (s.y >= b.y + b.h - 0.001 || s.y + CFG.height <= b.y + 0.001 || !overlaps(s.x, s.z, b)) continue;
    if (s.grounded && b.y + b.h - s.y <= 0.37) { s.y = b.y + b.h; continue; }
    const cx = clamp(s.x, b.x - b.w / 2, b.x + b.w / 2), cz = clamp(s.z, b.z - b.d / 2, b.z + b.d / 2);
    const dx = s.x - cx, dz = s.z - cz, d = Math.hypot(dx, dz);
    if (d > 0.0001) {
      const push = (CFG.radius - d) / d; s.x += dx * push; s.z += dz * push;
      // Remove only the velocity into the surface, preserving wall sliding.
      const nx = dx / d, nz = dz / d, dot = s.vx * nx + s.vz * nz;
      if (dot < 0) { s.vx -= dot * nx; s.vz -= dot * nz; }
    } else {
      const options = [
        { d: Math.abs(s.x - (b.x - b.w / 2 - CFG.radius)), x: b.x - b.w / 2 - CFG.radius, z: s.z },
        { d: Math.abs(s.x - (b.x + b.w / 2 + CFG.radius)), x: b.x + b.w / 2 + CFG.radius, z: s.z },
        { d: Math.abs(s.z - (b.z - b.d / 2 - CFG.radius)), x: s.x, z: b.z - b.d / 2 - CFG.radius },
        { d: Math.abs(s.z - (b.z + b.d / 2 + CFG.radius)), x: s.x, z: b.z + b.d / 2 + CFG.radius },
      ].sort((a, b) => a.d - b.d);
      s.x = options[0].x; s.z = options[0].z;
    }
  }
}
/** Fixed-duration, shared movement. Clients never choose server dt or position. */
export function move(s: Motor, input: Input, role: Role, dt = CFG.dt, boxes: readonly Box[] = ARENA): void {
  s.yaw = input.yaw; s.pitch = input.pitch;
  s.dashCooldown = Math.max(0, s.dashCooldown - dt);
  const len = Math.max(1, Math.hypot(input.mx, input.mz));
  let dx = (Math.cos(input.yaw) * input.mx - Math.sin(input.yaw) * input.mz) / len;
  let dz = (-Math.sin(input.yaw) * input.mx - Math.cos(input.yaw) * input.mz) / len;
  const moving = Math.hypot(dx, dz) > 0.01;
  const sprint = input.sprint && s.stamina > 1 && moving;
  s.stamina = clamp(s.stamina + (sprint ? -20 : 16) * dt, 0, 100);
  if (input.jump && !s.jumpHeld && s.grounded) { s.vy = CFG.jumpSpeed; s.grounded = false; }
  s.jumpHeld = input.jump;
  if (input.dash && !s.dashHeld && role === 'hider' && s.dashCooldown <= 0) {
    s.dashTime = CFG.dashDuration; s.dashCooldown = CFG.dashCooldown;
    if (!moving) { dx = -Math.sin(input.yaw); dz = -Math.cos(input.yaw); }
    s.vx = dx * CFG.dashSpeed; s.vz = dz * CFG.dashSpeed;
  }
  s.dashHeld = input.dash;
  if (s.dashTime > 0) s.dashTime = Math.max(0, s.dashTime - dt);
  else {
    const speed = (role === 'hider' ? CFG.hiderSpeed : CFG.seekerSpeed) * (sprint ? CFG.sprintMultiplier : 1);
    const a = 1 - Math.exp(-18 * dt); s.vx += (dx * speed - s.vx) * a; s.vz += (dz * speed - s.vz) * a;
  }
  // Substeps avoid tunneling through thin cover during a dash.
  const steps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vz) * dt / 0.18));
  for (let i = 0; i < steps; i++) { s.x += s.vx * dt / steps; s.z += s.vz * dt / steps; slide(s, boxes); }
  s.x = clamp(s.x, -CFG.arenaHalf + CFG.radius, CFG.arenaHalf - CFG.radius);
  s.z = clamp(s.z, -CFG.arenaHalf + CFG.radius, CFG.arenaHalf - CFG.radius);
  const oldY = s.y; s.vy -= CFG.gravity * dt; s.y += s.vy * dt; s.grounded = false;
  for (const b of boxes) {
    if (!overlaps(s.x, s.z, b, CFG.radius * 0.98)) continue;
    const top = b.y + b.h;
    if (s.vy <= 0 && oldY >= top - 0.001 && s.y <= top) { s.y = top; s.vy = 0; s.grounded = true; }
    else if (s.vy > 0 && oldY + CFG.height <= b.y + 0.001 && s.y + CFG.height >= b.y) { s.y = b.y - CFG.height; s.vy = 0; }
  }
  if (s.y <= 0) { s.y = 0; s.vy = 0; s.grounded = true; }
}
export function rayBox(origin: Vec3, dir: Vec3, min: Vec3, max: Vec3): number | null {
  let near = 0, far = Infinity;
  for (const k of ['x', 'y', 'z'] as const) {
    if (Math.abs(dir[k]) < 1e-9) { if (origin[k] < min[k] || origin[k] > max[k]) return null; }
    else { const a = (min[k] - origin[k]) / dir[k], b = (max[k] - origin[k]) / dir[k]; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); if (near > far) return null; }
  }
  return far >= 0 ? near : null;
}
export function arenaRay(origin: Vec3, dir: Vec3, range: number = CFG.shotRange): number {
  let distance = range;
  for (const b of ARENA) {
    const d = rayBox(origin, dir, { x: b.x - b.w / 2, y: b.y, z: b.z - b.d / 2 }, { x: b.x + b.w / 2, y: b.y + b.h, z: b.z + b.d / 2 });
    if (d !== null) distance = Math.min(distance, d);
  }
  if (dir.y < -1e-6) distance = Math.min(distance, -origin.y / dir.y);
  for (const axis of ['x', 'z'] as const) if (Math.abs(dir[axis]) > 1e-6) {
    const d = ((dir[axis] > 0 ? CFG.arenaHalf : -CFG.arenaHalf) - origin[axis]) / dir[axis];
    if (d >= 0) distance = Math.min(distance, d);
  }
  return Math.max(0, distance);
}
export const aimDirection = (yaw: number, pitch: number): Vec3 => ({ x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) });
