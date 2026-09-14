"""Original Neon Carnival model, authored in Blender from the supplied concept.

Run with Blender --background --python-exit-code 1 --python this_file.py.
Game coordinates are metres, Y up; Blender uses (x, -z, y).
"""
import bpy
import bmesh
import json
import math
import random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
RULES = json.loads((ROOT / 'shared/rules.json').read_text(encoding='utf-8'))
BODY_RADIUS = RULES['radius']
BODY_HEIGHT = RULES['height']
OUT = ROOT / 'assets-src/worlds/neon-carnival'
RUNTIME = ROOT / 'public/assets/worlds/neon-carnival.glb'
OUT.mkdir(parents=True, exist_ok=True)
RUNTIME.parent.mkdir(parents=True, exist_ok=True)
random.seed(29)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.unit_settings.system = 'METRIC'
bpy.context.scene.unit_settings.scale_length = 1
bpy.context.preferences.filepaths.save_version = 0

def xyz(p):
    return (p[0], -p[2], p[1])

def mat(name, color, metal=0, glow=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = .38 if metal else .7
    if glow:
        p.inputs['Emission Color'].default_value = (*color, 1)
        p.inputs['Emission Strength'].default_value = glow
    return m

NAVY = mat('Midnight enamel', (.024, .052, .092), .35)
RED = mat('Oxblood carnival paint', (.32, .035, .075), .18)
ROSE = mat('Faded velvet rose', (.55, .105, .2), .15)
CREAM = mat('Warm porcelain', (.68, .56, .39))
GOLD = mat('Brushed brass', (.64, .34, .075), .75)
METAL = mat('Steel chassis', (.105, .15, .21), .7)
FLOOR = mat('Blue paving', (.065, .1, .145))
PAVER = mat('Paving variation', (.09, .13, .18))
CYAN = mat('Electric cyan', (.025, .75, 1), .2, 3)
PINK = mat('Neon pink', (1, .018, .32), .2, 3)
VIOLET = mat('Violet neon', (.44, .065, 1), .2, 3)
BULB = mat('Amber bulbs', (1, .5, .12), .1, 4)
BLACK = mat('Rubber', (.014, .019, .027))
GLASS = mat('Iridescent mirror blue', (.055, .23, .33), .8)
GREEN = mat('Palm leaves', (.075, .22, .12))
WOOD = mat('Timber', (.18, .095, .06))

layout = dict(id='neon-carnival', name='Neon Carnival', half=32,
              recommended='4–12 players',
              description='A neon fairground: carousel plaza, arcade rooftops, bumper court and a crouch tunnel.',
              theme='carnival', boxes=[], spawns=[], waypoints=[], mirrors=[], landmarks=[])
cosmetics = []
solids = []

def mesh(name, verts, faces, material, cosmetic=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata([xyz(v) for v in verts], [], faces)
    data.materials.append(material)
    ob = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(ob)
    (cosmetics if cosmetic else solids).append(ob)
    return ob

def cube(name, pos, size, material, cosmetic=True):
    x, y, z = pos
    w, h, d = (a / 2 for a in size)
    vs = [(x+a*w,y+b*h,z+c*d) for a,b,c in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return mesh(name, vs, [(2,6,4,0),(5,7,3,1),(4,5,1,0),(3,7,6,2),(1,3,2,0),(6,7,5,4)], material, cosmetic)

def pennant(name, verts, material):
    # A thin closed triangle has visible front and back in single-sided glTF materials.
    points = [Vector(v) for v in verts]
    normal = (points[1]-points[0]).cross(points[2]-points[0]).normalized() * .01
    points = [tuple(p+normal) for p in points] + [tuple(p-normal) for p in points]
    return mesh(name, points, [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)], material)

def box(name, x, z, w, d, h, material=NAVY, y=0, kind='cover'):
    b = dict(id=name, x=x, z=z, w=w, d=d, h=h, y=y, kind=kind)
    layout['boxes'].append(b)
    ob = cube(name, (x,y+h/2,z), (w,h,d), material, False)
    ob['collisionId'] = name
    return ob

def cylinder(name, pos, radius, depth, material, vertices=16):
    x,y,z=pos
    verts=[(x+radius*math.cos(i*math.tau/vertices),y+s*depth/2,z+radius*math.sin(i*math.tau/vertices)) for s in [-1,1] for i in range(vertices)]
    faces=[tuple(range(vertices)),tuple(range(2*vertices-1,vertices-1,-1))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    return mesh(name,verts,faces,material)

def sphere(name, pos, radius, material):
    bm=bmesh.new()
    bmesh.ops.create_icosphere(bm,subdivisions=1,radius=radius)
    data=bpy.data.meshes.new(name)
    bm.to_mesh(data)
    bm.free()
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=xyz(pos)
    data.materials.append(material)
    cosmetics.append(ob)
    return ob

def beam(name, a, b, radius, material, vertices=8):
    start,end=Vector(a),Vector(b)
    axis=(end-start).normalized()
    u=axis.cross(Vector((0,1,0)) if abs(axis.y)<.9 else Vector((1,0,0))).normalized()
    v=axis.cross(u)
    verts=[tuple(p+radius*(u*math.cos(i*math.tau/vertices)+v*math.sin(i*math.tau/vertices))) for p in [start,end] for i in range(vertices)]
    faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,2*vertices))]
    faces += [(i,(i+1)%vertices,(i+1)%vertices+vertices,i+vertices) for i in range(vertices)]
    return mesh(name,verts,faces,material)

def ring(name, x, y, z, radius, material, thickness=.07, n=64, vertical=False):
    for i in range(n):
        a, b = i*math.tau/n, (i+1)*math.tau/n
        p = (x+radius*math.cos(a), y+radius*math.sin(a), z) if vertical else (x+radius*math.cos(a),y,z+radius*math.sin(a))
        q = (x+radius*math.cos(b), y+radius*math.sin(b), z) if vertical else (x+radius*math.cos(b),y,z+radius*math.sin(b))
        beam(name, p,q,thickness,material,6)

def text(name, body, x, y, z, size, material, yaw=0):
    data = bpy.data.curves.new(name,'FONT')
    data.body = body
    data.align_x = 'CENTER'
    data.size = size
    data.extrude = .012
    data.bevel_depth = .003
    ob = bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location = xyz((x,y,z))
    ob.rotation_euler = (math.pi/2,0,yaw)
    data.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.convert(target='MESH')
    cosmetics.append(bpy.context.object)

def bulbs_line(a,b,count):
    for i in range(count):
        t=i/max(1,count-1)
        sphere('Festoon bulb',tuple(a[k]*(1-t)+b[k]*t for k in range(3)),.075,BULB)

def rail(name,x,z,w,d,y):
    # A real narrow rail box prevents walking through its visible frame.
    box(name,x,z,w,d,1.05,METAL,y)
    cube(name+' brass top',(x,y+1.05,z),(w+.05,.09,d+.05),GOLD)
    cube(name+' light',(x,y+.76,z),(w+.02,.035,d+.02),CYAN)

def stairs(name,x,z,w,count=14,direction=-1):
    for i in range(count):
        box(name+str(i),x,z+direction*i*.48,w,.49,(i+1)*.3,METAL,kind='step')
        cube(name+' nosing',(x,(i+1)*.3+.006,z+direction*i*.48-direction*.21),(w,.012,.045),BULB)

def crate(name,x,z,w=1.8,h=1.4):
    box(name,x,z,w,w,h,ROSE)
    for k in [-1,1]:
        cube(name+' bands',(x+k*(w/2-.12),h/2,z),( .12,h+.01,w+.01),GOLD)
    cube(name+' top',(x,h+.004,z),(w,.008,w),CREAM)
    text(name+' star','✦',x,h*.3,z+w/2+.012,h*.6,CREAM)

# Ground is the same y=0 plane as the authoritative motor.
cube('Continuous ground',(0,-.18,0),(64,.36,64),FLOOR)
for x in range(-31,32,2):
    for z in range(-31,32,2):
        if (x+z)%6 == 0:
            cube('Inlaid paving',(x,.002,z),(1.94,.004,1.94),PAVER)
for s in [-1,1]:
    cube('Boundary wall',(s*32.45,1.6,0),(.9,3.2,65),NAVY)
    cube('Boundary wall',(0,1.6,s*32.45),(64,3.2,.9),NAVY)
    cube('Perimeter light',(s*31.98,.04,0),(.045,.04,63),PINK)
    cube('Perimeter light',(0,.04,s*31.98),(63,.04,.045),CYAN)

# Carousel: square accessible podium, circular ride crown, brass poles and striped canopy.
box('carousel-plaza',0,0,13,13,.6,RED,kind='platform')
for s in [-1,1]:
    box('plaza-step-x'+str(s),s*7,0,1,5,.3,METAL,kind='step')
    box('plaza-step-z'+str(s),0,s*7,5,1,.3,METAL,kind='step')
box('carousel-core',0,0,1.5,1.5,7.3,RED,y=.6)
for s in [-1,1]:
    cube('Core mirror',(s*.76,3,0),(.012,3.4,1.1),GLASS)
    cube('Core mirror',(0,3,s*.76),(1.1,3.4,.012),GLASS)
for i in range(8):
    a=i*math.tau/8
    x,z=5*math.cos(a),5*math.sin(a)
    box('carousel-pole-'+str(i),x,z,.19,.19,6.9,GOLD,y=.6)
    # Folded ride seats are compact, honest cover blocks with decorated faces.
    box('carousel-seat-'+str(i),x,z,1.05,.8,1.05,ROSE,y=.6)
    cube('Seat cushion',(x,1.68,z),(1.02,.07,.78),CREAM)
    sphere('Pole finial',(x,7.45,z),.2,BULB)
ring('Carousel crown',0,7.45,0,6.4,GOLD,.16)
ring('Carousel lower light',0,.63,0,6.15,PINK,.045)
for i in range(48):
    a,b=i*math.tau/48,(i+1)*math.tau/48
    mesh('Striped carousel canopy',[(6.65*math.cos(a),7.6,6.65*math.sin(a)),(6.65*math.cos(b),7.6,6.65*math.sin(b)),(1.0*math.cos(b),10,1.0*math.sin(b)),(1.0*math.cos(a),10,1.0*math.sin(a))],[(3,2,1,0)],RED if i%4<2 else CREAM)
    sphere('Carousel marquee bulb',(6.48*math.cos(a),7.37,6.48*math.sin(a)),.095,BULB)
    if i%4==0:
        beam('Roof seam',(6.6*math.cos(a),7.62,6.6*math.sin(a)),(math.cos(a),10.03,math.sin(a)),.045,GOLD)
cylinder('Carousel roof cap',(0,10,0),1.05,.22,GOLD)
beam('Flagpole',(0,10,0),(0,11.9,0),.06,GOLD)
pennant('Pennant',[(0,11.9,0),(1.5,11.55,0),(0,11.2,0)],PINK)

def pavilion(name,x,z,title,accent):
    # Door at front plus two side exits. Roof is a real platform.
    for s in [-1,1]:
        box(name+' front '+str(s),x+s*4,z+4.5,5,.45,4,RED)
        box(name+' side '+str(s),x+s*6.5,z-1,.45,7,4,RED)
    box(name+' back',x,z-4.5,13,.45,4,NAVY)
    box(name+' door lintel',x,z+4.5,3,.45,1.2,RED,y=2.8)
    box(name+' rooftop',x,z,13.5,9.6,.24,METAL,y=4.0,kind='platform')
    cube(name+' fascia',(x,3.8,z+4.77),(13.4,.4,.12),GOLD)
    cube(name+' neon edge',(x,4.08,z+4.87),(13.5,.07,.06),accent)
    text(name+' sign',title,x,3.05,z+4.79,.82,accent)
    bulbs_line((x-6.3,4.0,z+4.88),(x+6.3,4.0,z+4.88),32)
    for s in [-1,1]:
        if s == -1:
            # The west connector meets this side; leave its full 3m width open.
            for segment in [-1,1]:
                rail(name+' roof rail west '+str(segment),x-6.5,z+segment*3,.13,3,4.24)
        else:
            rail(name+' roof rail '+str(s),x+s*6.5,z,.13,9,4.24)
        # Neon-edged poster panels are flush against solid wall surfaces.
        cube(name+' poster',(x+s*4.1,1.8,z+4.735),(2.3,1.8,.018),NAVY)
        text(name+' poster text','PLAY',x+s*4.1,1.75,z+4.76,.48,CREAM)

pavilion('arcade',18,-17,'ARCADE',PINK)
stairs('arcade-stair-',18,-5.85,3)
rail('arcade-back-rail',18,-21.65,13,.13,4.24)
box('arcade roof plant',21,-17,2,2,1.2,RED,y=4.24)
text('Arcade rooftop title','ECHO',18,6.3,-20.8,1.35,CYAN)
for x in [13,16,20,23]:
    box('arcade-machine-'+str(x),x,-19.5,.9,.7,1.8,NAVY)
    cube('Cabinet screen',(x,1.25,-19.135),(.68,.7,.025),VIOLET if x%2 else CYAN)
    cube('Control deck',(x,.85,-19.1),(.88,.07,.2),GOLD)
    text('Cabinet label','E',x,.22,-19.13,.25,PINK)

# Bumper court with overhead festoons and low ride cover.
for s in [-1,1]:
    box('bumper-border-'+str(s),-18+s*7,16,.35,12,.6,RED)
box('bumper-back',-18,22,14,.35,.6,RED)
cube('Bumper floor',(-18,.015,16),(13.6,.025,11.6),GLASS)
for i,(x,z) in enumerate([(-21,13),(-16,14),(-20,19),(-14.5,19)]):
    box('bumper-car-'+str(i),x,z,2.3,1.65,.76,ROSE if i%2 else NAVY)
    cube('Rubber bumper',(x,.24,z),(2.33,.22,1.68),BLACK)
    cube('Bumper windscreen',(x,.62,z-.6),(1.8,.22,.045),CYAN)
    beam('Car aerial',(x,.76,z-.5),(x,2.9,z-.5),.018,METAL)
for x in [-24,-12]:
    for z in [10,22]:
        box('court-post-'+str(x)+'-'+str(z),x,z,.25,.25,5,GOLD)
for z in [10,22]:
    beam('Court festoon',(-24,5,z),(-12,5,z),.025,METAL)
    bulbs_line((-24,4.94,z),(-12,4.94,z),24)
text('Bumper sign','BUMP!',-18,5.1,22.3,1.15,PINK)

# Crouch tunnel: stepped roof catwalk and 1.25m clear lower route.
box('tunnel-left',-23,-12,.65,11,3.9,VIOLET)
box('tunnel-right',-19,-12,.65,11,3.9,NAVY)
box('tunnel-crouch-ceiling',-21,-12,3.35,11,2.65,ROSE,y=1.25)
box('tunnel-roof',-21,-12,5,11.5,.3,METAL,y=3.9,kind='platform')
# Put the roof approach beside the tunnel so neither crouch entrance is blocked.
stairs('tunnel-stair-',-17,.1,3)
box('tunnel-stair-landing',-17,-7.25,3,2,.3,METAL,y=3.9,kind='platform')
for z in [-17.6,-6.4]:
    for s in [-1,1]:
        cube('Tunnel trim',(-21+s*1.5,.62,z),(.075,1.22,.075),CYAN)
    cube('Tunnel lip',(-21,1.24,z),(3.05,.065,.075),PINK)
text('Tunnel title','SLIDE',-21,2.15,-6.36,.65,CYAN)
rail('Tunnel outer rail',-23.36,-12,.13,10.8,4.2)
# Overhead catwalk linking west tunnel roof to north promenade.
box('north-high-walk',-7.5,-17,22,3,.25,METAL,y=3.95,kind='platform')
rail('north-walk-rail',-7.5,-18.45,22,.13,4.2)
for x in [-15,-7,0]:
    box('north-walk-support-'+str(x),x,-17,.42,.42,3.95,GOLD)
    cube('Support light',(x,2.2,-16.775),(.1,1.4,.026),CYAN)
box('arcade-connector',7.5,-17,8,3,.25,METAL,y=3.95,kind='platform')

# Mirror maze panels are opaque physical cover, never live actor reflections.
for i,(x,z,w,d) in enumerate([(15,2,.3,7),(20,5,8,.3),(24,1,.3,8),(19,-2,6,.3)]):
    box('mirror-maze-'+str(i),x,z,w,d,3.2,GLASS)
    cube('Mirror top glow',(x,3.2,z),(w+.04,.065,d+.04),VIOLET)
    for k in [-1,1]:
        px,pz=(x+k*(w/2-.13),z) if w>d else (x,z+k*(d/2-.13))
        cube('Mirror frame',(px,1.6,pz),(.12,3.2,.12),GOLD)

# Funhouse face around a real walk-through mouth.
for s in [-1,1]:
    box('funhouse-cheek-'+str(s),18+s*3.8,17,3.6,.7,6,ROSE)
    box('funhouse-side-'+str(s),18+s*5.6,19,.5,4.8,4,RED)
box('funhouse-brow',18,17,4,.7,3.1,ROSE,y=2.9)
box('funhouse-roof',18,19,11.6,5,.3,METAL,y=6,kind='platform')
for s in [-1,1]:
    sphere('Clown glowing eye',(18+s*2.6,4.9,17.42),.45,CYAN)
    sphere('Clown cheek',(18+s*4.4,3.5,17.42),.58,PINK)
sphere('Clown nose',(18,3.95,17.5),.7,RED)
for x in [16.5,17.5,18.5,19.5]:
    cube('Funhouse tooth',(x,2.96,17.42),(.6,.13,.18),CREAM)
text('Funhouse sign','FUNHOUSE',18,6.8,17.25,.8,PINK)
for i in range(9):
    x=12.8+i*1.3
    pennant('Jester roof pennant',[(x-.7,6.3,17),(x+.7,6.3,17),(x,8.0+(i%2)*.7,18)],VIOLET if i%2 else GOLD)

def booth(i,x,z):
    box('ticket-booth-'+str(i),x,z,2.8,2.4,2.7,RED)
    cube('Ticket window',(x,1.75,z+1.215),(2.1,1.25,.025),NAVY)
    cube('Ticket counter',(x,1.1,z+1.25),(2.8,.12,.1),GOLD)
    cube('Ticket cap',(x,2.78,z),(3.1,.16,2.7),GOLD)
    text('Tickets','TICKETS',x,2.32,z+1.24,.38,BULB)
    mesh('Booth canopy',[(x-1.7,2.9,z-1.5),(x+1.7,2.9,z-1.5),(x+1.7,2.9,z+1.5),(x-1.7,2.9,z+1.5),(x,4,z)],[(4,1,0),(4,2,1),(4,3,2),(4,0,3)],ROSE)
    bulbs_line((x-1.4,2.85,z+1.4),(x+1.4,2.85,z+1.4),9)
for i,x in enumerate([-6,0,6]):
    booth(i,x,23)
for x,z in [(-10,-6),(10,10),(-9,10),(10,-9),(-16,-24),(26,10)]:
    crate('vault-crate-'+str(x)+'-'+str(z),x,z)

# Distinctive skyline: Ferris wheel and coaster are outside playable bounds.
wx,wy,wz=15,18,-41
for s in [-1,1]:
    beam('Ferris support',(wx+s*8,0,wz+3),(wx,wy,wz),.4,GOLD)
ring('Ferris outer rim',wx,wy,wz,13.5,ROSE,.15,80,True)
ring('Ferris neon rim',wx,wy,wz+.18,13.3,PINK,.065,80,True)
ring('Ferris hub',wx,wy,wz,1.5,GOLD,.15,32,True)
for i in range(16):
    a=i*math.tau/16
    x,y=wx+13.5*math.cos(a),wy+13.5*math.sin(a)
    beam('Ferris spoke',(wx,wy,wz),(x,y,wz),.075,GOLD)
    beam('Ferris LED',(wx,wy,wz+.08),(x,y,wz+.08),.03,VIOLET)
    cube('Gondola',(x,y-1.1,wz),(1.5,1.6,1.3),RED)
    cube('Gondola window',(x,y-.9,wz+.66),(1.2,.8,.035),CYAN)
    sphere('Rim light',(x,y,wz+.15),.16,BULB)
for i in range(110):
    t=i/109
    x=-51+t*102
    y=9+10*(.5+.5*math.sin(t*math.tau*1.5))**2
    z=-38-4*math.cos(t*math.tau)
    if i:
        for offset in [-.75,.75]:
            beam('Coaster rail',(prev[0],prev[1],prev[2]+offset),(x,y,z+offset),.09,ROSE)
        beam('Coaster sleeper',(x,y,z-.85),(x,y,z+.85),.06,GOLD)
    if i%6==0:
        beam('Coaster column',(x,0,z),(x,y,z),.15,METAL)
    prev=(x,y,z)
text('Skyline ECHO','E C H O',0,12.5,-31.9,2.5,BULB)
text('Skyline subtitle','WORLDS PLAY TOGETHER',0,11.4,-31.85,.53,PINK)
for x in [-9,9]:
    cube('ECHO marquee tower',(x,7,-33),(1,14,1),NAVY)
    cube('Tower strip',(x,8,-32.48),(.14,9,.03),CYAN)

# Lamps have solid slim bases, with canopies above normal headroom.
for i,(x,z) in enumerate([(-28,-2),(-28,25),(28,-26),(28,26),(-10,17),(9,-24),(-8,-25),(10,17)]):
    box('lamp-post-'+str(i),x,z,.22,.22,5,GOLD)
    cube('Lamp lantern',(x,4.85,z),(.48,.65,.48),BULB)
    cube('Lamp lid',(x,5.24,z),(.68,.12,.68),NAVY)
    for s in [-1,1]:
        cube('Lantern frame',(x+s*.2,4.85,z),(.04,.7,.5),METAL)

# Flush ornamental panel work gives the park a built, maintained material language.
for b in list(layout['boxes']):
    if b['id'].startswith(('arcade front','funhouse-cheek','ticket-booth')):
        x,z,w,d,h,y=(b[k] for k in ['x','z','w','d','h','y'])
        for side in [-1,1]:
            cube('Brass facade pilaster',(x+side*(w/2-.09),y+h/2,z+d/2+.012),(.1,h,.024),GOLD)
        cube('Facade skirting',(x,y+.15,z+d/2+.012),(w,.16,.024),GOLD)
    if b['id'].startswith('bumper-car-'):
        x,z,w,d,h=(b[k] for k in ['x','z','w','d','h'])
        for side in [-1,1]:
            sphere('Bumper headlight',(x+side*.76,.57,z+d/2+.03),.11,BULB)
        cube('Car racing stripe',(x,h+.004,z),(.24,.008,d),GOLD)

# Bunting and strings cross above the routes, leaving generous headroom.
for z in [-9,10]:
    for i in range(18):
        x=-8.5+i
        y=6.3-.6*math.sin(i/17*math.pi)
        beam('Festival cable',(x,y,z),(x+1,6.3-.6*math.sin((i+1)/17*math.pi),z),.015,METAL,6)
        mesh('Festival flag',[(x+.15,y,z),(x+.85,y,z),(x+.5,y-.7,z),
                              (x+.15,y,z+.012),(x+.85,y,z+.012),(x+.5,y-.7,z+.012)],
             [(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)],PINK if i%2 else CYAN)
        sphere('Festival cable bulb',(x,y-.05,z),.055,BULB)

# Low planters supply cover while clustered foliage stays inside their proxy bounds.
for i,(x,z) in enumerate([(-10,-10),(9,11),(-9,22),(9,23),(-27,-21),(27,17)]):
    box('planter-'+str(i),x,z,2.4,1.5,1.3,NAVY)
    cube('Planter brass rim',(x,1.305,z),(2.4,.01,1.5),GOLD)
    for j in range(6):
        sphere('Clipped shrub',(x-.8+(j%3)*.8,1.23,z-.32+(j//3)*.64),.3,GREEN)

for x,z in [(-28,-28),(0,-28),(28,-28),(28,0),(28,28),(0,29),(-28,28),(-29,0),(-28,8),(28,-8),(-8,28),(8,-28)]:
    layout['spawns'].append(dict(x=x,y=0,z=z))
for x,z in [(-27,-25),(-27,0),(-27,26),(0,28),(27,26),(28,0),(27,-27),(0,-27),(-10,0),(10,0),(0,10),(0,-10),(-18,8),(10,-17)]:
    layout['waypoints'].append(dict(x=x,y=0,z=z))
for label,a,b in [('violet',(-28,-26),(27,27)),('candy',(27,-26),(-27,27))]:
    for suffix,target,p in [('a','b',a),('b','a',b)]:
        x,z=p
        yaw=math.atan2(x,z)
        layout['mirrors'].append(dict(id=label+'-'+suffix,target=label+'-'+target,label=label.upper(),x=x,y=0,z=z,yaw=yaw,exit=dict(x=x-math.sin(yaw)*2.6,y=0,z=z-math.cos(yaw)*2.6)))
for name,x,z in [('CAROUSEL PLAZA',0,0),('ARCADE',18,-17),('BUMPER COURT',-18,16),('MIRROR MAZE',20,3),('TICKET ALLEY',0,24),('SLIDE TUNNEL',-21,-12)]:
    layout['landmarks'].append(dict(name=name,x=x,y=8 if name=='CAROUSEL PLAZA' else 5.6,z=z))

# Validate layout before exporting. The same descriptor is consumed by JS/Rust.
def clear(p):
    for b in layout['boxes']:
        if p['y'] + BODY_HEIGHT <= b['y'] + .001 or p['y'] >= b['y'] + b['h'] - .001:
            continue
        dx = max(abs(p['x'] - b['x']) - b['w']/2, 0)
        dz = max(abs(p['z'] - b['z']) - b['d']/2, 0)
        if dx*dx + dz*dz < BODY_RADIUS*BODY_RADIUS - 1e-7:
            return False
    return True
for p in layout['spawns']+[m['exit'] for m in layout['mirrors']]:
    assert clear(p), 'Blocked spawn/exit '+str(p)
(OUT/'map.json').write_text(json.dumps(layout,indent=2)+'\n',encoding='utf-8')

# Merge static decorations by material. Preserve individual solid collider meshes.
decor_batches={material.name:[ob for ob in cosmetics if ob.type=='MESH' and ob.data.materials and ob.data.materials[0]==material] for material in bpy.data.materials}
for material_name,items in decor_batches.items():
    if not items:
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for ob in items:
        ob.select_set(True)
    bpy.context.view_layer.objects.active=items[0]
    bpy.ops.object.join()
    bpy.context.object.name='Decor / '+material_name
    bpy.context.object['visualOnly']=True

# Ensure every closed solid has outward-facing polygons in glTF.
for ob in bpy.context.scene.objects:
    if ob.type=='MESH':
        bm=bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        bm.to_mesh(ob.data)
        bm.free()

scene=bpy.context.scene
scene.world.color=(.09,.09,.09)
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.065,.13,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
def light(name,kind,pos,power,color,size=10):
    data=bpy.data.lights.new(name,kind)
    data.energy=power
    data.color=color
    if kind=='AREA':
        data.shape='DISK'
        data.size=size
    ob=bpy.data.objects.new(name,data)
    bpy.context.collection.objects.link(ob)
    ob.location=xyz(pos)
    ob.rotation_euler=(Vector((0,0,0))-ob.location).to_track_quat('-Z','Y').to_euler()
    return ob
sun=light('Moon','SUN',(10,30,20),2.5,(.42,.63,1))
sun.data.angle=.3
light('Warm plaza','AREA',(0,22,0),6500,(1,.46,.19),20)
light('Front fill','AREA',(18,25,28),12000,(.47,.65,1),30)
light('Pink rim','AREA',(-28,18,-15),7500,(1,.12,.38),20)
camera_data=bpy.data.cameras.new('Overview camera')
camera=bpy.data.objects.new('Overview camera',camera_data)
bpy.context.collection.objects.link(camera)
camera.location=xyz((68,59,78))
target=Vector(xyz((0,7,-6)))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=105
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1500
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.film_transparent=False

# Runtime contains meshes only. Server owns collisions and portal interactions.
bpy.ops.object.select_all(action='DESELECT')
for ob in scene.objects:
    if ob.type=='MESH':
        ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(RUNTIME),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_animations=False,export_cameras=False,export_lights=False)
meshes=[ob for ob in scene.objects if ob.type=='MESH']
meta=dict(name=layout['name'],id=layout['id'],generator='scripts/worlds/neon_carnival.py',sourceReference='e7b92f37-2831-4988-a077-5e5aa945c25f.png',blender=bpy.app.version_string,units='metres',runtimeUp='+Y',collisionCount=len(layout['boxes']),meshes=len(meshes),triangles=sum(len(p.vertices)-2 for ob in meshes for p in ob.data.polygons),glbBytes=RUNTIME.stat().st_size)
(OUT/'manifest.json').write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'neon-carnival.blend'))
scene.render.filepath=str(OUT/'overview.png')
bpy.ops.render.render(write_still=True)
camera_data.type='PERSP'
camera_data.lens=23
camera.location=xyz((10,2.5,15))
camera.rotation_euler=(Vector(xyz((0,5,-1)))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(OUT/'ground-view.png')
scene.render.resolution_x=1440
scene.render.resolution_y=900
bpy.ops.render.render(write_still=True)
print('WORLD_BUILD_COMPLETE '+json.dumps(meta))
