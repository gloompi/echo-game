use crate::balance::{Skin, Weapon};
use crate::{
    arena, history::History, map, movement, physics, rules, Event, Input, Motor, Phase, Pose,
    Preference, Role, Settings, Vec3,
};
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
pub mod combat;
use combat::{AbilityState, CombatState, Mine, MineView, Projectile, ProjectileView};

pub struct Player {
    pub id: String,
    pub name: String,
    pub bot: bool,
    pub preference: Preference,
    pub role: Role,
    pub motor: Motor,
    pub alive: bool,
    pub caught: bool,
    pub joined_round: u64,
    pub hp: u32,
    pub ammo: u32,
    pub tags: u32,
    pub baits: u32,
    pub skin: Skin,
    pub combat: CombatState,
    pub ack: u64,
    pub input: Input,
    queue: VecDeque<Input>,
    last_seq: u64,
    last_input_at: f64,
    pub reload_until: f64,
    pub mirror_until: f64,
    interact_held: bool,
    shot_at: f64,
    wave_until: f64,
    wave_at: f64,
    waypoint: usize,
}
impl Player {
    pub fn new(id: String, name: String, bot: bool, preference: Preference, now: f64) -> Self {
        Self {
            id,
            name,
            bot,
            preference,
            role: Role::Hider,
            motor: Motor::new(arena().spawns[0]),
            alive: true,
            caught: false,
            joined_round: 0,
            hp: rules().hit_points,
            ammo: rules().magazine,
            tags: 0,
            baits: 0,
            skin: Skin::default(),
            combat: CombatState::new(&Settings::default().balance),
            ack: 0,
            input: Input::default(),
            queue: VecDeque::new(),
            last_seq: 0,
            last_input_at: now,
            reload_until: 0.0,
            mirror_until: 0.0,
            interact_held: false,
            shot_at: -1e9,
            wave_until: 0.0,
            wave_at: -1e9,
            waypoint: 0,
        }
    }
    pub fn pose(&self, now: f64) -> Pose {
        Pose {
            id: self.id.clone(),
            x: self.motor.x,
            y: self.motor.y,
            z: self.motor.z,
            yaw: self.motor.yaw,
            pitch: self.motor.pitch,
            role: self.role,
            alive: self.alive,
            moving: self.motor.vx.hypot(self.motor.vz),
            grounded: self.motor.grounded,
            waving: self.wave_until > now,
            dashing: self.motor.dash_time > 0.0,
            crouched: self.motor.crouched,
            warp: self.motor.warp,
            sliding: self.motor.slide_time > 0.0,
            shielded: self.combat.shield_until > now,
            controlled: self.motor.controlled(),
            hit_at: self.combat.hit_at,
            skin: self.skin,
            weapon: self.combat.weapon,
        }
    }
    pub fn set_input(&mut self, input: Input, now: f64) -> bool {
        if !input.validate()
            || input.seq <= self.last_seq
            || input.seq > self.ack.saturating_add(180)
            || self.queue.len() >= 120
        {
            return false;
        }
        self.last_seq = input.seq;
        self.last_input_at = now;
        self.queue.push_back(input);
        true
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPlayer<'a> {
    pub id: &'a str,
    pub name: &'a str,
    pub bot: bool,
    pub preference: Preference,
    pub role: Role,
    pub alive: bool,
    pub caught: bool,
    pub tags: u32,
    pub baits: u32,
    pub skin: Skin,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SelfState<'a> {
    #[serde(flatten)]
    pub motor: &'a Motor,
    pub id: &'a str,
    pub role: Role,
    pub alive: bool,
    pub hp: u32,
    pub ammo: u32,
    pub reload_left: f64,
    pub mirror_left: f64,
    pub ack: u64,
    pub waving: bool,
    pub spectating: bool,
    pub skin: Skin,
    pub weapon: Weapon,
    pub abilities: AbilityState,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot<'a> {
    #[serde(rename = "type")]
    pub message_type: &'static str,
    pub now: f64,
    pub view_time: f64,
    pub room: &'a str,
    pub host: &'a str,
    pub public: bool,
    pub practice: bool,
    pub phase: Phase,
    pub ends_at: f64,
    pub round: u64,
    pub winner: Option<Role>,
    pub bots_enabled: bool,
    pub settings: Settings,
    pub settings_version: u64,
    pub roster: Vec<PublicPlayer<'a>>,
    #[serde(rename = "self")]
    pub self_state: SelfState<'a>,
    pub players: Vec<Pose>,
    pub echo: Option<Pose>,
    pub events: Vec<Event>,
    pub mines: Vec<MineView>,
    pub projectiles: Vec<ProjectileView>,
}
pub struct Room {
    pub code: String,
    pub public: bool,
    pub practice: bool,
    pub players: Vec<Player>,
    pub host: String,
    pub settings: Settings,
    pub settings_version: u64,
    pub phase: Phase,
    pub ends_at: f64,
    pub round: u64,
    pub winner: Option<Role>,
    pub bots_enabled: bool,
    pub history: History,
    events: VecDeque<Event>,
    event_sequence: u64,
    bot_sequence: u64,
    last_bait: HashMap<String, f64>,
    pub mines: Vec<Mine>,
    pub projectiles: Vec<Projectile>,
    entity_sequence: u64,
}
impl Room {
    pub fn new(code: String, public: bool, practice: bool, settings: Settings) -> Self {
        Self {
            code,
            public,
            practice,
            settings,
            settings_version: 1,
            players: vec![],
            host: String::new(),
            phase: Phase::Lobby,
            ends_at: 0.0,
            round: 0,
            winner: None,
            bots_enabled: true,
            history: History::default(),
            events: VecDeque::new(),
            event_sequence: 0,
            bot_sequence: 0,
            last_bait: HashMap::new(),
            mines: vec![],
            projectiles: vec![],
            entity_sequence: 0,
        }
    }
    pub fn human_count(&self) -> usize {
        self.players.iter().filter(|p| !p.bot).count()
    }
    pub fn player(&self, id: &str) -> Option<&Player> {
        self.players.iter().find(|p| p.id == id)
    }
    pub fn player_mut(&mut self, id: &str) -> Option<&mut Player> {
        self.players.iter_mut().find(|p| p.id == id)
    }
    pub fn add(&mut self, mut p: Player) -> bool {
        if self.players.len() >= rules().max_players {
            if !p.bot {
                if let Some(i) = self.players.iter().position(|p| p.bot) {
                    self.players.remove(i);
                }
            }
            if self.players.len() >= rules().max_players {
                return false;
            }
        }
        if self.host.is_empty() && !p.bot {
            self.host = p.id.clone();
        }
        let layout = map(self.settings.map_id);
        p.motor = Motor::new(layout.spawns[self.players.len() % layout.spawns.len()]);
        p.combat = CombatState::new(&self.settings.balance);
        p.ammo = p.combat.ammunition[0];
        let hot_join = self.public && matches!(self.phase, Phase::Headstart | Phase::Playing);
        let in_round = self.phase == Phase::Lobby || hot_join;
        p.alive = in_round;
        p.joined_round = if in_round { self.round } else { self.round + 1 };
        p.waypoint = self.players.len() % layout.waypoints.len();
        self.players.push(p);
        true
    }
    pub fn remove(&mut self, id: &str) {
        self.players.retain(|p| p.id != id);
        self.last_bait.remove(id);
        self.mines.retain(|m| m.owner != id);
        self.projectiles.retain(|p| p.owner != id);
        if self.host == id {
            self.host = self
                .players
                .iter()
                .find(|p| !p.bot)
                .map(|p| p.id.clone())
                .unwrap_or_default();
        }
    }
    pub fn configure(&mut self, actor: &str, settings: Settings) -> Result<(), &'static str> {
        if self.host != actor {
            return Err("Only the host can change room settings.");
        }
        if !matches!(self.phase, Phase::Lobby | Phase::Finished) {
            return Err("Change settings between rounds, not during a hunt.");
        }
        settings.validate()?;
        let changed_map = self.settings.map_id != settings.map_id;
        self.settings = settings;
        self.settings_version += 1;
        self.mines.clear();
        self.projectiles.clear();
        if changed_map {
            self.history.clear();
            self.events.clear();
            let layout = map(settings.map_id);
            for (i, p) in self.players.iter_mut().enumerate() {
                p.motor = Motor::new(layout.spawns[i % layout.spawns.len()]);
                p.queue.clear();
                p.input = Input::neutral(p.ack, 0.0, 0.0);
                p.mirror_until = 0.0;
                p.interact_held = false;
                p.combat = CombatState::new(&settings.balance);
                p.ammo = p.combat.ammunition[0];
            }
        }
        Ok(())
    }
    pub fn lobby(&mut self, actor: &str) -> Result<(), &'static str> {
        if self.host != actor {
            return Err("Only the host can return everyone to the lobby.");
        }
        self.phase = Phase::Lobby;
        self.ends_at = 0.0;
        self.history.clear();
        self.events.clear();
        self.winner = None;
        self.mines.clear();
        self.projectiles.clear();
        for p in &mut self.players {
            p.alive = true;
            p.joined_round = self.round;
            p.queue.clear();
            p.input = Input::neutral(p.ack, p.motor.yaw, p.motor.pitch);
            p.combat = CombatState::new(&self.settings.balance);
            p.ammo = p.combat.ammunition[0];
            p.reload_until = 0.0;
            p.motor.control_left = 0.0;
            p.motor.pull_left = 0.0;
            p.motor.slide_time = 0.0;
            p.motor.dash_time = 0.0;
        }
        Ok(())
    }
    fn fill_bots(&mut self, now: f64) {
        if !self.bots_enabled {
            self.players.retain(|p| !p.bot);
            return;
        }
        let names = ["Noodle", "Afterimage", "Static", "Wrong Turn"];
        while self.players.len() < 4 {
            self.bot_sequence += 1;
            self.add(Player::new(
                format!("bot-{}-{}", self.code, self.bot_sequence),
                names[self.bot_sequence as usize % 4].into(),
                true,
                Preference::Auto,
                now,
            ));
        }
    }
    pub fn start(&mut self, now: f64) -> bool {
        if !matches!(self.phase, Phase::Lobby | Phase::Finished) {
            return false;
        }
        self.fill_bots(now);
        if self.players.len() < 2 {
            return false;
        }
        self.round += 1;
        self.phase = Phase::Headstart;
        self.ends_at = now + rules().headstart_ms.max(self.settings.delay_ms) as f64;
        self.winner = None;
        self.history.clear();
        self.events.clear();
        self.last_bait.clear();
        self.mines.clear();
        self.projectiles.clear();
        let mut candidates = vec![];
        for pref in [Preference::Seeker, Preference::Auto, Preference::Hider] {
            let mut group: Vec<usize> = self
                .players
                .iter()
                .enumerate()
                .filter(|(_, p)| p.preference == pref)
                .map(|(i, _)| i)
                .collect();
            if !group.is_empty() {
                let n = group.len();
                group.rotate_left((self.round as usize - 1) % n);
            }
            candidates.extend(group);
        }
        candidates.truncate(self.settings.seeker_count.min(self.players.len() - 1));
        let layout = map(self.settings.map_id);
        for (i, p) in self.players.iter_mut().enumerate() {
            p.role = if candidates.contains(&i) {
                Role::Seeker
            } else {
                Role::Hider
            };
            p.motor = Motor::new(layout.spawns[i % layout.spawns.len()]);
            p.motor.yaw = p.motor.x.atan2(p.motor.z);
            p.hp = rules().hit_points;
            p.alive = true;
            p.caught = false;
            p.joined_round = self.round;
            p.combat = CombatState::new(&self.settings.balance);
            p.ammo = p.combat.ammunition[0];
            p.reload_until = 0.0;
            p.mirror_until = 0.0;
            p.interact_held = false;
            p.wave_until = 0.0;
            p.shot_at = -1e9;
            p.wave_at = -1e9;
            p.queue.clear();
            p.input = Input::neutral(p.ack, p.motor.yaw, 0.0);
            p.last_seq = p.ack;
            p.last_input_at = now;
        }
        self.history
            .record(now, self.players.iter().map(|p| p.pose(now)).collect());
        true
    }
    fn event(&mut self, mut event: Event) {
        self.event_sequence += 1;
        event.id = self.event_sequence;
        self.events.push_back(event);
        if self.events.len() > 4096 {
            self.events.pop_front();
        }
    }
    fn simple_event(&mut self, at: f64, kind: &'static str, actor: String, target: Option<String>) {
        self.event(Event {
            id: 0,
            at,
            kind,
            actor,
            target,
            from: None,
            to: None,
            hit: None,
            echo: None,
        });
    }
    fn blocked(&self, p: &Player, yaw: f64) -> bool {
        map(self.settings.map_id).boxes.iter().any(|b| {
            b.y + b.h > p.motor.y + 0.37
                && physics::overlaps(
                    p.motor.x - yaw.sin() * 1.2,
                    p.motor.z - yaw.cos() * 1.2,
                    b,
                    rules().radius,
                )
        })
    }
    fn bot_input(&self, index: usize, now: f64) -> Input {
        let p = &self.players[index];
        let s = &p.motor;
        let layout = map(self.settings.map_id);
        let mut input = Input::neutral(p.ack + 1, s.yaw, 0.0);
        let route = ((now / 3500.0) as usize + p.waypoint) % layout.waypoints.len();
        let mut goal = layout.waypoints[route];
        let ahead = Vec3 {
            x: s.x - s.yaw.sin() * 0.8,
            y: s.y,
            z: s.z - s.yaw.cos() * 0.8,
        };
        input.crouch = !physics::can_occupy(ahead, rules().height, &layout.boxes)
            && physics::can_occupy(ahead, movement().crouch_height, &layout.boxes);
        input.interact = (now / 1000.0).sin() > 0.95;
        if p.role == Role::Seeker {
            // Target choice and aim use delayed observations, never live Hider poses.
            let visible = self.history.sample(now - self.settings.delay_ms as f64);
            let target = visible
                .iter()
                .filter(|q| q.role == Role::Hider && q.alive)
                .min_by(|a, b| {
                    (a.x - s.x)
                        .hypot(a.z - s.z)
                        .total_cmp(&(b.x - s.x).hypot(b.z - s.z))
                });
            if let Some(target) = target {
                goal = target.position();
                if let Some(old) = self
                    .history
                    .sample(now - self.settings.delay_ms as f64 - 350.0)
                    .iter()
                    .find(|q| q.id == target.id && q.warp == target.warp)
                {
                    goal.x += (target.x - old.x) / 0.35 * 0.65;
                    goal.z += (target.z - old.z) / 0.35 * 0.65;
                }
                let d = (goal.x - s.x).hypot(goal.z - s.z);
                input.yaw = (-(goal.x - s.x)).atan2(-(goal.z - s.z));
                let target_eye = physics::eye(target.crouched);
                let eye = physics::eye(s.crouched);
                input.pitch = (target.y + target_eye - (s.y + eye))
                    .atan2(d.max(0.1))
                    .clamp(-1.2, 1.2);
                let from = Vec3 {
                    x: s.x,
                    y: s.y + eye,
                    z: s.z,
                };
                input.shoot = d < 27.0
                    && physics::map_ray(from, physics::aim(input.yaw, input.pitch), layout)
                        > d - 0.6
                    && (now / 700.0).sin() > -0.15;
                input.mz = if d > 8.0 { 0.7 } else { 0.0 };
                input.mx = if d < 10.0 {
                    (now / 1700.0).sin() * 0.5
                } else {
                    0.0
                };
                if input.mz > 0.0 && self.blocked(p, input.yaw) {
                    input.mx = 1.0;
                    input.jump = (now / 400.0).sin() > 0.8;
                }
                input.reload = p.ammo == 0;
                input.scan = (now / 2100.0).sin() > 0.99;
                return input;
            }
        }
        input.yaw = (-(goal.x - s.x)).atan2(-(goal.z - s.z));
        input.mz = 1.0;
        if self.blocked(p, input.yaw) {
            input.mx = 0.9;
            input.jump = (now / 300.0 + p.waypoint as f64).sin() > 0.0;
        }
        let threat = p.role == Role::Hider
            && self.players.iter().any(|q| {
                q.role == Role::Seeker && q.alive && (q.motor.x - s.x).hypot(q.motor.z - s.z) < 10.0
            });
        input.sprint = threat;
        input.dash = threat && (now / 900.0 + p.waypoint as f64).sin() > 0.94;
        input.ability = threat && (now / 1700.0 + p.waypoint as f64).sin() > 0.98;
        input.wave = !threat && (now / 1500.0 + p.waypoint as f64).sin() > 0.985;
        input
    }
    fn mirror_exit(&self, index: usize) -> Option<Vec3> {
        let p = self.players.get(index)?;
        let layout = map(self.settings.map_id);
        let source = layout
            .mirrors
            .iter()
            .filter(|m| {
                (m.x - p.motor.x).hypot(m.z - p.motor.z) <= movement().mirror_radius
                    && (m.y - p.motor.y).abs() < 1.3
            })
            .min_by(|a, b| {
                (a.x - p.motor.x)
                    .hypot(a.z - p.motor.z)
                    .total_cmp(&(b.x - p.motor.x).hypot(b.z - p.motor.z))
            })?;
        let destination = layout.mirrors.iter().find(|m| m.id == source.target)?;
        let eye = Vec3 {
            x: p.motor.x,
            y: p.motor.y + physics::eye(p.motor.crouched),
            z: p.motor.z,
        };
        let delta = Vec3 {
            x: source.x - eye.x,
            y: source.y + 1.0 - eye.y,
            z: source.z - eye.z,
        };
        let d = (delta.x * delta.x + delta.y * delta.y + delta.z * delta.z).sqrt();
        if d > 0.001
            && physics::map_ray(
                eye,
                Vec3 {
                    x: delta.x / d,
                    y: delta.y / d,
                    z: delta.z / d,
                },
                layout,
            ) < d - 0.1
        {
            return None;
        }
        if !physics::can_occupy(destination.exit, rules().height, &layout.boxes)
            || destination.exit.x.abs() > layout.half - rules().radius
            || destination.exit.z.abs() > layout.half - rules().radius
        {
            return None;
        }
        Some(destination.exit)
    }
    /// Hiders keep their original mirror cooldown. Seekers have independent cast/recharge timings.
    pub fn use_mirror(&mut self, index: usize, now: f64) -> bool {
        let Some(p) = self.players.get(index) else {
            return false;
        };
        if !p.alive
            || p.joined_round != self.round
            || p.motor.controlled()
            || !matches!(self.phase, Phase::Playing | Phase::Headstart)
            || (self.phase == Phase::Headstart && p.role == Role::Seeker)
            || p.mirror_until > now
            || p.combat.action_until > now
        {
            return false;
        }
        let Some(to) = self.mirror_exit(index) else {
            self.players[index].combat.cast_until = 0.0;
            self.players[index].combat.cast_origin = None;
            return false;
        };
        let b = self.settings.balance.teleport;
        let p = &mut self.players[index];
        if p.role == Role::Seeker && b.seeker_cast_ms > 0 {
            if p.combat.cast_origin.is_none() {
                if !p.motor.grounded {
                    return false;
                }
                p.combat.cast_origin = Some(p.motor.position());
                p.combat.cast_until = now + b.seeker_cast_ms as f64;
                p.motor.vx = 0.0;
                p.motor.vz = 0.0;
                p.motor.dash_time = 0.0;
                return false;
            }
            if p.combat.cast_until > now {
                return false;
            }
            if p.combat.cast_origin.is_some_and(|v| {
                (v.x - p.motor.x).hypot(v.z - p.motor.z) > 0.25 || (v.y - p.motor.y).abs() > 0.25
            }) {
                p.combat.cast_origin = None;
                p.combat.cast_until = 0.0;
                return false;
            }
        }
        let actor = p.id.clone();
        let from = p.motor.position();
        p.combat.cast_origin = None;
        p.combat.cast_until = 0.0;
        p.motor.x = to.x;
        p.motor.y = to.y;
        p.motor.z = to.z;
        p.motor.vx = 0.0;
        p.motor.vy = 0.0;
        p.motor.vz = 0.0;
        p.motor.grounded = true;
        p.motor.crouched = false;
        p.motor.dash_time = 0.0;
        p.motor.slide_time = 0.0;
        p.motor.jump_buffer = 0.0;
        p.motor.warp += 1;
        p.mirror_until = now
            + (if p.role == Role::Seeker {
                b.seeker_cooldown_ms
            } else {
                self.settings.mirror_cooldown_ms
            }) as f64;
        if p.role == Role::Seeker {
            p.combat.action_until = now + self.settings.balance.control.switch_ms as f64;
        }
        self.event(Event {
            id: 0,
            at: now,
            kind: "teleport",
            actor,
            target: None,
            from: Some(from),
            to: Some(to),
            hit: None,
            echo: None,
        });
        true
    }
    pub fn tick(&mut self, now: f64) {
        if self.phase == Phase::Headstart && now >= self.ends_at {
            self.phase = Phase::Playing;
            self.ends_at = now + self.settings.round_ms as f64;
        }
        if self.phase == Phase::Finished && now >= self.ends_at {
            let host = self.host.clone();
            let _ = self.lobby(&host);
        }
        let bot_inputs: Vec<Option<Input>> = (0..self.players.len())
            .map(|i| {
                if self.players[i].bot && self.players[i].alive {
                    Some(self.bot_input(i, now))
                } else {
                    None
                }
            })
            .collect();
        let mut events = vec![];
        let mut shots = vec![];
        let mut mirrors = vec![];
        let mut shields = vec![];
        let mut hooks = vec![];
        let mut mines = vec![];
        let mut scans = vec![];
        let mut switches = vec![];
        for (index, p) in self.players.iter_mut().enumerate() {
            if let Some(input) = &bot_inputs[index] {
                p.input = input.clone();
                p.last_input_at = now;
            } else if let Some(input) = p.queue.pop_front() {
                p.input = input;
            }
            p.ack = p.input.seq;
            let input = if now - p.last_input_at > 300.0 {
                Input::neutral(p.ack, p.motor.yaw, p.motor.pitch)
            } else {
                p.input.clone()
            };
            let playable = matches!(self.phase, Phase::Playing | Phase::Headstart)
                && p.alive
                && p.joined_round == self.round;
            let can_act = playable
                && !(self.phase == Phase::Headstart && p.role == Role::Seeker)
                && !p.motor.controlled();
            if playable && !(self.phase == Phase::Headstart && p.role == Role::Seeker) {
                // Movement and combat input cancel a channel; turning alone does not.
                if p.combat.cast_origin.is_some()
                    && (input.mx.abs() + input.mz.abs() > 0.01
                        || input.jump
                        || input.dash
                        || input.crouch
                        || input.shoot
                        || input.ability
                        || input.mine)
                {
                    p.combat.cast_origin = None;
                    p.combat.cast_until = 0.0;
                }
                let mut movement_input = input.clone();
                if p.combat.cast_origin.is_some() {
                    movement_input.mx = 0.0;
                    movement_input.mz = 0.0;
                    movement_input.jump = false;
                    movement_input.dash = false;
                    movement_input.sprint = false;
                }
                let dash = p.motor.dash_time;
                physics::step_configured(&mut p.motor, &movement_input, p.role, &self.settings);
                if dash <= 0.0 && p.motor.dash_time > 0.0 {
                    events.push(("dash", p.id.clone()));
                }
                if can_act && input.wave && now - p.wave_at > 1800.0 {
                    p.wave_at = now;
                    p.wave_until = now + 1500.0;
                    events.push(("wave", p.id.clone()));
                }
                if can_act
                    && ((input.interact && !p.interact_held) || p.combat.cast_origin.is_some())
                {
                    mirrors.push(index);
                }
            } else {
                p.motor.yaw = input.yaw;
                p.motor.pitch = input.pitch;
                p.motor.vx = 0.0;
                p.motor.vz = 0.0;
            }
            if can_act {
                if input.ability && !p.combat.primary_held {
                    if p.role == Role::Hider {
                        shields.push(index);
                    } else {
                        hooks.push(index);
                    }
                }
                if input.mine && !p.combat.mine_held {
                    mines.push(index);
                }
                if input.scan && !p.combat.scan_held {
                    scans.push(index);
                }
                if let Some(weapon) = input.weapon {
                    switches.push((index, weapon));
                }
            }
            p.interact_held = input.interact;
            p.combat.primary_held = input.ability;
            p.combat.mine_held = input.mine;
            p.combat.scan_held = input.scan;
            let weapon = p.combat.weapon;
            let magazine = self.settings.balance.weapon(weapon).magazine as u32;
            let reload = combat::reload_ms(&self.settings, weapon);
            if reload == 0 || (p.reload_until > 0.0 && now >= p.reload_until) {
                p.ammo = magazine;
                p.reload_until = 0.0;
            }
            p.combat.ammunition[weapon.index()] = p.ammo;
            if can_act
                && p.role == Role::Seeker
                && p.combat.cast_origin.is_none()
                && p.combat.action_until <= now
            {
                if reload > 0
                    && (input.reload || (input.shoot && p.ammo == 0))
                    && p.reload_until == 0.0
                    && p.ammo < magazine
                {
                    p.reload_until = now + reload as f64;
                }
                if input.shoot {
                    shots.push(index);
                }
            }
        }
        for (kind, actor) in events {
            self.simple_event(now, kind, actor, None);
        }
        // Proactive shields win a same-tick input tie, but never break existing control.
        for index in shields {
            self.activate_shield(index, now);
        }
        for index in hooks {
            self.use_hook(index, now);
        }
        for index in mines {
            self.place_mine(index, now);
        }
        for index in scans {
            self.activate_scan(index, now);
        }
        for (index, weapon) in switches {
            self.switch_weapon(index, weapon, now);
        }
        for index in mirrors {
            self.use_mirror(index, now);
        }
        if self.phase == Phase::Playing {
            self.tick_combat_entities(now);
        }
        // All movement/warps complete before present-position hit tests.
        for index in shots {
            self.fire(index, now);
        }
        if self.phase == Phase::Playing {
            let active: Vec<&Player> = self
                .players
                .iter()
                .filter(|p| p.joined_round == self.round)
                .collect();
            let winner = if !active.iter().any(|p| p.role == Role::Hider && p.alive) {
                Some(Role::Seeker)
            } else if now >= self.ends_at
                || !active.iter().any(|p| p.role == Role::Seeker && p.alive)
            {
                Some(Role::Hider)
            } else {
                None
            };
            if let Some(winner) = winner {
                self.phase = Phase::Finished;
                self.winner = Some(winner);
                self.ends_at = now + rules().results_ms as f64;
            }
        }
        self.history.record(
            now,
            self.players
                .iter()
                .filter(|p| p.joined_round <= self.round)
                .map(|p| p.pose(now))
                .collect(),
        );
        while self
            .events
            .front()
            .is_some_and(|e| e.at < now - rules().history_ms as f64)
        {
            self.events.pop_front();
        }
    }
    pub fn snapshot(&self, viewer: &Player, now: f64) -> Snapshot<'_> {
        self.snapshot_for(&viewer.id, now)
            .expect("viewer belongs to room")
    }
    pub fn snapshot_for(&self, id: &str, now: f64) -> Option<Snapshot<'_>> {
        let viewer = self.player(id)?;
        let delayed = viewer.role == Role::Seeker;
        let view_time = now
            - if delayed {
                self.settings.delay_ms as f64
            } else {
                0.0
            };
        let past = self.history.sample(now - self.settings.delay_ms as f64);
        let mut visible: Vec<Pose> = self
            .players
            .iter()
            .filter(|p| {
                p.id != id && p.joined_round <= self.round && (!delayed || p.role == Role::Seeker)
            })
            .map(|p| p.pose(now))
            .collect();
        if delayed {
            visible.extend(
                past.iter()
                    .filter(|p| p.id != id && p.role == Role::Hider && self.player(&p.id).is_some())
                    .cloned(),
            );
        }
        let mut events: Vec<Event> = self
            .events
            .iter()
            .rev()
            .filter_map(|e| {
                let non_spatial = matches!(e.kind, "tag" | "catch" | "round");
                let delivery = e.at
                    + if delayed && e.actor != id && !non_spatial {
                        self.settings.delay_ms as f64
                    } else {
                        0.0
                    };
                if delivery > now || delivery < now - 1000.0 {
                    return None;
                }
                let mut e = e.clone();
                if non_spatial {
                    e.from = None;
                    e.to = None;
                }
                Some(e)
            })
            .take(64)
            .collect();
        events.reverse();
        Some(Snapshot {
            message_type: "snapshot",
            now,
            view_time,
            room: &self.code,
            host: &self.host,
            public: self.public,
            practice: self.practice,
            phase: self.phase,
            ends_at: self.ends_at,
            round: self.round,
            winner: self.winner,
            bots_enabled: self.bots_enabled,
            settings: self.settings,
            settings_version: self.settings_version,
            roster: self
                .players
                .iter()
                .map(|p| PublicPlayer {
                    id: &p.id,
                    name: &p.name,
                    bot: p.bot,
                    preference: p.preference,
                    role: p.role,
                    alive: p.alive,
                    caught: p.caught,
                    tags: p.tags,
                    baits: p.baits,
                    skin: p.skin,
                })
                .collect(),
            self_state: SelfState {
                motor: &viewer.motor,
                id: &viewer.id,
                role: viewer.role,
                alive: viewer.alive,
                hp: viewer.hp,
                ammo: viewer.ammo,
                reload_left: (viewer.reload_until - now).max(0.0),
                mirror_left: (viewer.mirror_until - now).max(0.0),
                ack: viewer.ack,
                waving: viewer.wave_until > now,
                spectating: viewer.joined_round > self.round,
                skin: viewer.skin,
                weapon: viewer.combat.weapon,
                abilities: viewer.combat.view(now),
            },
            players: visible,
            echo: if viewer.role == Role::Hider {
                past.into_iter().find(|p| p.id == id)
            } else {
                None
            },
            events,
            mines: self.mine_views(viewer, now),
            projectiles: self.projectile_views(),
        })
    }
}
