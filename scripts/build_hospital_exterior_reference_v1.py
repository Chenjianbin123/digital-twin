"""Reference-led hospital campus model with editable architectural assemblies."""
import argparse
import math
import random
import shutil
import sys
from pathlib import Path

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import hospital_reference_landscape as landscape

OUT=h.ROOT/'output/hospital-exterior-reference-v1'
REFERENCE=h.ROOT/'output/imagegen/hospital-concepts-20261005/hospital-exterior-high-fidelity-v1.png'


def materials():
    for name,color,rough,metal,noise in [
        ('stone','#d9d4c9',.68,0,.007),('limestone','#c8c7bd',.72,0,.006),
        ('joint','#a09e96',.79,0,0),('white','#e6e7e4',.40,.03,0),
        ('silver','#84939b',.30,.7,.0006),('steel','#b4bec4',.27,.8,.0004),
        ('dark','#344149',.39,.45,0),('signage','#1b5861',.55,0,0),('glassdark','#344e5e',.17,.52,0),
        ('spandrel','#48525a',.28,.45,0),('teal','#276c73',.35,.45,0),
        ('blue','#306f8b',.34,.28,0),('bronze','#81755d',.36,.55,0),
        ('paving','#bcbdb5',.85,0,.008),('asphalt','#515956',.91,0,.012),
        ('grass','#6a7850',.98,0,.045),('soil','#484736',1,0,.02),
        ('leaf','#4b642e',.72,0,0),('leaflight','#708a3d',.71,0,0),
        ('leafdark','#314522',.80,0,0),('bark','#655b43',.96,0,.02),
        ('wood','#8e795c',.69,0,.004),('rubber','#242c30',.83,0,0),
        ('context','#8b9da7',.87,0,0),('contextglass','#73868f',.63,.12,0)]:
        h.material(name,color,rough,metal,noise=noise)
    h.material('lamp','#e5edf2',.25,.05,.25)
    for i,color in enumerate(['#405c69','#38525f','#344e5b','#49616b','#304955']):h.material('glazing'+str(i),color,.17,.24)
    glass=h.material('glass','#c0d7df',.085,.08)
    glass.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value=.75


def facade(name,width,floors,origin,angle,parent,grand=False):
    root=h.empty(name,parent)
    root.location=origin
    root.rotation_euler.z=angle
    pitch=3.15
    height=floors*pitch
    margin=1.15
    bays=max(3,round((width-2*margin)/1.82))
    bw=(width-2*margin)/bays
    h.box('Recessed dark facade',(0,.015,height/2),(width-.16,.12,height),'spandrel',.014,root)
    for floor in range(floors):
        z=floor*pitch
        h.box('Continuous limestone sill',(0,-.18,z+.34),(width,.36,.20),'stone',.018,root)
        h.box('Horizontal mullion cap',(0,-.218,z+.61),(width-2*margin,.07,.075),'silver',.009,root)
        h.box('Upper transom',(0,-.178,z+2.91),(width-2*margin,.06,.073),'silver',.008,root)
        for bay in range(bays):
            x=-width/2+margin+(bay+.5)*bw
            h.box('Window insulated glazing',(x,-.089,z+1.765),(bw-.070,.025,2.25),'glazing'+str((bay*3+floor*7)%5),.003,root)
            for dx in [-bw/2,bw/2]:
                h.box('Vertical window mullion',(x+dx,-.169,z+1.74),(.066,.11,2.43),'silver',.006,root)
            h.box('Window lower transom',(x,-.170,z+1.00),(bw,.095,.055),'silver',.004,root)
            if (floor*11+bay*3)%7==0:
                for j in range(5):
                    h.box('Visible interior blind slat',(x,-.11,z+2.61-j*.09),(bw-.14,.008,.040),'context',0,root)
        for side in [-1,1]:
            h.box('Stone facade end pier',(side*(width/2-margin/2),-.12,z+pitch/2),(margin,.26,pitch-.015),'stone',.012,root)
            for j in [1,2]:h.box('Stone panel recessed joint',(side*(width/2-margin/2),-.255,z+j*1.05),(margin,.006,.016),'joint',0,root)
        if grand:
            for x in [-width*.29,width*.29]:
                h.box('Architectural vertical fin',(x,-.30,z+pitch/2),(.88,.51,pitch-.007),'stone',.018,root)
                h.box('Fin bronze reveal',(x+.462,-.23,z+pitch/2),(.045,.36,pitch),'bronze',.004,root)
    # Regular facade seams remain geometrical rather than painted-on linework.
    for x in [-width/2+.40,width/2-.40]:h.box('Pier vertical joint',(x,-.258,height/2),(.016,.009,height),'joint',0,root)
    return root


def tower(name,loc,size,floors,parent):
    x,y=loc
    w,d=size
    base=7.72
    height=floors*3.15
    root=h.empty(name,parent)
    h.box('Tower structural mass',(x,y,base+height/2),(w-.20,d-.20,height),'stone',.025,root)
    facade('South facade',w,floors,(x,y-d/2,base),0,root,w>30)
    facade('North facade',w,floors,(x,y+d/2,base),math.pi,root)
    facade('East facade',d,floors,(x+w/2,y,base),math.pi/2,root)
    facade('West facade',d,floors,(x-w/2,y,base),-math.pi/2,root)
    z=base+height
    h.box('Roof slab',(x,y,z+.12),(w+.35,d+.35,.31),'stone',.025,root)
    h.box('Roof waterproof membrane',(x,y,z+.31),(w-.55,d-.55,.045),'joint',.007,root)
    for side in [-1,1]:
        h.box('Roof parapet',(x,y+side*(d/2-.10),z+.73),(w,.24,.85),'stone',.016,root)
        h.box('Roof side parapet',(x+side*(w/2-.10),y,z+.73),(.24,d,.85),'stone',.016,root)
        h.box('Roof parapet cap',(x,y+side*(d/2-.10),z+1.17),(w+.07,.36,.075),'silver',.007,root)
    h.box('Mechanical penthouse',(x,y+1,z+1.36),(w*.64,d*.48,2.10),'dark',.08,root)
    for i in range(12):h.box('Plant room louver',(x,y+1-d*.245,z+.48+i*.155),(w*.65,.14,.052),'silver',.006,root)
    for xx in [-w*.18,w*.18]:
        h.box('Air handling unit',(x+xx,y,z+2.75),(3.1,2.4,.90),'silver',.06,root)
        for dx in [-.72,.72]:
            h.cylinder('Rooftop fan',(x+xx+dx,y,z+3.22),.53,.055,'dark',parent=root,segments=32)
            for k in range(5):
                blade=h.box('Fan blade',(x+xx+dx,y,z+3.253),(.84,.10,.010),'silver',.004,root)
                blade.rotation_euler.z=k*math.pi/5
    return root,z


def podium(parent):
    root=h.empty('Outpatient_Podium',parent)
    h.box('Podium main body',(0,-7,4.02),(79,18,8.04),'stone',.04,root)
    h.box('Podium roof cornice',(0,-7,8.13),(79.5,18.5,.30),'stone',.03,root)
    h.box('Glazed lobby shadow',(0,-16.06,3.79),(32,.19,6.69),'dark',.02,root)
    for side in [-1,1]:
        for x in [18.1,20.6,23.1,25.6,28.1,30.6,33.1,35.6,38.1]:
            for z in [2.00,5.18]:
                h.box('Podium storefront',(side*x,-16.11,z),(2.16,.06,2.67),'glazing'+str(int(x)%5),.008,root)
                for dx in [-1.105,1.105]:h.box('Storefront jamb',(side*x+dx,-16.19,z),(.075,.13,2.81),'silver',.009,root)
            h.box('Podium floor band',(side*x,-16.12,3.59),(2.5,.25,.39),'stone',.012,root)
        for z in [.7,1.4,2.1,2.8,3.5,4.2,4.9,5.6,6.3,7.,7.7]:
            h.box('Podium stone seam',(side*27.85,-16.016,z),(23.25,.008,.012),'joint',0,root)
        for x in range(17,40,2):h.box('Podium panel vertical seam',(side*x,-16.018,4.0),(.015,.008,8),'joint',0,root)
    for i in range(23):
        x=-15.35+i*1.395
        h.box('Lobby curtain glazing',(x,-16.20,3.72),(1.31,.027,6.4),'glazing'+str(i%5),.005,root)
        h.box('Lobby curtain mullion',(x-.69,-16.255,3.7),(.065,.16,6.55),'dark',.007,root)
    for z in [1.08,3.52,6.91]:h.box('Lobby glazing transom',(0,-16.30,z),(32,.12,.075),'silver',.007,root)
    for x in [-4.9,0,4.9]:
        h.box('Entrance door portal',(x,-16.35,2.11),(4.05,.25,3.45),'dark',.03,root)
        h.box('Entrance door glazing',(x,-16.50,2.11),(3.74,.025,3.23),'glassdark',.004,root)
        h.box('Door center stile',(x,-16.55,2.11),(.074,.07,3.3),'silver',.006,root)
        h.box('Door safety manifestation',(x,-16.573,1.59),(3.73,.005,.080),'white',0,root)
        for dx in [-.14,.14]:h.bar('Lobby door handle',(x+dx,-16.60,1.31),(x+dx,-16.60,1.86),.018,'steel',root)
    # Thin glazed canopy; the metal grid casts real shadows onto the entry.
    for yy in [-15.75,-23.05]:h.box('Canopy long rim',(0,yy,5.15),(33,.20,.22),'silver',.023,root)
    for xx in [-16.4,16.4]:h.box('Canopy side rim',(xx,-19.40,5.15),(.20,7.3,.22),'silver',.023,root)
    h.box('Entrance canopy dark infill',(0,-19.40,5.20),(32.6,6.95,.035),'glass',.005,root)
    for x in range(-16,17,2):h.box('Canopy projecting rib',(x,-19.4,5.03),(.12,7.10,.27),'dark',.007,root)
    for y in [-16.3,-18.2,-20.2,-22.85]:h.box('Canopy cross beam',(0,y,5.01),(32.7,.12,.26),'silver',.007,root)
    for x in [-15,15]:
        h.box('Canopy support column',(x,-21.7,2.65),(.19,.19,5.05),'steel',.014,root)
        h.box('Column stone base',(x,-21.7,.37),(.46,.46,.28),'limestone',.02,root)
    sign=h.text('Outpatient services sign','门诊 · 住院服务中心',(0,-16.22,7.50),1.10,'signage',root)
    sign.data.font=bpy.data.fonts.load('C:/Windows/Fonts/msyhbd.ttc',check_existing=True)
    sign.data.extrude=.025
    roof_shrub=landscape.leaf_cloud('Roof shrub individual leaves',71,.72,.44,root,650,.50)
    roof_shrub.location=(-34,-11,8.9)
    rng=random.Random(103)
    for side in [-1,1]:
        h.box('Terrace planter',(side*26,-9,8.52),(20,9,.68),'stone',.07,root)
        h.box('Terrace soil',(side*26,-9,8.875),(19.5,8.5,.06),'soil',.03,root)
        for i in range(44):
            xx=side*26-9+(i%11)*1.78
            yy=-12.3+(i//11)*2.08
            shrub=roof_shrub.copy()
            shrub.data=roof_shrub.data
            bpy.context.collection.objects.link(shrub)
            shrub.parent=root
            shrub.location=(xx+rng.uniform(-.35,.35),yy+rng.uniform(-.45,.45),8.9)
            shrub.rotation_euler.z=rng.random()*h.TAU
            shrub.scale=(1,1,rng.uniform(.8,1.65))
        # Glazed/stone right-return facade is visible from the reference camera.
        for yy in range(-14,2,2):
            for zz in [2.0,5.15]:h.box('Podium side glazing',(side*39.52,yy,zz),(.025,1.65,2.60),'glazing2',.005,root)
    return root


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--width',type=int,default=1920)
    parser.add_argument('--samples',type=int,default=64)
    parser.add_argument('--skip-render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 320<=args.width<=4096 or not 1<=args.samples<=1024:parser.error('width 320..4096, samples 1..1024 required')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    root=h.empty('HospitalExterior_Reference_V1')
    buildings=h.empty('Hospital_Buildings',root)
    tower('Central_Inpatient_Tower',(-4,9),(40,19),10,buildings)
    tower('West_Wing',(-31,7),(16,19),5,buildings)
    tower('East_Wing',(27,6),(17,24),7,buildings)
    podium(buildings)
    h.box('Main tower sign backer',(-4,-.80,40.35),(21,.29,3.2),'stone',.03,buildings)
    sign=h.text('Hospital name','仁和医院',(-4,-.97,40.42),3.0,'signage',buildings)
    sign.data.font=bpy.data.fonts.load('C:/Windows/Fonts/msyhbd.ttc',check_existing=True)
    sign.data.extrude=.05
    h.box('Right wing identity pier',(27,-6.24,27.0),(3.7,.31,5.0),'stone',.023,buildings)
    h.box('Teal cross horizontal',(27,-6.43,27.2),(2.2,.19,.66),'teal',.04,buildings)
    h.box('Teal cross vertical',(27,-6.44,27.2),(.66,.19,2.2),'teal',.04,buildings)
    landscape.hardscape(root)
    landscape.planting(root)
    landscape.ambulance(root)
    landscape.context(root)
    world=bpy.data.worlds.new('City daylight environment')
    world.use_nodes=True
    environment=world.node_tree.nodes.new('ShaderNodeTexEnvironment')
    environment.image=bpy.data.images.load(str(Path(bpy.app.binary_path).parent/'4.5/datafiles/studiolights/world/city.exr'))
    environment.image.pack()
    world.node_tree.links.new(environment.outputs['Color'],world.node_tree.nodes['Background'].inputs[0])
    world.node_tree.nodes['Background'].inputs[1].default_value=.65
    # Keep urban HDR illumination/reflections, with a neutral distant sky in the
    # camera: the close buildings in a rooftop HDR panorama would have false scale.
    sky_background=world.node_tree.nodes.new('ShaderNodeBackground')
    sky_background.inputs[0].default_value=(*h.rgb('#c5d9e5'),1)
    sky_background.inputs[1].default_value=.85
    ray=world.node_tree.nodes.new('ShaderNodeLightPath')
    mix=world.node_tree.nodes.new('ShaderNodeMixShader')
    world.node_tree.links.new(ray.outputs['Is Camera Ray'],mix.inputs[0])
    world.node_tree.links.new(world.node_tree.nodes['Background'].outputs[0],mix.inputs[1])
    world.node_tree.links.new(sky_background.outputs[0],mix.inputs[2])
    world.node_tree.links.new(mix.outputs[0],world.node_tree.nodes['World Output'].inputs['Surface'])
    bpy.context.scene.world=world
    sun_data=bpy.data.lights.new('Soft afternoon sun','SUN')
    sun_data.energy=2.0
    sun_data.angle=.07
    sun_data.color=(1,.96,.91)
    sun=bpy.data.objects.new('Soft afternoon sun',sun_data)
    bpy.context.collection.objects.link(sun)
    sun.location=(-90,-100,140)
    h.aim(sun,(0,0,0))
    h.setup(OUT,(70,-155,44),(-1,-5,18),57,args.width,args.samples)
    bpy.context.scene.view_settings.exposure=0
    bpy.context.scene.cycles.max_bounces=6
    h.save(OUT,'hospital-exterior-reference-v1',REFERENCE,{'camera':'Reference_Hero_Camera','kind':'native editable Blender model','render':'hero.png'})
    shutil.copy2(Path(bpy.app.binary_path).parent/'4.5/datafiles/studiolights/world/license.txt',OUT/'environment-license.txt')
    if not args.skip_render:bpy.ops.render.render(write_still=True)


if __name__=='__main__':main()
