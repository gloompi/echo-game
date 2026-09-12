import * as T from 'three';
import { ACTIVE_MAP } from '../shared/map.js';
import { possibleRegions } from '../shared/scan.js';
import type { Pose, Snapshot, Vec3 } from '../shared/types.js';
/** Only consumes authoritative public entities and already delayed poses. */
export class CombatFX {
  private mines = new Map<number,T.Mesh>();
  private webs = new Map<number,T.Mesh>();
  private rings: T.Mesh[] = [];
  private ringGeometry = new T.RingGeometry(.985,1,64);
  private ringMaterial = new T.MeshBasicMaterial({color:0x6ceede,transparent:true,opacity:.4,side:T.DoubleSide,depthWrite:false});
  private mineGeometry = new T.CylinderGeometry(.33,.43,.1,12);
  private mineMaterial = new T.MeshStandardMaterial({color:0xde823c,emissive:0xd77732,emissiveIntensity:.35});
  private webGeometry = new T.IcosahedronGeometry(1,1);
  private webMaterial = new T.MeshBasicMaterial({color:0xe1fdff,wireframe:true});
  private scanAt = -Infinity;
  update(scene: T.Scene, snapshot: Snapshot, players: Pose[], sampledAt: number, now: number): void {
    this.sync(this.mines,snapshot.mines??[],scene,() => new T.Mesh(this.mineGeometry,this.mineMaterial), (mesh,value) => { mesh.position.set(value.x,value.y+.07,value.z); mesh.scale.setScalar('armed' in value && value.armed ? 1:.7); });
    this.sync(this.webs,snapshot.projectiles??[],scene,() => new T.Mesh(this.webGeometry,this.webMaterial), (mesh,value) => { mesh.position.set(value.x,value.y,value.z); mesh.rotation.y=now/180; mesh.scale.setScalar('radius' in value ? Number(value.radius) : .18); });
    const active = snapshot.self.role==='seeker'&&snapshot.self.alive&&!snapshot.self.spectating&&snapshot.phase==='playing'
      &&(snapshot.self.abilities?.scanLeft??0)>Math.max(0,now-snapshot.now);
    if (!active) { for(const ring of this.rings)ring.visible=false; this.scanAt=-Infinity; return; }
    if (now-this.scanAt<100) return; this.scanAt=now;
    let count=0;
    for(const pose of players) if(pose.role==='hider'&&pose.alive) {
      for(const region of possibleRegions(pose,Math.max(0,now-sampledAt),snapshot.settings,ACTIVE_MAP.mirrors)) {
        let ring=this.rings[count]; if(!ring) {ring=new T.Mesh(this.ringGeometry,this.ringMaterial);ring.rotation.x=-Math.PI/2;this.rings.push(ring);scene.add(ring);}
        ring.visible=true;ring.position.set(region.x,.045,region.z);ring.scale.setScalar(Math.max(.1,region.radius));count++;
      }
    }
    for(let i=count;i<this.rings.length;i++)this.rings[i].visible=false;
  }
  private sync<P extends Vec3 & {id:number}>(map: Map<number,T.Mesh>, values: P[],scene: T.Scene,create:()=>T.Mesh,update:(mesh:T.Mesh,value:P)=>void):void {
    const ids=new Set(values.map(value=>value.id));
    for(const [id,mesh] of map)if(!ids.has(id)){mesh.removeFromParent();map.delete(id);}
    for(const value of values){let mesh=map.get(value.id);if(!mesh){mesh=create();map.set(value.id,mesh);scene.add(mesh);}update(mesh,value);}
  }
  clear():void {for(const mesh of [...this.mines.values(),...this.webs.values(),...this.rings])mesh.removeFromParent();this.mines.clear();this.webs.clear();this.rings=[];this.scanAt=-Infinity;}
  dispose():void {this.clear();for(const item of [this.ringGeometry,this.ringMaterial,this.mineGeometry,this.mineMaterial,this.webGeometry,this.webMaterial])item.dispose();}
}
