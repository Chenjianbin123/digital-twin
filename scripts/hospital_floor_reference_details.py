"""Native architectural details for the reference-led ward floor (metres)."""
import math
import bpy
import hospital_reconstruction_common as h


def palette():
    for name, color, rough, metal in [
        ('Floor_Wall', '#e5e4df', .7, 0), ('Floor_CutEdge', '#c4c7c7', .5, .05),
        ('Floor_Stone', '#c7cbcb', .4, 0), ('Floor_Vinyl', '#d7dada', .48, 0),
        ('Floor_Seam', '#aeb6b7', .7, 0), ('Floor_Oak', '#c7b8a0', .55, 0),
        ('Floor_Teal', '#678c94', .42, .08), ('Floor_White', '#eceeea', .38, 0),
        ('Floor_Steel', '#a9b8c0', .28, .72), ('Floor_Dark', '#25363e', .5, .1),
        ('Floor_Screen', '#123746', .36, 0), ('Floor_Ink', '#254958', .5, 0),
        ('Floor_Curtain', '#b4c6c8', .9, 0), ('Floor_Glass', '#e7f2f4', .035, 0),
        ('Floor_Blue', '#388ef0', .38, .15), ('Floor_Amber', '#edb153', .45, 0),
        ('Floor_Green', '#56826b', .75, 0), ('Floor_Soil', '#48483d', .95, 0),
    ]:
        h.material(name, color, rough, metal)
    h.material('Floor_LED', '#c6f0ff', .3, emission=2)
    shader = h.M['Floor_Glass'].node_tree.nodes.get('Principled BSDF')
    shader.inputs['Transmission Weight'].default_value = 1
    shader.inputs['IOR'].default_value = 1.45
    for key, scale, distance in [('Floor_Stone', 150, .012), ('Floor_Vinyl', 260, .004),
                                 ('Floor_Oak', 7, .005), ('Floor_Curtain', 220, .003)]:
        mat = h.M[key]
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        texture = nodes.new('ShaderNodeTexNoise'); texture.inputs['Scale'].default_value = scale
        coords = nodes.new('ShaderNodeTexCoord')
        links.new(coords.outputs['Object'], texture.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump'); bump.inputs['Distance'].default_value = distance
        bump.inputs['Strength'].default_value = .12
        links.new(texture.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])


def box(name, loc, size, mat='Floor_Wall', edge=.018, parent=None):
    return h.box(name, loc, size, mat, edge, parent)


def chair(parent, x, y, angle=0):
    root = h.empty('Visitor chair', parent); root.location = (x, y, .10)
    root.rotation_euler.z = angle
    box('Chair upholstered seat', (0, 0, .46), (.48, .47, .075), 'Floor_Teal', .04, root)
    box('Chair curved back', (0, .205, .74), (.48, .07, .48), 'Floor_Teal', .035, root)
    for xx in [-.19, .19]:
        for yy in [-.17, .17]:
            h.bar('Chair steel leg', (xx, yy, .04), (xx, yy, .44), .017, 'Floor_Steel', root)
        h.bar('Chair arm support', (xx*1.23, -.1, .43), (xx*1.23, -.1, .67), .013, 'Floor_Steel', root)
        box('Chair arm pad', (xx*1.23, -.025, .67), (.044, .3, .035), 'Floor_Dark', .012, root)
    return root


def screen(parent, x, y, z, width=.38, name='Door terminal'):
    root = h.empty(name, parent)
    root.location = (x, y, z)
    root['assetRole'] = 'door-terminal' if 'Door' in name else 'workstation-display'
    box(name+' case', (0, 0, 0), (width, .04, width*.63), 'Floor_Steel', .02, root)
    box(name+' bezel', (0, -.025, 0), (width*.94, .012, width*.56), 'Floor_Dark', .012, root)
    face = box(name+' display', (0, -.033, 0), (width*.86, .004, width*.48), 'Floor_Screen', .004, root)
    face['runtimeSurface'] = True
    for i in range(3):
        box('Demo display row', (-width*.06, -.037, width*(.12-i*.11)),
            (width*.52, .003, width*.024), 'Floor_LED', .001, root)
    return root


def curtain(parent, x, y, width=.28, height=1.45):
    vertices, faces = [], []
    steps = 60
    for z in [.28, .28+height]:
        for i in range(steps+1):
            xx = x-width/2+width*i/steps
            vertices.append((xx, y+.04*math.sin(i*math.pi/5), z))
    for i in range(steps): faces.append((i, i+1, i+steps+2, i+steps+1))
    cloth = h.object_mesh('Pleated privacy curtain', vertices, faces, 'Floor_Curtain', parent, True)
    solid = cloth.modifiers.new('Curtain fabric', 'SOLIDIFY'); solid.thickness = .002
    for i in range(6):
        h.ring('Curtain hanging loop', (x-width/2+i*width/5, y, height+.34), .023, .004,
               'Floor_Steel', parent, (math.pi/2,0,0), 16)


def plant(parent, x, y):
    h.cylinder('Lobby planter', (x,y,.36), .23,.5,'Floor_White',parent=parent,segments=48,edge=.025)
    h.cylinder('Planter soil', (x,y,.605),.20,.015,'Floor_Soil',parent=parent,segments=32)
    for i in range(13):
        a=i*2.39996; tip=(x+.23*math.cos(a), y+.23*math.sin(a), .86+(i%5)*.12)
        h.bar('Plant stem',(x,y,.59),tip,.008,'Floor_Green',parent)
        leaf=h.sphere('Lobby leaf',tip,(.075,.20,.025),'Floor_Green',parent,12,6)
        leaf.rotation_euler=(.4, .3, a)


def sink(parent, x, y):
    box('Wash cabinet',(x,y,.52),(1.10,.57,.80),'Floor_Oak',.025,parent)
    box('Solid surface sink top',(x,y,.94),(1.16,.63,.065),'Floor_White',.025,parent)
    # A recessed basin with rim, rather than a painted basin rectangle.
    box('Basin recess',(x,y-.035,.980),(.56,.36,.025),'Floor_Dark',.08,parent)
    box('Basin bottom',(x,y-.035,.987),(.45,.26,.015),'Floor_White',.07,parent)
    h.tube('Gooseneck faucet',[(x,y+.22,.98),(x,y+.22,1.21),(x,y+.10,1.27),(x,y-.01,1.24)],.018,'Floor_Steel',parent)
    for xx in [-.28,.28]: box('Cabinet grip',(x+xx,y-.295,.81),(.20,.025,.025),'Floor_Steel',.005,parent)


def room_shell(parent, number, x, north):
    yc = 4.70 if north else -4.70
    root=h.empty('Room_'+str(number),parent)
    root['roomId']='demo-room-'+str(number); root['roomNumber']=str(number)
    root['capacity']=2; root['layoutSource']='reference concept; illustrative, not surveyed'
    box('Room resilient floor',(x,yc,.065),(4.33,4.76,.07),'Floor_Vinyl',.015,root)
    # Expose the beds from the fixed bird's-eye camera while retaining boundaries.
    for xx in [x-2.2,x+2.2]:
        if xx==x-2.2 or number in [104,108]:
            box('Cutaway partition',(xx,yc,.86),(.14,4.9,1.52),'Floor_Wall',.014,root)
            box('Partition cut cap',(xx,yc,1.627),(.16,4.9,.026),'Floor_CutEdge',.007,root)
            box('Partition skirting',(xx+.08,yc,.18),(.012,4.75,.15),'Floor_Steel',.003,root)
    head_y=6.78 if north else -2.63
    box('Oak clinical headwall',(x,head_y,1.04),(4.18,.09,1.88),'Floor_Oak',.02,root)
    box('White headwall upper',(x,head_y-.051,1.80),(4.10,.018,.19),'Floor_White',.004,root)
    for xx in [x-2.11,x+2.11]:
        box('Headwall architectural pier',(xx,head_y,1.38),(.20,.23,2.56),'Floor_CutEdge',.014,root)
    box('Upper headwall rail',(x,head_y,2.43),(4.2,.16,.19),'Floor_White',.015,root)
    # Visible ward opening on corridor side, with a real 1.12 metre gap at right.
    door_y=2.24 if north else -2.24
    wall_center=x-.63
    height=1.16 if north else 1.94
    box('Corridor wall cutaway',(wall_center,door_y,.1+height/2),(3.05,.14,height),'Floor_Wall',.012,root)
    box('Corridor wall cap',(wall_center,door_y,.1+height),(3.08,.17,.035),'Floor_CutEdge',.006,root)
    door_x=x+1.55
    for xx in [door_x-.57,door_x+.57]:
        box('Door jamb',(xx,door_y,1.26),(.075,.19,2.32),'Floor_Oak',.008,root)
    box('Door lintel',(door_x,door_y,2.40),(1.21,.19,.075),'Floor_Oak',.008,root)
    door=h.empty('Room door open',root); door.location=(door_x+.53,door_y,.1)
    door.rotation_euler.z=math.radians(78 if north else -78)
    box('Door leaf',(-.52,0,1.12),(1.04,.042,2.24),'Floor_Oak',.01,door)
    box('Door vision pane',(-.52,-.025,1.55),(.25,.016,.77),'Floor_Glass',.012,door)
    h.bar('Door handle',(-.91,-.065,1.02),(-.71,-.065,1.02),.013,'Floor_Steel',door)
    screen(root,x+.54,door_y-.10,1.38,.34)
    # Reference labels are part of a switchable display layer, not identifiers.
    for xx in [x-1.07,x+1.07]:
        chair(root,xx-.80,head_y-.65,math.pi/10)
    for xx in [x-1.9,x+1.9]:
        curtain(root,xx,head_y-.60,.23,1.60)
    h.bar('Privacy curtain track',(x-1.96,head_y-.60,2.03),(x+1.96,head_y-.60,2.03),.018,'Floor_Steel',root)
    # Outer glazed wall is low in the front row to maintain the reference cutaway.
    exterior=7.16 if north else -7.16
    base_height=.65 if north else .55
    box('Window sill wall',(x,exterior,.1+base_height/2),(4.34,.17,base_height),'Floor_Wall',.015,root)
    for xx in [x-2.12,x,x+2.12]:
        box('Window mullion',(xx,exterior,1.27),(.05,.085,1.26),'Floor_Steel',.004,root)
    for zz in [.65,1.90]:box('Window horizontal frame',(x,exterior,zz),(4.30,.085,.055),'Floor_Steel',.004,root)
    box('Window glass',(x,exterior,1.27),(4.20,.014,1.17),'Floor_Glass',.002,root)
    return root


def ribbon(name, path, width, low, high, mat, parent):
    vertices=[]
    for i,(x,y) in enumerate(path):
        a=path[max(i-1,0)]; b=path[min(i+1,len(path)-1)]
        dx,dy=b[0]-a[0],b[1]-a[1]; length=math.hypot(dx,dy)
        nx,ny=-dy/length*width/2,dx/length*width/2
        vertices.extend([(x+nx,y+ny,low),(x-nx,y-ny,low),(x-nx,y-ny,high),(x+nx,y+ny,high)])
    faces=[(3,2,1,0)]
    for i in range(len(path)-1):
        for j in range(4): faces.append((i*4+j,i*4+(j+1)%4,(i+1)*4+(j+1)%4,(i+1)*4+j))
    n=len(vertices);faces.append((n-4,n-3,n-2,n-1))
    return h.bevel(h.object_mesh(name,vertices,faces,mat,parent),.012,3)


def station(parent):
    root=h.empty('Central_Nurse_Station',parent)
    path=[(-3,.8),(-3,-.35)]
    path += [(-2.45+.55*math.cos(math.pi+i*math.pi/2/16),-.35+.55*math.sin(math.pi+i*math.pi/2/16)) for i in range(17)]
    path += [(2.45,-.9)]
    path += [(2.45+.55*math.cos(-math.pi/2+i*math.pi/2/16),-.35+.55*math.sin(-math.pi/2+i*math.pi/2/16)) for i in range(17)]
    path += [(3,.8)]
    ribbon('Curved counter body',path,.43,.14,1.11,'Floor_White',root)
    ribbon('Teal counter plinth',path,.445,.18,.29,'Floor_Teal',root)
    ribbon('Stone countertop',path,.56,1.10,1.17,'Floor_White',root)
    ribbon('Counter fine shadow reveal',path,.447,.95,.975,'Floor_Steel',root)
    for x in [-1.85,0,1.85]:
        box('Workstation desk',(x,.08,.82),(1.71,.76,.055),'Floor_Oak',.015,root)
        box('Desk pedestal',(x+.58,.18,.44),(.36,.50,.69),'Floor_White',.012,root)
        h.cylinder('Monitor stem',(x,-.03,1.00),.022,.32,'Floor_Steel',parent=root)
        box('Monitor foot',(x,-.03,.861),(.27,.17,.025),'Floor_Dark',.008,root)
        screen(root,x,-.03,1.24,.50,'Workstation monitor')
        box('Keyboard',(x,-.33,.86),(.40,.135,.018),'Floor_Dark',.006,root)
        for r in range(4):
            for c in range(12):box('Keyboard key',(x-.176+c*.031,-.375+r*.027,.872),(.022,.020,.006),'Floor_Steel',.002,root)
        chair(root,x,.79,math.pi)
    h.text('Counter identity','护 士 站',(0,-1.126,.72),.19,'Floor_Ink',root)
    return root


def wings(parent):
    root=h.empty('Support_Spaces',parent)
    for x in [-10.75,10.75]:
        box('Wing floor',(x,0,.065),(3.70,14.4,.07),'Floor_Stone',.01,root)
        box('Outside sidewall',(math.copysign(12.60,x),0,.88),(.18,14.5,1.56),'Floor_Wall',.015,root)
        for y in [-7.18,7.18]:box('Wing exterior',(x,y,1.3),(3.70,.18,2.4),'Floor_Wall',.015,root)
        for y in [-2.24,2.24]:
            box('Support partition',(x-.65,y,.8),(2.4,.14,1.4),'Floor_Wall',.014,root)
    # Twin elevator doors on the left back wall, visible from the cutaway camera.
    for x in [-11.60,-9.92]:
        box('Lift stone surround',(x,6.94,1.4),(1.62,.21,2.60),'Floor_CutEdge',.02,root)
        for dx in [-.36,.36]:
            box('Elevator brushed steel door',(x+dx,6.81,1.32),(.707,.06,2.34),'Floor_Steel',.008,root)
        box('Elevator indicator',(x,6.766,2.56),(.38,.022,.13),'Floor_Dark',.009,root)
        h.text('Elevator floor','03',(x,6.747,2.56),.09,'Floor_LED',root)
        box('Lift call button',(x+.78,6.72,1.23),(.09,.05,.16),'Floor_Steel',.008,root)
    plant(root,-12.06,2.98)
    # Staff work and supply rooms.
    for y in [3.1,4.3,5.5]:
        box('Supply storage',(12.14,y,1.14),(.58,1.12,2.08),'Floor_White',.02,root)
        for z in [.38,.92,1.48]:box('Supply door seam',(11.839,y,z),(.008,1.04,.012),'Floor_Seam',.002,root)
        box('Supply pull',(11.80,y-.25,1.2),(.025,.025,.22),'Floor_Steel',.005,root)
    sink(root,10.33,6.68)
    sink(root,-10.64,-6.65)
    box('WC partition',(-11.40,-4.85,.96),(.13,3.7,1.72),'Floor_Wall',.015,root)
    for y in [-5.75,-3.8]:
        h.sphere('WC ceramic bowl',(-12.00,y,.53),(.30,.41,.25),'Floor_White',root,32,16)
        box('WC tank',(-12.00,y+.33,.82),(.46,.16,.60),'Floor_White',.045,root)
        h.ring('WC seat',(-12.00,y-.03,.70),.22,.042,'Floor_White',root,segments=40)
    for x in [9.80,11.45]:chair(root,x,-5.3)
    box('Staff table',(10.65,-6.52,.83),(2.90,.78,.065),'Floor_Oak',.02,root)
    for x in [9.45,11.85]:box('Staff table leg',(x,-6.52,.45),(.055,.60,.71),'Floor_Steel',.008,root)
    return root
