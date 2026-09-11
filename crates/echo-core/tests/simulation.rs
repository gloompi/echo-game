use echo_core::{arena, history::History, physics, room::{Player,Room}, rules, Input, Motor, Phase, Pose, Preference, Role, Settings, Vec3};
use serde::Deserialize;

const NOW:f64=10_000.0;
fn player(id:&str,pref:Preference)->Player {Player::new(id.into(),id.into(),false,pref,NOW)}
fn pair(delay:u64)->Room {
    let mut r=Room::new("ABC234".into(),false,false,Settings{delay_ms:delay,seeker_count:1,..Settings::default()});
    r.bots_enabled=false;assert!(r.add(player("s",Preference::Seeker)));assert!(r.add(player("h",Preference::Hider)));assert!(r.start(NOW));
    r.phase=Phase::Playing;r.ends_at=NOW+180_000.0;
    r.player_mut("s").unwrap().motor=Motor::new(Vec3{x:20.0,y:0.0,z:10.0});
    r.player_mut("h").unwrap().motor=Motor::new(Vec3{x:20.0,y:0.0,z:0.0});r.history.clear();r
}
fn pose(x:f64)->Pose {player("h",Preference::Hider).pose(0.0).with_x(x)}
trait PoseX {fn with_x(self,x:f64)->Self;}
impl PoseX for Pose {fn with_x(mut self,x:f64)->Self{self.x=x;self}}
#[test]fn warmup_never_substitutes_live_positions(){let mut h=History::default();h.record(1000.0,vec![pose(9.0)]);assert!(h.sample(999.0).is_empty());}
#[test]fn history_interpolates_and_copies(){let mut h=History::default();h.record(1000.0,vec![pose(0.0)]);h.record(2000.0,vec![pose(10.0)]);let mut p=h.sample(1500.0);assert_eq!(p[0].x,5.0);p[0].x=99.0;assert_eq!(h.sample(1500.0)[0].x,5.0);}
#[test]fn history_shortest_angle(){let mut h=History::default();let mut a=pose(0.0);a.yaw=std::f64::consts::PI-0.1;let mut b=a.clone();b.yaw=-std::f64::consts::PI+0.1;h.record(0.0,vec![a]);h.record(100.0,vec![b]);assert!((h.sample(50.0)[0].yaw-std::f64::consts::PI).abs()<1e-9);}
#[test]fn history_clear_removes_previous_round(){let mut h=History::default();h.record(0.0,vec![pose(1.0)]);h.clear();assert!(h.sample(10.0).is_empty());}
#[test]fn all_configurable_delay_boundaries(){
    for delay in [0,250,1250,3000,10000]{
        let mut r=pair(delay);let now=25_000.0;
        r.player_mut("h").unwrap().motor.x=14.0;
        if delay>0{r.history.record(now-delay as f64,vec![r.player("h").unwrap().pose(now).with_x(20.0)]);}
        r.history.record(now,vec![r.player("h").unwrap().pose(now)]);
        let s=r.snapshot_for("s",now).unwrap();assert_eq!(s.players[0].x,if delay==0{14.0}else{20.0});
        assert_eq!(s.view_time,now-delay as f64);assert_eq!(s.self_state.motor.x,20.0);assert!(s.echo.is_none());
    }
}
#[test]fn missing_history_omits_hiders(){let r=pair(10000);assert!(r.snapshot_for("s",NOW).unwrap().players.is_empty());}
#[test]fn hider_gets_live_seekers_and_own_echo(){let mut r=pair(1250);r.history.record(NOW,vec![r.player("h").unwrap().pose(NOW)]);r.player_mut("s").unwrap().motor.x=19.0;r.player_mut("h").unwrap().motor.x=14.0;let s=r.snapshot_for("h",NOW+1250.0).unwrap();assert_eq!(s.players[0].x,19.0);assert_eq!(s.echo.unwrap().x,20.0);assert_eq!(s.self_state.motor.x,14.0);}
#[test]fn allied_seekers_are_live_without_hider_leaks(){let mut r=pair(3000);r.add(player("ally",Preference::Seeker));let round=r.round;let p=r.player_mut("ally").unwrap();p.role=Role::Seeker;p.joined_round=round;p.alive=true;p.motor.x=7.0;let s=r.snapshot_for("s",NOW).unwrap();assert_eq!(s.players.len(),1);assert_eq!(s.players[0].id,"ally");assert_eq!(s.players[0].x,7.0);}
#[test]fn roster_is_non_spatial(){let r=pair(3000);let json=serde_json::to_value(r.snapshot_for("s",NOW).unwrap()).unwrap();for p in json["roster"].as_array().unwrap(){for key in ["x","y","z","vx","vy","vz","yaw","pitch","motor"]{assert!(p.get(key).is_none());}}}
#[test]fn room_settings_host_only_and_frozen_during_round(){let mut r=pair(3000);let settings=Settings{delay_ms:1250,..r.settings};assert!(r.configure("h",settings).is_err());assert!(r.configure("s",settings).is_err());r.lobby("s").unwrap();let version=r.settings_version;r.configure("s",settings).unwrap();assert_eq!(r.settings.delay_ms,1250);assert_eq!(r.settings_version,version+1);}
#[test]fn settings_reject_invalid_ranges_and_fractional_milliseconds(){for value in [Settings{delay_ms:10001,..Settings::default()},Settings{round_ms:29999,..Settings::default()},Settings{round_ms:600001,..Settings::default()},Settings{seeker_count:0,..Settings::default()},Settings{seeker_count:4,..Settings::default()}]{assert!(value.validate().is_err());}assert!(serde_json::from_str::<Settings>(r#"{"delayMs":0.5,"roundMs":180000,"seekerCount":1}"#).is_err());}
#[test]fn headstart_covers_long_delay(){let mut r=pair(10000);r.lobby("s").unwrap();assert!(r.start(NOW));assert_eq!(r.ends_at,NOW+10000.0);}
#[test]fn host_cannot_return_room_as_another_player(){let mut r=pair(3000);assert!(r.lobby("h").is_err());assert_eq!(r.phase,Phase::Playing);}
#[test]fn captures_use_present_not_echo(){let mut r=pair(3000);r.history.record(NOW,vec![r.player("h").unwrap().pose(NOW).with_x(14.0)]);r.fire(0,NOW+3000.0);assert_eq!(r.player("h").unwrap().hp,1);assert_eq!(r.player("s").unwrap().tags,1);}
#[test]fn shooting_only_echo_misses_and_awards_bait(){let mut r=pair(3000);r.history.record(NOW,vec![r.player("h").unwrap().pose(NOW)]);r.player_mut("h").unwrap().motor.x=14.0;r.fire(0,NOW+3000.0);assert_eq!(r.player("h").unwrap().hp,2);assert_eq!(r.player("h").unwrap().baits,1);assert!(r.snapshot_for("s",NOW+3000.0).unwrap().events.iter().any(|e|e.echo==Some(true)));}
#[test]fn cover_blocks_present_hits(){let mut r=pair(3000);r.player_mut("s").unwrap().motor=Motor::new(Vec3{x:0.0,y:0.0,z:8.0});r.player_mut("h").unwrap().motor=Motor::new(Vec3{x:0.0,y:0.0,z:-8.0});r.fire(0,NOW);assert_eq!(r.player("h").unwrap().hp,2);}
#[test]fn closest_hider_is_hit(){let mut r=pair(3000);r.add(player("near",Preference::Hider));let round=r.round;let p=r.player_mut("near").unwrap();p.joined_round=round;p.alive=true;p.motor=Motor::new(Vec3{x:20.0,y:0.0,z:5.0});r.fire(0,NOW);assert_eq!(r.player("near").unwrap().hp,1);assert_eq!(r.player("h").unwrap().hp,2);}
#[test]fn fire_rate_magazine_and_role_are_authoritative(){let mut r=pair(3000);r.player_mut("h").unwrap().motor.x=14.0;r.fire(0,NOW);r.fire(0,NOW+1.0);assert_eq!(r.player("s").unwrap().ammo,11);for i in 1..20{r.fire(0,NOW+i as f64*rules().fire_interval as f64);}assert_eq!(r.player("s").unwrap().ammo,0);r.fire(1,NOW);assert_eq!(r.player("h").unwrap().ammo,12);}
#[test]fn two_hits_capture_and_finish(){let mut r=pair(3000);r.fire(0,NOW);r.fire(0,NOW+200.0);assert!(!r.player("h").unwrap().alive);r.tick(NOW+201.0);assert_eq!(r.winner,Some(Role::Seeker));let ammo=r.player("s").unwrap().ammo;r.fire(0,NOW+500.0);assert_eq!(r.player("s").unwrap().ammo,ammo);}
#[test]fn own_shot_immediate_but_remote_spatial_effects_delayed(){let mut r=pair(1250);let input=Input{seq:1,wave:true,..Input::default()};assert!(r.player_mut("h").unwrap().set_input(input,NOW));r.tick(NOW);assert!(r.snapshot_for("s",NOW+1249.0).unwrap().events.iter().all(|e|e.kind!="wave"));assert!(r.snapshot_for("s",NOW+1250.0).unwrap().events.iter().any(|e|e.kind=="wave"));r.fire(0,NOW+1300.0);assert!(r.snapshot_for("s",NOW+1300.0).unwrap().events.iter().any(|e|e.kind=="shot"));}
#[test]fn input_flood_cannot_simulate_extra_ticks(){let mut r=pair(3000);for seq in 1..100{assert!(r.player_mut("h").unwrap().set_input(Input{seq,mz:1.0,..Input::default()},NOW));}let before=r.player("h").unwrap().motor.z;r.tick(NOW+17.0);let p=r.player("h").unwrap();assert_eq!(p.ack,1);assert!((p.motor.z-before).abs()<0.12);}
#[test]fn duplicate_far_ahead_and_invalid_inputs_rejected(){let mut p=player("h",Preference::Hider);assert!(p.set_input(Input{seq:1,..Input::default()},NOW));assert!(!p.set_input(Input{seq:1,..Input::default()},NOW));assert!(!p.set_input(Input{seq:99999,..Input::default()},NOW));assert!(!p.set_input(Input{seq:2,mx:f64::NAN,..Input::default()},NOW));assert!(!p.set_input(Input{seq:2,mx:2.0,..Input::default()},NOW));}
#[test]fn late_private_join_spectates(){let mut r=pair(3000);r.add(player("late",Preference::Auto));let s=r.snapshot_for("late",NOW).unwrap();assert!(s.self_state.spectating);assert!(!s.self_state.alive);}
#[test]fn public_join_enters_as_hider(){let mut r=pair(3000);r.public=true;r.add(player("late",Preference::Auto));assert!(r.player("late").unwrap().alive);assert!(!r.snapshot_for("late",NOW).unwrap().self_state.spectating);}
#[test]fn capacity_twelve_and_host_transfer(){let mut r=pair(3000);for i in 0..10{assert!(r.add(player(&format!("p{i}"),Preference::Auto)));}assert!(!r.add(player("overflow",Preference::Auto)));r.remove("s");assert_eq!(r.host,"h");}
#[test]fn timeout_returns_to_lobby_not_an_unconfigurable_autostart(){let mut r=pair(3000);r.ends_at=NOW+10.0;r.tick(NOW+11.0);assert_eq!(r.winner,Some(Role::Hider));r.tick(r.ends_at+1.0);assert_eq!(r.phase,Phase::Lobby);assert_eq!(r.round,1);}
#[test]fn headstart_freezes_seekers(){let mut r=pair(3000);r.phase=Phase::Headstart;r.ends_at=NOW+5000.0;for id in ["s","h"]{r.player_mut(id).unwrap().set_input(Input{seq:1,mz:1.0,shoot:true,..Input::default()},NOW);}r.tick(NOW+17.0);assert_eq!(r.player("s").unwrap().motor.z,10.0);assert_eq!(r.player("s").unwrap().ammo,12);assert!(r.player("h").unwrap().motor.z<0.0);}
#[test]fn reload_duration(){let mut r=pair(3000);let p=r.player_mut("s").unwrap();p.ammo=3;p.set_input(Input{seq:1,reload:true,..Input::default()},NOW);r.tick(NOW);assert_eq!(r.player("s").unwrap().reload_until,NOW+1500.0);r.tick(NOW+1499.0);assert_eq!(r.player("s").unwrap().ammo,3);r.tick(NOW+1500.0);assert_eq!(r.player("s").unwrap().ammo,12);}
#[test]fn roles_rotate_and_leave_at_least_one_hider(){let mut r=pair(3000);for p in &mut r.players{p.preference=Preference::Auto;}r.lobby("s").unwrap();r.settings.seeker_count=3;r.start(NOW);assert_eq!(r.players.iter().filter(|p|p.role==Role::Seeker).count(),1);let previous=r.players[0].role;r.lobby("s").unwrap();r.start(NOW);assert_ne!(r.players[0].role,previous);}
#[test]fn all_spawn_points_are_clear(){for p in &arena().spawns{assert!(arena().boxes.iter().all(|b|!physics::overlaps(p.x,p.z,b,rules().radius)||p.y>=b.y+b.h));}}
#[derive(Deserialize)]struct Fixtures{cases:Vec<Case>}
#[derive(Deserialize)]struct Case{name:String,start:Vec3,role:Role,segments:Vec<Segment>}
#[derive(Deserialize)]struct Segment{ticks:usize,input:Input,expected:Motor}
#[test]fn javascript_rust_motor_parity(){
    let fixtures:Fixtures=serde_json::from_str(include_str!("../../../tests/fixtures/movement.json")).unwrap();
    for case in fixtures.cases{let mut motor=Motor::new(case.start);for segment in case.segments{for _ in 0..segment.ticks{physics::step(&mut motor,&segment.input,case.role);}let actual=serde_json::to_value(&motor).unwrap();let expected=serde_json::to_value(segment.expected).unwrap();for (key,value) in expected.as_object().unwrap(){if let Some(number)=value.as_f64(){assert!((actual[key].as_f64().unwrap()-number).abs()<1e-7,"{} {key}: {} != {number}",case.name,actual[key]);}else{assert_eq!(&actual[key],value,"{} {key}",case.name);}}}}
}
