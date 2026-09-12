use echo_core::{history::History, map, movement, physics, room::{Player,Room}, rules,
    BunnyHop, Input, MapId, Motor, Phase, Preference, Role, Settings, Vec3};
use serde::Deserialize;

const NOW:f64=20_000.0;
fn pair(settings:Settings)->Room {
    let mut room=Room::new("MAP234".into(),false,false,Settings{seeker_count:1,..settings});
    room.bots_enabled=false;
    for (id,pref) in [("s",Preference::Seeker),("h",Preference::Hider)] {
        assert!(room.add(Player::new(id.into(),id.into(),false,pref,NOW)));
    }
    assert!(room.start(NOW));room.phase=Phase::Playing;room.ends_at=NOW+180_000.0;room
}
fn at_mirror(room:&mut Room,index:usize,mirror:usize) {
    let p=&map(room.settings.map_id).mirrors[mirror];
    room.players[index].motor=Motor::new(Vec3{x:p.x,y:p.y,z:p.z});
}
#[test]
fn mirror_warps_to_paired_clear_exit_without_resetting_dash_or_stamina() {
    let mut room=pair(Settings::default());at_mirror(&mut room,1,0);
    room.players[1].motor.stamina=27.0;room.players[1].motor.dash_cooldown=2.0;
    room.players[1].motor.vx=10.0;room.players[1].motor.yaw=1.2;
    let source=&map(room.settings.map_id).mirrors[0];
    let exit=map(room.settings.map_id).mirrors.iter().find(|p|p.id==source.target).unwrap().exit;
    assert!(room.use_mirror(1,NOW));let p=&room.players[1];
    assert_eq!(p.motor.position(),exit);assert_eq!(p.motor.warp,1);
    assert_eq!(p.motor.vx,0.0);assert_eq!(p.motor.yaw,1.2);
    assert_eq!(p.motor.stamina,27.0);assert_eq!(p.motor.dash_cooldown,2.0);
    assert_eq!(p.mirror_until,NOW+60_000.0);
}
#[test]
fn mirror_cooldown_is_per_player_and_shared_across_pairs() {
    let mut room=pair(Settings{map_id:MapId::Switchyard,..Settings::default()});
    at_mirror(&mut room,1,0);assert!(room.use_mirror(1,NOW));
    at_mirror(&mut room,1,2);assert!(!room.use_mirror(1,NOW+59_999.0));
    at_mirror(&mut room,0,2);assert!(!room.use_mirror(0,NOW+1.0));
    let cast=room.settings.balance.teleport.seeker_cast_ms as f64;
    assert!(!room.use_mirror(0,NOW+cast));
    assert!(room.use_mirror(0,NOW+1.0+cast));
    assert_eq!(room.players[0].mirror_until,NOW+1.0+cast+room.settings.balance.teleport.seeker_cooldown_ms as f64);
    assert!(room.use_mirror(1,NOW+60_000.0));
}
#[test]
fn mirror_checks_proximity_alive_role_and_phase() {
    let mut room=pair(Settings::default());assert!(!room.use_mirror(1,NOW));
    at_mirror(&mut room,1,0);room.players[1].alive=false;assert!(!room.use_mirror(1,NOW));
    room.players[1].alive=true;room.phase=Phase::Lobby;assert!(!room.use_mirror(1,NOW));
    room.phase=Phase::Headstart;at_mirror(&mut room,0,0);assert!(!room.use_mirror(0,NOW));
    assert!(room.use_mirror(1,NOW));assert!(!room.use_mirror(100,NOW));
}
#[test]
fn held_interact_cannot_repeat_even_with_zero_cooldown() {
    let mut room=pair(Settings{mirror_cooldown_ms:0,..Settings::default()});at_mirror(&mut room,1,0);
    room.players[1].set_input(Input{seq:1,interact:true,..Input::default()},NOW);
    room.tick(NOW);assert_eq!(room.players[1].motor.warp,1);
    // Put the player back in range without changing their warp marker.
    let m=&map(room.settings.map_id).mirrors[0];room.players[1].motor.x=m.x;room.players[1].motor.z=m.z;
    room.players[1].set_input(Input{seq:2,interact:true,..Input::default()},NOW+17.0);
    room.tick(NOW+17.0);assert_eq!(room.players[1].motor.warp,1);
    room.players[1].set_input(Input{seq:3,..Input::default()},NOW+34.0);room.tick(NOW+34.0);
    room.players[1].set_input(Input{seq:4,interact:true,..Input::default()},NOW+51.0);room.tick(NOW+51.0);
    assert_eq!(room.players[1].motor.warp,2);
}
#[test]
fn teleport_is_withheld_and_history_does_not_smear_between_exits() {
    let mut room=pair(Settings{delay_ms:3000,..Settings::default()});at_mirror(&mut room,1,0);
    room.history.clear();let old=room.players[1].pose(NOW);room.history.record(NOW-1.0,vec![old.clone()]);
    assert!(room.use_mirror(1,NOW));let warped=room.players[1].pose(NOW);room.history.record(NOW,vec![warped.clone()]);
    assert_eq!(room.history.sample(NOW-0.5)[0].position(),old.position());
    let before=room.snapshot_for("s",NOW+2999.0).unwrap();assert_eq!(before.players[0].position(),old.position());
    assert!(!before.events.iter().any(|e|e.kind=="teleport"));
    let after=room.snapshot_for("s",NOW+3000.0).unwrap();assert_eq!(after.players[0].position(),warped.position());
    assert!(after.events.iter().any(|e|e.kind=="teleport"));
    assert!(room.snapshot_for("h",NOW).unwrap().events.iter().any(|e|e.kind=="teleport"));
}
#[test]
fn remote_metadata_does_not_publish_current_mirror_cooldowns_or_warp_markers() {
    let mut room=pair(Settings::default());at_mirror(&mut room,1,0);room.use_mirror(1,NOW);
    let value=serde_json::to_value(room.snapshot_for("s",NOW).unwrap()).unwrap();
    for p in value["roster"].as_array().unwrap(){for key in ["mirrorLeft","mirrorUntil","warp","crouched","x","y","z"]{assert!(p.get(key).is_none());}}
}
#[test]
fn no_reload_mode_keeps_fire_rate_and_infinite_magazine() {
    let mut room=pair(Settings{reload_ms:0,..Settings::default()});
    room.players[0].motor=Motor::new(Vec3{x:20.0,y:0.0,z:10.0});room.players[1].motor.x=10.0;
    for i in 0..100{let at=NOW+i as f64*room.settings.balance.weapons.blaster.interval_ms as f64;room.fire(0,at);room.fire(0,at+1.0);}
    assert_eq!(room.players[0].ammo,rules().magazine);assert_eq!(room.players[0].reload_until,0.0);
    // The first duplicate must not generate a second event.
    let mut r=pair(Settings{reload_ms:0,..Settings::default()});r.fire(0,NOW);r.fire(0,NOW+1.0);
    assert_eq!(r.snapshot_for("s",NOW+1.0).unwrap().events.iter().filter(|e|e.kind=="shot").count(),1);
}
#[test]
fn custom_reload_is_used_instead_of_global_duration() {
    let mut room=pair(Settings{reload_ms:400,..Settings::default()});room.players[0].ammo=1;
    room.players[0].set_input(Input{seq:1,reload:true,..Input::default()},NOW);room.tick(NOW);
    assert_eq!(room.players[0].reload_until,NOW+400.0);room.tick(NOW+399.0);assert_eq!(room.players[0].ammo,1);
    room.tick(NOW+400.0);assert_eq!(room.players[0].ammo,rules().magazine);
}
#[test]
fn crouch_hitbox_is_lower_and_shots_still_hit_current_body() {
    let mut room=pair(Settings::default());room.players[0].motor=Motor::new(Vec3{x:20.0,y:0.0,z:10.0});
    room.players[1].motor=Motor::new(Vec3{x:20.0,y:0.0,z:0.0});room.players[1].motor.crouched=true;
    room.fire(0,NOW);assert_eq!(room.players[1].hp,2); // Standing aim passes above a crouched target.
    room.players[0].motor.pitch=(-1.0_f64).atan2(10.0);room.fire(0,NOW+room.settings.balance.weapons.blaster.interval_ms as f64);assert_eq!(room.players[1].hp,1);
    assert!(physics::eye(true)<physics::eye(false));
}
#[test]
fn map_change_is_host_only_between_rounds_and_clears_old_history() {
    let mut room=pair(Settings::default());let next=Settings{map_id:MapId::Glassworks,..room.settings};
    assert!(room.configure("s",next).is_err());room.lobby("s").unwrap();assert!(room.configure("h",next).is_err());
    let pose=room.players[1].pose(NOW);room.history.record(NOW,vec![pose]);
    room.configure("s",next).unwrap();assert!(room.history.sample(NOW).is_empty());
    assert_eq!(room.players[0].motor.position(),map(MapId::Glassworks).spawns[0]);
}
#[test]
fn map_data_has_clear_spawns_and_reciprocal_mirrors() {
    for id in [MapId::Afterhours,MapId::Switchyard,MapId::Glassworks]{let layout=map(id);
        assert_eq!(layout.spawns.len(),12);
        for p in layout.spawns.iter().chain(layout.mirrors.iter().map(|m|&m.exit)) {
            assert!(physics::can_occupy(*p,rules().height,&layout.boxes));
            assert!(p.x.abs()+rules().radius<layout.half&&p.z.abs()+rules().radius<layout.half);
        }
        for m in &layout.mirrors{assert_eq!(layout.mirrors.iter().find(|q|q.id==m.target).unwrap().target,m.id);}
    }
}
#[test]
fn new_settings_validate_and_legacy_messages_get_defaults() {
    for s in [Settings{reload_ms:10001,..Settings::default()},Settings{dash_cooldown_ms:30001,..Settings::default()},Settings{mirror_cooldown_ms:180001,..Settings::default()}]{assert!(s.validate().is_err());}
    let old:Settings=serde_json::from_str(r#"{"delayMs":1250,"roundMs":180000,"seekerCount":1}"#).unwrap();assert_eq!(old.mirror_cooldown_ms,60000);
    assert!(serde_json::from_str::<Settings>(r#"{"mapId":"unknown"}"#).is_err());
    assert!(serde_json::from_str::<Settings>(r#"{"bunnyHop":"unknown"}"#).is_err());
    assert!(serde_json::from_str::<Input>(r#"{"crouch":"true"}"#).is_err());
    assert!(serde_json::from_str::<Input>(r#"{"interact":true,"x":100}"#).is_err());
}
#[test]
fn bunny_hop_auto_repeats_timed_hold_does_not() {
    for mode in [BunnyHop::Off,BunnyHop::Timed,BunnyHop::Auto]{
        let mut s=Motor::new(Vec3::default());let options=Settings{bunny_hop:mode,..Settings::default()};let mut jumps=0;
        for _ in 0..180{let grounded=s.grounded;physics::step_in(&mut s,&Input{jump:true,..Input::default()},Role::Hider,&[],1000.0,&options);if grounded&&!s.grounded&&s.vy>0.0{jumps+=1;}}
        if mode==BunnyHop::Auto{assert!(jumps>=3);}else{assert_eq!(jumps,1);}
    }
}
#[test]
fn history_is_discontinuous_on_warp_marker() {
    let mut h=History::default();let room=pair(Settings::default());let a=room.players[1].pose(NOW);let mut b=a.clone();b.x+=60.0;b.warp+=1;
    h.record(0.0,vec![a.clone()]);h.record(100.0,vec![b.clone()]);assert_eq!(h.sample(99.0)[0].x,a.x);assert_eq!(h.sample(100.0)[0].x,b.x);
    assert_eq!(movement().mirror_radius,1.8);
}
#[derive(Deserialize)]struct Fixtures{cases:Vec<Case>}
#[derive(Deserialize)]struct Case{name:String,start:Vec3,role:Role,settings:Settings,segments:Vec<Segment>}
#[derive(Deserialize)]struct Segment{ticks:usize,input:Input,expected:Motor}
#[test]
fn new_gameplay_javascript_rust_parity() {
    let fixtures:Fixtures=serde_json::from_str(include_str!("../../../tests/fixtures/gameplay.json")).unwrap();
    for c in fixtures.cases{let mut motor=Motor::new(c.start);for segment in c.segments{
        for _ in 0..segment.ticks{physics::step_configured(&mut motor,&segment.input,c.role,&c.settings);}
        let actual=serde_json::to_value(&motor).unwrap();let expected=serde_json::to_value(segment.expected).unwrap();
        for(key,value)in expected.as_object().unwrap(){
            if let Some(n)=value.as_f64(){assert!((actual[key].as_f64().unwrap()-n).abs()<1e-7,"{} {key}: {} != {n}",c.name,actual[key]);}
            else{assert_eq!(&actual[key],value,"{} {key}",c.name);}
        }
    }}
}
