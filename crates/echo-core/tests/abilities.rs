//! Authoritative regression tests for the new combat module. Requires cargo test.
use echo_core::{balance::{Balance,Skin,Weapon},map,room::{Player,Room},Input,Motor,Phase,Preference,Settings,Vec3};
const NOW:f64=20000.0;
fn pair()->Room{
 let mut r=Room::new("NEW234".into(),false,false,Settings{seeker_count:1,..Settings::default()});r.bots_enabled=false;
 for(id,pref)in[("s",Preference::Seeker),("h",Preference::Hider)]{assert!(r.add(Player::new(id.into(),id.into(),false,pref,NOW)));}
 assert!(r.start(NOW));r.phase=Phase::Playing;r.ends_at=NOW+180000.0;r.history.clear();
 r.players[0].motor=Motor::new(Vec3{x:20.0,y:0.0,z:10.0});r.players[1].motor=Motor::new(Vec3{x:20.0,y:0.0,z:0.0});r
}
#[test]fn shared_balance_and_typed_messages_reject_invalid_values(){
 assert!(Balance::default().validate().is_ok());let mut b=Balance::default();b.shield.duration_ms=b.shield.cooldown_ms;assert!(b.validate().is_err());
 assert!(serde_json::from_str::<Input>(r#"{"ability":true,"weapon":"hacked"}"#).is_err());
 assert!(serde_json::from_str::<Input>(r#"{"ability":true,"x":99}"#).is_err());
}
#[test]fn shield_is_proactive_and_does_not_break_existing_control(){
 let mut r=pair();assert!(r.apply_control(1,1000,NOW));assert!(!r.activate_shield(1,NOW));
 r.players[1].motor.control_left=0.0;assert!(r.activate_shield(1,NOW+1001.0));assert!(!r.apply_control(1,1000,NOW+1002.0));
 assert!(!r.activate_shield(0,NOW+1001.0));assert!(!r.activate_shield(1,NOW+1002.0));
}
#[test]fn shield_blocks_present_position_damage_but_expires(){
 let mut r=pair();assert!(r.activate_shield(1,NOW));r.fire(0,NOW);assert_eq!(r.players[1].hp,2);
 r.fire(0,NOW+2001.0);assert_eq!(r.players[1].hp,1);
}
#[test]fn crowd_control_cannot_be_extended_or_chained_without_a_recovery_window(){
 let mut r=pair();assert!(r.apply_control(1,1000,NOW));assert!(!r.apply_control(1,5000,NOW+1.0));
 assert_eq!(r.players[1].motor.control_left,1.0);r.players[1].motor.control_left=0.0;
 assert!(!r.apply_control(1,1000,NOW+1001.0));assert!(r.apply_control(1,1000,NOW+2501.0));
}
#[test]fn mines_arm_and_root_without_damage_or_early_removal_for_seekers(){
 let mut r=pair();assert!(r.place_mine(0,NOW));r.players[1].motor=r.players[0].motor.clone();
 r.tick_combat_entities(NOW+899.0);assert_eq!(r.players[1].motor.control_left,0.0);
 r.tick_combat_entities(NOW+900.0);assert!(r.players[1].motor.control_left>0.0);assert_eq!(r.players[1].hp,2);
 assert_eq!(r.snapshot_for("s",NOW+900.0).unwrap().mines.len(),1);
 assert_eq!(r.snapshot_for("h",NOW+900.0).unwrap().mines.len(),0);
 assert_eq!(r.snapshot_for("s",NOW+3900.0).unwrap().mines.len(),0);
}
#[test]fn hook_affects_multiple_bodies_in_its_corridor_including_allies(){
 let mut r=pair();let mut ally=Player::new("ally".into(),"Ally".into(),false,Preference::Seeker,NOW);
 ally.motor=Motor::new(Vec3{x:20.0,y:0.0,z:6.0});r.add(ally);let round=r.round;
 let p=r.player_mut("ally").unwrap();p.role=echo_core::Role::Seeker;p.alive=true;p.joined_round=round;p.motor=Motor::new(Vec3{x:20.0,y:0.0,z:6.0});
 assert!(r.use_hook(0,NOW));assert!(r.players[1].motor.pull_left>0.0);assert!(r.player("ally").unwrap().motor.pull_left>0.0);
 assert!(!r.use_hook(0,NOW+1.0));assert_eq!(r.players[1].hp,2);
}
#[test]fn weapon_muzzle_is_offset_from_the_camera_and_trace_does_not_end_on_hidden_body(){
 let mut r=pair();r.fire(0,NOW);let snapshot=r.snapshot_for("s",NOW).unwrap();let e=snapshot.events.iter().find(|e|e.kind=="shot").unwrap();
 assert!(e.from.unwrap().x>20.2);assert!(e.from.unwrap().z<9.1);assert!(e.to.unwrap().z< -10.0);assert!(e.target.is_none());
}
#[test]fn weapon_switching_preserves_independent_ammunition_and_has_recovery(){
 let mut r=pair();r.fire(0,NOW);assert_eq!(r.players[0].ammo,11);
 assert!(r.switch_weapon(0,Weapon::Scatter,NOW+1.0));assert_eq!(r.players[0].ammo,4);
 r.fire(0,NOW+2.0);assert_eq!(r.players[0].ammo,4);
 assert!(r.switch_weapon(0,Weapon::Blaster,NOW+1000.0));assert_eq!(r.players[0].ammo,11);
}
#[test]fn web_has_travel_time_and_never_deals_damage(){
 let mut r=pair();assert!(r.switch_weapon(0,Weapon::Web,NOW));r.fire(0,NOW+1000.0);
 assert_eq!(r.players[1].motor.control_left,0.0);assert_eq!(r.projectiles.len(),1);
 for i in 1..=35{r.tick_combat_entities(NOW+1000.0+i as f64*1000.0/60.0);}
 assert!(r.players[1].motor.control_left>0.0);assert_eq!(r.players[1].hp,2);
}
#[test]fn scan_does_not_publish_live_hider_coordinates(){
 let mut r=pair();let mut past=r.players[1].pose(NOW-3000.0);past.x=12.0;r.history.record(NOW-3000.0,vec![past]);
 assert!(r.activate_scan(0,NOW));assert!(!r.activate_scan(1,NOW));let s=r.snapshot_for("s",NOW).unwrap();
 assert_eq!(s.players[0].x,12.0);assert!(s.self_state.abilities.scan_left>0.0);
 let json=serde_json::to_value(s).unwrap();assert!(json["roster"][1].get("x").is_none());
}
#[test]fn seeker_teleport_has_a_separate_cast_and_cooldown(){
 let mut r=pair();let mirror=&map(r.settings.map_id).mirrors[0];r.players[0].motor=Motor::new(Vec3{x:mirror.x,y:mirror.y,z:mirror.z});
 assert!(!r.use_mirror(0,NOW));assert!(!r.use_mirror(0,NOW+399.0));assert!(r.use_mirror(0,NOW+400.0));
 assert_eq!(r.players[0].mirror_until,NOW+20400.0);
}
#[test]fn movement_cancels_a_seeker_teleport_channel(){
 let mut r=pair();let mirror=&map(r.settings.map_id).mirrors[0];r.players[0].motor=Motor::new(Vec3{x:mirror.x,y:mirror.y,z:mirror.z});
 assert!(!r.use_mirror(0,NOW));r.players[0].set_input(Input{seq:1,mz:1.0,..Input::default()},NOW+10.0);r.tick(NOW+10.0);
 assert!(r.players[0].combat.cast_origin.is_none());assert_eq!(r.players[0].motor.warp,0);
}
#[test]fn skins_are_cosmetic_and_lobby_only(){
 let mut r=pair();assert!(r.set_skin("h",Skin::Jade).is_err());r.lobby("s").unwrap();assert!(r.set_skin("h",Skin::Jade).is_ok());
 assert_eq!(r.players[1].skin,Skin::Jade);assert_eq!(r.players[1].hp,2);
}
