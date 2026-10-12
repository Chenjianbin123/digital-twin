"""Editable nursing and clinical support furniture, in metre coordinates."""
import math
import bpy
import hospital_reconstruction_common as h
import hospital_floor_reference_details as d


def remove_tree(obj):
    for child in list(obj.children_recursive):bpy.data.objects.remove(child,do_unlink=True)
    bpy.data.objects.remove(obj,do_unlink=True)


def cabinet(parent,name,x,y,width=.65,depth=.48,height=.90,angle=0,drawers=False):
    root=h.empty(name,parent);root.location=(x,y,.10);root.rotation_euler.z=angle
    root['assetRole']='clinical-storage'
    d.box('Cabinet recessed plinth',(0,0,.055),(width-.08,depth-.065,.11),'Floor_Dark',.01,root)
    d.box('Cabinet sealed carcass',(0,0,height/2+.07),(width,depth,height-.06),'Floor_White',.012,root)
    d.box('Worktop edge',(0,0,height+.055),(width+.025,depth+.035,.045),'Floor_White',.015,root)
    if drawers:
        for i in range(3):
            z=.20+i*(height-.19)/3
            d.box('Clinical drawer front',(0,-depth/2-.012,z),(width-.04,.022,(height-.19)/3-.013),'Floor_Teal',.008,root)
            h.bar('Drawer pull',(-width*.24,-depth/2-.038,z+.035),(width*.24,-depth/2-.038,z+.035),.011,'Floor_Steel',root)
    else:
        for side in [-1,1]:
            d.box('Cupboard door',(side*width*.25,-depth/2-.013,height*.52),(width*.5-.025,.025,height-.17),'Floor_Oak',.01,root)
            h.bar('Cupboard pull',(side*.055,-depth/2-.045,height*.59),
                  (side*.055,-depth/2-.045,height*.80),.012,'Floor_Steel',root)
    return root


def printer(parent,x,y,z):
    root=h.empty('Nurse document printer',parent);root.location=(x,y,z)
    d.box('Printer main housing',(0,0,.13),(.44,.34,.23),'Floor_White',.025,root)
    d.box('Printer scanner lid',(0,0,.265),(.46,.35,.035),'Floor_Dark',.012,root)
    d.box('Printer paper opening',(0,-.177,.15),(.32,.015,.045),'Floor_Dark',.004,root)
    d.box('Printer output tray',(0,-.23,.12),(.34,.15,.018),'Floor_Steel',.006,root)
    d.box('Printer blank paper',(0,-.23,.133),(.25,.15,.006),'Floor_White',.002,root)
    d.box('Printer control display',(.155,-.07,.29),(.10,.08,.006),'Floor_Screen',.004,root)
    return root


def nursing(root):
    station=bpy.data.objects['Central_Nurse_Station']
    # The middle position becomes a standing document/preparation station.
    # Keep the two outer seated workstations and side entries free.
    for obj in list(station.children):
        x=obj.location.x
        if abs(x)<.45 and obj.name.startswith(('Workstation monitor','Visitor chair','Monitor stem','Monitor foot','Keyboard')):
            remove_tree(obj)
    for x in [-.61,0,.61]:
        cabinet(root,'Nurse rear preparation cabinet',x,1.55,.60,.48,.94,drawers=x==0)
    printer(station,-.03,.01,.85)
    for i in range(5):
        x=-.47+i*.038
        d.box('Nurse blank document file',(x,.15,1.015),(.024,.24,.30),
              'Floor_Teal' if i%2 else 'Floor_White',.002,station)
    d.box('Document file holder',(-.39,.15,.858),(.26,.29,.025),'Floor_Steel',.004,station)
    for x in [-.61,.61]:
        d.box('Labelled supply tray',(x,1.52,1.135),(.44,.28,.065),'Floor_Teal',.012,root)
        for i in range(3):d.box('Wrapped supply pack',(x-.12+i*.12,1.52,1.184),(.10,.20,.032),'Floor_White',.008,root)
    # A discreet recessed floor inlay gives the work area a material boundary.
    d.box('Nursing zone floor inset',(0,.32,.112),(6.75,3.70,.010),'V3_NursingFloor',.16,root)
    for x in [-3.25,3.25]:
        d.box('Nursing floor fine border',(x,.32,.12),(.018,3.5,.005),'Floor_Teal',.003,root)
    return station


def parking_bay(parent,name,x,y,width,length,asset):
    root=h.empty(name,parent);root.location=(x,y,0)
    root['assetRole']='equipment-parking';root['assetName']=asset.name
    root['centerX']=x;root['centerY']=y;root['width']=width;root['length']=length
    for xx in [-width/2,width/2]:d.box('Equipment bay painted side',(xx,0,.106),(.035,length,.005),'Floor_Teal',.002,root)
    d.box('Equipment bay painted rear',(0,length/2,.106),(width,.035,.005),'Floor_Teal',.002,root)
    h.text('Equipment bay floor label','设备停放',(0,-length/2-.17,.108),.13,'Floor_Ink',root,rotation=(0,0,0))
    return root


def transport(root):
    cart=bpy.data.objects['Emergency trolley'];cart.location=(11.65,1.65,.10)
    parking_bay(root,'Emergency cart bay',11.65,1.65,1.20,1.25,cart)
    chair=bpy.data.objects['Parked transport wheelchair'];chair.location=(-11.55,4.70,.10)
    parking_bay(root,'Wheelchair bay',-11.55,4.70,1.15,1.45,chair)
    cart=bpy.data.objects['Nursing trolley'];cart.location=(10.75,5.42,.10)
    parking_bay(root,'Treatment cart bay',10.75,5.42,1.18,1.20,cart)
    # Keep greenery out of the new transport parking rectangle.
    support=bpy.data.objects['Support_Spaces']
    for obj in support.children:
        if obj.name.startswith(('Lobby planter','Planter soil','Plant stem','Lobby leaf')):
            obj.location.y+=1.75
    for obj in list(bpy.data.objects['Hospital_Clinical_Details_V2'].children):
        if obj.name.startswith('Visitor chair'):remove_tree(obj)
    seating=h.empty('Visitor waiting seats',root);seating.location=(-11.86,-.62,0)
    seating.rotation_euler.z=math.pi/2
    for x in [-.64,0,.64]:d.chair(seating,x,0)
    h.bar('Waiting seats connecting beam',(-.96,0,.27),(.96,0,.27),.025,'Floor_Steel',seating)


def tray_table(parent,x,y):
    root=h.empty('Mobile overbed table',parent);root.location=(x,y,.10)
    root['assetRole']='overbed-table'
    d.box('Overbed table laminate top',(0,0,.86),(1.02,.40,.045),'Floor_Oak',.025,root)
    d.box('Table edge bumper',(0,0,.836),(1.045,.416,.02),'Floor_White',.021,root)
    h.bar('Table telescopic upright',(.40,0,.12),(.40,0,.82),.028,'Floor_Steel',root)
    d.box('Table adjustable sleeve',(.40,0,.49),(.072,.065,.28),'Floor_White',.012,root)
    for yy in [-.16,.16]:
        h.bar('Table base rail',(-.35,yy,.09),(.40,yy,.09),.018,'Floor_Steel',root)
        for xx in [-.35,.40]:h.cylinder('Table caster',(xx,yy,.047),.047,.026,'Floor_Dark',(math.pi/2,0,0),root,20)
    h.cylinder('Patient water cup',(-.31,.03,.949),.034,.127,'Floor_White',parent=root,segments=32)
    return root


def room_details(root):
    for room in [o for o in bpy.context.scene.objects if o.get('capacity')==2]:
        number=int(room['roomNumber']);x=[-6.6,-2.2,2.2,6.6][(number-101)%4]
        tray_table(room,x-1.07,3.79 if number<105 else -5.56)
        # Low skirting and protection at the door edges survive the cutaway.
        for side in [-1,1]:
            d.box('Clinical wall skirting',(x+side*2.10,4.7 if number<105 else -4.7,.20),
                  (.025,4.66,.17),'Floor_CutEdge',.003,room)
        for bed in [o for o in room.children if o.get('assetRole')=='physical-bed']:
            # Synthetic status bars on the real terminal surface, no patient data.
            terminals=[o for o in bed.children_recursive if o.get('assetRole')=='bedside-terminal']
            for terminal in terminals:
                for i in range(3):
                    d.box('Bedside display demonstration',(-.68,-1.296,1.65-i*.045),
                          (.26-i*.035,.002,.010),'Floor_LED',.001,terminal)


def support_rooms(root):
    # Preparation counter fronts face into the room, away from the shared wall.
    for i,y in enumerate([4.16,5.12,6.08]):
        cabinet(root,'Preparation work cabinet',9.24,y,.94,.52,.85,math.pi/2,i==1)
    for y in [4.16,5.12,6.08]:
        d.box('Preparation splashback',(8.989,y,1.34),(.035,.94,.75),'Floor_White',.008,root)
        d.box('Preparation task light',(9.04,y,1.70),(.055,.77,.025),'Floor_LED',.008,root)
    for y in [4.13,4.37]:
        d.box('Sealed preparation supplies',(9.26,y,1.055),(.30,.18,.075),'Floor_White',.012,root)
    # Upgrade the front treatment workbench into enclosed, cleanable storage.
    support=bpy.data.objects['Support_Spaces']
    for obj in list(support.children):
        if obj.name.startswith(('Staff table','Staff table leg')):remove_tree(obj)
    for i,x in enumerate([9.69,10.65,11.61]):
        cabinet(root,'Treatment room counter',x,-7.48,.94,.62,.85,math.pi,i==1)
    d.box('Treatment couch pillow',(10.36,-4.58,1.04),(.61,.32,.12),'Floor_White',.07,root)
    h.bar('Examination lamp stand',(11.30,-4.27,.15),(11.30,-4.27,1.45),.022,'Floor_Steel',root)
    h.bar('Examination articulated arm',(11.30,-4.27,1.45),(10.79,-4.53,1.78),.025,'Floor_White',root)
    h.sphere('Examination lamp head',(10.79,-4.53,1.76),(.18,.15,.07),'Floor_White',root,24,12)
    for i in range(3):
        a=i*math.tau/3
        h.bar('Lamp stand base',(11.3,-4.27,.14),(11.3+.22*math.cos(a),-4.27+.22*math.sin(a),.12),.016,'Floor_Steel',root)
    # The near wall is cut away; screen and rail mark the treatment bay.
    partition=h.empty('Treatment privacy screen',root);partition.location=(11.34,-5.48,.10)
    for yy in [-.59,.59]:
        h.bar('Screen leg',(0,yy,.03),(0,yy,1.77),.014,'Floor_Steel',partition)
        h.bar('Screen foot',(-.21,yy,.04),(.21,yy,.04),.017,'Floor_Steel',partition)
    d.box('Washable privacy screen',(0,0,1.1),(.025,1.15,1.28),'Floor_Curtain',.015,partition)
    # Sanitary room fixtures have mirror, paper/soap dispensers and actual rails.
    d.box('Sanitary mirror frame',(-10.64,-7.91,1.57),(1.07,.045,.76),'Floor_Steel',.018,root)
    d.box('Sanitary mirror',(-10.64,-7.881,1.57),(1.00,.012,.69),'V3_Mirror',.007,root)
    for x in [-9.88,-11.35]:
        d.box('Hygiene dispenser',(x,-7.81,1.34),(.18,.14,.27),'Floor_White',.025,root)
        d.box('Hygiene dispenser window',(x,-7.73,1.34),(.085,.01,.10),'Floor_Teal',.005,root)
    for y in [-6.65,-4.70]:
        d.box('Cubicle door latch',(-11.352,y-.36,1.10),(.023,.09,.13),'Floor_Steel',.008,root)
        h.bar('Cubicle pull',(-11.30,y-.36,.94),(-11.30,y-.36,1.10),.012,'Floor_Steel',root)
        h.ring('Toilet paper holder',(-12.37,y-.35,.72),.058,.008,'Floor_Steel',root,(0,math.pi/2,0))
        h.cylinder('Toilet paper roll',(-12.37,y-.35,.72),.051,.10,'Floor_White',(0,math.pi/2,0),root,24)
