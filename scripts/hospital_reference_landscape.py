"""Detailed campus planting, hardscape and context for the hospital reference."""
import math
import random

import bpy
from mathutils import Vector
import hospital_reconstruction_common as h


def leaf_cloud(name,seed,radius,height,parent,count=4200,leafscale=1):
    rng=random.Random(seed)
    vertices,faces=[],[]
    # Individual pointed, folded leaves; the crown is not an opaque sphere.
    for i in range(count):
        a=rng.random()*h.TAU
        z=rng.uniform(-1,1)
        rr=math.sqrt(1-z*z)*rng.random()**.22*(1+.16*math.sin(a*3)+.10*math.sin(a*7+z*2))
        center=Vector((rr*math.cos(a)*radius,rr*math.sin(a)*radius,z*radius*.85+height))
        yaw=rng.random()*h.TAU
        tilt=rng.uniform(-.75,.75)
        length=rng.uniform(.10,.23)*leafscale
        axis=Vector((math.cos(yaw),math.sin(yaw),tilt)).normalized()*length
        cross=axis.cross(Vector((0,0,1))).normalized()*length*.46
        base=len(vertices)
        vertices.extend([center-axis,center-axis*.42+cross,center+axis*.52+cross*.7,
                         center+axis,center+axis*.52-cross*.7,center-axis*.42-cross,
                         center+Vector((0,0,.027*leafscale))])
        faces.extend([(base+j,base+(j+1)%6,base+6) for j in range(6)])
    obj=h.object_mesh(name,vertices,faces,'leaf',parent)
    for mat in ['leaflight','leafdark']:obj.data.materials.append(h.M[mat])
    for face in obj.data.polygons:face.material_index=rng.choices([0,1,2],[.6,.25,.15])[0]
    return obj


def vegetation_prototype(parent):
    root=h.empty('Tree_Prototype',parent)
    h.cylinder('Tree trunk',(0,0,1.65),.135,3.3,'bark',parent=root,segments=12,edge=0)
    rng=random.Random(41)
    for i in range(13):
        a=i*2.4
        start=(0,0,1.8+i*.115)
        end=(math.cos(a)*rng.uniform(.7,1.3),math.sin(a)*rng.uniform(.7,1.3),3.5+rng.uniform(-.6,.6))
        h.bar('Tree branch',start,end,.045,'bark',root,10)
    leaf_cloud('Individual foliage',19,1.92,4.05,root)
    return root


def duplicate_tree(prototype,loc,scale,angle,name):
    root=h.empty(name,prototype.parent)
    for source in prototype.children:
        obj=source.copy()
        obj.data=source.data
        bpy.context.collection.objects.link(obj)
        obj.parent=root
    root.location=loc
    root.scale=(scale,scale,scale)
    root.rotation_euler.z=angle
    return root


def planting(parent):
    root=h.empty('Landscape_Planting',parent)
    prototype=vegetation_prototype(root)
    locations=[]
    for x in [-36,-28,-20,20,28,36]:
        locations.extend([(x,-20,1.25),(x,-40,1.25)])
    for y in [-17,-5,7,20]:locations.extend([(-45,y,1.0),(43,y,.85)])
    for x in [-53,-41,-28,-13,2,16,31,48]:locations.append((x,-54,1.70))
    for x in range(-55,65,8):locations.append((x,44,1.4))
    prototype.location=(*locations[0][:2],0)
    prototype.scale=(1.25,1.25,1.25)
    for i,(x,y,scale) in enumerate(locations[1:]):duplicate_tree(prototype,(x,y,0),scale,i*1.7,f'Tree_{i+2:02d}')
    # Low planting beds keep the front entry clear, with rounded shrub masses
    # broken up by individual small leaves in the foreground.
    rng=random.Random(20261005)
    shrub_source=leaf_cloud('Shrub individual leaves',55,.65,.42,root,650,.45)
    shrub_source.location=(-27,-20,.35)
    for x,y,w,d in [(-27,-20,22,6),(27,-20,22,6),(-26,-40,26,5),(25,-40,28,5),(-44,4,5,33),(43,9,4,25)]:
        h.box('Planting stone edge',(x,y,.18),(w,d,.36),'limestone',.12,root)
        h.box('Garden soil',(x,y,.365),(w-.35,d-.35,.025),'soil',.03,root)
        for i in range(round(w*d/2)):
            xx=x+rng.uniform(-w/2+.4,w/2-.4)
            yy=y+rng.uniform(-d/2+.4,d/2-.4)
            shrub=shrub_source.copy()
            shrub.data=shrub_source.data
            bpy.context.collection.objects.link(shrub)
            shrub.parent=root
            shrub.location=(xx,yy,.35)
            shrub.scale=(1,1,rng.uniform(.75,1.3))
            shrub.rotation_euler.z=rng.random()*h.TAU
    return root


def hardscape(parent):
    root=h.empty('Campus_Hardscape',parent)
    h.box('Continuous site terrain',(0,0,-.3),(2000,2000,.5),'grass',.02,root)
    h.box('Arrival paving',(0,-15,-.04),(90,57,.25),'paving',.04,root)
    h.box('Front service road',(0,-30,.10),(91,7,.07),'asphalt',.025,root)
    h.box('Public boulevard',(0,-49,.015),(190,10,.075),'asphalt',.02,root)
    h.box('Ambulance side lane',(38,-1,.10),(6,51,.08),'asphalt',.03,root)
    for y in [-33.6,-26.4,-43.8,-54.2]:h.box('Raised granite curb',(0,y,.20),(90,.23,.27),'limestone',.02,root)
    for x in [-38,38]:
        for y in range(-28,26,3):h.box('Side lane dash',(x,y,.148),(.12,1.50,.009),'white',0,root)
    for x in range(-70,74,6):h.box('Road dash',(x,-49,.061),(3,.13,.009),'white',0,root)
    for x in range(-5,6):
        h.box('Pedestrian crossing',(x*.60,-30,.151),(.35,6.6,.008),'white',0,root)
        h.box('Boulevard pedestrian crossing',(x*.60,-49,.062),(.35,9.2,.008),'white',0,root)
    for x in range(-40,42,3):
        for y in [-24.6,-35.4]:h.box('Paving expansion seam',(x,y,.103),(.015,2.8,.004),'joint',0,root)
    for y in range(-41,-14,3):h.box('Paving slab joint',(0,y,.10),(87,.012,.004),'joint',0,root)
    h.box('Entrance platform',(0,-15,.34),(34,6.1,.46),'paving',.04,root)
    for i in range(3):h.box('Broad entrance step',(0,-18.2-i*.33,.35-i*.105),(32,.36,.14),'limestone',.012,root)
    # Sloped side approach, separate from the formal front steps.
    ramp=h.box('Accessible entrance ramp',(19,-15,.34),(5,6,.20),'paving',.02,root)
    ramp.rotation_euler.y=-.065
    for x in [-19,19]:
        for y in [-17.6,-12.8]:
            h.bar('Access rail',(x-2,y,.86),(x+2,y,.58),.025,'steel',root)
            for dx in [-2,0,2]:h.bar('Access rail post',(x+dx,y,.25),(x+dx,y,.72-dx*.07),.017,'steel',root)
    for x in [-32,-24,-16,16,24,32]:
        h.cylinder('Entrance bollard',(x,-24.5,.61),.09,1.08,'steel',parent=root)
        h.cylinder('Bollard dark cap',(x,-24.5,1.15),.095,.05,'dark',parent=root)
    for x,y in [(-34,-37),(-16,-37),(17,-37),(34,-37),(-42,-12),(42,-16)]:
        h.box('Light pole foot',(x,y,.16),(.43,.43,.25),'limestone',.015,root)
        h.bar('Pedestrian lamp post',(x,y,.2),(x,y,4.1),.055,'dark',root)
        h.box('Lamp head',(x+.22,y,4.1),(.65,.25,.12),'dark',.03,root)
        h.box('Lamp diffuser',(x+.22,y,4.032),(.53,.18,.012),'lamp',.003,root)
    for x in [-27,26]:
        for y in [-23.7,-36.5]:
            for dx in [-.85,.85]:h.box('Bench support',(x+dx,y,.36),(.12,.47,.50),'dark',.015,root)
            for j in range(6):h.box('Timber bench slat',(x,y-.22+j*.087,.64),(2.2,.070,.062),'wood',.008,root)
    # Freestanding identity sign on the foreground-right side of the plot.
    h.box('Gate sign stone',(33,-40.1,1.4),(9,.62,2.6),'stone',.04,root)
    h.text('Campus gate name','仁和医院',(33,-40.43,1.71),.76,'teal',root)
    h.text('Campus gate English','RENHE MEDICAL CENTER',(33,-40.434,.86),.16,'dark',root)
    return root


def ambulance(parent):
    root=h.empty('Ambulance',parent)
    h.box('Van body',(0,0,1.01),(1.92,4.6,1.49),'white',.18,root)
    h.box('Raised roof',(0,.22,1.92),(1.85,3.90,.48),'white',.16,root)
    h.box('Front windscreen',(0,-2.25,1.51),(1.65,.06,.66),'glassdark',.06,root)
    h.box('Bonnet',(0,-2.27,.96),(1.81,.25,.18),'white',.06,root)
    h.box('Front grille',(0,-2.417,.67),(.80,.025,.20),'dark',.012,root)
    for side in [-1,1]:
        for yy in [-1.50,1.51]:
            h.cylinder('Ambulance tyre',(side*.95,yy,.47),.35,.18,'rubber',(0,math.pi/2,0),root)
            h.cylinder('Ambulance alloy wheel',(side*1.048,yy,.47),.21,.018,'steel',(0,math.pi/2,0),root)
        h.box('Ambulance blue stripe',(side*.965,.15,.98),(.015,3.8,.17),'blue',.003,root)
        h.box('Rear side window',(side*.968,.56,1.52),(.02,1.66,.49),'glassdark',.035,root)
        h.box('Cab side window',(side*.968,-1.51,1.47),(.02,.69,.59),'glassdark',.031,root)
        h.box('Headlight',(side*.63,-2.404,.91),(.39,.025,.22),'lamp',.023,root)
    h.box('Emergency light bar',(0,-1.1,2.22),(1.16,.27,.14),'blue',.04,root)
    root.location=(38,-9,.16)
    root.rotation_euler.z=.04
    return root


def context(parent):
    root=h.empty('Background_Context',parent)
    rng=random.Random(523)
    for i in range(76):
        x=-260+i*7.8
        y=215+(i%4)*20
        height=rng.uniform(12,35)
        w=rng.uniform(4,8)
        h.box('Distant city mass',(x,y,height/2),(w,9,height),'context',.1,root)
        for z in range(3,int(height),3):h.box('Distant glazing band',(x,y-4.53,z),(w-.6,.04,1.6),'contextglass',0,root)
    return root
