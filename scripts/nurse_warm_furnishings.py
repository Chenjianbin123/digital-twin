"""Visible-first furnishings for the warm wood / light grey nurse station.

Metres, Blender Z-up. Screen faces remain independent meshes for runtime content;
this module does not create patient text, textures, lights, or production bindings.
"""
import math

from mathutils import Vector


def _rod(h, name, start, end, radius, material, parent):
    a, b = Vector(start), Vector(end)
    return h.cylinder(name, tuple((a + b) / 2), radius, (b - a).length, material,
                      rotation=tuple((b - a).to_track_quat('Z', 'Y').to_euler()),
                      vertices=16, parent=parent)


def _screen(h, name, center, width, height, normal, parent, role):
    center, normal = Vector(center), Vector(normal)
    up = Vector((0, 0, 1))
    right = up.cross(normal).normalized()
    vertices = [tuple(center + right * x * width / 2 + up * z * height / 2)
                for x, z in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    surface = h.mesh(name, vertices, [(0, 1, 2, 3)], 'screen', parent=parent,
                     uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    surface['runtimeSurface'] = True
    surface['displayRole'] = role
    surface['contentSource'] = 'runtime-only'
    surface['canvasFlipY'] = False
    return surface


def _workstation(h, equipment, number, position, rotation=0):
    group = h.empty(f'Workstation_{number:02d}', equipment)
    group.location = position
    group.rotation_euler.z = rotation
    h.box(f'Monitor_{number:02d}_Base', (0, -.025, .009), (.245, .175, .018),
          'dark', bevel=.008, parent=group)
    h.box(f'Monitor_{number:02d}_BaseInset', (0, -.025, .019), (.198, .126, .004),
          'silver', bevel=.002, parent=group)
    _rod(h, f'Monitor_{number:02d}_Stand', (0, -.035, .023), (0, -.015, .23),
         .022, 'silver', group)
    h.box(f'Monitor_{number:02d}_Back', (0, 0, .31), (.525, .058, .33),
          'dark', bevel=.014, parent=group)
    h.box(f'Monitor_{number:02d}_RearMount', (0, -.039, .255), (.087, .022, .085),
          'silver', bevel=.007, parent=group)
    for row in range(6):
        h.box(f'Monitor_{number:02d}_RearVent_{row:02d}', (0, -.030, .33 + row * .013),
              (.19, .003, .004), 'screen', bevel=.001, parent=group)
    screen = _screen(h, f'Screen_Work_{number:02d}', (0, .0305, .31), .482, .271125,
                     (0, 1, 0), group, 'nursing-workstation')
    h.sphere(f'Monitor_{number:02d}_StatusLed', (.216, .030, .172),
             (.002, .0015, .002), 'blue', group)
    h.tube(f'Monitor_{number:02d}_Cable', [(0, -.05, .25), (.045, -.076, .15),
           (.064, -.080, .07), (.11, -.095, .004)], .003, 'dark', group)

    keyboard = h.empty(f'Keyboard_{number:02d}', group)
    h.box(f'Keyboard_{number:02d}_Body', (0, .145, .012), (.427, .145, .024),
          'silver', bevel=.007, parent=keyboard)
    h.box(f'Keyboard_{number:02d}_Inset', (0, .145, .025), (.405, .123, .003),
          'dark', bevel=.001, parent=keyboard)
    for row in range(4):
        for column in range(12):
            if row == 3 and 3 <= column <= 8:
                continue
            h.box(f'Keyboard_{number:02d}_Key_{row}_{column}',
                  (-.184 + column * .0306, .101 + row * .029, .029),
                  (.026, .023, .007), 'white', bevel=.0015, parent=keyboard)
    h.box(f'Keyboard_{number:02d}_Space', (-.015, .188, .029), (.180, .023, .007),
          'white', bevel=.002, parent=keyboard)
    h.box(f'Mouse_{number:02d}_Pad', (.294, .140, .0015), (.129, .144, .003),
          'fabric', bevel=.001, parent=group)
    h.sphere(f'Mouse_{number:02d}_Body', (.294, .145, .021),
             (.031, .051, .018), 'white', group)
    h.box(f'Mouse_{number:02d}_ButtonJoint', (.294, .127, .037),
          (.0014, .046, .002), 'dark', bevel=.0005, parent=group)
    h.cylinder(f'Mouse_{number:02d}_Wheel', (.294, .139, .038), .006, .007, 'dark',
               rotation=(0, math.pi / 2, 0), vertices=16, parent=group)
    return screen


def _chair(h, equipment, name, position, rotation=0):
    chair = h.empty(name, equipment)
    chair.location = position
    chair.rotation_euler.z = rotation
    h.cylinder(name + '_Lift', (0, 0, .27), .025, .34, 'steel', parent=chair)
    h.cylinder(name + '_LiftCover', (0, 0, .37), .043, .15, 'dark', parent=chair)
    h.box(name + '_SeatShell', (0, 0, .455), (.48, .46, .036), 'dark', .016, chair)
    h.box(name + '_SeatPad', (0, -.005, .486), (.46, .441, .038), 'fabric', .018, chair)
    _rod(h, name + '_BackSupport', (0, .15, .44), (0, .235, .78), .018, 'steel', chair)
    vertices, faces = [], []
    columns, rows = 12, 7
    for j in range(rows + 1):
        t = j / rows
        z = .58 + t * .36
        half_width = .227 - .020 * abs(t - .48)
        for i in range(columns + 1):
            s = 2 * i / columns - 1
            vertices.append((s * half_width, .21 + .048 * t + .028 * s * s, z))
    for j in range(rows):
        for i in range(columns):
            a = j * (columns + 1) + i
            faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    back = h.mesh(name + '_CurvedUpholsteredBack', vertices, faces, 'fabric', chair, smooth=True)
    back.modifiers.new('Padded back thickness', 'SOLIDIFY').thickness = .023
    for side in [-1, 1]:
        _rod(h, name + f'_ArmSupport_{side}', (side * .206, .08, .45),
             (side * .261, .06, .63), .012, 'steel', chair)
        h.box(name + f'_ArmPad_{side}', (side * .254, .015, .645),
              (.055, .247, .026), 'dark', .011, chair)
    for i in range(5):
        angle = math.tau * i / 5
        x, y = .294 * math.cos(angle), .294 * math.sin(angle)
        _rod(h, name + f'_BaseSpoke_{i}', (0, 0, .114), (x, y, .071), .014, 'silver', chair)
        h.cylinder(name + f'_CasterPivot_{i}', (x, y, .066), .012, .033, 'dark',
                   vertices=12, parent=chair)
        for side in [-1, 1]:
            h.cylinder(name + f'_CasterWheel_{i}_{side}',
                       (x + side * .014 * math.sin(angle), y - side * .014 * math.cos(angle), .028),
                       .028, .011, 'dark', rotation=(math.pi / 2, 0, angle), vertices=16, parent=chair)
    return chair


def _files_and_sanitizer(h, equipment):
    rack = h.empty('Transparent_FileRack', equipment)
    rack.location = (2.22, .58, .75)
    h.box('FileRack_Base', (0, 0, .007), (.30, .21, .014), 'glass', .004, rack)
    h.box('FileRack_Back', (0, -.097, .133), (.30, .006, .25), 'glass', .002, rack)
    for i, x in enumerate([-.146, -.05, .05, .146]):
        h.box(f'FileRack_Divider_{i}', (x, -.009, .10), (.005, .188, .185), 'glass', .002, rack)
    for i, x in enumerate([-.098, 0, .098]):
        height = .231 + i * .012
        h.box(f'FileRack_Folder_{i}', (x, -.025, .014 + height / 2),
              (.054, .125, height), 'blue' if i != 1 else 'white', .003, rack)
        h.box(f'FileRack_PaperEdges_{i}', (x, -.021, .019 + height / 2),
              (.043, .118, height - .012), 'paper', .001, rack)
    stack = h.empty('Paperwork_Stack', equipment)
    stack.location = (.77, .64, .75)
    h.box('Paperwork_Tray', (0, 0, .007), (.30, .22, .014), 'silver', .004, stack)
    h.box('Paperwork_Pages', (0, 0, .023), (.274, .196, .018), 'paper', .001, stack)
    h.box('Paperwork_Cover', (0, 0, .033), (.282, .203, .002), 'blue', .0005, stack)
    bottle = h.empty('Hand_Sanitizer', equipment)
    bottle.location = (-.72, .09, 1.07)
    h.box('Sanitizer_Bottle', (0, 0, .070), (.073, .057, .14), 'glass', .013, bottle)
    h.box('Sanitizer_Liquid', (0, 0, .055), (.058, .044, .10), 'blue', .009, bottle)
    h.box('Sanitizer_Label', (0, -.029, .071), (.045, .0015, .061), 'paper', .001, bottle)
    h.cylinder('Sanitizer_PumpCollar', (0, 0, .148), .018, .019, 'white', vertices=24, parent=bottle)
    h.cylinder('Sanitizer_PumpNeck', (0, 0, .170), .007, .027, 'white', vertices=16, parent=bottle)
    h.box('Sanitizer_PumpHead', (0, -.014, .184), (.029, .059, .014), 'white', .005, bottle)


def _plant(h, foliage, position=(-2.705, 1.65, 1.07), scale=1, name='Counter_LivePlant'):
    plant = h.empty(name, foliage)
    plant.location = position
    plant.scale = (scale, scale, scale)
    h.cylinder('Plant_CeramicPot', (0, 0, .0675), .076, .135, 'white', parent=plant)
    h.cylinder('Plant_Soil', (0, 0, .135), .069, .007, 'dark', vertices=24, parent=plant)
    rim = [(.072 * math.cos(i * math.tau / 32), .072 * math.sin(i * math.tau / 32), .136) for i in range(32)]
    h.tube('Plant_PotLip', rim, .0045, 'white', plant, cyclic=True)
    h.tube('Plant_CentralStem', [(0, 0, .138), (0, 0, .40)], .0025, 'green', plant)
    for index in range(11):
        angle = index * 2.39996
        z = .165 + index * .020
        length = .11 + .027 * (index % 3)
        radius = .030 + .004 * (index % 3)
        direction = Vector((math.cos(angle), math.sin(angle), 0))
        lateral = Vector((-math.sin(angle), math.cos(angle), 0))
        start = Vector((0, 0, z))
        vertices, faces = [], []
        for step in range(9):
            t = step / 8
            center = start + direction * (length * t) + Vector((0, 0, .057 * math.sin(math.pi * t * .8)))
            for side in [-1, 0, 1]:
                point = center + lateral * (side * radius * math.sin(math.pi * t))
                point.z += (1 - abs(side)) * .007 * math.sin(math.pi * t)
                vertices.append(tuple(point))
        for step in range(8):
            for side in range(2):
                a = step * 3 + side
                if step == 0:
                    faces.append((1, a + 3, a + 4))
                elif step == 7:
                    faces.append((a, 25, a + 1))
                else:
                    faces.append((a, a + 3, a + 4, a + 1))
        leaf = h.mesh(f'Plant_Leaf_{index:02d}', vertices, faces, 'green', plant, smooth=True)
        leaf.modifiers.new('Leaf thickness', 'SOLIDIFY').thickness = .0006
        h.tube(f'Plant_LeafVein_{index:02d}', [vertices[step * 3 + 1] for step in range(9)],
               .0007, 'green', plant)
    return plant


def _background_cabinet(h, equipment, foliage):
    cabinet = h.empty('Background_ClinicalLowCabinet', equipment)
    cabinet.location = (-.905, 3.39, 0)
    h.box('BackgroundCabinet_RecessedPlinth', (0, .012, .039), (2.55, .38, .078),
          'silver', .007, cabinet)
    h.box('BackgroundCabinet_Carcass', (0, 0, .44), (2.63, .408, .72),
          'white', .008, cabinet)
    h.box('BackgroundCabinet_ClinicalTop', (0, 0, .808), (2.67, .46, .024),
          'white', .006, cabinet)
    h.box('BackgroundCabinet_FrontShadowJoint', (0, -.191, .793), (2.633, .016, .005),
          'dark', .001, cabinet)
    for index, x in enumerate([-.99, -.33, .33, .99]):
        h.box(f'BackgroundCabinet_DoorFrame_{index}', (x, -.195, .44), (.654, .020, .694),
              'silver', .003, cabinet)
        h.box(f'BackgroundCabinet_DoorFace_{index}', (x, -.208, .44), (.642, .010, .680),
              'wall', .003, cabinet)
        for side in [-1, 1]:
            h.box(f'BackgroundCabinet_HandleFoot_{index}_{side}', (x + .11 + side * .061, -.214, .708),
                  (.012, .019, .012), 'steel', .003, cabinet)
        h.box(f'BackgroundCabinet_Handle_{index}', (x + .11, -.222, .708), (.154, .012, .015),
              'steel', .005, cabinet)
    for index, x in enumerate([-.265, -.15, -.035]):
        height = .240 + index * .015
        h.box(f'BackgroundCabinet_FileBox_{index}', (x, .035, .82 + height / 2),
              (.078, .246, height), 'blue' if index != 1 else 'wall', .003, cabinet)
        h.box(f'BackgroundCabinet_FilePaperEdges_{index}', (x, .035, .82 + height - .004),
              (.061, .229, .006), 'paper', .001, cabinet)
        h.box(f'BackgroundCabinet_FileLabel_{index}', (x, -.089, .945),
              (.043, .002, .056), 'paper', .001, cabinet)
    # Pots sit on the top at .82 m; the scaled leaves stay beside and below the dashboard.
    _plant(h, foliage, (-2.03, 3.35, .82), 1.3, 'Background_Plant_Left')
    _plant(h, foliage, (.23, 3.35, .82), 1.3, 'Background_Plant_Right')
    return cabinet


def _cart(h, equipment):
    cart = h.empty('Clinical_SupplyCart', equipment)
    cart.location = (-3.5, 3.2, 0)
    for level, z in enumerate([.19, .50, .84]):
        h.box(f'Cart_Shelf_{level}', (0, 0, z), (.58, .44, .027), 'white', .010, cart)
        h.tube(f'Cart_ShelfRail_{level}', [(-.277, -.205, z + .05), (-.277, .205, z + .05),
               (.277, .205, z + .05), (.277, -.205, z + .05)], .007, 'steel', cart)
    for index, (x, y) in enumerate([(-.265, -.19), (.265, -.19), (-.265, .19), (.265, .19)]):
        _rod(h, f'Cart_Upright_{index}', (x, y, .08), (x, y, .905), .011, 'steel', cart)
        h.box(f'Cart_CasterFork_{index}', (x, y, .086), (.029, .06, .045), 'silver', .006, cart)
        h.cylinder(f'Cart_Wheel_{index}', (x, y, .047), .047, .027, 'dark',
                   rotation=(0, math.pi / 2, 0), vertices=20, parent=cart)
    h.tube('Cart_PushHandle', [(-.282, .19, .83), (-.34, .19, .92),
           (.34, .19, .92), (.282, .19, .83)], .012, 'steel', cart)
    h.box('Cart_LowerSupplyBin', (0, 0, .277), (.45, .33, .147), 'blue', .014, cart)
    h.box('Cart_LowerBinFrontInset', (0, -.169, .279), (.36, .003, .083), 'white', .009, cart)
    h.box('Cart_MiddleSupplyBox', (.06, .01, .57), (.37, .27, .113), 'paper', .006, cart)
    h.box('Cart_TopPaperStack', (.04, -.01, .8675), (.285, .213, .028), 'paper', .002, cart)


def build_furnishings(h, root):
    equipment = h.empty('Equipment', root)
    foliage = h.empty('Foliage', root)
    screens = []
    for number, x in enumerate([-1.55, 0, 1.55], 1):
        # Match Desk_InnerStaffWorktop: front staff surface spans Y=.12 to .76.
        screens.append(_workstation(h, equipment, number, (x, .50, .75)))
        _chair(h, equipment, f'Nursing_Chair_{number:02d}', (x, 1.57, 0))
    screens.append(_workstation(h, equipment, 4, (-2.35, 1.9, .75), -math.pi / 2))
    # Park the return-desk chair behind the first row rather than intersecting its neighbour.
    _chair(h, equipment, 'Nursing_Chair_04', (-1.70, 2.35, 0), -math.pi / 2)
    _files_and_sanitizer(h, equipment)
    _plant(h, foliage)
    _background_cabinet(h, equipment, foliage)
    _cart(h, equipment)

    wall = h.empty('Wall_DisplayAssembly', equipment)
    h.box('Screen_Main_WallMount', (-.95, 3.682, 1.95), (.39, .033, .32), 'steel', .009, wall)
    h.box('Screen_Main_Frame', (-.95, 3.638, 1.95), (1.356, .064, .786), 'dark', .011, wall)
    screens.append(_screen(h, 'Screen_Main', (-.95, 3.60, 1.95), 1.3, .73,
                           (0, -1, 0), wall, 'ward-dashboard'))
    h.box('Clock_Frame', (.075, 3.634, 2.13), (.36, .052, .148), 'dark', .007, wall)
    screens.append(_screen(h, 'Clock_Display', (.075, 3.605, 2.13), .326, .114,
                           (0, -1, 0), wall, 'clock'))
    return {'equipment': equipment, 'foliage': foliage, 'screens': screens}
