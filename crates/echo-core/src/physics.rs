//! Port of shared/physics.ts. Keep parity fixtures green when changing either motor.
use crate::{arena, rules, BoxCollider, Input, Motor, Role, Vec3};

pub fn overlaps(x: f64, z: f64, b: &BoxCollider, radius: f64) -> bool {
    let dx = x - x.clamp(b.x - b.w / 2.0, b.x + b.w / 2.0);
    let dz = z - z.clamp(b.z - b.d / 2.0, b.z + b.d / 2.0);
    dx * dx + dz * dz < radius * radius - 1e-7
}
fn slide(s: &mut Motor, boxes: &[BoxCollider]) {
    let c = rules();
    for _ in 0..3 { for b in boxes {
        if s.y >= b.y + b.h - 0.001 || s.y + c.height <= b.y + 0.001 || !overlaps(s.x, s.z, b, c.radius) { continue; }
        if s.grounded && b.y + b.h - s.y <= 0.37 { s.y = b.y + b.h; continue; }
        let cx = s.x.clamp(b.x - b.w / 2.0, b.x + b.w / 2.0);
        let cz = s.z.clamp(b.z - b.d / 2.0, b.z + b.d / 2.0);
        let dx = s.x - cx; let dz = s.z - cz; let d = dx.hypot(dz);
        if d > 0.0001 {
            let push = (c.radius - d) / d; s.x += dx * push; s.z += dz * push;
            let nx = dx / d; let nz = dz / d; let dot = s.vx * nx + s.vz * nz;
            if dot < 0.0 { s.vx -= dot * nx; s.vz -= dot * nz; }
        } else {
            let options = [(b.x - b.w / 2.0 - c.radius, s.z), (b.x + b.w / 2.0 + c.radius, s.z),
                (s.x, b.z - b.d / 2.0 - c.radius), (s.x, b.z + b.d / 2.0 + c.radius)];
            let mut best = options[0]; let mut distance = f64::INFINITY;
            for (x,z) in options { let d = (s.x-x).abs() + (s.z-z).abs(); if d < distance { distance = d; best = (x,z); } }
            s.x = best.0; s.z = best.1;
        }
    }}
}
pub fn step(s: &mut Motor, i: &Input, role: Role) { step_with_boxes(s, i, role, &arena().boxes); }
pub fn step_with_boxes(s: &mut Motor, i: &Input, role: Role, boxes: &[BoxCollider]) {
    let c = rules(); let dt = 1.0 / c.tick_rate as f64;
    s.yaw = i.yaw; s.pitch = i.pitch; s.dash_cooldown = (s.dash_cooldown - dt).max(0.0);
    let len = i.mx.hypot(i.mz).max(1.0);
    let mut dx = (i.yaw.cos() * i.mx - i.yaw.sin() * i.mz) / len;
    let mut dz = (-i.yaw.sin() * i.mx - i.yaw.cos() * i.mz) / len;
    let moving = dx.hypot(dz) > 0.01; let sprint = i.sprint && s.stamina > 1.0 && moving;
    s.stamina = (s.stamina + if sprint { -20.0 * dt } else { 16.0 * dt }).clamp(0.0, 100.0);
    if i.jump && !s.jump_held && s.grounded { s.vy = c.jump_speed; s.grounded = false; }
    s.jump_held = i.jump;
    if i.dash && !s.dash_held && role == Role::Hider && s.dash_cooldown <= 0.0 {
        s.dash_time = c.dash_duration; s.dash_cooldown = c.dash_cooldown;
        if !moving { dx = -i.yaw.sin(); dz = -i.yaw.cos(); }
        s.vx = dx * c.dash_speed; s.vz = dz * c.dash_speed;
    }
    s.dash_held = i.dash;
    if s.dash_time > 0.0 { s.dash_time = (s.dash_time - dt).max(0.0); }
    else {
        let speed = (if role == Role::Hider { c.hider_speed } else { c.seeker_speed }) * (if sprint { c.sprint_multiplier } else { 1.0 });
        let a = 1.0 - (-18.0 * dt).exp(); s.vx += (dx * speed - s.vx) * a; s.vz += (dz * speed - s.vz) * a;
    }
    let steps = (s.vx.hypot(s.vz) * dt / 0.18).ceil().max(1.0) as usize;
    for _ in 0..steps { s.x += s.vx * dt / steps as f64; s.z += s.vz * dt / steps as f64; slide(s, boxes); }
    s.x = s.x.clamp(-c.arena_half + c.radius, c.arena_half - c.radius);
    s.z = s.z.clamp(-c.arena_half + c.radius, c.arena_half - c.radius);
    let old_y = s.y; s.vy -= c.gravity * dt; s.y += s.vy * dt; s.grounded = false;
    for b in boxes {
        if !overlaps(s.x, s.z, b, c.radius * 0.98) { continue; }
        let top = b.y + b.h;
        if s.vy <= 0.0 && old_y >= top - 0.001 && s.y <= top { s.y = top; s.vy = 0.0; s.grounded = true; }
        else if s.vy > 0.0 && old_y + c.height <= b.y + 0.001 && s.y + c.height >= b.y { s.y = b.y - c.height; s.vy = 0.0; }
    }
    if s.y <= 0.0 { s.y = 0.0; s.vy = 0.0; s.grounded = true; }
}
pub fn aim(yaw: f64, pitch: f64) -> Vec3 { Vec3 { x: -yaw.sin() * pitch.cos(), y: pitch.sin(), z: -yaw.cos() * pitch.cos() } }
pub fn ray_box(o: Vec3, d: Vec3, min: Vec3, max: Vec3) -> Option<f64> {
    let mut near: f64 = 0.0; let mut far = f64::INFINITY;
    for (o,d,min,max) in [(o.x,d.x,min.x,max.x),(o.y,d.y,min.y,max.y),(o.z,d.z,min.z,max.z)] {
        if d.abs() < 1e-9 { if o < min || o > max { return None; } }
        else { let a = (min-o)/d; let b = (max-o)/d; near = near.max(a.min(b)); far = far.min(a.max(b)); if near > far { return None; } }
    }
    if far >= 0.0 { Some(near) } else { None }
}
pub fn arena_ray(o: Vec3, d: Vec3) -> f64 {
    let c = rules(); let mut distance = c.shot_range;
    for b in &arena().boxes {
        if let Some(v) = ray_box(o,d,Vec3{x:b.x-b.w/2.0,y:b.y,z:b.z-b.d/2.0},Vec3{x:b.x+b.w/2.0,y:b.y+b.h,z:b.z+b.d/2.0}) { distance = distance.min(v); }
    }
    if d.y < -1e-6 { distance = distance.min(-o.y/d.y); }
    for (o,d) in [(o.x,d.x),(o.z,d.z)] { if d.abs() > 1e-6 { let v = ((if d>0.0 {c.arena_half} else {-c.arena_half}) - o)/d; if v>=0.0 { distance=distance.min(v); } } }
    distance.max(0.0)
}
pub fn player_ray(o: Vec3, d: Vec3, p: Vec3) -> Option<f64> {
    ray_box(o,d,Vec3{x:p.x-0.38,y:p.y+0.08,z:p.z-0.38},Vec3{x:p.x+0.38,y:p.y+rules().height,z:p.z+0.38})
}
