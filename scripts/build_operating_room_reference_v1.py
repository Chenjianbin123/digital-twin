"""Build the operating-room native Blender scene; output never touches production.

blender --background --threads 6 --python-exit-code 1 --python scripts/build_operating_room_reference_v1.py -- --width 960 --samples 24
"""
import argparse
import math
import sys
from pathlib import Path

import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import operating_room_reference_equipment as equipment

OUT=h.ROOT/'output/operating-room-reference-v1'
REFERENCE=h.ROOT/'output/imagegen/hospital-concepts-20261005/operating-room-high-fidelity-v1.png'


def materials():
    for name,color,rough,metal,noise in [
        ('white','#e2e6e6',.32,.08,.00012),('wall','#c8d0d1',.39,.10,.0002),
        ('silver','#aeb9bf',.31,.72,.00010),('steel','#bdc6cc',.22,.88,.00008),
        ('graphite','#283037',.46,.15,.0002),('padding','#272b30',.45,0,.0008),
        ('rubber','#212a30',.76,0,.0004),('teal','#547f86',.38,.12,.0002),
        ('floor','#aeb7bf',.44,0,.0011),('blue','#547f9b',.40,.08,0),
        ('hose','#b3c3cf',.42,0,0),('greenbag','#23766e',.6,0,.0003),
        ('drape','#4d809b',.87,0,.0008),('seam','#647277',.64,.05,0)]:
        h.material(name,color,rough,metal,noise=noise)
    h.material('light','#f7f8f8',.22,.05,2)
    h.material('screen','#081a29',.22,.12,.18)
    for name,color in [('cyan','#7dd2dd'),('green','#71c788'),('yellow','#c6bd6a')]:h.material(name,color,.4,.12,.5)
    glass=h.material('glass','#e8f1f5',.075,.0)
    glass.node_tree.nodes['Principled BSDF'].inputs['Transmission Weight'].default_value=.90
    optic=h.material('optic','#deebf2',.18,.45,.32)


def shell(parent):
    root=h.empty('Room_Shell',parent)
    h.box('Continuous medical floor',(0,-.75,-.10),(8.6,10.5,.20),'floor',.005,root)
    # Back wall is solid around, but not across, the door recess.
    h.box('Back wall substrate',(0,3.66,1.65),(8.6,.16,3.3),'seam',.005,root)
    for i in range(9):
        x=-3.82+i*.955
        for j,(z,ht) in enumerate([(.61,1.21),(1.89,1.34),(2.955,.775)]):
            h.box('Sealed wall panel',(x,3.566,z),(.949,.027,ht),'wall',.004,root)
    h.box('Right wall substrate',(4.25,.02,1.65),(.16,7.32,3.30),'seam',.006,root)
    for i in range(7):
        yy=-2.99+i*1.03
        for z,ht in [(.6,1.19),(1.89,1.37),(2.965,.755)]:
            h.box('Right sealed wall panel',(4.156,yy,z),(.028,1.024,ht),'wall',.004,root)
    h.box('Left wall substrate',(-4.25,.02,1.65),(.16,7.32,3.30),'wall',.005,root)
    for side in [-1,1]:
        h.box('Coved floor edge',(side*4.15,.03,.07),(.04,7.3,.14),'silver',.018,root)
    h.box('Back coved floor edge',(0,3.535,.07),(8.30,.045,.14),'silver',.018,root)
    # Door has its own inset frame, gasket, vision panel and operator hood.
    x=-2.88
    h.box('Hermetic door frame',(x,3.51,1.23),(1.46,.10,2.46),'steel',.013,root)
    h.box('Door shadow gasket',(x,3.442,1.22),(1.32,.055,2.35),'graphite',.015,root)
    h.box('Teal sliding door leaf',(x,3.401,1.21),(1.27,.036,2.29),'teal',.019,root)
    h.box('Door operator hood',(x,3.415,2.50),(1.62,.18,.25),'silver',.025,root)
    for z,ht in [(.13,.18),(.74,.19)]:h.box('Door protective band',(x,3.377,z),(1.25,.012,ht),'steel',.002,root)
    h.box('Vision panel seal',(x+.04,3.374,1.61),(.44,.025,.44),'graphite',.021,root)
    h.box('Vision panel frame',(x+.04,3.358,1.61),(.405,.012,.404),'steel',.018,root)
    h.box('Vision panel glass',(x+.04,3.348,1.61),(.366,.008,.366),'glass',.013,root)
    h.box('Dim corridor behind window',(x+.04,3.380,1.61),(.36,.005,.36),'hose',.005,root)
    h.text('Door identifier','手术室 01',(x,3.365,2.10),.11,'white',root)
    h.bar('Door pull',(x-.44,3.31,.87),(x-.44,3.31,1.40),.015,'steel',root)
    for z in [.88,1.39]:h.bar('Handle attachment',(x-.44,3.31,z),(x-.44,3.38,z),.014,'steel',root)
    # Ceiling panels and central airflow grid remain real editable geometry.
    h.box('Ceiling substrate',(0,.02,3.34),(8.6,7.4,.09),'seam',.005,root)
    for i in range(9):
        for j in range(8):
            h.box('Ceiling panel',(-3.80+i*.95,-3.19+j*.91,3.28),(.943,.903,.045),'white',.003,root)
    for x in [-2.2,2.2]:
        for y in [-1.7,1.2]:
            h.box('Ceiling light frame',(x,y,3.237),(1.45,.57,.044),'silver',.009,root)
            h.box('Ceiling diffuser',(x,y,3.207),(1.38,.50,.012),'light',.007,root)
    h.box('Laminar flow frame',(-.15,.0,3.224),(2.15,2.50,.080),'silver',.018,root)
    h.box('Airflow filter backing',(-.15,.0,3.171),(2.05,2.40,.020),'graphite',.003,root)
    for i in range(50): h.box('Airflow screen longitudinal',(-1.15+i*.041,.0,3.149),(.014,2.39,.014),'wall',.001,root)
    for j in range(58): h.box('Airflow screen transverse',(-.15,-1.17+j*.041,3.138),(2.04,.013,.012),'wall',.001,root)
    return root


def wall_equipment(parent):
    root=h.empty('Integrated_Wall_Equipment',parent)
    # Glass-fronted storage on the right wall, with physical shelf and stock detail.
    for cy in [.18,1.39,2.60]:
        h.box('Storage cabinet back',(4.14,cy,1.65),(.035,1.18,2.74),'white',.008,root)
        for yy in [cy-.575,cy+.575]:
            h.box('Storage cabinet side',(3.91,yy,1.65),(.48,.035,2.74),'white',.008,root)
        for z in [.29,1.10,3.02]:
            h.box('Storage cabinet horizontal frame',(3.91,cy,z),(.48,1.18,.04),'white',.008,root)
        for z in [.44,.88]:
            h.box('Storage lower door',(3.655,cy,z),(.023,1.12,.42),'wall',.008,root)
            h.bar('Storage door pull',(3.63,cy-.10,z+.10),(3.63,cy+.10,z+.10),.009,'steel',root)
        for side in [-1,1]:
            yy=cy+side*.28
            for edge_y in [yy-.262,yy+.262]:
                h.box('Cabinet window vertical frame',(3.650,edge_y,2.08),(.022,.020,1.62),'silver',.004,root)
            for edge_z in [1.28,2.88]:
                h.box('Cabinet window horizontal frame',(3.650,yy,edge_z),(.022,.544,.020),'silver',.004,root)
            h.box('Glass cabinet window',(3.632,yy,2.08),(.012,.494,1.56),'glass',.004,root)
            h.bar('Cabinet window pull',(3.602,yy-side*.20,1.83),(3.602,yy-side*.20,2.05),.009,'steel',root)
        for z in [1.29,1.70,2.12,2.55]:
            h.box('Cabinet shelf',(3.9,cy,z),(.39,1.13,.020),'steel',.003,root)
            for i in range(6):
                yy=cy-.44+i*.17
                h.cylinder('Stock bottle',(3.79,yy,z+.11),.045,.18,'glass',parent=root)
                h.cylinder('Bottle cap',(3.79,yy,z+.212),.039,.03,'white',parent=root)
                h.box('Stock bottle label',(3.744,yy,z+.11),(.006,.066,.076),'white',.001,root)
    equipment.screen('Room_Control_Panel',(-1.86,3.49,1.73),.44,.34,root)
    h.box('Room switch bank',(-1.86,3.508,1.36),(.44,.035,.17),'silver',.009,root)
    for xx in [-2.00,-1.86,-1.72]:
        h.box('Electrical socket',(xx,3.484,1.36),(.085,.01,.095),'white',.006,root)
        for dx in [-.015,.015]:h.box('Socket opening',(xx+dx,3.477,1.366),(.008,.003,.021),'graphite',.001,root)
    h.cylinder('Wall clock case',(-1.86,3.49,2.46),.178,.035,'steel',(math.pi/2,0,0),root)
    h.cylinder('Wall clock dial',(-1.86,3.466,2.46),.159,.008,'white',(math.pi/2,0,0),root)
    for i in range(12):
        a=h.TAU*i/12
        h.text('Clock numeral',str(i or 12),(-1.86+.129*math.sin(a),3.457,2.46+.129*math.cos(a)),.028,'graphite',root)
    h.bar('Clock hour hand',(-1.86,3.451,2.46),(-1.918,3.451,2.507),.004,'graphite',root)
    h.bar('Clock minute hand',(-1.86,3.448,2.46),(-1.778,3.448,2.52),.003,'graphite',root)
    h.box('Wall medical gas rail',(.12,3.51,1.49),(1.5,.060,.19),'silver',.012,root)
    for i,mat in enumerate(['blue','yellow','green','white','white']):
        xx=-.43+i*.275
        h.cylinder('Wall gas bezel',(xx,3.47,1.49),.038,.025,mat,(math.pi/2,0,0),root)
        h.cylinder('Wall gas aperture',(xx,3.451,1.49),.020,.014,'graphite',(math.pi/2,0,0),root)
    return root


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--width',type=int,default=1600)
    parser.add_argument('--samples',type=int,default=64)
    parser.add_argument('--skip-render',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 320<=args.width<=4096 or not 1<=args.samples<=1024:parser.error('width 320..4096, samples 1..1024 required')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    materials()
    root=h.empty('OperatingRoom_Reference_V1')
    root['referenceInferredDimensionsMetres']='8.5 x 7.3 x 3.3'
    shell(root)
    wall_equipment(root)
    table=equipment.table(root)
    table.location.x=-.35
    table.rotation_euler.z=math.radians(10)
    for build in [equipment.lamps,equipment.anesthesia,equipment.pendant,equipment.accessories,equipment.boom_displays]:build(root)
    equipment.instrument_cart(root,(-2.8,-1.55),'Foreground_Instrument_Cart')
    equipment.instrument_cart(root,(2.65,2.56),'Rear_Instrument_Cart')
    world=bpy.data.worlds.new('Clinical neutral ambience')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.91,.95,1,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.12
    bpy.context.scene.world=world
    for x in [-2.2,2.2]:
        for y in [-1.7,1.2]:h.area('Ceiling clinical softbox',(x,y,3.17),(x,y,0),105,1.38,(1,.99,.98),.50)
    h.area('Entrance reflected fill',(0,-3.9,2.50),(0,1.3,1.2),90,5,(1,.99,.98),2.5)
    h.setup(OUT,(-3.30,-4.90,2.38),(-.05,1.08,1.35),28,args.width,args.samples)
    bpy.context.scene.view_settings.exposure=-.35
    h.save(OUT,'operating-room-reference-v1',REFERENCE,{'camera':'Reference_Hero_Camera','kind':'native editable Blender model','render':'hero.png'})
    if not args.skip_render:bpy.ops.render.render(write_still=True)


if __name__=='__main__':main()
