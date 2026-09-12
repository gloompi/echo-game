import * as T from 'three';
import { ARENA } from '../shared/map.js';
import { block, material } from './models.js';
export const CYAN = 0x58f5d1, PINK = 0xf06ade;
export function textTexture(text: string, fg = '#9eeddc', bg = '#0c1b2c', w = 1024, h = 256): T.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!; ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${Math.floor(h * 0.48)}px Arial`;
  ctx.fillText(text, w / 2, h / 2, w * 0.92);
  const tex = new T.CanvasTexture(canvas); tex.colorSpace = T.SRGBColorSpace; return tex;
}
interface OwnedResources { geometries: Set<T.BufferGeometry>; materials: Set<T.Material>; textures: Set<T.Texture>; instances: Set<T.InstancedMesh> }
function resources(): OwnedResources { return {geometries:new Set(),materials:new Set(),textures:new Set(),instances:new Set()}; }
function sign(parent: T.Object3D, text: string, pos: [number, number, number], width: number, color: string, ry = 0, owned?: OwnedResources): T.Mesh {
  const texture=textTexture(text,color), geometry=new T.PlaneGeometry(width,width/4), mat=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
  const mesh = new T.Mesh(geometry,mat); mesh.position.set(...pos); mesh.rotation.y = ry; parent.add(mesh);
  if(owned){owned.geometries.add(geometry);owned.materials.add(mat);owned.textures.add(texture);} return mesh;
}
function tube(parent: T.Object3D, points: T.Vector3[], color: number, radius = 0.035, owned?: OwnedResources) {
  const geo = new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, radius, 5, false);
  const mesh = new T.Mesh(geo, material(color, 1.2)); parent.add(mesh); owned?.geometries.add(geo);
}
function freezeStatic(root:T.Object3D):void { root.traverse(object=>{if(object instanceof T.Mesh){object.updateMatrix();object.matrixAutoUpdate=false;}}); }
export function lighting(scene: T.Scene, lobby = false): T.DirectionalLight {
  scene.background = new T.Color(lobby ? 0x091321 : 0x07111e);
  scene.fog = new T.Fog(lobby ? 0x091321 : 0x07111e, lobby ? 24 : 38, lobby ? 65 : 110);
  scene.add(new T.HemisphereLight(0xb8d7f6, 0x414768, 2.0));
  const light = new T.DirectionalLight(0xd2e6ff, 3.0); light.position.set(-12, 23, 10); light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048); light.shadow.camera.left = -29; light.shadow.camera.right = 29; light.shadow.camera.top = 29; light.shadow.camera.bottom = -29; light.shadow.camera.near = 0.1; light.shadow.camera.far = 65; light.shadow.normalBias = 0.025; light.shadow.bias = -0.0002; scene.add(light);
  const rim = new T.DirectionalLight(0xef5cdd, 1.0); rim.position.set(12, 6, -9); scene.add(rim);
  const fill = new T.DirectionalLight(0x5dffd9, 0.75); fill.position.set(-12, 5, -2); scene.add(fill);
  return light;
}
export function makeArena(): { scene: T.Scene; animate: (time: number) => void; light: T.DirectionalLight; dispose:()=>void } {
  const scene = new T.Scene(), light = lighting(scene), owned=resources();
  block(scene, [50, 0.35, 50], [0, -0.22, 0], 0x0d1827);
  const floorGeo = new T.BoxGeometry(1.96, 0.06, 1.96), floorMat = material(0x334255); owned.geometries.add(floorGeo);
  const tiles = new T.InstancedMesh(floorGeo, floorMat, 24 * 24); owned.instances.add(tiles); const matrix = new T.Matrix4(), color = new T.Color();
  for (let x = 0; x < 24; x++) for (let z = 0; z < 24; z++) {
    const i = x * 24 + z; matrix.makeTranslation(x * 2 - 23, -0.015, z * 2 - 23); tiles.setMatrixAt(i, matrix);
    color.setHex((x + z) % 4 === 0 ? 0x253347 : (x + z) % 2 ? 0x1e2b3c : 0x1b2637); tiles.setColorAt(i, color);
  }
  tiles.receiveShadow = true; scene.add(tiles);
  for (const side of [-1, 1]) {
    block(scene, [0.085, 0.018, 43], [side * 21, 0.025, 0], side === 1 ? PINK : CYAN, false, 0.8);
    block(scene, [43, 0.018, 0.085], [0, 0.025, side * 21], side === 1 ? CYAN : PINK, false, 0.8);
    for (let i = -20; i <= 20; i += 5) {
      for (const rotate of [false, true]) {
        const x = rotate ? i : side * 24, z = rotate ? side * 24 : i;
        block(scene, [rotate ? 4.9 : 1, 3.4, rotate ? 1 : 4.9], [x, 1.65, z], 0x152439);
        block(scene, [1.1, 4.1, 1.1], [x, 2, z], 0x24384c);
        block(scene, [rotate ? 0.45 : 0.09, 2.6, rotate ? 0.09 : 0.45], [x + (rotate ? 0 : -side * 0.57), 2.0, z + (rotate ? -side * 0.57 : 0)], (i / 5) % 2 ? PINK : CYAN, false, 1.3);
      }
    }
    block(scene, [49, 0.28, 1.3], [0, 4.05, side * 24], 0x27364c);
    block(scene, [1.3, 0.28, 49], [side * 24, 4.05, 0], 0x27364c);
    block(scene, [47, 0.035, 0.08], [0, 4.07, side * 23.3], PINK, false, 1.2);
    block(scene, [0.08, 0.035, 47], [side * 23.3, 4.07, 0], CYAN, false, 1.2);
  }
  for (const b of ARENA) {
    const platform = b.kind === 'platform' || b.kind === 'step';
    block(scene, [b.w, b.h, b.d], [b.x, b.y + b.h / 2, b.z], platform ? 0x29394e : 0x36485e, !platform);
    const neon = b.x < 0 ? CYAN : PINK;
    if (b.kind === 'step') block(scene, [b.w, 0.035, 0.05], [b.x, b.y + b.h + 0.018, b.z + (b.z < 0 ? b.d / 2 : -b.d / 2)], neon, false, 0.9);
    else if (b.kind === 'cover') {
      block(scene, [b.w + 0.025, 0.10, b.d + 0.025], [b.x, b.y + b.h - 0.18, b.z], 0x7792a5);
      block(scene, [b.w * 0.6, 0.10, 0.018], [b.x, b.y + 0.36, b.z + b.d / 2 + 0.02], neon, false, 1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(scene, [0.1, b.h, 0.1], [b.x + sx * (b.w / 2 - 0.08), b.y + b.h / 2, b.z + sz * (b.d / 2 - 0.08)], 0x1b2b40);
      if (b.w > 2 && b.w < 5) sign(scene, 'E / 03', [b.x, b.y + b.h * 0.62, b.z + b.d / 2 + 0.031], b.w * 0.56, '#bacbcd',0,owned);
    } else if (b.kind === 'platform') block(scene, [b.w + 0.04, 0.07, b.d + 0.04], [b.x, b.y + b.h - 0.11, b.z], neon, false, 0.65);
  }
  const core = new T.Group(); core.position.set(0, 5.2, 0); scene.add(core);
  const gemGeo=new T.OctahedronGeometry(0.84),gemMat=new T.MeshStandardMaterial({ color: CYAN, emissive: CYAN, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.35 });owned.geometries.add(gemGeo);owned.materials.add(gemMat);
  const gem = new T.Mesh(gemGeo,gemMat); core.add(gem);
  for (let i = 0; i < 3; i++) { const geo=new T.TorusGeometry(1.5+i*.15,.018,5,64);owned.geometries.add(geo);const ring=new T.Mesh(geo,material(i%2?PINK:CYAN,1.4));ring.rotation.set(Math.PI/2+i*.32,i*.4,0);core.add(ring); }
  for (const x of [-1.8, 1.8]) { block(scene,[.11,2.6,.11],[x,2,0],0x76abbb,false,.8);tube(scene,[new T.Vector3(x,.8,0),new T.Vector3(x*2,.07,0),new T.Vector3(x*3,.07,3),new T.Vector3(x*3,.07,9)],x<0?CYAN:PINK,.035,owned); }
  sign(scene,'E C H O',[0,5.7,-23.7],10,'#9dffde',0,owned);sign(scene,'DON’T TRUST YOUR EYES',[0,4.45,-23.68],8,'#7e93a8',0,owned);
  const arrowGeo=new T.ConeGeometry(.16,.5,3);owned.geometries.add(arrowGeo);
  for(const side of [-1,1]){sign(scene,side<0?'SECTOR 01':'SECTOR 02',[side*23.4,2.6,0],7,'#a4bdc9',-side*Math.PI/2,owned);for(let i=0;i<5;i++){const arrow=new T.Mesh(arrowGeo,material(side<0?CYAN:PINK,.5));arrow.position.set(side*5,.06,(i-2)*1.1+side*11);arrow.rotation.x=Math.PI/2;scene.add(arrow);}}
  const starPos:number[]=[];for(let i=0;i<180;i++){const a=i*2.39996,r=45+(i%11)*4;starPos.push(Math.cos(a)*r,16+(i*7%40),Math.sin(a)*r);}const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(starPos,3));const starMat=new T.PointsMaterial({color:0xadc7de,size:.12,sizeAttenuation:true});owned.geometries.add(starGeo);owned.materials.add(starMat);scene.add(new T.Points(starGeo,starMat));
  for(let i=0;i<34;i++){const a=i/34*Math.PI*2,r=42+(i%4)*5,h=5+(i*7%17),x=Math.cos(a)*r,z=Math.sin(a)*r;block(scene,[3+i%3,h,4],[x,h/2-2,z],0x111c2d);for(let k=0;k<h/2;k++)block(scene,[1.6,.08,4.02],[x,k*2+1,z],i%3?0x456879:0x79526d,false,.45);}
  return { scene, light, animate(time){core.rotation.y=time*.35;gem.rotation.z=time*.25;core.position.y=5.2+Math.sin(time*1.5)*.08;},dispose(){for(const instance of owned.instances)instance.dispose();for(const texture of owned.textures)texture.dispose();for(const geometry of owned.geometries)geometry.dispose();for(const mat of owned.materials)mat.dispose();scene.clear();} };
}
export function makeStage(): { scene: T.Scene; light: T.DirectionalLight; stage: T.Group } {
  const scene = new T.Scene(), light = lighting(scene, true), stage = new T.Group(); scene.add(stage);
  block(stage, [11, 0.5, 8], [0, -0.30, 0], 0x122237);
  const tileGeo=new T.BoxGeometry(.97,.05,.97),tileMat=new T.MeshStandardMaterial({color:0xffffff,roughness:.76,metalness:.12,flatShading:true});
  const tiles=new T.InstancedMesh(tileGeo,tileMat,77),matrix=new T.Matrix4(),color=new T.Color();let tile=0;
  for(let x=-5;x<=5;x++)for(let z=-3;z<=3;z++){matrix.makeTranslation(x,-.022,z);tiles.setMatrixAt(tile,matrix);tiles.setColorAt(tile,color.setHex((x+z)%2?0x243a4e:0x1b2f42));tile++;}tiles.receiveShadow=true;stage.add(tiles);
  block(stage,[11.02,.06,.06],[0,-.02,3.95],CYAN,false,1.7);block(stage,[.06,.06,8],[-5.48,-.02,0],CYAN,false,1.7);block(stage,[.06,.06,8],[5.48,-.02,0],PINK,false,1.7);
  for(const x of [-4.4,4.4]){block(stage,[.9,3.7,.9],[x,1.8,-2.9],0x243850,true);block(stage,[.44,2.7,.035],[x,1.8,-2.43],x<0?CYAN:PINK,false,1.5);}
  block(stage,[9.7,.30,.75],[0,3.7,-2.9],0x26364d,true);block(stage,[9.5,.04,.06],[0,3.69,-2.49],PINK,false,1.2);block(stage,[1.5,1.1,1.5],[-3.6,.55,0],0x33475c,true);block(stage,[1.5,.05,1.5],[-3.6,1.03,0],0x68bba7,false,.5);block(stage,[2.2,.55,1.2],[3.8,.275,1.2],0x273a52,true);
  const ring=new T.Mesh(new T.RingGeometry(2.2,2.23,64),new T.MeshBasicMaterial({color:CYAN,transparent:true,opacity:.55,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(0,.023,.5);stage.add(ring);sign(stage,'E C H O   /   03',[0,2.8,-2.43],3.8,'#91d5d0');
  freezeStatic(stage); return {scene,light,stage};
}
