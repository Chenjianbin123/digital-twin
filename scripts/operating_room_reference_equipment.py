"""Editable operating theatre equipment reconstructed from the approved concept."""
import math
import hospital_reconstruction_common as h


def caster(x,y,z,parent,r=.065):
    h.cylinder('Caster swivel', (x,y,z+r*1.7),r*.35,.06,'steel',parent=parent)
    h.box('Caster fork',(x,y,z+r*.75),(r*1.05,r*1.2,r*1.25),'steel',.008,parent)
    for dx in [-r*.40,r*.40]:
        h.cylinder('Non marking tyre',(x+dx,y,z),r,r*.36,'rubber',(0,math.pi/2,0),parent)
        h.cylinder('Wheel hub',(x+dx*1.49,y,z),r*.48,.007,'silver',(0,math.pi/2,0),parent)
    h.box('Foot brake',(x,y-r*.72,z+r*.65),(r*.65,r*.9,.019),'graphite',.008,parent)


def screen(name,loc,w,ht,parent,standby=False):
    x,y,z=loc
    root=h.empty(name,parent)
    h.box('Display enclosure',(x,y,z),(w,.065,ht),'graphite',.017,root)
    h.box('Display gasket',(x,y-.036,z),(w-.025,.006,ht-.025),'rubber',.004,root)
    h.box('Display glass',(x,y-.041,z),(w-.043,.004,ht-.045),'screen',.002,root)
    h.sphere('Display power LED',(x+w*.40,y-.046,z-ht*.43),(.003,.002,.003),'cyan',root)
    if standby:
        for j in range(3):
            points=[]
            for i in range(61):
                dx=-w*.46+i*w*.92/60
                dz=.055*math.sin(i*.11+j*.6)+j*.035-.035
                points.append((x+dx,y-.046,z+dz))
            h.tube('Standby abstract ribbon',points,.0025,'blue',root)
    else:
        for row,color in enumerate(['green','cyan','yellow']):
            points=[]
            for i in range(56):
                wave=math.sin(i*.7)*.008
                if i%18==7: wave=.025
                if i%18==8: wave=-.012
                points.append((x-w*.42+i*w*.60/55,y-.046,z+ht*.22-row*ht*.21+wave))
            h.tube('Demonstration trace',points,.0012,color,root)
            for k in range(3):
                h.box('Demo indicator',(x+w*.30+k*.025,y-.045,z+ht*.22-row*ht*.21),(.016,.002,.008),color,.001,root)
        for i in range(8):
            h.box('Display soft key',(x-w*.4+i*w*.112,y-.045,z-ht*.37),(w*.066,.002,.007),'silver',.001,root)
    return root


def table(parent):
    root=h.empty('Operating_Table',parent)
    x,y=.45,-.55
    h.box('Floor bumper',(x,y-.02,.092),(.81,1.29,.13),'rubber',.048,root)
    h.box('Stainless base casting',(x,y,.18),(.80,1.32,.17),'steel',.045,root)
    h.box('Base upper cover',(x,y+.01,.272),(.65,1.13,.065),'silver',.028,root)
    for dx in [-.36,.36]:
        for dy in [-.52,.52]: caster(x+dx,y+dy,.08,root,.055)
    for dx in [-.25,.25]:
        h.box('Foot pedal',(x+dx,y-.73,.17),(.17,.14,.035),'graphite',.011,root)
    h.box('Column foot',(x,y,.37),(.35,.43,.18),'steel',.025,root)
    for j in range(9):
        h.box('Hydraulic bellows',(x,y,.46+j*.024),(.38+(.012 if j%2 else 0),.46,.020),'rubber',.008,root)
    h.box('Telescopic column',(x,y,.78),(.32,.37,.30),'steel',.021,root)
    h.cylinder('Table pitch bearing',(x,y,.89),.118,.43,'steel',(0,math.pi/2,0),root)
    for side in [-1,1]:
        h.cylinder('Pitch pivot end',(x+side*.23,y,.89),.071,.016,'silver',(0,math.pi/2,0),root)
        h.cylinder('Pitch pivot screw',(x+side*.243,y,.89),.024,.010,'graphite',(0,math.pi/2,0),root,segments=6)
    # Head is +Y, the split leg plates are at the camera-facing -Y end.
    sections=[('Head',1.13,.40,.57),('Back',.65,.54,.60),('Pelvis',.045,.63,.61)]
    for name,dy,length,width in sections:
        h.box(name+' stainless pan',(x,y+dy,1.01),(width+.02,length,.07),'steel',.019,root)
        h.box(name+' cushion piping',(x,y+dy,1.057),(width+.004,length-.009,.042),'graphite',.02,root)
        h.box(name+' seamless pad',(x,y+dy,1.091),(width,length-.019,.11),'padding',.033,root)
    for side in [-1,1]:
        xx=x+side*.166
        h.box('Split leg deck',(xx,y-.70,1.005),(.315,.81,.062),'steel',.017,root)
        h.box('Split leg cushion seam',(xx,y-.70,1.053),(.308,.792,.045),'graphite',.021,root)
        h.box('Split leg cushion',(xx,y-.70,1.088),(.304,.785,.103),'padding',.033,root)
        h.box('Accessory side rail',(x+side*.373,y+.16,.982),(.022,1.78,.033),'steel',.004,root)
        for dy in [-.60,-.25,.18,.62,.91]:
            h.box('Rail stand-off',(x+side*.334,y+dy,.981),(.068,.027,.028),'steel',.004,root)
            h.box('Rail mounting bracket',(x+side*.316,y+dy,.946),(.018,.055,.074),'steel',.004,root)
            h.cylinder('Rail fastener',(x+side*.331,y+dy,.945),.009,.012,'graphite',(0,math.pi/2,0),root,segments=12)
        for dy in [-.27,.58]:
            h.cylinder('Deck hinge',(x+side*.305,y+dy,1.005),.024,.045,'steel',(0,math.pi/2,0),root)
        h.bar('Adjustment spindle',(x+side*.31,y-.71,.95),(x+side*.39,y-.71,.81),.01,'steel',root)
        h.cylinder('Knurled locking knob',(x+side*.40,y-.71,.80),.025,.055,'graphite',parent=root)
    h.box('Hand controller',(.91,-.28,.87),(.062,.025,.16),'graphite',.013,root)
    for i in range(5): h.box('Controller button',(.91,-.295,.815+i*.025),(.036,.009,.015),'silver',.006,root)
    h.tube('Controller coiled cable',[(.92+.011*math.sin(t*.8),-.26+.012*math.cos(t*.8),.77-t*.004) for t in range(60)],.003,'rubber',root)
    return root


def surgical_lamp(name,loc,radius,parent,normal):
    root=h.empty(name,parent)
    # All optical parts share a local mounting plane before the lamp is posed.
    h.cylinder('Lamp back housing',(0,0,-.025),radius,.12,'white',parent=root,segments=64)
    h.ring('Perimeter grip bumper',(0,0,.025),radius+.008,.017,'silver',root)
    h.cylinder('Reflector tray',(0,0,.043),radius*.944,.017,'silver',parent=root,segments=64)
    for fraction,count in [(.33,8),(.59,14),(.81,20)]:
        for i in range(count):
            a=h.TAU*(i+.3)/count
            x,y=radius*fraction*math.cos(a),radius*fraction*math.sin(a)
            rr=radius*.084
            h.cylinder('LED individual reflector',(x,y,.057),rr,.014,'steel',parent=root,segments=20)
            h.ring('Optical chrome rim',(x,y,.067),rr*.88,.0018,'silver',root,segments=20)
            h.sphere('Convex LED optic',(x,y,.069),(rr*.73,rr*.73,.009),'optic',root,16,8)
            h.cylinder('LED emitter',(x,y,.078),rr*.28,.005,'light',parent=root,segments=12)
    h.cylinder('Handle socket',(0,0,.066),radius*.17,.052,'silver',parent=root)
    h.cylinder('Sterile center handle',(0,0,.145),radius*.075,.145,'white',parent=root)
    h.cylinder('Handle end',(0,0,.218),radius*.087,.015,'graphite',parent=root)
    for side in [-1,1]:
        pts=[(side*(radius+.045),-.12,-.015),(side*(radius+.082),-.18,-.085),
             (side*(radius+.095),.12,-.15),(side*(radius+.045),.20,-.14)]
        h.tube('Side rotation grip',pts,.016,'white',root)
    root.location=loc
    from mathutils import Vector
    root.rotation_euler=Vector(normal).to_track_quat('Z','Y').to_euler()
    return root


def lamps(parent):
    root=h.empty('Dual_Surgical_Lights',parent)
    h.cylinder('Ceiling light mount',(-.90,.65,3.12),.20,.14,'white',parent=root)
    h.cylinder('Main rotating column',(-.90,.65,2.96),.073,.34,'white',parent=root)
    for label,elbow,end,z,r in [('Main',(-1.35,-.05),(-.72,-.55),2.45,.44),('Secondary',(.55,.58),(1.10,.32),2.38,.34)]:
        h.beam(label+' ceiling arm',(-.90,.65,2.94),(*elbow,2.94),.10,.072,'white',root)
        h.cylinder(label+' pivot',(*elbow,2.87),.077,.24,'white',parent=root)
        h.beam(label+' spring arm',(*elbow,2.80),(end[0],end[1],2.66),.084,.067,'white',root)
        h.cylinder(label+' elbow',(*end,2.64),.058,.19,'silver',parent=root)
        h.tube(label+' lamp fork',[(end[0],end[1],2.66),(end[0]+r+.04,end[1],2.62),(end[0]+r+.06,end[1]-.04,z+.08)],.025,'white',root)
        surgical_lamp(label+'_Optical_Head',(*end,z),r,root,(.02,-.61,-.79))
    return root


def anesthesia(parent):
    root=h.empty('Anesthesia_Workstation',parent)
    x,y=-1.1,1.78
    for dx in [-.29,.29]:
        for dy in [-.25,.25]: caster(x+dx,y+dy,.075,root)
    h.box('Machine foot',(x,y,.19),(.76,.65,.10),'white',.033,root)
    h.box('Machine main cart',(x,y,.63),(.64,.57,.82),'white',.04,root)
    for i in range(3):
        zz=.37+i*.15
        h.box('Drawer gap',(x,y-.294,zz),(.53,.012,.132),'graphite',.007,root)
        h.box('Equipment drawer',(x,y-.305,zz),(.51,.02,.119),'white',.009,root)
        h.bar('Drawer pull',(x-.13,y-.336,zz+.025),(x+.13,y-.336,zz+.025),.009,'steel',root)
    h.box('Anesthesia tray rim',(x,y-.02,1.073),(.81,.72,.065),'white',.023,root)
    h.box('Anesthesia tray liner',(x,y-.04,1.11),(.70,.61,.009),'teal',.013,root)
    h.box('Ventilator control chassis',(x+.04,y+.08,1.38),(.58,.38,.48),'white',.027,root)
    screen('Ventilator_Display',(x+.11,y-.122,1.47),.32,.245,root)
    for i in range(4):
        h.cylinder('Flow control',(x-.18+i*.11,y-.129,1.23),.021,.032,'blue' if i==0 else 'silver',(math.pi/2,0,0),root)
        h.cylinder('Control center',(x-.18+i*.11,y-.147,1.23),.012,.007,'graphite',(math.pi/2,0,0),root)
    for i in range(8): h.box('Ventilator cooling slot',(x+.345,y-.03,1.26+i*.035),(.004,.22,.008),'graphite',.001,root)
    h.bar('Monitor pole',(x-.15,y+.17,1.58),(x-.15,y+.17,1.89),.022,'steel',root)
    screen('Patient_Monitor_Demo',(x-.15,y+.05,1.92),.48,.35,root)
    for i in range(3):
        xx=x-.34+i*.073
        h.cylinder('Flowmeter tube',(xx,y-.16,1.48),.020,.25,'glass',parent=root)
        h.cylinder('Flowmeter end cap',(xx,y-.16,1.34),.024,.026,'silver',parent=root)
        h.box('Flow scale',(xx,y-.181,1.48),(.009,.001,.21),'white',.001,root)
    for side in [-1,1]:
        xx=x-.40+side*.052
        points=[]
        for i in range(81):
            t=i/80
            points.append((xx-.18*math.sin(math.pi*t),y-.13-.09*math.sin(math.pi*t),1.48-.72*math.sin(math.pi*t)))
        h.tube('Breathing circuit hose',points,.024,'hose',root)
        for i in range(2,79,2):
            p=points[i]
            ring=h.ring('Hose corrugation',p,.025,.003,'white',root,segments=16)
            from mathutils import Vector
            ring.rotation_euler=(Vector(points[i+1])-Vector(points[i-1])).to_track_quat('Z','Y').to_euler()
    h.sphere('Reservoir breathing bag',(x-.52,y-.20,1.07),(.076,.058,.17),'greenbag',root)
    h.bar('Vaporizer carrier',(x+.37,y-.08,1.33),(x+.58,y-.08,1.33),.015,'steel',root)
    h.cylinder('Vaporizer',(x+.45,y-.02,1.49),.072,.20,'silver',parent=root)
    h.cylinder('Vaporizer dial',(x+.45,y-.02,1.603),.047,.027,'graphite',parent=root)
    return root


def pendant(parent):
    root=h.empty('Equipment_Pendant',parent)
    x,y=1.80,1.60
    h.box('Pendant ceiling plate',(1.55,2.0,3.21),(.38,.38,.08),'white',.021,root)
    h.cylinder('Pendant column',(1.55,2.0,3.06),.085,.28,'white',parent=root)
    h.beam('Pendant swing arm',(1.55,2.0,2.97),(x,y,2.97),.13,.11,'white',root)
    h.cylinder('Pendant terminal joint',(x,y,2.85),.10,.36,'white',parent=root)
    h.box('Gas pendant enclosure',(x,y,1.93),(.28,.26,1.45),'white',.06,root)
    h.box('Pendant face plate',(x,y-.137,1.92),(.20,.015,1.25),'silver',.02,root)
    for i,color in enumerate(['white','white','blue','yellow','green']):
        z=2.38-i*.205
        h.cylinder('Gas socket bezel',(x,y-.163,z),.038,.025,color,(math.pi/2,0,0),root)
        h.cylinder('Gas socket aperture',(x,y-.181,z),.020,.011,'graphite',(math.pi/2,0,0),root)
        h.cylinder('Gas socket center',(x,y-.187,z),.007,.012,'steel',(math.pi/2,0,0),root)
    for z in [1.25,1.65,2.04]:
        h.box('Cantilever shelf',(x-.36,y,z),(.50,.47,.052),'white',.023,root)
        h.box('Shelf soft bumper',(x-.36,y-.22,z-.002),(.43,.018,.032),'blue',.006,root)
        if z<2:
            h.box('Equipment module',(x-.36,y,z+.12),(.36,.32,.19),'white',.016,root)
            screen('Equipment status',(x-.40,y-.173,z+.15),.19,.10,root)
            h.cylinder('Module dial',(x-.24,y-.183,z+.13),.019,.014,'silver',(math.pi/2,0,0),root)
    h.bar('Pendant handle',(x+.22,y-.03,1.69),(x+.22,y-.03,2.28),.013,'steel',root)
    for z in [1.70,2.26]: h.bar('Handle stand-off',(x+.1,y-.03,z),(x+.22,y-.03,z),.013,'steel',root)
    return root


def instrument_cart(parent,loc,name='Instrument_Cart'):
    root=h.empty(name,parent)
    x,y=loc
    for dx in [-.38,.38]:
        for dy in [-.235,.235]:
            caster(x+dx,y+dy,.069,root,.055)
            h.bar('Cart upright',(x+dx,y+dy,.14),(x+dx,y+dy,1.02),.017,'steel',root)
    h.box('Cart enclosure',(x,y,.59),(.73,.45,.79),'silver',.023,root)
    for i in range(4):
        z=.33+i*.18
        h.box('Cart drawer seam',(x,y-.23,z),(.68,.008,.168),'graphite',.003,root)
        h.box('Cart drawer front',(x,y-.24,z),(.671,.014,.157),'steel',.007,root)
        h.bar('Cart drawer handle',(x-.14,y-.278,z+.025),(x+.14,y-.278,z+.025),.011,'steel',root)
    h.box('Cart instrument surface',(x,y,1.027),(.86,.57,.034),'steel',.021,root)
    for side in [-1,1]:
        h.bar('Raised tray rail',(x+side*.4,y-.24,1.105),(x+side*.4,y+.24,1.105),.010,'steel',root)
        for dy in [-.24,.24]:h.bar('Tray rail support',(x+side*.4,y+dy,1.04),(x+side*.4,y+dy,1.105),.009,'steel',root)
    h.bar('Rear tray rail',(x-.4,y+.24,1.105),(x+.4,y+.24,1.105),.010,'steel',root)
    h.box('Folded sterile drape',(x,y,1.053),(.68,.41,.02),'drape',.014,root)
    for dx in [-.19,.15]:
        h.box('Instrument tray',(x+dx,y,1.078),(.26,.28,.024),'steel',.016,root)
        h.box('Instrument tray recess',(x+dx,y,1.091),(.235,.255,.008),'silver',.012,root)
        for i in range(4):
            h.bar('Instrument handle',(x+dx-.083+i*.054,y-.105,1.108),(x+dx-.083+i*.054,y+.07,1.108),.004,'steel',root,12)
    return root


def accessories(parent):
    root=h.empty('Mobile_Accessories',parent)
    # Mayo stand clear of the operating table side rail.
    x,y=1.95,-.95
    for i in range(5):
        a=h.TAU*i/5
        p=(x+.29*math.cos(a),y+.29*math.sin(a))
        h.bar('Mayo stand leg',(x,y,.19),(*p,.11),.018,'steel',root)
        caster(*p,.052,root,.039)
    h.cylinder('Mayo stand column',(x,y,.60),.020,.95,'steel',parent=root)
    h.cylinder('Mayo clamp',(x,y,.63),.032,.08,'silver',parent=root)
    h.box('Mayo tray',(x,y,1.09),(.53,.36,.045),'steel',.018,root)
    h.box('Mayo tray depression',(x,y,1.115),(.48,.31,.007),'silver',.012,root)
    x,y=-2.03,1.05
    h.cylinder('Stool upholstered seat',(x,y,.64),.215,.076,'padding',parent=root,segments=48)
    h.cylinder('Stool piston',(x,y,.42),.027,.36,'steel',parent=root)
    for i in range(5):
        a=h.TAU*i/5
        p=(x+.27*math.cos(a),y+.27*math.sin(a))
        h.bar('Stool base',(x,y,.21),(*p,.105),.019,'steel',root)
        caster(*p,.055,root,.040)
    x,y=-.14,2.30
    h.cylinder('IV pole',(x,y,1.11),.011,2.0,'steel',parent=root)
    h.cylinder('IV pole clamp',(x,y,1.30),.022,.044,'graphite',parent=root)
    for side in [-1,1]:
        h.tube('IV hook',[(x,y,2.10),(x+side*.15,y,2.10),(x+side*.18,y,2.07),(x+side*.17,y,2.03)],.006,'steel',root)
    for i in range(5):
        a=h.TAU*i/5
        h.bar('IV pole leg',(x,y,.16),(x+.23*math.cos(a),y+.23*math.sin(a),.08),.012,'steel',root)
    return root


def boom_displays(parent):
    root=h.empty('Dual_Monitor_Arm',parent)
    h.cylinder('Monitor ceiling swivel',(2.8,2.25,3.1),.115,.27,'white',parent=root)
    h.beam('Monitor overhead arm',(2.8,2.25,2.99),(3.13,1.15,2.99),.11,.09,'white',root)
    h.cylinder('Monitor elbow',(3.13,1.15,2.89),.065,.25,'white',parent=root)
    h.bar('Monitor drop arm',(3.13,1.15,2.88),(3.13,1.15,2.22),.037,'white',root)
    h.bar('Display crossbar',(2.49,1.16,2.19),(3.65,1.16,2.19),.024,'steel',root)
    for xx in [2.72,3.40]:
        screen('Diagnostic_Display',(xx,1.02,2.03),.64,.42,root,True)
    return root
