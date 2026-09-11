/** Original, metre-scale maps. Output is shared by Rust collision and Three.js. */
import { writeFileSync, readFileSync } from 'node:fs';
const maps = {};
function create(id, name, half, recommended, description, theme) {
  return maps[id] = { id, name, half, recommended, description, theme, boxes: [], spawns: [], waypoints: [], mirrors: [], landmarks: [] };
}
function box(m, id, x, z, w, d, h, y = 0, kind = 'cover') { m.boxes.push({ id, x, z, w, d, h, y, kind }); }
function landmark(m, name, x, z) { m.landmarks.push({ name, x, y: 3.8, z }); }
function perimeterSpawns(m) {
  const edge = m.half - 5;
  for (const x of [-edge * .55, 0, edge * .55]) {
    m.spawns.push({ x, y: 0, z: -edge }, { x: -x, y: 0, z: edge });
    m.spawns.push({ x: -edge, y: 0, z: x }, { x: edge, y: 0, z: -x });
  }
  for (const x of [-edge, 0, edge]) for (const z of [-edge, 0, edge]) if (x || z) m.waypoints.push({ x, y: 0, z });
}
function mirrors(m, name, ax, az, bx, bz) {
  for (const [id, target, x, z] of [[name+'-a',name+'-b',ax,az],[name+'-b',name+'-a',bx,bz]]) {
    const yaw = Math.atan2(x, z);
    m.mirrors.push({ id, target, label: name.toUpperCase(), x, y: 0, z, yaw,
      exit: { x: x-Math.sin(yaw)*2.6, y: 0, z: z-Math.cos(yaw)*2.6 } });
  }
}
function loop(m, prefix, cx, cz, turn = 0) {
  // Door, jump-through window, and crouch-only underpass provide distinct exits.
  const local = (id,x,z,w,d,h,y=0) => {
    for (let n=0;n<turn;n++) { [x,z]=[-z,x]; [w,d]=[d,w]; }
    box(m,prefix+'-'+id,cx+x,cz+z,w,d,h,y);
  };
  for (const z of [-5,5]) for (const x of [-3.75,3.75]) local(`panel-${x}-${z}`,x,z,4.5,.7,3.4);
  local('window-sill',0,5,3,.7,.55);
  local('window-lintel',0,5,3,.7,.4,3);
  for (const z of [-3.25,3.25]) local(`east-${z}`,6,z,.7,3.5,3.4);
  for (const z of [-3,3]) local(`west-${z}`,-6,z,.7,4,3.4);
  local('crawl-lintel',-6,0,.7,2,2.15,1.25);
  local('crate',1.8,0,2.1,2.1,1.4);
  local('alcove-back',-2.8,2.8,2,.25,2.6);
  local('alcove-left',-3.75,2,.25,1.8,2.6);
  local('alcove-right',-1.85,2,.25,1.8,2.6);
  local('low-barricade',0,8,4,.65,.65);
  const gx = cx, gz = cz-8;
  m.waypoints.push({x:gx,y:0,z:gz},{x:cx+9,y:0,z:cz},{x:cx,y:0,z:cz+10},{x:cx-9,y:0,z:cz});
}
function loft(m,id,x,z) {
  box(m,id+'-deck',x,z,7,4,2.1,0,'platform');
  box(m,id+'-cover',x+2,z,1.5,1.8,1.3,2.1);
  for(let i=0;i<6;i++) box(m,id+'-step-'+i,x-2,z+6.5-i*.75,2.3,.78,(i+1)*.35,0,'step');
}
const classic = create('afterhours','Afterhours',23,'2–6 players','Compact neon arena. Short loops, balconies and a diagonal mirror pair.','neon');
mirrors(classic,'echo',-20,-20,20,20);
landmark(classic,'AFTERHOURS',0,-21);
const yard = create('switchyard','Switchyard',40,'4–10 players','Four warehouse loops, crawl exits, hiding alcoves and two flanking lofts.','industrial');
perimeterSpawns(yard);
for (const [x,z,r,n] of [[-17,-17,0,'NORTH DOCK'],[17,-17,1,'EAST DEPOT'],[17,17,2,'SOUTH WORKS'],[-17,17,3,'WEST STORE']]) {
  loop(yard,n.toLowerCase().replaceAll(' ','-'),x,z,r); landmark(yard,n,x,z-7);
}
loft(yard,'west-loft',-31,0); loft(yard,'east-loft',31,0);
box(yard,'central-crate',0,0,3,3,1.5); box(yard,'central-cover',0,-5,6,.8,2.5);
mirrors(yard,'violet',-34,-32,34,32); mirrors(yard,'cyan',34,-32,-34,32);
const glass = create('glassworks','Glassworks',56,'8–12 players','Large garden courtyards: hedge loops, recessed hiding pockets, elevated overlooks and mirror shortcuts.','garden');
perimeterSpawns(glass);
for (const [x,z,r,n] of [[-28,-28,0,'FERN HOUSE'],[28,-28,1,'EAST GALLERY'],[28,28,2,'SUN COURT'],[-28,28,3,'WEST ATRIUM']]) {
  loop(glass,n.toLowerCase().replaceAll(' ','-'),x,z,r); landmark(glass,n,x,z-7);
  // Offset hedges form traversable loops rather than a closed maze.
  box(glass,n+'-hedge-a',x-10,z-10,8,1.2,2.6);
  box(glass,n+'-hedge-b',x+10,z+10,8,1.2,2.6);
  box(glass,n+'-hedge-c',x-12,z+3,1.2,8,2.6);
}
for(const [x,z,id] of [[-40,0,'west-overlook'],[40,0,'east-overlook'],[0,-38,'north-overlook'],[0,38,'south-overlook']]) {
  loft(glass,id,x,z); landmark(glass,id.toUpperCase().replaceAll('-',' '),x,z-3);
}
// Central ring offers four exits and offset blocks to break sight lines.
for(const s of [-1,1]) {
  box(glass,'ring-x-'+s,s*11,0,1.2,14,2.8);
  box(glass,'ring-z-'+s,0,s*11,14,1.2,2.8);
  box(glass,'ring-low-'+s,s*4,0,2,3,.7);
}
mirrors(glass,'orchid',-49,-46,49,46); mirrors(glass,'azure',49,-46,-49,46);
mirrors(glass,'amber',-49,0,49,0);
const text=JSON.stringify(maps)+'\n';
const file=new URL('../shared/maps.json',import.meta.url);
if(process.argv.includes('--check')) {if(readFileSync(file,'utf8')!==text) throw new Error('Run node scripts/build-maps.mjs and commit shared/maps.json');}
else writeFileSync(file,text);
