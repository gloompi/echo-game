import * as T from 'three';
import { ACTIVE_MAP, type GameMap } from '../shared/map.js';
import { makeArena as makeClassicArena } from './world.js';
import { mountWorldAsset, type WorldAssetStatus } from './world-assets.js';

type Bag={geometries:Set<T.BufferGeometry>;materials:Set<T.Material>;textures:Set<T.Texture>;instances:Set<T.InstancedMesh>};
const bag=():Bag=>({geometries:new Set(),materials:new Set(),textures:new Set(),instances:new Set()});
function disposeBag(resources:Bag):void{for(const mesh of resources.instances)mesh.dispose();for(const texture of resources.textures)texture.dispose();for(const geometry of resources.geometries)geometry.dispose();for(const material of resources.materials)material.dispose();}
function sign(text:string,color='#a6ffef',owned?:Bag):T.Sprite{
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#0c182bea';ctx.fillRect(0,0,512,96);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(2,2,508,92);ctx.fillStyle=color;ctx.font='bold 25px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,48,490);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const material=new T.SpriteMaterial({map:texture,depthWrite:false});const sprite=new T.Sprite(material);sprite.scale.set(5.5,1.03,1);if(owned){owned.textures.add(texture);owned.materials.add(material);}return sprite;
}
interface BlockSpec{x:number;y:number;z:number;w:number;h:number;d:number;color:number;emissive:number}
function buildMap(layout:GameMap):{scene:T.Scene;animate(time:number):void;dispose():void}{
  const scene=new T.Scene(),garden=layout.theme==='garden',owned=bag();scene.background=new T.Color(garden?0x10282b:0x111c2e);scene.fog=new T.Fog(garden?0x10282b:0x111c2e,layout.half*1.25,layout.half*3);
  const hemi=new T.HemisphereLight(0xc4f7ff,0x17232e,2.4);scene.add(hemi);const sun=new T.DirectionalLight(0xffe4be,3.5);sun.position.set(25,45,18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-layout.half,right:layout.half,top:layout.half,bottom:-layout.half,near:1,far:150});sun.shadow.bias=-.001;sun.shadow.camera.updateProjectionMatrix();scene.add(sun);
  const blocks:BlockSpec[]=[];const block=(x:number,y:number,z:number,w:number,h:number,d:number,color:number,emissive=0)=>blocks.push({x,y,z,w,h,d,color,emissive});
  block(0,-.12,0,layout.half*2,.24,layout.half*2,garden?0x254044:0x263445);
  const grid=new T.GridHelper(layout.half*2,Math.round(layout.half/2),0x526d77,0x334e5b);grid.position.y=.006;scene.add(grid);owned.geometries.add(grid.geometry);for(const mat of Array.isArray(grid.material)?grid.material:[grid.material])owned.materials.add(mat);
  for(const b of layout.boxes){const color=b.kind==='step'?0x718b9a:b.kind==='platform'?0x536679:b.id.includes('hedge')?0x2f735c:b.id.includes('crate')?0x9d6849:b.id.includes('alcove')?0x304454:garden?0x72918e:0x526d85;block(b.x,b.y+b.h/2,b.z,b.w,b.h,b.d,color);if(b.id.includes('sill')||b.id.includes('crawl-lintel'))block(b.x,b.y+.025,b.z,b.w+.02,.045,b.d+.02,0x62dbc6,0x26776e);if(b.id.endsWith('alcove-back')){const label=sign('HIDE / NO INVISIBILITY','#d4dce8',owned);label.scale.set(1.8,.34,1);label.position.set(b.x,b.y+b.h+.35,b.z);scene.add(label);}}
  for(const s of [-1,1]){block(s*(layout.half+.5),2.5,0,1,5,layout.half*2+2,0x203645);block(0,2.5,s*(layout.half+.5),layout.half*2,5,1,0x203645);}
  const cube=new T.BoxGeometry(1,1,1);owned.geometries.add(cube);const groups=new Map<string,BlockSpec[]>();for(const item of blocks){const key=`${item.color}:${item.emissive}`;const list=groups.get(key)??[];list.push(item);groups.set(key,list);}
  const matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),size=new T.Vector3();for(const items of groups.values()){const first=items[0],material=new T.MeshStandardMaterial({color:first.color,roughness:.8,metalness:.12,emissive:first.emissive,emissiveIntensity:first.emissive?1:0});owned.materials.add(material);const mesh=new T.InstancedMesh(cube,material,items.length);owned.instances.add(mesh);for(let i=0;i<items.length;i++){const b=items[i];position.set(b.x,b.y,b.z);size.set(b.w,b.h,b.d);matrix.compose(position,rotation,size);mesh.setMatrixAt(i,matrix);}mesh.castShadow=first.emissive===0;mesh.receiveShadow=true;scene.add(mesh);}
  const paintGeo=new T.PlaneGeometry(.16,3),paint=new T.MeshBasicMaterial({color:garden?0x739989:0xc49a59,transparent:true,opacity:.4,depthWrite:false});owned.geometries.add(paintGeo);owned.materials.add(paint);const count=Math.max(0,Math.ceil((layout.half*2-4)/8))*2,paintMesh=new T.InstancedMesh(paintGeo,paint,count);owned.instances.add(paintMesh);let at=0;const q=new T.Quaternion(),scale=new T.Vector3(1,1,1);for(let p=-layout.half+4;p<layout.half;p+=8)for(const axis of [0,1]){q.setFromEuler(new T.Euler(-Math.PI/2,0,axis*Math.PI/2));matrix.compose(new T.Vector3(axis?p:0,.012,axis?0:p),q,scale);paintMesh.setMatrixAt(at++,matrix);}paintMesh.count=at;scene.add(paintMesh);
  return{scene,animate:()=>{},dispose(){sun.shadow.map?.dispose();disposeBag(owned);scene.clear();}};
}
function decorateMirrors(scene:T.Scene,layout:GameMap):{animate(time:number):void;dispose():void}{
  const owned=bag(),animated:{texture:T.CanvasTexture;plane:T.Mesh;phase:number}[]=[],colors=['#ed7bff','#61e8ef','#ffc179'],frameGeo=new T.BoxGeometry(1,1,1);owned.geometries.add(frameGeo);const frameMaterials=new Map<string,T.MeshStandardMaterial>(),planeGeo=new T.PlaneGeometry(1.85,2.5);owned.geometries.add(planeGeo);
  for(const [index,mirror] of layout.mirrors.entries()){
    const color=colors[Math.floor(index/2)%colors.length],group=new T.Group();group.position.set(mirror.x,mirror.y,mirror.z);group.rotation.y=mirror.yaw+Math.PI;scene.add(group);
    let frameMaterial=frameMaterials.get(color);if(!frameMaterial){frameMaterial=new T.MeshStandardMaterial({color:0x253947,metalness:.85,roughness:.25,emissive:color,emissiveIntensity:.22});frameMaterials.set(color,frameMaterial);owned.materials.add(frameMaterial);}const frames=new T.InstancedMesh(frameGeo,frameMaterial,4);owned.instances.add(frames);const specs=[[-1,1.4,.16,2.8],[1,1.4,.16,2.8],[0,2.72,2.16,.16],[0,.08,2.16,.16]] as const;for(let i=0;i<specs.length;i++){const [x,y,w,h]=specs[i];matrix.compose(new T.Vector3(x,y,0),new T.Quaternion(),new T.Vector3(w,h,.22));frames.setMatrixAt(i,matrix);}group.add(frames);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(128,128,4,128,128,180);gradient.addColorStop(0,'#e8ffff');gradient.addColorStop(.25,color);gradient.addColorStop(.6,'#1b3555');gradient.addColorStop(1,'#070f20');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);ctx.strokeStyle=color;ctx.lineWidth=3;for(let r=20;r<180;r+=23){ctx.beginPath();ctx.ellipse(128,128,r,r*.82,r/60,0,Math.PI*1.7);ctx.stroke();}
    const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.center.set(.5,.5);const planeMaterial=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,transparent:true,opacity:.92});owned.textures.add(texture);owned.materials.add(planeMaterial);const plane=new T.Mesh(planeGeo,planeMaterial);plane.position.y=1.4;group.add(plane);const label=sign(`${mirror.label} / F TO SHIFT`,color,owned);label.scale.set(3,.56,1);label.position.set(mirror.x,mirror.y+3.35,mirror.z);scene.add(label);animated.push({texture,plane,phase:index});
  }
  for(const mark of layout.landmarks){const label=sign(mark.name,'#a6ffef',owned);label.position.set(mark.x,mark.y,mark.z);scene.add(label);}
  return{animate(time){for(const item of animated){item.texture.rotation=time*.12+item.phase;item.plane.scale.setScalar(1+Math.sin(time*2+item.phase)*.015);}},dispose(){disposeBag(owned);}};
}
const matrix=new T.Matrix4();
export function makeArena():{scene:T.Scene;ready:Promise<void>;assetStatus:WorldAssetStatus;animate(time:number):void;dispose():void}{
  const layout=ACTIVE_MAP,base=layout.id==='afterhours'?makeClassicArena():buildMap(layout),fallback=new T.Group();
  fallback.name=`world-fallback:${layout.id}`;
  // Keep lights, mirrors and subsequently added actors outside the replaceable art group.
  for(const object of [...base.scene.children])if(!(object instanceof T.Light))fallback.add(object);
  base.scene.add(fallback);
  const mirrors=decorateMirrors(base.scene,layout),asset=mountWorldAsset(base.scene,layout.id,fallback);
  let disposed=false;
  return{scene:base.scene,ready:asset.ready,assetStatus:asset.status,animate(time){if(disposed)return;if(asset.status.state!=='loaded')base.animate(time);mirrors.animate(time);},dispose(){if(disposed)return;disposed=true;asset.dispose();mirrors.dispose();base.dispose();fallback.clear();}};
}
