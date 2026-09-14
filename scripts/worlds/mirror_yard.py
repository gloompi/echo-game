"""Original Mirror Yard Blender authoring and GLB export; no external assets.
Run Blender 5.2: blender --background --python-exit-code 1 --python scripts/worlds/mirror_yard.py
Coordinates in map.json are Three/game (x,y-up,z); authoring converts to Blender (x,-z,y).
"""
import bpy, bmesh, math, json, random, pathlib, os
from mathutils import Vector
random.seed(7219)
ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT/'assets-src/worlds/mirror-yard'
OUT.mkdir(parents=True,exist_ok=True)
GLB = ROOT/'public/assets/worlds/mirror-yard.glb'
GLB.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for d in bpy.data.materials: bpy.data.materials.remove(d)
M={}; boxes=[]; cosmetic=[]; collision_objects=[]
def mat(name,color,metal=0,rough=.55,emission=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal; p.inputs['Roughness'].default_value=rough
    if emission: p.inputs['Emission Color'].default_value=(*color,1);p.inputs['Emission Strength'].default_value=emission
    M[name]=m; return m
mat('Concrete | pale titanium',(.32,.355,.39),.15,.68)
mat('Wall | slate steel',(.205,.245,.29),.55,.44)
mat('Panel | alloy',(.40,.455,.50),.65,.4)
mat('Edge | graphite',(.065,.087,.11),.65,.35)
mat('Paving | blue gray',(.255,.294,.33),.1,.74)
mat('Paving | pale',(.35,.39,.42),.05,.75)
mat('Cyan | luminous',(.005,.75,1),.2,.28,5)
mat('Red | luminous',(1,.025,.01),.2,.3,4)
mat('Amber | luminous',(1,.46,.13),.2,.3,3)
mat('Warning | ochre',(.72,.43,.11),.5,.5)
mat('Soil',(.055,.067,.05),0,.95)
mat('Foliage | dark',(.075,.15,.105),0,.9)
mat('Foliage | sage',(.16,.25,.19),0,.9)
mat('Foliage | silver',(.24,.33,.27),0,.9)
def cube(name,x,y,z,w,h,d,material,collision=False,kind='cover',bevel=.035):
    verts=[(-w/2,-d/2,-h/2),(w/2,-d/2,-h/2),(w/2,d/2,-h/2),(-w/2,d/2,-h/2),(-w/2,-d/2,h/2),(w/2,-d/2,h/2),(w/2,d/2,h/2),(-w/2,d/2,h/2)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    if bevel:
        bm=bmesh.new();bm.from_mesh(mesh)
        bmesh.ops.bevel(bm,geom=list(bm.edges),offset=min(bevel,w/5,d/5,h/5),segments=1,affect='EDGES')
        bm.normal_update();bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=(x,-z,y+h/2)
    o.data.materials.append(M[material])
    if collision:
        box=dict(id=name,x=round(x,4),y=round(y,4),z=round(z,4),w=round(w,4),h=round(h,4),d=round(d,4),kind=kind)
        boxes.append(box);o['collisionId']=name;collision_objects.append(o)
    else:cosmetic.append(o)
    return o
C='Concrete | pale titanium'; W='Wall | slate steel'; P='Panel | alloy'; E='Edge | graphite';CY='Cyan | luminous'; R='Red | luminous'; A='Amber | luminous'
def solid(n,x,y,z,w,h,d,m=C,kind='cover',bevel=.035):return cube(n,x,y,z,w,h,d,m,True,kind,bevel)
def deco(n,x,y,z,w,h,d,m=P,bevel=.02):return cube(n,x,y,z,w,h,d,m,False,'cover',bevel)
def strip(n,x,y,z,w,h,d,color=CY):return deco(n,x,y,z,w,h,d,color,.005)
def face_detail(n,x,y,z,w,h,d,red=False):
    # Surface-mounted paneling and hairline luminous trims, <3cm from the solid.
    for side in [-1,1]:
        zz=z+side*(d/2+.008)
        deco(n+' face plate',x,y+.14,zz,w-.18,h-.3,.022,P)
        for sx in [-1,1]:
            strip(n+' vertical inset',x+sx*(w/2-.20),y+.4,zz+side*.016,.065,max(.15,h-1.0),.018,R if red else CY)
        for yy in [.29,h-.27]:deco(n+' horizontal seam',x,y+yy,zz+side*.016,w-.25,.04,.018,E,.004)

def crate(n,x,z,w=1.65,d=1.65,h=1.65,y=0):
    solid(n,x,y,z,w,h,d,W,bevel=.06)
    deco(n+' lid',x,y+h-.075,z,w-.14,.09,d-.14,P)
    for xx in [-1,1]:
        for zz in [-1,1]:deco(n+' corner',x+xx*(w/2-.10),y+.04,z+zz*(d/2-.10),.15,h-.08,.15,E)
    for zz in [-1,1]:
        deco(n+' panel',x,y+.22,z+zz*(d/2+.003),w-.35,h-.47,.024,P)
        strip(n+' latch',x+.24,y+h*.62,z+zz*(d/2+.017),.22,.065,.018,A)
    for i in range(3):deco(n+' top groove',x+(i-1)*.35,y+h+.013,z,.08,.008,d-.38,E,.002)
def planter(n,x,z,w=4,d=1.8,y=0):
    solid(n,x,y,z,w,1.25,d,W,bevel=.045)
    deco(n+' rim',x,y+1.08,z,w-.02,.16,d-.02,P)
    deco(n+' soil',x,y+1.24,z,w-.32,.015,d-.32,'Soil',.001)
    for i in range(max(3,int(w*2))):
        xx=x+random.uniform(-w/2+.35,w/2-.35);zz=z+random.uniform(-d/2+.30,d/2-.30)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(xx,-zz,y+1.42+random.uniform(.0,.25)))
        o=bpy.context.object;o.name=n+' soft foliage';o.scale=(random.uniform(.35,.6),random.uniform(.30,.45),random.uniform(.35,.60));o.data.materials.append(M[random.choice(['Foliage | dark','Foliage | sage','Foliage | silver'])]);cosmetic.append(o)
def rail(n,x,z,length,axis='x',y=3.6):
    w,d=(length,.15) if axis=='x' else (.15,length)
    solid(n+' guard',x,y+.32,z,w,.80,d,E,bevel=.02)
    # Cyan ribbon and metallic top cap remain inside its proxy.
    deco(n+' cap',x,y+1.065,z,w,.055,d,P,.012)
    strip(n+' light',x,y+.89,z,w-.03,.045,d+.005)
    count=max(1,round(length/3.2))
    for j in range(count+1):
        off=(j/count-.5)*max(.1,length-.18)
        px=x+off if axis=='x' else x;pz=z if axis=='x' else z+off
        solid(n+' post-'+str(j),px,y,pz,.19,1.13,.19,W,bevel=.015)
# Foundation is a mapped floor; pavers finish precisely at y=0.
solid('yard-foundation',0,-.62,0,48,.592,48,W,'platform',.07)
for ix in range(24):
    for iz in range(24):
        x=-23+ix*2;z=-23+iz*2
        deco('courtyard paver',x,-.028,z,1.96,.028,1.96,random.choice(['Paving | blue gray','Paving | blue gray','Paving | pale']),.009)
# Distinct perimeter edge, low enough to see the complete walkable arena.
for s in [-1,1]:
    solid('boundary-x'+str(s),s*23.75,0,0,.5,1.0,48,W)
    solid('boundary-z'+str(s),0,0,s*23.75,47.5,1.0,.5,W)
    for v in range(-21,22,6):
        deco('perimeter cap',s*23.75,.88,v,.49,.11,1.65,P)
        strip('perimeter cyan',s*23.73,.62,v,.505,.10,.8)
        deco('perimeter cap',v,.88,s*23.75,1.65,.11,.49,P)
        strip('perimeter cyan',v,.62,s*23.73,.8,.10,.505)
# Complete square rooftop loop, 3.6m above ground with 3.2m undercroft.
for s in [-1,1]:
    solid('roof-walk-z'+str(s),0,3.2,s*16,36,.4,4,P,'platform')
    solid('roof-walk-x'+str(s),s*16,3.2,0,4,.4,28,P,'platform')
    for v in [-16,-8,8,16]:
        solid('pier-z'+str((s,v)),v,0,s*16.8,1.45,3.2,1.55,W)
        face_detail('pier-z'+str((s,v)),v,0,s*16.8,1.45,3.2,1.55)
    for v in [-8,0,8]:
        solid('pier-x'+str((s,v)),s*16.8,0,v,1.55,3.2,1.45,W)
        face_detail('pier-x'+str((s,v)),s*16.8,0,v,1.55,3.2,1.45)
    # Outer parapets at roof height; undercrofts remain open for flanks.
    rail('outer-z'+str(s),0,s*17.88,35.65)
    rail('outer-x'+str(s),s*17.88,0,27.65,'z')
    rail('inner-x'+str(s),s*14.13,0,27.5,'z')
    for idx,(cx,l) in enumerate([(-12.25,3.45),(0,14.75),(12.25,3.45)]):rail('inner-z'+str((s,idx)),cx,s*14.12,l)
    strip('roof fascia z'+str(s),0,3.29,s*14.015,35.5,.13,.025)
    strip('roof fascia x'+str(s),s*14.015,3.29,0,.025,.13,27.4)
# Four physically connected, shallow-rise stair routes to the rooftop ring.
for s in [-1,1]:
    for x in [-9,9]:
        for i in range(12):
            z=s*(6.8+(i+.5)*.6);h=(i+1)*.3
            solid('stair-'+str((s,x,i)),x,0,z,3,h,.603,W,'step',.015)
            strip('stair safety edge',x,h-.025,z-s*.269,2.8,.026,.042,A)
        # Toe arrows laid into the ground: cosmetic and no collision.
        for j in range(3):strip('stair approach stripe',x,-.001,s*(5.5-j*.35),1.8,.004,.10,CY)
# Layered corner architecture attached to catwalks, intentionally asymmetrical height.
for index,(x,z,h) in enumerate([(-19,-19,5.4),(19,-19,6.6),(-19,19,4.5),(19,19,5.1)]):
    solid('corner bastion-'+str(index),x,0,z,3.8,h,3.8,C,bevel=.07)
    for yy in [0.25,2.5,h-.5]:deco('bastion armor band',x,yy,z,3.76,.25,3.76,E)
    deco('bastion roof',x,h-.15,z,3.76,.15,3.76,P)
    for sx in [-1,1]:
        deco('bastion vertical armor',x+sx*1.65,.14,z,.34,h-.2,3.76,P)
        strip('bastion cyan marker',x+sx*1.79,1.3,z,.085,1.4,3.75,CY)
    # Modular exterior armor seams give the silhouette readable industrial scale.
    for face in [-1,1]:
        for col in [-1,0,1]:
            for row in range(int(h/1.15)):
                yy=.12+row*1.15
                deco('bastion armor plate',x+col*1.12,yy,z+face*1.904,1.02,1.04,.032,W,.025)
                deco('bastion side armor plate',x+face*1.904,yy,z+col*1.12,.032,1.04,1.02,W,.025)
        strip('bastion face status',x+1.40,1.05,z+face*1.927,.10,1.85,.018,CY)
        strip('bastion side status',x+face*1.927,1.05,z-1.40,.018,1.85,.10,CY)
    crate('bastion rooftop service-'+str(index),x,z,1.7,1.4,.65,h)
    # Top ventilation stack remains within the mapped solid.
    deco('bastion inset louver',x,h+.001,z,2.4,.025,2.35,E)
    for j in range(7):deco('roof vent slat',x+(j-3)*.29,h+.023,z,.13,.016,2.2,P,.002)
# Ground-level underpass wings frame red paths without blocking the outer lanes.
for s in [-1,1]:
    for x in [-5.4,5.4]:
        solid('underpass wing'+str((s,x)),x,0,s*17,2.0,2.7,2.0,C)
        face_detail('tunnel wing'+str((s,x)),x,0,s*17,2,2.7,2,True)
    solid('crawl tunnel lintel'+str(s),0,1.36,s*16.4,4.6,1.84,1.2,W)
    strip('crawl warning',0,1.41,s*15.787,3.8,.075,.024,R)
    strip('crawl warning back',0,1.41,s*17.013,3.8,.075,.024,R)
    for x in [-2.42,2.42]:
        solid('crawl tunnel side'+str((s,x)),x,0,s*16.4,.3,3.2,1.2,C)
        strip('crawl threshold',x-s*.02,.13,s*15.79,.08,1.11,.03,R)
# Eight plaza planters and a dozen varied vault/hide cover pieces.
for i,(x,z,w,d) in enumerate([(-4.6,-4.2,4.4,1.7),(4.6,4.2,4.4,1.7),(-4.4,4.9,1.7,3.7),(4.4,-4.9,1.7,3.7),(-11.7,0,1.65,4),(11.7,0,1.65,4),(-20.3,-9,2.1,3.5),(20.3,9,2.1,3.5)]):planter('planter-'+str(i),x,z,w,d)
for i,(x,z,w,d,h,y) in enumerate([(-8,0,1.6,2.1,1.6,0),(8,0,1.6,2.1,1.6,0),(-2,-8,2.2,1.5,1.2,0),(2,8,2.2,1.5,1.2,0),(-12,-10.6,1.7,1.7,2.25,0),(12,10.6,1.7,1.7,2.25,0),(-21,4,1.8,2,1.7,0),(21,-4,1.8,2,1.7,0),(-4,-16,1.6,1.6,1.3,3.6),(4,16,1.6,1.6,1.3,3.6),(-16,7,1.8,1.6,1.15,3.6),(16,-7,1.8,1.6,1.15,3.6)]):crate('supply crate-'+str(i),x,z,w,d,h,y)
# Portal architecture contains NO portal surfaces: gameplay creates the interactables.
# Both north/south alcoves are grounded, wide and have unobstructed 2.6m exit lanes.
for s in [-1,1]:
    z=s*21.2
    solid('mirror alcove back'+str(s),0,0,s*22.65,6.5,5.8,.60,W,bevel=.06)
    for xx in [-3.0,3.0]:
        solid('mirror alcove jamb'+str((s,xx)),xx,0,z,.65,5.8,3.25,C,bevel=.06)
        deco('alcove vertical armor',xx,.15,z,.62,5.5,3.20,P)
        strip('alcove cyan vertical',xx-s*.02,.4,z-s*1.58,.19,4.55,.065,CY)
    solid('mirror alcove crown'+str(s),0,5.15,z,5.45,.65,3.25,C,bevel=.06)
    strip('mirror alcove crown cyan',0,5.18,z-s*1.58,4.8,.12,.055,CY)
    deco('mirror alcove inner backing',0,.3,s*22.335,5.3,4.5,.025,E)
    for xx in [-2,2]:strip('mirror alcove status',xx,3.5,s*22.31,.08,.8,.03,A)
# Tall central triangular signal sculpture. Stepped AABBs approximate sloping mass;
# each tier has matching visual box; decorative triangle strips stay on the facade.
solid('signal plinth',0,0,0,4.0,.3,3.4,W,'step',.06)
solid('signal base',0,.3,0,3.5,.3,2.9,P,'step',.045)
for i in range(7):
    width=3.0-i*.36
    solid('signal monument tier-'+str(i),0,.6+i*.55,0,width,.55,2.1,E,bevel=.02)
# Mesh triangle tubes in X/Y-up plane; confined to proxy silhouette.
def beam_between(n,a,b,r,m):
    a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));delta=b-a
    bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=delta.length,location=(a+b)/2)
    o=bpy.context.object;o.name=n;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler();o.data.materials.append(M[m]);cosmetic.append(o)
for s in [-1,1]:
    verts=[(-1.12,.94,s*1.057),(1.12,.94,s*1.057),(0,3.7,s*1.057)]
    for i in range(3):beam_between('central cyan triangle',verts[i],verts[(i+1)%3],.075,CY)
    strip('signal plinth cyan',0,.34,s*1.451,2.75,.09,.016,CY)
# Paving lane markers and recessed service hatch details; surface-only.
for s in [-1,1]:
    for v in range(-18,19,3):
        strip('flank dash',s*20.15,-.001,v,.09,.006,1.25,A)
    for x in [-5,5]:
        for z in [-11,11]:
            deco('drain bed',x,.001,z,1.8,.012,.6,E,.001)
            for j in range(7):deco('drain rib',x+(j-3)*.23,.012,z,.07,.011,.5,P,.001)
# Ground spawn and mirror exit validation against all authored collision AABBs.
spawns=[dict(x=x,y=0,z=z) for x,z in [(-21,-15),(21,15),(-21,15),(21,-15),(-20,0),(20,0),(-7,-21),(7,21),(7,-21),(-7,21),(-6.7,2.8),(6.7,-2.8)]]
mirrors=[dict(id='yard-a',target='yard-b',label='YARD',x=0,y=0,z=-21.1,yaw=math.pi,exit=dict(x=0,y=0,z=-18.4)),dict(id='yard-b',target='yard-a',label='YARD',x=0,y=0,z=21.1,yaw=0,exit=dict(x=0,y=0,z=18.4))]
# yaw follows existing game's convention: face direction is (-sin(yaw),-cos(yaw)).
for p in spawns+[m['exit'] for m in mirrors]:
    for b in boxes:
        if b['y']+b['h'] <=p['y']+.001 or b['y']>=p['y']+2.16:continue
        assert not (abs(p['x']-b['x'])<b['w']/2+.36 and abs(p['z']-b['z'])<b['d']/2+.36),('blocked spawn/exit',p,b['id'])
waypoints=[dict(x=x,y=0,z=z) for x,z in [(-21,-15),(21,15),(-21,15),(21,-15),(-20,0),(20,0),(-7,-21),(7,21),(7,-21),(-7,21),(-6.7,2.8),(6.7,-2.8),(0,-6),(0,6),(-6,0),(6,0)]]
mapdata=dict(id='mirror-yard',name='Mirror Yard',half=24,recommended='2–8 players',description='A layered industrial courtyard. Climb four stair routes to the rooftop loop, crouch through red service tunnels, or escape through paired mirror alcoves.',theme='industrial',boxes=boxes,spawns=spawns,waypoints=waypoints,mirrors=mirrors,landmarks=[dict(name='MIRROR YARD',x=0,y=6.2,z=-21.5),dict(name='SIGNAL COURT',x=0,y=4.8,z=0),dict(name='ROOFTOP LOOP',x=-16,y=5,z=0)])
(OUT/'map.json').write_text(json.dumps(mapdata,indent=2)+'\n',encoding='utf8')
# Bake cosmetics to one mesh per material; mapped physical meshes retain collisionId.
for material in M.values():
    group=[o for o in bpy.context.scene.objects if o.type=='MESH' and 'collisionId' not in o and o.data.materials and o.data.materials[0]==material]
    if not group:continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in group:o.select_set(True)
    bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='Detail batch | '+material.name
# Render-only presentation rig. It is excluded from GLB export.
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=40
scene.cycles.use_denoising=True
scene.world.color=(.16,.19,.24)
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.105,.145,.20,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.48
bpy.ops.object.light_add(type='AREA',location=(-18,-8,35));key=bpy.context.object;key.name='Render key';key.data.energy=21000;key.data.shape='DISK';key.data.size=27
bpy.ops.object.light_add(type='AREA',location=(22,15,22));key=bpy.context.object;key.name='Render fill';key.data.energy=13000;key.data.size=22;key.data.color=(.58,.73,1)
bpy.ops.object.light_add(type='AREA',location=(-15,24,15));key=bpy.context.object;key.name='Render rim';key.data.energy=9500;key.data.size=14;key.data.color=(1,.70,.48)
for s in [-1,1]:
    bpy.ops.object.light_add(type='POINT',location=(0,-s*16.2,1.0));o=bpy.context.object;o.name='Render tunnel red';o.data.energy=110;o.data.color=(1,.025,.008);o.data.shadow_soft_size=1.2
    bpy.ops.object.light_add(type='AREA',location=(0,-s*21,3));o=bpy.context.object;o.name='Render alcove cyan';o.data.energy=100;o.data.color=(.02,.6,1);o.data.size=2
# Studio ground is render-only and below mapped foundation.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.70));ground=bpy.context.object;ground.name='Render backdrop';ground.data.materials.append(mat('Backdrop',(.055,.072,.088),0,.85))
bpy.ops.object.camera_add(location=(49,-60,54));cam=bpy.context.object;cam.name='Presentation camera';scene.camera=cam
cam.rotation_euler=(Vector((0,0,1.7))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=72
scene.render.resolution_x=1400;scene.render.resolution_y=1050;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
# Restrict export to world mesh objects. No lights/camera/backdrop/interactable mirrors.
bpy.ops.object.select_all(action='DESELECT')
world_objects=[o for o in scene.objects if o.type=='MESH' and o!=ground]
for o in world_objects:o.select_set(True)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in world_objects)
bpy.ops.export_scene.gltf(filepath=str(GLB),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
scene.render.filepath=str(OUT/'preview.png')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'mirror-yard.blend'))
print('MIRROR_YARD_EXPORT',json.dumps(dict(collisionBoxes=len(boxes),meshObjects=len(world_objects),triangles=triangles,glbBytes=GLB.stat().st_size)))
if not os.environ.get('ECHO_SKIP_RENDER'):
    bpy.ops.render.render(write_still=True)
    cam.data.type='PERSP';cam.data.lens=22;cam.location=(-5,-11,2.1);cam.rotation_euler=(Vector((0,5,2.8))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.resolution_x=1400;scene.render.resolution_y=875;scene.render.filepath=str(OUT/'ground-view.png');bpy.ops.render.render(write_still=True)
metadata=dict(id='mirror-yard',name='Mirror Yard',generator='scripts/worlds/mirror_yard.py',blender=bpy.app.version_string,seed=7219,reference='echo-character-assets/assets/d740b259-4d28-4d6b-9f46-a7610bfe7776.png',createdFrom='Original meshes authored in Blender from user-supplied concept art; no downloaded models or textures.',coordinates='map: x/y-up/z metres; Blender: x/-z/y; glTF exporter converts back to y-up',collisionBoxes=len(boxes),meshObjects=len(world_objects),triangles=triangles,glbBytes=GLB.stat().st_size,materials=len({m.name for o in world_objects for m in o.data.materials}),stairRoutes=4,stairRise=.3,stairTread=.6,stairWidth=3,catwalkTop=3.6,crawlClearance=1.36,standingClearanceUnderCatwalk=3.2,groundSpawns=len(spawns),mirrors=len(mirrors),validation=['All 12 ground spawns and both mirror exits clear for radius .36 and height 2.16.','All physical meshes carry collisionId and are generated from exact map AABBs.','Every catwalk connects to 4 physical stair runs of twelve 0.3m rises.','Runtime GLB excludes presentation rig, backdrop and interactable mirror meshes.'],notes=['Foliage is soft cosmetic material inside planters; non-solid leaf clusters have no collider.','Small bevels, seams, light ribbons and paved surface details are cosmetic.','Guard rail panels are solid metal with emissive ribbon, matching their collision boxes.','No game motor or authoritative rules changed.'])
(OUT/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n',encoding='utf8')
print('MIRROR_YARD_COMPLETE',str(GLB))
