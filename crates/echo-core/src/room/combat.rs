//! Authoritative abilities. Presentation never receives a hidden target's current position.
use super::*;
use crate::balance::{Balance, Skin, Weapon};

#[derive(Debug, Clone)]
pub struct CombatState {
    pub weapon: Weapon,
    pub ammunition: [u32; 4],
    pub ready_at: [f64; 4], pub shot_sequence: u64,
    pub shield_until: f64, pub shield_ready: f64, pub mine_ready: f64,
    pub hook_ready: f64, pub scan_until: f64, pub scan_ready: f64,
    pub immune_until: f64, pub action_until: f64, pub hit_at: f64,
    pub cast_until: f64, pub cast_origin: Option<Vec3>,
    pub primary_held: bool, pub mine_held: bool, pub scan_held: bool,
}
impl CombatState {
    pub fn new(b: &Balance) -> Self {
        Self { weapon: Weapon::Blaster,
            ammunition: [b.weapons.blaster.magazine as u32, b.weapons.scatter.magazine as u32,
                b.weapons.repeater.magazine as u32, b.weapons.web.magazine as u32],
            ready_at: [-1e9; 4], shot_sequence: 0, shield_until: 0.0, shield_ready: 0.0, mine_ready: 0.0,
            hook_ready: 0.0, scan_until: 0.0, scan_ready: 0.0, immune_until: 0.0,
            action_until: 0.0, hit_at: -1e9, cast_until: 0.0, cast_origin: None,
            primary_held: false, mine_held: false, scan_held: false }
    }
    pub fn view(&self, now: f64) -> AbilityState {
        let left = |until: f64| (until - now).max(0.0);
        AbilityState { shield_left: left(self.shield_until), shield_cooldown: left(self.shield_ready),
            mine_cooldown: left(self.mine_ready), hook_cooldown: left(self.hook_ready),
            scan_left: left(self.scan_until), scan_cooldown: left(self.scan_ready),
            immune_left: left(self.immune_until), switch_left: left(self.action_until), teleport_cast_left: left(self.cast_until) }
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all="camelCase")]
pub struct AbilityState {
    pub shield_left: f64, pub shield_cooldown: f64, pub mine_cooldown: f64,
    pub hook_cooldown: f64, pub scan_left: f64, pub scan_cooldown: f64,
    pub immune_left: f64, pub switch_left: f64, pub teleport_cast_left: f64,
}
#[derive(Debug, Clone)]
pub struct Mine {
    pub id: u64, pub owner: String, pub position: Vec3,
    pub armed_at: f64, pub expires_at: f64, pub triggered_at: Option<f64>,
}
#[derive(Serialize)]
pub struct MineView { pub id: u64, pub owner: String, pub x: f64, pub y: f64, pub z: f64, pub armed: bool }
#[derive(Debug, Clone)]
pub struct Projectile {
    pub id: u64, pub owner: String, pub from: Vec3, pub dir: Vec3,
    pub distance: f64, pub range: f64, pub speed: f64, pub radius: f64, pub active: bool,
}
#[derive(Serialize)]
pub struct ProjectileView { pub id: u64, pub owner: String, pub x: f64, pub y: f64, pub z: f64, pub radius: f64 }
fn add(o: Vec3, d: Vec3, t: f64) -> Vec3 { Vec3 { x:o.x+d.x*t, y:o.y+d.y*t, z:o.z+d.z*t } }
fn distance(a: Vec3, b: Vec3) -> f64 { ((a.x-b.x).powi(2)+(a.y-b.y).powi(2)+(a.z-b.z).powi(2)).sqrt() }
fn toward(a: Vec3, b: Vec3) -> Vec3 {
    let d=distance(a,b).max(1e-9); Vec3 {x:(b.x-a.x)/d,y:(b.y-a.y)/d,z:(b.z-a.z)/d}
}
pub fn reload_ms(settings: &Settings, weapon: Weapon) -> u64 {
    if settings.reload_ms==0 {return 0;}
    let override_ms=settings.balance.weapon(weapon).reload_ms;
    if override_ms==0 {settings.reload_ms} else {override_ms}
}
/// Matches the view weapon's 0.47 scale and named muzzle. Camera-to-muzzle sweep
/// prevents shooting through cover when the camera can peek but the barrel cannot.
pub fn muzzle(motor: &Motor, layout: &crate::Arena) -> (Vec3, Vec3, bool) {
    let eye=Vec3{x:motor.x,y:motor.y+physics::eye(motor.crouched),z:motor.z};
    let forward=physics::aim(motor.yaw,motor.pitch);
    let right=Vec3{x:motor.yaw.cos(),y:0.0,z:-motor.yaw.sin()};
    let up=Vec3{x:motor.yaw.sin()*motor.pitch.sin(),y:motor.pitch.cos(),z:motor.yaw.cos()*motor.pitch.sin()};
    let from=add(add(add(eye,right,0.27),up,-0.33+0.13*0.47),forward,0.49+1.06*0.47);
    let blocked=physics::map_ray(eye,toward(eye,from),layout)<distance(eye,from)+0.02;
    (from,forward,blocked)
}
fn projectile_wall(o: Vec3, d: Vec3, radius: f64, layout: &crate::Arena, range: f64) -> f64 {
    let mut result=physics::map_ray(o,d,layout).min(range);
    for b in &layout.boxes {
        if let Some(t)=physics::ray_box(o,d,Vec3{x:b.x-b.w/2.0-radius,y:b.y-radius,z:b.z-b.d/2.0-radius},
            Vec3{x:b.x+b.w/2.0+radius,y:b.y+b.h+radius,z:b.z+b.d/2.0+radius}) {result=result.min(t);}
    }
    result.max(0.0)
}
impl Room {
    pub fn set_skin(&mut self, id: &str, skin: Skin) -> Result<(), &'static str> {
        if self.phase!=Phase::Lobby {return Err("Change skins in the lobby.");}
        let p=self.player_mut(id).ok_or("Player not found.")?;p.skin=skin;Ok(())
    }
    pub fn combat_ready(&self, index: usize, now: f64) -> bool {
        self.players.get(index).is_some_and(|p|p.alive&&p.joined_round==self.round&&!p.motor.controlled()
            &&p.combat.cast_until<=now&&p.combat.action_until<=now
            &&(self.phase==Phase::Playing||(self.phase==Phase::Headstart&&p.role==Role::Hider)))
    }
    pub fn activate_shield(&mut self, index: usize, now: f64) -> bool {
        if !self.combat_ready(index,now) {return false;}
        let b=self.settings.balance.shield;let p=&mut self.players[index];
        if p.role!=Role::Hider||!b.enabled||p.combat.shield_ready>now||p.motor.stamina<b.stamina_cost as f64 {return false;}
        p.motor.stamina-=b.stamina_cost as f64;p.combat.shield_until=now+b.duration_ms as f64;p.combat.shield_ready=now+b.cooldown_ms as f64;
        let actor=p.id.clone();self.simple_event(now,"shield",actor,None);true
    }
    pub fn activate_scan(&mut self, index: usize, now: f64) -> bool {
        if !self.combat_ready(index,now) {return false;}
        let b=self.settings.balance.scan;let p=&mut self.players[index];
        if p.role!=Role::Seeker||!b.enabled||p.combat.scan_ready>now {return false;}
        p.combat.scan_until=now+b.duration_ms as f64;p.combat.scan_ready=now+b.cooldown_ms as f64;
        let actor=p.id.clone();self.simple_event(now,"scan",actor,None);true
    }
    /// Repeated control never refreshes a stun/root. Shield and post-control grace
    /// both reject new control. Gravity and the collision sweep still run while held.
    pub fn apply_control(&mut self, index: usize, duration_ms: u64, now: f64) -> bool {
        let p=&mut self.players[index];
        if !p.alive||p.joined_round!=self.round||p.combat.shield_until>now||p.motor.controlled()||p.combat.immune_until>now {return false;}
        p.motor.control_left=duration_ms as f64/1000.0;
        p.combat.immune_until=now+duration_ms as f64+self.settings.balance.control.immunity_ms as f64;
        p.motor.dash_time=0.0;p.motor.slide_time=0.0;p.motor.jump_buffer=0.0;p.motor.vx=0.0;p.motor.vz=0.0;
        p.combat.cast_until=0.0;p.combat.cast_origin=None;p.combat.scan_until=0.0;true
    }
    pub fn place_mine(&mut self, index: usize, now: f64) -> bool {
        if !self.combat_ready(index,now) {return false;}
        let b=self.settings.balance.mine;let p=&self.players[index];
        if p.role!=Role::Seeker||!b.enabled||p.combat.mine_ready>now||!p.motor.grounded {return false;}
        let active=self.mines.iter().filter(|m|m.owner==p.id&&m.expires_at>now
            &&m.triggered_at.is_none_or(|t|now<t+self.settings.delay_ms as f64)).count();
        if active>=b.max_active as usize {return false;}
        // Place at the caster's feet, not at a client-provided remote coordinate.
        let position=p.motor.position();let owner=p.id.clone();
        self.entity_sequence+=1;
        self.mines.push(Mine{id:self.entity_sequence,owner:owner.clone(),position,armed_at:now+b.arm_ms as f64,
            expires_at:now+b.life_ms as f64,triggered_at:None});
        self.players[index].combat.mine_ready=now+b.cooldown_ms as f64;
        self.players[index].combat.action_until=now+self.settings.balance.control.switch_ms as f64;
        self.simple_event(now,"mine",owner,None);true
    }
    pub fn use_hook(&mut self, index: usize, now: f64) -> bool {
        if !self.combat_ready(index,now) {return false;}
        let b=self.settings.balance.hook;let p=&self.players[index];
        if p.role!=Role::Seeker||!b.enabled||p.combat.hook_ready>now {return false;}
        let layout=map(self.settings.map_id);let (from,dir,blocked)=muzzle(&p.motor,layout);
        let range=if blocked{0.0}else{projectile_wall(from,dir,b.width_cm as f64/200.0,layout,b.range_cm as f64/100.0)};
        let anchor=p.motor.position();let actor=p.id.clone();let radius=b.width_cm as f64/200.0;
        let mut targets:Vec<(f64,usize)>=self.players.iter().enumerate().filter_map(|(j,q)|{
            if j==index||!q.alive||q.joined_round!=self.round||(!b.friendly_fire&&q.role==Role::Seeker){return None;}
            let pos=q.motor.position();let h=physics::height(q.motor.crouched);
            let t=physics::ray_box(from,dir,Vec3{x:pos.x-0.38-radius,y:pos.y,z:pos.z-0.38-radius},
                Vec3{x:pos.x+0.38+radius,y:pos.y+h,z:pos.z+0.38+radius})?;
            // Width does not grant a through-wall hit near the sides of the corridor.
            let center=Vec3{x:pos.x,y:pos.y+h*0.5,z:pos.z};
            if t>=range||physics::map_ray(from,toward(from,center),layout)<distance(from,center)-0.2{return None;}
            Some((t,j))
        }).collect();
        targets.sort_by(|a,b|a.0.total_cmp(&b.0));targets.truncate(b.max_targets as usize);
        self.players[index].combat.hook_ready=now+b.cooldown_ms as f64;
        self.players[index].combat.action_until=now+self.settings.balance.control.switch_ms as f64;
        for (_,j) in targets {
            if self.apply_control(j,b.pull_ms+b.stun_ms,now) {
                let q=&mut self.players[j];q.motor.pull_left=b.pull_ms as f64/1000.0;
                q.motor.pull_x=anchor.x;q.motor.pull_z=anchor.z;q.motor.pull_speed=b.pull_speed_cm as f64/100.0;
            }
        }
        self.event(Event{id:0,at:now,kind:"hook",actor,target:None,from:Some(from),to:Some(add(from,dir,range)),hit:None,echo:None});true
    }
    pub fn switch_weapon(&mut self, index: usize, weapon: Weapon, now: f64) -> bool {
        if !self.combat_ready(index,now)||!self.settings.balance.weapon(weapon).enabled {return false;}
        let p=&mut self.players[index];
        if p.role!=Role::Seeker||weapon==p.combat.weapon||p.reload_until>now {return false;}
        p.combat.ammunition[p.combat.weapon.index()]=p.ammo;p.combat.weapon=weapon;
        p.ammo=p.combat.ammunition[weapon.index()];p.combat.action_until=now+self.settings.balance.control.switch_ms as f64;true
    }
    pub fn fire(&mut self, index: usize, now: f64) {
        if !self.combat_ready(index,now)||self.phase!=Phase::Playing {return;}
        let p=&self.players[index];let weapon=p.combat.weapon;let b=self.settings.balance.weapon(weapon);
        let unlimited=reload_ms(&self.settings,weapon)==0;
        if p.role!=Role::Seeker||!b.enabled||p.reload_until>now||p.combat.ready_at[weapon.index()]>now||(!unlimited&&p.ammo==0){return;}
        // Resource bounds depend only on public projectiles, never hidden hit outcomes.
        if weapon==Weapon::Web&&(self.projectiles.len()>=32||self.projectiles.iter().filter(|q|q.owner==p.id).count()>=12){return;}
        let actor=p.id.clone();let layout=map(self.settings.map_id);let (from,_,blocked)=muzzle(&p.motor,layout);
        let yaw=p.motor.yaw;let pitch=p.motor.pitch;let sequence=p.combat.shot_sequence;
        self.players[index].combat.shot_sequence=self.players[index].combat.shot_sequence.wrapping_add(1);
        self.players[index].shot_at=now;self.players[index].combat.ready_at[weapon.index()]=now+b.interval_ms as f64;
        self.players[index].ammo=if unlimited{b.magazine as u32}else{self.players[index].ammo-1};
        self.players[index].combat.ammunition[weapon.index()]=self.players[index].ammo;
        if weapon==Weapon::Web {
            let dir=physics::aim(yaw,pitch);let web=self.settings.balance.web;
            let range=if blocked{0.0}else{projectile_wall(from,dir,web.radius_cm as f64/100.0,layout,b.range_cm as f64/100.0)};
            if range>0.0 {
                self.entity_sequence+=1;self.projectiles.push(Projectile{id:self.entity_sequence,owner:actor.clone(),from,dir,
                    distance:0.0,range,speed:web.speed_cm as f64/100.0,radius:web.radius_cm as f64/100.0,active:true});
            }
            self.event(Event{id:0,at:now,kind:"web",actor,target:None,from:Some(from),to:None,hit:None,echo:None});return;
        }
        let mut victims=Vec::new();let mut bait=None;
        for pellet in 0..b.pellets {
            // Stable server pattern, independent of client-provided RNG or hit coordinates.
            let phase=((sequence.wrapping_mul(1664525).wrapping_add(pellet*1013904223))%10007) as f64/10007.0;
            let angle=phase*std::f64::consts::TAU;let spread=b.spread_mrad as f64/1000.0;
            let radius=if b.pellets>1&&pellet==0{0.0}else{spread*(0.35+0.65*phase.sqrt())};
            let dir=physics::aim(yaw+angle.cos()*radius,(pitch+angle.sin()*radius).clamp(-1.3,1.3));
            let wall=if blocked{0.0}else{physics::map_ray(from,dir,layout).min(b.range_cm as f64/100.0)};
            let mut nearest=wall;let mut victim=None;
            for (j,q) in self.players.iter().enumerate() {
                if q.role!=Role::Hider||!q.alive||q.joined_round!=self.round {continue;}
                if let Some(t)=physics::player_ray_crouched(from,dir,q.motor.position(),q.motor.crouched) {
                    if t<nearest {nearest=t;victim=Some(j);}
                }
            }
            let damaged=victim.is_some_and(|j|self.players[j].combat.shield_until<=now);
            if let Some(j)=victim {if damaged&&!victims.contains(&j){victims.push(j);}}
            if victim.is_none()&&self.settings.delay_ms>0 {
                bait=self.history.sample(now-self.settings.delay_ms as f64).into_iter().find(|q|q.alive&&q.role==Role::Hider
                    &&physics::player_ray_crouched(from,dir,q.position(),q.crouched).is_some_and(|t|t<wall)).map(|q|q.id);
            }
            // A tracer extends to cover/range, never to a hidden present-position hit.
            self.event(Event{id:0,at:now,kind:"shot",actor:actor.clone(),target:None,from:Some(from),to:Some(add(from,dir,wall)),hit:Some(damaged),echo:Some(bait.is_some())});
        }
        // One health decrement per victim per trigger, not seven shotgun instant-kill pellets.
        for j in victims {self.damage(index,j,b.damage as u32,now);}
        if let Some(id)=bait {
            if now-self.last_bait.get(&id).copied().unwrap_or(-1e9)>500.0 {
                if let Some(p)=self.player_mut(&id){if p.alive{p.baits+=1;}}self.last_bait.insert(id,now);
            }
        }
    }
    fn damage(&mut self, shooter: usize, victim: usize, amount: u32, now: f64) {
        if amount==0||self.players[victim].combat.shield_until>now {return;}
        let actor=self.players[shooter].id.clone();let target=self.players[victim].id.clone();
        let p=&mut self.players[victim];p.hp=p.hp.saturating_sub(amount);p.combat.hit_at=now;
        self.players[shooter].tags+=1;self.simple_event(now,"tag",actor.clone(),Some(target.clone()));
        if self.players[victim].hp==0 {
            self.players[victim].alive=false;self.players[victim].caught=true;
            self.simple_event(now,"catch",actor,Some(target));
        }
    }
    pub fn tick_combat_entities(&mut self, now: f64) {
        let layout=map(self.settings.map_id);let b=self.settings.balance;
        for k in 0..self.mines.len() {
            let m=&self.mines[k];
            if m.triggered_at.is_some()||now<m.armed_at||now>=m.expires_at {continue;}
            let from=add(m.position,Vec3{x:0.0,y:1.0,z:0.0},0.15);
            let victim=self.players.iter().enumerate().filter(|(_,p)|p.alive&&p.role==Role::Hider&&p.joined_round==self.round
                &&(p.motor.y-m.position.y).abs()<0.8&&(p.motor.x-m.position.x).hypot(p.motor.z-m.position.z)<=b.mine.trigger_radius_cm as f64/100.0)
                .find(|(_,p)|{let to=add(p.motor.position(),Vec3{x:0.0,y:1.0,z:0.0},0.4);
                    physics::map_ray(from,toward(from,to),layout)>=distance(from,to)-0.05});
            if let Some((j,_))=victim {self.mines[k].triggered_at=Some(now);self.apply_control(j,b.mine.root_ms,now);}
        }
        self.mines.retain(|m|now<m.expires_at&&m.triggered_at.is_none_or(|t|now<t+self.settings.delay_ms as f64+100.0));
        for k in 0..self.projectiles.len() {
            let p=&self.projectiles[k];let from=add(p.from,p.dir,p.distance);
            let length=(p.speed/rules().tick_rate as f64).min(p.range-p.distance).max(0.0);
            let mut nearest=length;let mut victim=None;
            if p.active {
                for (j,q) in self.players.iter().enumerate() {
                    if !q.alive||q.role!=Role::Hider||q.joined_round!=self.round {continue;}
                    let v=q.motor.position();let r=0.38+p.radius;
                    if let Some(t)=physics::ray_box(from,p.dir,Vec3{x:v.x-r,y:v.y+0.08-p.radius,z:v.z-r},
                        Vec3{x:v.x+r,y:v.y+physics::height(q.motor.crouched)+p.radius,z:v.z+r}) {
                        if t<=nearest {nearest=t;victim=Some(j);}
                    }
                }
            }
            self.projectiles[k].distance+=length;
            if let Some(j)=victim {self.projectiles[k].active=false;self.apply_control(j,b.web.root_ms,now);}
            // Cosmetic flight continues to its predetermined wall endpoint after a hit.
        }
        self.projectiles.retain(|p|p.distance<p.range-0.001);
    }
    pub fn mine_views(&self, viewer: &Player, now: f64) -> Vec<MineView> {
        self.mines.iter().filter(|m|now<m.expires_at&&m.triggered_at.is_none_or(|t|viewer.role==Role::Seeker&&now<t+self.settings.delay_ms as f64))
            .map(|m|MineView{id:m.id,owner:m.owner.clone(),x:m.position.x,y:m.position.y,z:m.position.z,armed:now>=m.armed_at}).collect()
    }
    pub fn projectile_views(&self) -> Vec<ProjectileView> {
        self.projectiles.iter().map(|p|{let v=add(p.from,p.dir,p.distance);
            ProjectileView{id:p.id,owner:p.owner.clone(),x:v.x,y:v.y,z:v.z,radius:p.radius}}).collect()
    }
}
