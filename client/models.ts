import * as T from 'three';
import type { Skin, Weapon } from '../shared/balance.js';
import { eyeHeight } from '../shared/physics.js';
import type { Pose, Role } from '../shared/types.js';
const cube = new T.BoxGeometry(1, 1, 1);
const outlineMat = new T.MeshBasicMaterial({ color: 0x080d1b, side: T.BackSide });
const ghostBodyMat = new T.MeshBasicMaterial({color:0xf452e8,transparent:true,opacity:.23,depthWrite:false,side:T.FrontSide});
const ghostOutlineMat = new T.MeshBasicMaterial({color:0x59ffed,transparent:true,opacity:.6,depthWrite:false,side:T.BackSide});
const ghostRingGeometry = new T.RingGeometry(.45,.48,32);
const ghostRingMaterial = new T.MeshBasicMaterial({color:0xe657ed,transparent:true,opacity:.65,side:T.DoubleSide,depthWrite:false});
const mats = new Map<number, T.MeshStandardMaterial>();
const shirts = new Set([0xf4eee7,0xf3ece5]), trousers = new Set([0x39566f,0x3c556a]);
const armor = new Set([0x2e4057,0x4e6377,0x4e6277,0x506d86,0x6a879e,0x8dacbe,0x344962,0x49627b,0x405772]);
function freezeMeshLocals(root:T.Object3D,except=new Set<T.Object3D>()):void{root.traverse(object=>{if(object instanceof T.Mesh&&!except.has(object)){object.updateMatrix();object.matrixAutoUpdate=false;}});}
export function material(color: number, glow = 0): T.MeshStandardMaterial {
  const key = color + glow * 0x1000000;
  if (!mats.has(key)) mats.set(key, new T.MeshStandardMaterial({ color, roughness: 0.76, metalness: 0.12, flatShading: true, emissive: color, emissiveIntensity: glow }));
  return mats.get(key)!;
}
export function block(parent: T.Object3D, size: [number, number, number], pos: [number, number, number], color: number, outlined = false, glow = 0): T.Mesh {
  const mesh = new T.Mesh(cube, material(color, glow)); mesh.scale.set(...size); mesh.position.set(...pos); mesh.castShadow = glow === 0; mesh.receiveShadow = true; parent.add(mesh);
  if (outlined) { const edge = new T.Mesh(cube, outlineMat); edge.scale.set(1.055, 1.055, 1.055); mesh.add(edge); }
  return mesh;
}
export function makeBlaster(): T.Group {
  const gun = new T.Group();
  block(gun, [0.32, 0.32, 0.64], [0, 0, 0.15], 0xffa822, true);
  block(gun, [0.36, 0.12, 0.62], [0, 0.20, 0.19], 0xffce60, true);
  block(gun, [0.22, 0.20, 0.57], [0, 0.13, 0.70], 0xffb331, true);
  block(gun, [0.24, 0.23, 0.07], [0, 0.13, 1], 0xe4582a, true);
  block(gun, [0.14, 0.12, 0.03], [0, 0.13, 1.045], 0xffe79d, false, 1.5);
  block(gun, [0.23, 0.19, 0.40], [0, -0.14, 0.53], 0xd65b30, true);
  for (let i = 0; i < 3; i++) block(gun, [0.245, 0.16, 0.04], [0, -0.17, 0.42 + i * 0.1], 0x833a32);
  const grip = block(gun, [0.19, 0.34, 0.19], [0, -0.29, -0.05], 0x222a41, true); grip.rotation.x = -0.22;
  block(gun, [0.25, 0.23, 0.30], [0, 0, -0.27], 0xe87629, true);
  block(gun, [0.13, 0.05, 0.15], [0, 0.29, 0.06], 0x15283d);
  block(gun, [0.03, 0.05, 0.08], [0, 0.3, 0.64], 0x52ffee, false, 1);
  const muzzle = new T.Object3D(); muzzle.name = 'muzzle'; muzzle.position.set(0, 0.13, 1.06); gun.add(muzzle);
  freezeMeshLocals(gun); return gun;
}
/** Different silhouettes share a named, authoritative muzzle socket. */
export function makeWeapon(weapon: Weapon = 'blaster'): T.Group {
  const gun = makeBlaster(); gun.userData.weapon = weapon;
  if (weapon === 'scatter') {
    for (const side of [-1, 1]) block(gun, [0.12,0.18,0.55], [side*0.2,0.13,0.73], 0xba562c, true);
    block(gun, [0.53,0.13,0.26], [0,-0.08,0.7], 0xfad484, true);
  } else if (weapon === 'repeater') {
    block(gun, [0.12,0.2,0.95], [0,0.32,0.48], 0x304b61, true);
    block(gun, [0.2,0.42,0.28], [0,-0.35,0.25], 0x283344, true);
    for (let i=0;i<4;i++) block(gun,[0.34,0.035,0.06],[0,0.27,0.37+i*0.12],0x62eee6,false,.7);
  } else if (weapon === 'web') {
    for (const side of [-1,1]) {
      block(gun,[0.1,0.45,0.55],[side*0.27,0.13,0.75],0x89e8e0,true);
      block(gun,[0.15,0.08,0.08],[side*0.2,0.13,1],0xf6ffff,false,1);
    }
    block(gun,[0.43,0.25,0.32],[0,-0.23,0.3],0x4f6c86,true);
    for(let i=0;i<4;i++) block(gun,[0.44,0.03,0.32],[0,-0.31+i*0.055,0.3],0xe1f5ff);
  }
  freezeMeshLocals(gun); return gun;
}
const PALETTES: Record<Skin, [number,number]> = {
  classic:[0xf4eee7,0x39566f],cobalt:[0xb6d8f4,0x17478f],ember:[0xffd8b4,0x9b422e],jade:[0xc6e5cf,0x267c68],
  violet:[0xe0d2f4,0x7350a5],arctic:[0xf1f8ff,0x72929f],sunset:[0xffdfae,0xb25373],carbon:[0x949fad,0x283343],
};
export class Character {
  readonly group = new T.Group(); readonly body = new T.Group(); readonly arms:T.Group[]=[]; readonly legs:T.Group[]=[]; readonly head=new T.Group(); gun?:T.Group;
  private skin:Skin='classic';private weapon:Weapon='blaster';private hitLeft=0;private lastHitAt=-1e9;private ownedGeometry:T.BufferGeometry[]=[];private shield?:T.Mesh;private bindRing?:T.Mesh;private phase=Math.random()*Math.PI*2;private ownedMaterials:T.Material[]=[];
  constructor(readonly role:Role,readonly ghost=false){
    const seeker=role==='seeker',skin=0xe6b78c;this.group.add(this.body);this.body.add(this.head);
    if(!seeker){block(this.body,[.72,.65,.40],[0,1.04,0],0xf4eee7,true);for(let i=0;i<3;i++)block(this.body,[.735,.105,.415],[0,.82+i*.22,0],0x28303b);block(this.body,[.68,.16,.39],[0,.69,0],0x3c556a,true);}else{block(this.body,[.79,.68,.49],[0,1.05,0],0x2e4057,true);block(this.body,[.66,.31,.12],[0,1.19,.28],0x4e6377,true);block(this.body,[.33,.065,.02],[.08,1.20,.35],0x48dedb,false,.7);block(this.body,[.60,.22,.12],[0,.89,.28],0x243147,true);block(this.body,[.84,.13,.53],[0,.73,0],0x8a4f3d,true);block(this.body,[.20,.15,.04],[0,.73,.30],0xa9b4c3);block(this.body,[.42,.45,.20],[0,1.15,-.31],0x172c42,true);}
    for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.195,.67,0);this.body.add(leg);this.legs.push(leg);block(leg,[.29,.53,.32],[0,-.24,0],seeker?0x495263:0x39566f,true);if(seeker)block(leg,[.31,.17,.10],[0,-.28,.20],0x233248,true);block(leg,[.32,.18,.43],[0,-.57,.05],seeker?0x152639:0xc9bbaa,true);block(leg,[.33,.06,.44],[0,-.64,.05],0x162333);const arm=new T.Group();arm.position.set(side*.49,1.30,0);this.body.add(arm);this.arms.push(arm);block(arm,[.28,.32,.31],[0,-.12,0],seeker?0x4e6277:0xf3ece5,true);if(!seeker)block(arm,[.29,.09,.32],[0,-.11,0],0x282c39);else block(arm,[.33,.21,.35],[0,-.02,0],0x506d86,true);block(arm,[.235,.29,.25],[0,-.39,0],seeker?0x273448:skin,true);block(arm,[.275,.24,.28],[0,-.57,.01],seeker?0x192438:0xd4c59d,true);block(arm,[.29,.075,.29],[0,-.47,0],seeker?0x4b5e73:0xa79276);block(arm,[.085,.13,.16],[-side*.16,-.56,.06],seeker?0x192438:0xd4c59d);}
    block(this.head,[.68,.64,.59],[0,1.71,0],skin,true);block(this.head,[.085,.14,.08],[.02,1.64,.335],0xca775b);for(const side of [-1,1]){block(this.head,[.17,.17,.024],[side*.17,1.77,.31],0xfff8e9);block(this.head,[.062,.115,.016],[side*.17-.014,1.765,.33],0x171c28);const brow=block(this.head,[.22,.068,.035],[side*.17,1.9,.324],seeker?0x1c2029:0x563329);brow.rotation.z=side*(seeker?.25:-.12);block(this.head,[.13,.16,.18],[side*.38,1.66,0],0xdc9e7a,true);}
    if(seeker){block(this.head,[.89,.22,.76],[0,2.025,0],0x6a879e,true);block(this.head,[.60,.06,.69],[0,2.16,0],0x8dacbe);block(this.head,[.85,.64,.14],[0,1.76,-.33],0x344962,true);for(const side of [-1,1]){block(this.head,[.14,.46,.70],[side*.39,1.82,0],0x49627b,true);block(this.head,[.17,.31,.37],[side*.39,1.47,.13],0x405772,true);block(this.head,[.13,.34,.28],[side*.515,1.77,0],0x9b8f95,true);block(this.head,[.045,.19,.16],[side*.59,1.77,0],0x655a72);}block(this.head,[.29,.035,.028],[.025,1.49,.314],0x7c4040).rotation.z=.08;this.gun=makeWeapon();this.gun.scale.setScalar(.47);this.group.add(this.gun);}else{block(this.head,[.76,.22,.67],[0,2.005,-.015],0x55352b,true);block(this.head,[.74,.38,.17],[0,1.86,-.31],0x492b28,true);block(this.head,[.16,.33,.23],[-.3,1.88,.22],0x58352b,true);block(this.head,[.26,.15,.1],[.04,1.94,.31],0x573129);block(this.head,[.16,.23,.11],[.27,1.91,.31],0x573129);const mouth=block(this.head,[.36,.13,.027],[.03,1.505,.315],0x552c32);mouth.rotation.z=-.04;block(this.head,[.30,.067,.029],[.03,1.535,.33],0xfff7e2);block(this.head,[.105,.05,.03],[-.25,1.615,.31],0xd28b77);}
    if(!ghost){const shieldGeometry=new T.SphereGeometry(.94,16,12),shieldMaterial=new T.MeshBasicMaterial({color:0x60efe4,wireframe:true,transparent:true,opacity:.3,depthWrite:false});this.shield=new T.Mesh(shieldGeometry,shieldMaterial);this.shield.position.y=1.1;this.shield.scale.y=1.35;this.shield.visible=false;this.group.add(this.shield);const bindGeometry=new T.TorusGeometry(.54,.04,5,24),bindMaterial=new T.MeshBasicMaterial({color:0xe5f3ff,transparent:true,opacity:.9,depthWrite:false});this.bindRing=new T.Mesh(bindGeometry,bindMaterial);this.bindRing.rotation.x=Math.PI/2;this.bindRing.position.y=.4;this.bindRing.visible=false;this.group.add(this.bindRing);this.ownedGeometry.push(shieldGeometry,bindGeometry);this.ownedMaterials.push(shieldMaterial,bindMaterial);}
    if(ghost){this.group.traverse(o=>{if(!(o instanceof T.Mesh))return;o.material=o.material===outlineMat?ghostOutlineMat:ghostBodyMat;o.castShadow=false;o.receiveShadow=false;});const ring=new T.Mesh(ghostRingGeometry,ghostRingMaterial);ring.rotation.x=-Math.PI/2;ring.position.y=.025;this.group.add(ring);}
    freezeMeshLocals(this.group,new Set([this.shield,this.bindRing].filter(Boolean) as T.Object3D[]));
  }
  setSkin(skin:Skin='classic'):void{if(this.ghost||this.skin===skin)return;this.skin=skin;const[light,dark]=PALETTES[skin];this.body.traverse(object=>{if(!(object instanceof T.Mesh)||!(object.material instanceof T.MeshStandardMaterial))return;const base=(object.userData.originalColor??object.material.color.getHex()) as number;if(!shirts.has(base)&&!trousers.has(base)&&!armor.has(base))return;if(object.userData.originalColor===undefined){object.userData.originalColor=base;object.material=object.material.clone();this.ownedMaterials.push(object.material);}const color=skin==='classic'?base:shirts.has(base)?light:dark;object.material.color.setHex(color);object.material.emissive.setHex(color);});}
  setWeapon(weapon:Weapon='blaster'):void{if(this.role!=='seeker'||this.weapon===weapon)return;this.weapon=weapon;this.gun?.removeFromParent();this.gun=makeWeapon(weapon);this.gun.scale.setScalar(.47);this.group.add(this.gun);}
  hit():void{this.hitLeft=.42;}
  animate(pose:Pick<Pose,'moving'|'grounded'|'waving'|'dashing'>&Partial<Pose>,dt:number,time:number):void{this.setSkin(pose.skin);this.setWeapon(pose.weapon);if(pose.hitAt!==undefined&&pose.hitAt>this.lastHitAt){this.lastHitAt=pose.hitAt;if(time*1000-pose.hitAt<650)this.hit();}this.hitLeft=Math.max(0,this.hitLeft-dt);if(this.shield){this.shield.visible=!!pose.shielded;this.shield.position.y=pose.crouched?.65:1.1;this.shield.scale.y=pose.crouched?.75:1.35;}if(this.bindRing){this.bindRing.visible=!!pose.controlled;this.bindRing.rotation.z=time*3;}this.phase+=dt*(pose.moving>.5?pose.moving*2.3:2);const walk=Math.min(1,pose.moving/6),swing=Math.sin(this.phase)*.70*walk;this.legs[0].rotation.x=pose.grounded?swing:-.6;this.legs[1].rotation.x=pose.grounded?-swing:.4;this.body.position.y=pose.grounded?Math.abs(Math.sin(this.phase))*.04*walk+Math.sin(time*2)*.009:0;this.body.rotation.z=pose.dashing?.1:Math.sin(this.phase)*walk*.022;if(this.role==='seeker'){this.arms[0].rotation.set(-1.16,-.28,-.16);this.arms[1].rotation.set(-1.03,.28,.18);if(this.gun){const pitch=pose.pitch??0;this.gun.position.set(-.27,eyeHeight(pose.crouched)-.33*Math.cos(pitch)+.49*Math.sin(pitch),.33*Math.sin(pitch)+.49*Math.cos(pitch));this.gun.rotation.x=-pitch;}}else{this.arms[0].rotation.set(-swing*.75,0,-.08);this.arms[1].rotation.set(swing*.75,0,.08);if(pose.waving)this.arms[0].rotation.set(.1,0,-2.45+Math.sin(time*12)*.24);}this.body.rotation.x=pose.sliding?-.42:this.hitLeft>0?-.16*Math.sin(this.hitLeft*30):0;if(pose.sliding){this.legs[0].rotation.x=-1.2;this.legs[1].rotation.x=-.75;this.arms[0].rotation.x=.7;this.arms[1].rotation.x=.7;}if(this.hitLeft>0)this.body.rotation.z+=Math.sin(this.hitLeft*40)*this.hitLeft*.35;}
  dispose():void{this.group.removeFromParent();for(const m of this.ownedMaterials)m.dispose();for(const geometry of this.ownedGeometry)geometry.dispose();}
}
