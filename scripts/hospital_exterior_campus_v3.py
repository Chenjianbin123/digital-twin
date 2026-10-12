"""Hospital forecourt, ambulance approach and architectural finish refinement."""
import math
import random
import bpy
import hospital_reconstruction_common as h
from hospital_exterior_landscape_v2 import _copy_group


def remove_tree(obj):
    for child in list(obj.children):
        remove_tree(child)
    bpy.data.objects.remove(obj,do_unlink=True)


def architecture():
    # Articulated stone bands on the smaller clinical wings reproduce the
    # reference's solid-wall rhythm while retaining the modeled windows behind.
    for name in ['West_Wing','East_Wing']:
        wing=bpy.data.objects[name]
        for obj in wing.children_recursive:
            if obj.name.startswith('Continuous limestone sill'):
                # Setting world dimensions under V2's scaled ancestor also
                # re-applies its X scale. Change only the local Z scale.
                obj.scale.z=3.6
                obj.location.z-=.10
        for facade in [o for o in wing.children if o.type=='EMPTY' and 'facade' in o.name]:
            panes=sorted([o for o in facade.children if o.name.startswith('Window insulated glazing')
                          and o.location.z<2],key=lambda o:o.location.x)
            if len(panes)<4: continue
            height=15.75 if name=='West_Wing' else 22.05
            for index in [len(panes)//3,2*len(panes)//3]:
                x=(panes[index-1].location.x+panes[index].location.x)/2
                h.box('V3 clinical wing stone pilaster',(x,-.26,height/2),(.35,.33,height),'stone',.012,facade)
    pier=bpy.data.objects['Right wing identity pier']
    pier.scale.z=22.6/5
    pier.location.z=19.4
    buildings=bpy.data.objects['Hospital_Buildings']
    for z in [8.6+i*1.05 for i in range(21)]:
        h.box('V3 identity pier stone joint',(27,-6.40,z),(3.7,.014,.012),'joint',0,buildings)
    podium=bpy.data.objects['Outpatient_Podium']
    h.box('V3 entrance stone fascia',(0,-16.38,7.48),(79,.30,1.30),'stone',.025,podium)
    for x in range(-38,40,2):
        h.box('V3 fascia panel joint',(x,-16.536,7.48),(.012,.006,1.27),'joint',0,podium)
    sign=bpy.data.objects['Outpatient services sign']
    sign.location.y=-16.565
    sign.location.z=7.48
    for i in range(5):
        shader=h.M['glazing'+str(i)].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value=.025+i*.005
        shader.inputs['Transmission Weight'].default_value=1
        shader.inputs['Metallic'].default_value=0
        shader.inputs['Base Color'].default_value=(.90,.95,.99,1)
    for name,color in [('stone','#e5dfd3'),('grass','#60764a'),('leaf','#42642e'),
                       ('leaflight','#81954b'),('leafdark','#2b4b2d')]:
        shader=h.M[name].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=(*h.rgb(color),1)
        h.M[name].diffuse_color=(*h.rgb(color),1)


def planter(parent,shrub_source,x,y,w,d,seed):
    group=h.empty('V3 healing garden planter',parent)
    h.box('V3 garden granite coping',(x,y,.29),(w,d,.36),'limestone',.13,group)
    h.box('V3 garden topsoil',(x,y,.478),(w-.28,d-.28,.04),'soil',.02,group)
    rng=random.Random(seed)
    for i in range(int(w*d*1.05)):
        obj=shrub_source.copy(); obj.data=shrub_source.data
        bpy.context.collection.objects.link(obj)
        obj.name='V3 layered ornamental planting'; obj.parent=group
        obj.location=(x+rng.uniform(-w/2+.35,w/2-.35),y+rng.uniform(-d/2+.35,d/2-.35),.49)
        scale=rng.uniform(.65,.95)
        obj.scale=(scale,scale,scale*rng.uniform(.65,1.20))
        obj.rotation_euler.z=rng.random()*h.TAU
    return group


def bench(parent,x,y):
    for dx in [-.83,.83]:
        h.box('V3 bench leg',(x+dx,y,.32),(.10,.52,.44),'dark',.014,parent)
    for j in range(6):
        h.box('V3 bench timber seat',(x,y-.22+j*.086,.58),(2.15,.075,.075),'wood',.012,parent)
    for z in [.79,.92,1.05]:
        h.box('V3 bench timber back',(x,y+.24,z),(2.15,.065,.105),'wood',.012,parent)
    for dx in [-.91,.91]:
        h.bar('V3 bench armrest',(x+dx,y-.20,.82),(x+dx,y+.24,.82),.025,'silver',parent)


def build(parent):
    bpy.context.view_layer.update()
    planting=bpy.data.objects['Landscape_Planting']
    for obj in list(planting.children):
        if obj.location.y<-33:
            remove_tree(obj)
        elif obj.location.x>0 and -24<obj.location.y<-16.4:
            # Clear the side entrance ramp while keeping the bed and plants together.
            obj.location.y=-20.7+(obj.location.y+20)*.7
            if obj.name.startswith(('Planting stone edge','Garden soil')):
                obj.scale.y*=.7
    hardscape=bpy.data.objects['Campus_Hardscape']
    for obj in list(hardscape.children):
        if obj.name.startswith(('Gate sign','Campus gate')):
            obj.location.y-=14.5
        elif obj.name.startswith(('Public boulevard','Road dash','Boulevard pedestrian crossing')):
            obj.location.y-=15
            obj.location.z=.1025 if obj.name=='Public boulevard' else .15
        elif obj.name.startswith(('Raised granite curb','Accessible entrance ramp','Access rail')):
            remove_tree(obj)
        elif obj.location.y<-33:
            remove_tree(obj)
    root=h.empty('V3_Hospital_Forecourt',parent)
    h.box('V3 forecourt paving foundation',(0,-46.2,-.01),(124,26.2,.22),'paving',.02,root)
    # Break curbs at the visitor drive, pedestrian axis and ambulance approach.
    for y in [-33.63,-58.8]:
        for a,b in [(-59,-21.2),(-14.8,-3),(3,50.3),(57.9,62)]:
            h.box('V3 interrupted street curb',((a+b)/2,y,.23),(b-a,.20,.22),'limestone',.015,root)
    for a,b in [(-59,-3),(3,10),(24,50.3)]:
        h.box('V3 entrance curb with crossing gaps',((a+b)/2,-26.38,.22),(b-a,.20,.20),'limestone',.015,root)
    h.box('V3 south boulevard curb',(0,-69.2,.18),(155,.22,.26),'limestone',.014,root)
    h.box('V3 central pedestrian promenade',(0,-46,.128),(5.8,26,.032),'paving',.008,root)
    for x in [-2.65,2.65]:
        h.box('V3 promenade contrasting border',(x,-46,.147),(.14,25.5,.012),'signage',.003,root)
    for y in [-57.7,-34.5]:
        for x in [-2.0,-1.5,-1.0,-.5,0,.5,1.0,1.5,2.0]:
            h.box('V3 pedestrian tactile warning',(x,y,.155),(.40,.50,.019),'V3 yellow paint',.012,root)
    h.box('V3 ambulance approach',(54.12,-43.25,.105),(7.2,31.5,.07),'asphalt',0,root)
    for x in [50.6,57.64]:
        h.box('V3 emergency lane edge',(x,-43.25,.15),(.10,30.8,.006),'V3 yellow paint',0,root)
    for y in [-52,-40,-30]:
        h.text('V3 ambulance road priority','急 救',(54.12,y,.156),.86,'V3 yellow paint',root,rotation=(0,0,0))
        h.box('V3 ambulance arrow shaft',(54.12,y+2,.153),(.13,1.3,.008),'V3 yellow paint',0,root)
        h.object_mesh('V3 ambulance arrow',[(53.7,y+2.4,.16),(54.12,y+3.2,.16),(54.54,y+2.4,.16)],[(0,1,2)],'V3 yellow paint',root)
    h.box('V3 ambulance entry sign',(60,-56,1.9),(1.6,.18,3.1),'signage',.055,root)
    h.text('V3 emergency sign title','急救通道',(60,-56.10,2.5),.28,'white',root)
    h.text('V3 emergency sign arrow','↑',(60,-56.10,1.86),.65,'white',root)
    h.text('V3 emergency sign note','请勿占用',(60,-56.10,1.28),.23,'white',root)
    shrub=next(o for o in planting.children if o.name.startswith('Shrub individual leaves'))
    species=next(o for o in planting.children if o.name.startswith('V2 Branching tree species'))
    gardens=[(12,-41.3,13,8),(31,-41.3,16,8),(12,-53.2,13,6),
             (30,-53.0,13,6),(44,-45.2,6,15),(-9,-45,5,17),(-51.8,-46,4,21)]
    for i,(x,y,w,d) in enumerate(gardens):
        planter(root,shrub,x,y,w,d,320+i)
        if w>10 or x<-45:
            _copy_group(species,root,(x-.8,y+.3,.48),.85,i*.83,'V3 forecourt shade tree')
    for x,y in [(8,-46.6),(16,-46.6),(28,-46.6),(37,-46.6)]: bench(root,x,y)
    for x,y in [(-9,-56),(5,-56),(23,-48),(47,-35),(-51,-36)]:
        h.cylinder('V3 landscape light base',(x,y,.25),.17,.25,'limestone',parent=root)
        h.bar('V3 landscape lighting pole',(x,y,.35),(x,y,3.5),.043,'dark',root)
        h.box('V3 landscape downlight',(x,y,3.52),(.54,.34,.13),'dark',.03,root)
        h.box('V3 landscape lamp lens',(x,y,3.45),(.44,.24,.02),'lamp',.008,root)
    # Short-stay bay remains on the approach road, away from the pedestrian crossing.
    for x in [10,24]:
        h.box('V3 dropoff end marking',(x,-27.6,.153),(.08,1.4,.008),'V3 yellow paint',0,root)
    h.box('V3 dropoff side marking',(17,-28.3,.153),(14,.08,.008),'V3 yellow paint',0,root)
    h.text('V3 dropoff road label','临 时 落 客',(17,-27.4,.162),.52,'V3 yellow paint',root,rotation=(0,0,0))
    for x in [8,26]:
        h.bar('V3 dropoff sign pole',(x,-25.2,.14),(x,-25.2,2.40),.038,'silver',root)
        h.box('V3 dropoff sign board',(x,-25.2,2.28),(1.4,.09,.66),'signage',.024,root)
        h.text('V3 dropoff sign text','落客即走',(x,-25.253,2.28),.24,'white',root)
    # Small drainage channels and litter bins belong to a maintained public forecourt.
    for x in [-8,8]:
        h.box('V3 linear entry drain',(x,-23.6,.115),(10,.15,.03),'dark',.005,root)
        for j in range(60):
            h.box('V3 drain grille',(x-4.9+j*.165,-23.6,.135),(.022,.145,.012),'steel',0,root)
    for x in [-6,24]:
        h.box('V3 waste station',(x,-47.3,.60),(.80,.42,.92),'dark',.05,root)
        h.box('V3 waste station lid',(x,-47.3,1.10),(.85,.47,.10),'silver',.035,root)
    # A real sloped deck meets the existing 0.57 m entry platform at its west end.
    a,b,y0,y1=20.91,27.1,-18.0,-16.3
    vertices=[(a,y0,.08),(b,y0,.08),(b,y1,.08),(a,y1,.08),
              (a,y0,.57),(b,y0,.14),(b,y1,.14),(a,y1,.57)]
    h.object_mesh('V3 accessible entrance ramp',vertices,[(0,3,2,1),(4,5,6,7),
                     (0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],'paving',root)
    h.box('V3 ramp lower landing',(28.2,-17.15,.10),(2.2,1.7,.08),'paving',.008,root)
    for y in [y0+.06,y1-.06]:
        for height in [.68,.94]:
            h.bar('V3 ramp continuous handrail',(a,y,.57+height),(b,y,.14+height),.024,'steel',root)
        for x in [a,23,25,b]:
            z=.57-(x-a)*.43/(b-a)
            h.bar('V3 ramp handrail upright',(x,y,z),(x,y,z+.94),.019,'steel',root)
    return root
