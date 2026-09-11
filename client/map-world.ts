import * as T from 'three';
import { ACTIVE_MAP, type GameMap } from '../shared/map.js';
import { makeArena as makeClassicArena } from './world.js';

function sign(text: string, color = '#a6ffef'): T.Sprite {
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#0c182bea';ctx.fillRect(0,0,512,96);
  ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(2,2,508,92);ctx.fillStyle=color;
  ctx.font='bold 25px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48,490);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false}));sprite.scale.set(5.5,1.03,1);return sprite;
}
function buildMap(layout: GameMap): { scene: T.Scene; animate(time: number): void } {
  const scene=new T.Scene(),garden=layout.theme==='garden';
  scene.background=new T.Color(garden?0x10282b:0x111c2e);scene.fog=new T.Fog(garden?0x10282b:0x111c2e,layout.half*1.25,layout.half*3.0);
  const hemi=new T.HemisphereLight(0xc4f7ff,0x17232e,2.4);scene.add(hemi);
  const sun=new T.DirectionalLight(0xffe4be,3.5);sun.position.set(25,45,18);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-layout.half,right:layout.half,top:layout.half,bottom:-layout.half,near:1,far:150});
  sun.shadow.bias=-.001;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
  const cube=new T.BoxGeometry(1,1,1),materials=new Map<number,T.MeshStandardMaterial>();
  const material=(color:number)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.8,metalness:.12}));return materials.get(color)!;};
  const block=(x:number,y:number,z:number,w:number,h:number,d:number,color:number)=>{
    const mesh=new T.Mesh(cube,material(color));mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);return mesh;
  };
  block(0,-.12,0,layout.half*2,.24,layout.half*2,garden?0x254044:0x263445);
  const grid=new T.GridHelper(layout.half*2,Math.round(layout.half/2),0x526d77,0x334e5b);grid.position.y=.006;scene.add(grid);
  for(const b of layout.boxes){
    const color=b.kind==='step'?0x718b9a:b.kind==='platform'?0x536679:b.id.includes('hedge')?0x2f735c:b.id.includes('crate')?0x9d6849:b.id.includes('alcove')?0x304454:garden?0x72918e:0x526d85;
    block(b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color);
    if(b.id.includes('sill')||b.id.includes('crawl-lintel')){
      const edge=block(b.x,b.y+.025,b.z,b.w+.02,.045,b.d+.02,0x62dbc6);
      (edge.material as T.MeshStandardMaterial).emissive.setHex(0x26776e);
    }
    if(b.id.endsWith('alcove-back')){const label=sign('HIDE / NO INVISIBILITY','#d4dce8');label.scale.set(1.8,.34,1);label.position.set(b.x,b.y+b.h+.35,b.z);scene.add(label);}
  }
  for(const s of [-1,1]){
    block(s*(layout.half+.5),2.5,0,1,5,layout.half*2+2,0x203645);
    block(0,2.5,s*(layout.half+.5),layout.half*2,5,1,0x203645);
  }
  // Non-colliding lane paint, not decorative obstacles that disagree with physics.
  const paint=new T.MeshBasicMaterial({color:garden?0x739989:0xc49a59,transparent:true,opacity:.4,depthWrite:false});
  for(let p=-layout.half+4;p<layout.half;p+=8){
    for(const axis of [0,1]){const tile=new T.Mesh(new T.PlaneGeometry(.16,3),paint);tile.rotation.x=-Math.PI/2;tile.rotation.z=axis*Math.PI/2;tile.position.set(axis?p:0,.012,axis?0:p);scene.add(tile);}
  }
  return {scene,animate:()=>{}};
}
function decorateMirrors(scene: T.Scene, layout: GameMap): (time: number) => void {
  const animated: { texture: T.CanvasTexture; plane: T.Mesh; phase: number }[]=[];
  const colors=['#ed7bff','#61e8ef','#ffc179'];
  for(const [index,mirror] of layout.mirrors.entries()){
    const color=colors[Math.floor(index/2)%colors.length],group=new T.Group();group.position.set(mirror.x,mirror.y,mirror.z);group.rotation.y=mirror.yaw+Math.PI;scene.add(group);
    const frameMaterial=new T.MeshStandardMaterial({color:0x253947,metalness:.85,roughness:.25,emissive:color,emissiveIntensity:.22});
    for(const [x,y,w,h] of [[-1,1.4,.16,2.8],[1,1.4,.16,2.8],[0,2.72,2.16,.16],[0,.08,2.16,.16]]){
      const bar=new T.Mesh(new T.BoxGeometry(w,h,.22),frameMaterial);bar.position.set(x,y,0);group.add(bar);
    }
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(128,128,4,128,128,180);
    gradient.addColorStop(0,'#e8ffff');gradient.addColorStop(.25,color);gradient.addColorStop(.6,'#1b3555');gradient.addColorStop(1,'#070f20');
    ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);ctx.strokeStyle=color;ctx.lineWidth=3;
    for(let r=20;r<180;r+=23){ctx.beginPath();ctx.ellipse(128,128,r,r*.82,r/60,0,Math.PI*1.7);ctx.stroke();}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.center.set(.5,.5);
    const plane=new T.Mesh(new T.PlaneGeometry(1.85,2.5),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true,opacity:.92}));
    plane.position.y=1.4;group.add(plane);
    const label=sign(`${mirror.label} / F TO SHIFT`,color);label.scale.set(3,.56,1);label.position.set(mirror.x,mirror.y+3.35,mirror.z);scene.add(label);
    animated.push({texture,plane,phase:index});
  }
  for(const mark of layout.landmarks){const label=sign(mark.name);label.position.set(mark.x,mark.y,mark.z);scene.add(label);}
  // This animation is time-only. Never render a live remote camera into a mirror.
  return time=>{for(const item of animated){item.texture.rotation=time*.12+item.phase;item.plane.scale.setScalar(1+Math.sin(time*2+item.phase)*.015);}};
}
export function makeArena(): { scene: T.Scene; animate(time: number): void; dispose(): void } {
  const layout=ACTIVE_MAP,base=layout.id==='afterhours'?makeClassicArena():buildMap(layout);
  const mirrors=decorateMirrors(base.scene,layout);
  return {scene:base.scene,animate(time){base.animate(time);mirrors(time);},dispose(){
    const geometry=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();
    base.scene.traverse(object=>{
      const mesh=object as T.Mesh;if(mesh.geometry)geometry.add(mesh.geometry);
      const own=mesh.material;if(own)for(const mat of Array.isArray(own)?own:[own]){
        materials.add(mat);for(const value of Object.values(mat))if(value instanceof T.Texture)textures.add(value);
      }
      if(object instanceof T.Light && 'shadow' in object){const shadow=(object as T.DirectionalLight).shadow;shadow?.map?.dispose();}
    });
    for(const item of geometry)item.dispose();for(const item of materials)item.dispose();for(const item of textures)item.dispose();base.scene.clear();
  }};
}
