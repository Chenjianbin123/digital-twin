"""Hospital-functional refinement of the preserved ward floor; pure model views."""
import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import hospital_floor_reference_details as d
import build_hospital_floor_reference_v1 as pipeline

OUT=h.ROOT/'output/hospital-floor-reference-v2'
SOURCE=OUT/'hospital-floor-reference-v2.blend'
V1=h.ROOT/'output/hospital-floor-reference-v1/hospital-floor-reference-v1.blend'


def plaque(parent,text,x,y,z,width=1.0):
    d.box('Clinical wayfinding plaque',(x,y,z),(width,.035,.26),'Floor_Teal',.018,parent)
    h.text('Wayfinding '+text,text,(x,y-.024,z),.16,'Floor_White',parent)


def cart(parent,x,y,emergency=False):
    root=h.empty('Emergency trolley' if emergency else 'Nursing trolley',parent)
    root.location=(x,y,.1);root['assetRole']='clinical-trolley'
    color='Floor_Amber' if emergency else 'Floor_Teal'
    for xx in [-.31,.31]:
        for yy in [-.22,.22]:
            h.cylinder('Trolley caster',(xx,yy,.07),.07,.035,'Floor_Dark',
                       (math.pi/2,0,0),root,24)
            h.bar('Trolley upright',(xx,yy,.14),(xx,yy,.91),.015,'Floor_Steel',root)
    d.box('Trolley storage body',(0,0,.51),(.66,.48,.67),'Floor_White',.035,root)
    for i in range(4):
        z=.27+i*.16
        d.box('Clinical trolley drawer',(0,-.25,z),(.61,.024,.135),color,.008,root)
        h.bar('Trolley drawer pull',(-.16,-.28,z+.024),(.16,-.28,z+.024),.011,'Floor_Steel',root)
    d.box('Trolley recessed tray',(0,0,.895),(.73,.56,.045),'Floor_Steel',.025,root)
    for xx in [-.36,.36]:d.box('Tray raised lip',(xx,0,.932),(.025,.56,.058),'Floor_White',.008,root)
    for yy in [-.275,.275]:d.box('Tray raised lip',(0,yy,.932),(.73,.025,.058),'Floor_White',.008,root)
    h.tube('Trolley pushing handle',[(-.35,.22,.93),(-.43,.27,1.02),(.43,.27,1.02),(.35,.22,.93)],.015,'Floor_Steel',root)
    if emergency:
        d.box('Defibrillator housing',(.04,.04,1.13),(.37,.27,.30),'Floor_White',.045,root)
        d.screen(root,.04,-.111,1.15,.27,'Defibrillator demo screen')
    else:
        for i in range(3):h.cylinder('Treatment supply bottle',(-.21+i*.17,.05,1.02),.039,.19,'Floor_White',parent=root)
    return root


def wheelchair(parent,x,y):
    root=h.empty('Parked transport wheelchair',parent);root.location=(x,y,.1)
    for xx in [-.30,.30]:
        h.ring('Wheelchair rear tyre',(xx,.16,.31),.29,.024,'Floor_Dark',root,(0,math.pi/2,0))
        h.ring('Wheelchair hand rim',(xx*1.13,.16,.31),.245,.010,'Floor_Steel',root,(0,math.pi/2,0))
        for i in range(16):
            angle=i*math.tau/16
            h.bar('Wheelchair spoke',(xx,.16,.31),(xx,.16+.28*math.cos(angle),.31+.28*math.sin(angle)),.0025,'Floor_Steel',root,12)
        h.cylinder('Wheelchair front caster',(xx,-.40,.078),.075,.028,'Floor_Dark',(0,math.pi/2,0),root,24)
        h.tube('Wheelchair frame',[(xx,.40,.94),(xx,.33,.23),(xx,-.38,.20),(xx,-.43,.10)],.017,'Floor_Steel',root)
        d.box('Wheelchair armrest',(xx,-.03,.71),(.06,.42,.05),'Floor_Dark',.015,root)
        d.box('Wheelchair footrest',(xx*.66,-.53,.18),(.20,.23,.03),'Floor_Dark',.01,root)
    d.box('Wheelchair fabric seat',(0,-.02,.48),(.53,.48,.04),'Floor_Teal',.025,root)
    d.box('Wheelchair fabric back',(0,.25,.72),(.53,.035,.47),'Floor_Teal',.025,root)


def clinical_details(root):
    details=h.empty('Hospital_Clinical_Details_V2',root)
    # A wider central circulation zone is visible around the existing nurse island.
    d.box('Continuous corridor resilient flooring',(0,0,.096),(17.65,6.20,.025),'Floor_Vinyl',.006,details)
    for y in [-2.93,2.93]:
        d.box('Corridor perimeter wayfinding strip',(0,y,.112),(17.5,.11,.008),'Floor_Teal',.002,details)
    for room in [o for o in bpy.context.scene.objects if o.get('capacity')==2]:
        number=int(room['roomNumber']);north=number<105
        index=(number-101)%4;x=[-6.6,-2.2,2.2,6.6][index]
        # These positions are local to the translated room root.
        y=2.24 if north else -2.24
        outside=y+(-.13 if north else .13)
        for z in [.35,.82]:d.box('Corridor crash rail',(x-.63,outside,z),(2.94,.04,.15),'Floor_Teal',.02,room)
        h.bar('Accessible corridor handrail',(x-2.08,outside+(-.07 if north else .07),1.03),
              (x+.77,outside+(-.07 if north else .07),1.03),.027,'Floor_Oak',room)
        for xx in [x-1.85,x-.7,x+.53]:
            h.bar('Handrail bracket',(xx,outside,.99),(xx,outside+(-.07 if north else .07),1.02),.013,'Floor_Steel',room)
        # Actual door-side number sign and hygiene point, rather than floating UI labels.
        plaque(room,str(number)+' 病房',x+.30,y-.16,1.81,.75)
        d.box('Hand hygiene dispenser',(x+.61,y-.19,1.13),(.115,.11,.22),'Floor_White',.025,room)
        d.box('Dispenser inspection window',(x+.61,y-.251,1.13),(.057,.007,.085),'Floor_Teal',.006,room)
        light=d.box('Door nurse call indicator',(x+1.55,y-.11,2.49),(.28,.06,.065),'Floor_LED',.018,room)
        light['assetRole']='room-call-indicator'
        separator=h.empty('Bed privacy separation',room)
        separator.location=(x,5.91 if north else -3.50,.1)
        separator.rotation_euler.z=math.pi/2
        d.curtain(separator,0,0,.62,1.96)
        h.bar('Longitudinal privacy rail',(x,3.28 if north else -5.95,2.42),
              (x,6.36 if north else -2.95,2.42),.018,'Floor_Steel',room)
    # Practical ward support areas, located in side rooms rather than in routes.
    cart(details,10.55,4.28)
    cart(details,11.72,.10,True)
    wheelchair(details,-11.84,3.30)
    plaque(details,'电 梯 厅',-10.76,7.63,2.71,2.30)
    plaque(details,'治疗准备',10.13,3.035,1.78,1.8)
    plaque(details,'处 置 室',10.13,-3.255,1.78,1.8)
    plaque(details,'卫 生 间',-11.41,-3.255,1.78,1.8)
    # Close the two toilets into separate cubicles while showing their cutaway.
    for cy,length in [(-7.375,.45),(-5.675,.95),(-4.025,.35)]:
        d.box('WC entrance wall pier',(-11.40,cy,.96),(.13,length,1.72),'Floor_Wall',.01,details)
    d.box('WC cubicle divider',(-12.0,-5.66,.88),(1.05,.075,1.56),'Floor_Wall',.01,details)
    for y in [-6.65,-4.70]:
        d.box('WC privacy door',(-11.39,y,.88),(.05,1.0,1.55),'Floor_Oak',.014,details)
        h.bar('WC grab rail',(-12.35,y+.2,.80),(-12.35,y-.2,.80),.022,'Floor_Steel',details)
    # Treatment couch and waste separation in the right-hand enclosed room.
    d.box('Treatment couch mattress',(10.36,-5.30,.93),(.85,1.85,.12),'Floor_Teal',.08,details)
    d.box('Treatment couch frame',(10.36,-5.30,.84),(.80,1.79,.055),'Floor_Steel',.025,details)
    for x in [10.03,10.69]:
        for y in [-5.94,-4.66]:h.bar('Couch tubular leg',(x,y,.12),(x,y,.81),.025,'Floor_Steel',details)
    for x,mat in [(11.53,'Floor_Amber'),(12.05,'Floor_Teal')]:
        d.box('Clinical waste container',(x,-6.59,.40),(.37,.38,.59),mat,.035,details)
        d.box('Waste container lid',(x,-6.59,.72),(.40,.41,.045),'Floor_White',.018,details)
    for x in [-11.90,-11.15]:d.chair(details,x,-.85,math.pi/2)
    # Architectural emergency wayfinding; illustrative, not code certification.
    for cx,width in [(9.975,2.15),(12.425,.35)]:
        d.box('Exit wall pier',(cx,8.08,1.3),(width,.18,2.4),'Floor_Wall',.015,details)
    d.box('Exit door lintel',(11.65,8.08,2.48),(1.20,.18,.24),'Floor_Wall',.015,details)
    d.box('Exit door leaf',(11.65,8.07,1.21),(1.15,.06,2.18),'Floor_Teal',.012,details)
    d.box('Exit vision panel',(11.65,8.028,1.70),(.39,.012,.60),'Floor_Glass',.008,details)
    h.bar('Exit panic bar',(11.2,8.01,1.11),(12.1,8.01,1.11),.026,'Floor_Steel',details)
    plaque(details,'安全出口',11.65,7.95,2.64,1.40)
    return details


def build():
    bpy.ops.wm.open_mainfile(filepath=str(V1))
    bpy.context.window.scene=bpy.data.scenes['Floor_Light']
    h.M.clear();h.M.update({m.name:m for m in bpy.data.materials})
    root=bpy.data.objects['Hospital_Floor_Reference_V1'];root.name='Hospital_Floor_Reference_V2'
    rooms=[o for o in bpy.context.scene.objects if o.get('capacity')==2]
    for room in rooms:
        room.location.y=.9 if int(room['roomNumber'])<105 else -.9
        for obj in room.children:
            if obj.name.startswith('Room door open'):
                if int(room['roomNumber'])<105:
                    obj.rotation_euler.z=math.radians(-62)
                    obj['mechanism']='inward hinged'
                else:
                    # Sliding entrance avoids an inward door swing into the bed head.
                    obj.rotation_euler.z=0;obj.location.x-=1.25;obj.location.y+=.15
                    obj['mechanism']='corridor-side sliding'
                    d.box('Sliding door top track',(obj.location.x+.1,-2.09,2.54),
                          (2.55,.13,.10),'Floor_Steel',.015,room)
    for obj in list(bpy.data.objects):
        if obj.name.startswith('Stone floor joint') or obj.name.startswith('Selected room 103') or obj.name=='Room106 demo alert':
            bpy.data.objects.remove(obj,do_unlink=True)
    for obj in bpy.data.objects['Preview_Graphics'].children:
        obj.location.y+=.9 if obj.location.y>0 else -.9
    support=bpy.data.objects['Support_Spaces']
    for obj in list(support.children):
        if obj.name.startswith('WC partition') or (obj.name.startswith('Wing exterior') and obj.location.x>0 and obj.location.y>0):
            bpy.data.objects.remove(obj,do_unlink=True);continue
        if obj.name.startswith('Visitor chair'):
            for child in list(obj.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
            bpy.data.objects.remove(obj,do_unlink=True);continue
        if abs(obj.location.y)>2:obj.location.y+=math.copysign(.9,obj.location.y)
        if obj.name.startswith(('Wing floor','Outside sidewall')):obj.scale.y*=16.4/14.5
    for name in ['Structural floor slab','Continuous clinical floor']:
        bpy.data.objects[name].scale.y*=16.5/14.66
    clinical_details(root)
    # Keep the original material palette, with clearer clinical floor contrast.
    mat=h.M['Floor_Vinyl'];mat.diffuse_color=(*h.rgb('#c8d4d3'),1)
    mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=mat.diffuse_color
    bpy.data.objects['Large soft key'].data.size=11
    camera=bpy.data.objects['Floor_Overview_Camera'];camera.location=(14,-28,33)
    camera.data.ortho_scale=34.4;h.aim(camera,(0,0,.45))
    camera=bpy.data.objects['Floor_Detail_Camera'];camera.location=(17,-22,23)
    camera.data.ortho_scale=17.0;h.aim(camera,(1,-1,.6))
    light=bpy.data.scenes['Floor_Light'];dark=bpy.data.scenes['Floor_Dark']
    for obj in list(light.objects):
        if obj.name not in dark.objects:dark.collection.objects.link(obj)
    for scene in [light,dark]:
        scene['revision']='V2 hospital circulation, protection rails and clinical support'
        scene['circulationWidthMetres']=6.28
    h.save(OUT,SOURCE.stem,pipeline.REFERENCE,{'version':2,'basedOn':str(V1),
        'rooms':8,'beds':16,'pureModelViews':True,'themes':['Floor_Light','Floor_Dark'],
        'camera':'Floor_Overview_Camera','fidelity':'Hospital ward concept; inferred dimensions, not surveyed design'})


if __name__=='__main__':
    pipeline.OUT=OUT;pipeline.SOURCE=SOURCE;pipeline.build=build
    pipeline.main()
