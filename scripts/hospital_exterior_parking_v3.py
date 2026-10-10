"""Small outpatient parking area, in unscaled metre coordinates."""
import math
import json
import bpy
import hospital_reconstruction_common as h


def surface(name, center, size, parent, aisle=False):
    obj = h.box(name, (*center, .105), (*size, .07), 'asphalt', 0, parent)
    obj['parkingSurface'] = True
    obj['parkingAisle'] = aisle
    return obj


def car(parent, space_id, location, angle, paint, index):
    root = h.empty('V3 parked car '+space_id, parent)
    root['carRoot'] = True
    root['parkingSpaceId'] = space_id
    root.location = (*location, .14)
    root.rotation_euler.z = angle
    # A tapered body with shoulder, sill and bonnet profiles avoids box-shaped cars.
    sections = [(-2.13,.73,.65),(-1.88,.88,.87),(-1.28,.91,.96),
                (.95,.91,1.00),(1.74,.86,.91),(2.12,.74,.76)]
    verts, faces = [], []
    for y, width, top in sections:
        verts += [(-width*.91,y,.34),(-width,y,.52),(-width,y,top-.10),
                  (-width*.85,y,top),(width*.85,y,top),(width,y,top-.10),
                  (width,y,.52),(width*.91,y,.34)]
    for i in range(len(sections)-1):
        for j in range(8):
            a=i*8+j; b=i*8+(j+1)%8
            faces.append((a,b,b+8,a+8))
    faces += [tuple(reversed(range(8))),tuple(range(40,48))]
    h.bevel(h.object_mesh('V3 sculpted car body',verts,faces,paint,root),.055,3)
    cabin = [(-.80,-1.18,.95),(.80,-1.18,.95),(.82,1.45,.95),(-.82,1.45,.95),
             (-.67,-.48,1.48),(.67,-.48,1.48),(.68,.83,1.48),(-.68,.83,1.48)]
    h.bevel(h.object_mesh('V3 car cabin',cabin,[(0,1,5,4),(1,2,6,5),(2,3,7,6),
                                             (3,0,4,7),(4,5,6,7)],paint,root),.045,3)
    for name, points in [
        ('windscreen',[(-.72,-1.195,1.01),(.72,-1.195,1.01),(.60,-.50,1.43),(-.60,-.50,1.43)]),
        ('rear glass',[(-.74,1.46,1.00),(-.60,.88,1.43),(.60,.88,1.43),(.74,1.46,1.00)])]:
        h.object_mesh('V3 car '+name,points,[(0,1,2,3)],'V3 car glass',root)
    for side in [-1,1]:
        h.object_mesh('V3 front side window',[(side*.797,-1.08,1.01),(side*.697,-.43,1.43),
                       (side*.70,.12,1.43),(side*.827,.12,1.01)],[(0,1,2,3)],'V3 car glass',root)
        h.object_mesh('V3 rear side window',[(side*.827,.22,1.01),(side*.70,.22,1.43),
                       (side*.71,.79,1.43),(side*.82,1.32,1.01)],[(0,1,2,3)],'V3 car glass',root)
        for y in [-1.35,1.35]:
            tyre=h.cylinder('V3 tyre '+space_id,(side*.885,y,.31),.31,.19,'rubber',
                            (0,math.pi/2,0),root,40,.01)
            tyre['wheelRadius']=.31
            tyre['parkingSpaceId']=space_id
            h.cylinder('V3 alloy rim',(side*.987,y,.31),.22,.015,'silver',
                       (0,math.pi/2,0),root,32,.003)
            h.cylinder('V3 wheel hub',(side*1.0,y,.31),.078,.025,'dark',
                       (0,math.pi/2,0),root,24)
            for k in range(5):
                a=k*h.TAU/5
                h.bar('V3 alloy wheel spoke',(side*1.006,y,.31),
                      (side*1.006,y+.19*math.sin(a),.31+.19*math.cos(a)),.019,'steel',root,8)
        h.box('V3 side mirror',(side*.98,-.80,1.03),(.21,.27,.13),paint,.05,root)
        for y in [-.48,.87]:
            h.box('V3 car door handle',(side*.921,y,.90),(.018,.19,.028),'silver',.008,root)
        h.tube('V3 car door shut line',[(side*.916,.19,.96),(side*.92,.18,.52),
                                     (side*.86,-.78,.43)],.006,'dark',root)
        h.box('V3 headlamp',(side*.57,-2.09,.72),(.44,.06,.14),'lamp',.036,root)
        h.box('V3 rear lamp',(side*.60,2.09,.72),(.34,.06,.14),'V3 brake lens',.03,root)
    h.box('V3 front grille',(0,-2.14,.51),(.86,.025,.14),'dark',.022,root)
    h.box('V3 rear plate',(0,2.145,.59),(.43,.015,.13),'V3 plate',.006,root)
    h.box('V3 front plate',(0,-2.155,.56),(.43,.015,.13),'V3 plate',.006,root)
    return root


def accessible_symbol(x,y,parent):
    z=.157
    points=[(x+.40*math.cos(i*h.TAU/36),y-.14+.40*math.sin(i*h.TAU/36),z) for i in range(37)]
    h.tube('V3 wheelchair wheel marking',points,.034,'V2 marking',parent)
    h.cylinder('V3 wheelchair head marking',(x-.05,y+.70,z),.105,.007,'V2 marking',parent=parent)
    h.tube('V3 wheelchair frame marking',[(x-.04,y+.50,z),(x+.06,y+.03,z),
             (x+.43,y+.03,z),(x+.62,y-.39,z),(x+.85,y-.39,z)],.038,'V2 marking',parent)
    h.tube('V3 wheelchair back marking',[(x-.02,y+.33,z),(x+.36,y+.33,z)],.035,'V2 marking',parent)


def build(parent):
    root=h.empty('V3_Parking',parent)
    for name,color,rough,metal in [
        ('V3 parking blue','#477788',.81,0),('V3 brake lens','#9d3027',.27,.1),
        ('V3 plate','#37667f',.40,0),('V3 car pearl','#d2d8d6',.22,.45),
        ('V3 car slate','#586571',.25,.60),('V3 car navy','#2f495c',.24,.55),
        ('V3 car champagne','#a69b83',.24,.55),('V3 car graphite','#313d42',.23,.55),
        ('V3 car silver','#929da3',.20,.65),('V3 car glass','#253c49',.085,.36),
        ('V3 yellow paint','#d7b85e',.73,0)]:
        mat=h.material(name,color,rough,metal)
        if 'car ' in name and 'glass' not in name:
            mat.node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value=.45
    surface('V3 north parking pavement',(-35,-40.5),(26,6),root)
    surface('V3 parking maneuver aisle',(-35,-46.5),(26,6),root,True)
    surface('V3 south parking pavement',(-35,-52.75),(26,6.5),root)
    surface('V3 parking access connector',(-21.5,-46.5),(1,6),root)
    surface('V3 visitor entrance road',(-18,-46.25),(6,25.5),root)
    for y in [-56.12,-37.38]:
        for lo,hi in [(-48,-27.0),(-24.8,-22)]:
            h.box('V3 parking curb',((lo+hi)/2,y,.25),(hi-lo,.18,.25),'limestone',.018,root)
    h.box('V3 parking west curb',(-48.12,-46.75,.25),(.18,18.5,.25),'limestone',.018,root)
    spaces=[]
    stripes={}
    for row,y in [('N',-40.75),('S',-52.25)]:
        edge=-46.2
        for i in range(7):
            width=3.5 if i==6 else 2.65
            x=edge+width/2; space_id=row+str(i+1).zfill(2)
            slot=h.empty('V3 parking space '+space_id,root)
            for key,value in {'parkingSpaceId':space_id,'accessible':i==6,'centerX':x,'centerY':y,
                              'widthMetres':width,'lengthMetres':5.3}.items(): slot[key]=value
            if i==6:
                h.box('V3 accessible blue surface',(x,y,.145),(width-.10,5.20,.008),'V3 parking blue',0,slot)
                accessible_symbol(x,y,slot)
                for yy in [y-2.2+j*.40 for j in range(12)]:
                    line=h.box('V3 accessible side hatching',(-25.95,yy,.153),(1.3,.08,.007),'V2 marking',0,root)
                    line.rotation_euler.z=.35
            boundary_names=[]
            for dx in [-width/2,width/2]:
                # Neighbouring bays reference one shared physical stripe.
                key=(row,round(x+dx,4))
                yy=y+(-.0375 if row=='N' else .0375)
                if key not in stripes:
                    line=h.box('V3 stall boundary',(x+dx,yy,.158),(.08,5.225,.007),'V2 marking',0,root)
                    line['parkingBoundary']=True
                    stripes[key]=line
                boundary_names.append(stripes[key].name)
            outer=y+(2.65 if row=='N' else -2.65)
            line=h.box('V3 stall end boundary',(x,outer,.154),(width,.075,.007),'V2 marking',0,slot)
            line['parkingBoundary']=True
            boundary_names.append(line.name)
            slot['boundaryObjectNames']=json.dumps(boundary_names)
            for dx in [-.65,.65]:
                h.box('V3 wheel stop',(x+dx,outer+(-.45 if row=='N' else .45),.23),(.68,.17,.17),'rubber',.035,slot)
            if i!=6:
                h.text('V3 bay number',space_id,(x,y+(-1.92 if row=='N' else 1.92),.161),.32,'V2 marking',slot,rotation=(0,0,0))
            spaces.append({'id':space_id,'x':x,'y':y,'accessible':i==6})
            edge+=width
    paints=['pearl','slate','navy','champagne','graphite','silver']
    occupied=['N01','N03','N05','S02','S04','S06']
    cars=[]
    for i,space_id in enumerate(occupied):
        slot=next(s for s in spaces if s['id']==space_id)
        vehicle=car(root,space_id,(slot['x'],slot['y']),math.pi if space_id[0]=='N' else 0,'V3 car '+paints[i],i)
        cars.append(vehicle.name)
    # Same-height transfer path; the opening in the curb remains clear.
    for y in [-56.5,-36.1]:
        h.box('V3 accessible transfer path',(-19,y,.134),(17,1.8,.028),'paving',.006,root)
    for y in [-53.5,-36.1]:
        for x in [-20.4+i*.8 for i in range(7)]:
            h.box('V3 visitor road pedestrian stripe',(x,y,.155),(.43,1.8,.008),'V2 marking',0,root)
    h.box('V3 parking entry sign',(-23,-57.0,1.62),(1.3,.13,2.45),'signage',.055,root)
    h.text('V3 parking P','P',(-23,-57.073,2.20),.68,'white',root)
    h.text('V3 parking title','门诊停车',(-23,-57.074,1.50),.24,'white',root)
    h.text('V3 parking direction','←',(-23,-57.074,.97),.45,'white',root)
    h.box('V3 gate control housing',(-14.2,-54,.74),(.42,.50,1.2),'silver',.045,root)
    h.bar('V3 raised parking barrier',(-14.2,-54,1.12),(-14.60,-54,4.45),.05,'white',root)
    for z in [1.60,2.20,2.80,3.40,4.0]:
        h.box('V3 barrier reflective stripe',(-14.2-(z-1.12)*.12,-54,z),(.12,.12,.18),'V3 yellow paint',.005,root)
    h.text('V3 visitor road label','门 诊',( -18,-54.5,.155),.65,'V2 marking',root,rotation=(0,0,0))
    return {'spaces':spaces,'cars':cars,'visitorDriveX':-18,'asphaltTop':.14}
