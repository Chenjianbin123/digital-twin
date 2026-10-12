"""Visible detail pass for editable warm-v1, before independent anchor fitting.

Metres / Blender Z-up. Only new children are authored: existing desk geometry,
screen geometry, UVs, transforms, and materials are intentionally untouched.
"""
import math

import bpy


def _child(root, name):
    return next((obj for obj in root.children_recursive if obj.name == name), None)


def _brochure_stand(h, parent):
    stand = h.empty('WarmV2_PublicInformationStand', parent)
    stand.location = (-2.705, .98, 1.07)
    stand.rotation_euler.z = -math.pi / 2
    h.box('WarmV2_Stand_Foot', (0, 0, .009), (.29, .14, .018), 'silver', .006, stand)
    h.box('WarmV2_Stand_Column', (0, .016, .081), (.026, .025, .135), 'steel', .005, stand)
    h.box('WarmV2_Stand_Frame', (0, .01, .235), (.258, .023, .285), 'silver', .007, stand)
    h.box('WarmV2_Stand_Paper', (0, -.003, .235), (.235, .002, .264), 'paper', .001, stand)
    h.box('WarmV2_Stand_Header', (0, -.0046, .332), (.204, .001, .041), 'blue', .0003, stand)
    # Unlabelled print layout, not a runtime screen or a patient document.
    for row in range(6):
        width = .184 if row % 3 else .145
        h.box(f'WarmV2_Stand_PrintRule_{row}', (-.092 + width / 2, -.0046, .281 - row * .025),
              (width, .001, .003), 'silver', .0003, stand)
    h.box('WarmV2_Stand_ClearCover', (0, -.007, .235), (.243, .002, .273), 'glass', .001, stand)
    for x in (-.112, .112):
        for z in (.117, .353):
            h.cylinder('WarmV2_Stand_Fixing', (x, -.009, z), .0033, .002, 'steel',
                       rotation=(math.pi / 2, 0, 0), vertices=12, parent=stand)
    return stand


def _public_file_organizer(h, parent):
    rack = h.empty('WarmV2_PublicDocumentOrganizer', parent)
    rack.location = (2.13, .095, 1.07)
    h.box('WarmV2_PublicRack_Base', (0, 0, .006), (.42, .142, .012), 'silver', .004, rack)
    h.box('WarmV2_PublicRack_Back', (0, .064, .130), (.405, .006, .248), 'glass', .002, rack)
    for level in range(3):
        z = .02 + level * .075
        h.box(f'WarmV2_PublicRack_Shelf_{level}', (0, 0, z), (.404, .131, .006), 'glass', .002, rack)
        h.box(f'WarmV2_PublicRack_Paper_{level}', (-.018, 0, z + .012),
              (.323, .109, .018), 'paper', .001, rack)
        h.box(f'WarmV2_PublicRack_Cover_{level}', (-.018, 0, z + .022),
              (.33, .111, .002), 'blue' if level == 1 else 'wall', .0005, rack)
        h.box(f'WarmV2_PublicRack_LabelFrame_{level}', (0, -.067, z + .018),
              (.087, .007, .029), 'silver', .001, rack)
        h.box(f'WarmV2_PublicRack_Label_{level}', (0, -.071, z + .018),
              (.071, .0015, .020), 'paper', .0005, rack)
    for x in (-.204, .204):
        h.box('WarmV2_PublicRack_Side', (x, 0, .132), (.006, .13, .25), 'glass', .002, rack)
    return rack


def _paperwork(h, parent):
    trays = h.empty('WarmV2_ClinicalPaperTrays', parent)
    trays.location = (-.75, .52, .75)
    for level in range(2):
        z = .007 + level * .065
        h.box(f'WarmV2_Tray_{level}_Base', (0, 0, z), (.38, .29, .014), 'silver', .004, trays)
        for x in (-.184, .184):
            h.box(f'WarmV2_Tray_{level}_Side', (x, 0, z + .019), (.010, .282, .034),
                  'silver', .003, trays)
        h.box(f'WarmV2_Tray_{level}_Back', (0, -.136, z + .020), (.362, .010, .034),
              'silver', .003, trays)
        h.box(f'WarmV2_Tray_{level}_Pages', (0, .003, z + .017), (.338, .254, .020),
              'paper', .001, trays)
        h.box(f'WarmV2_Tray_{level}_Folder', (0, .003, z + .028), (.343, .258, .002),
              'blue' if level else 'wall', .0005, trays)
        for layer in range(3):
            h.box(f'WarmV2_Tray_{level}_PaperEdge_{layer}', (0, .1305, z + .011 + layer * .005),
                  (.332, .001, .0008), 'wall', 0, trays)
    for x in (-.179, .179):
        for y in (-.123, .123):
            h.cylinder('WarmV2_Tray_Spacer', (x, y, .049), .004, .065, 'steel', vertices=12, parent=trays)

    clipboard = h.empty('WarmV2_AnonymousClipboard', parent)
    clipboard.location = (.79, .305, .75)
    h.box('WarmV2_Clipboard_Board', (0, 0, .003), (.28, .21, .006), 'blue', .004, clipboard)
    h.box('WarmV2_Clipboard_BlankPages', (0, -.002, .007), (.259, .192, .002), 'paper', .0005, clipboard)
    h.box('WarmV2_Clipboard_SpringClip', (0, -.081, .012), (.096, .027, .008), 'steel', .003, clipboard)
    for x in (-.034, .034):
        h.cylinder('WarmV2_Clipboard_ClipFixing', (x, -.082, .017), .003, .002, 'silver',
                   vertices=12, parent=clipboard)

    pen_cup = h.empty('WarmV2_DeskStationery', parent)
    # Leaves a gap to both the mouse and file tray after the v2 X-position fit.
    pen_cup.location = (.51, .62, .75)
    h.cylinder('WarmV2_PenCup_Foot', (0, 0, .004), .044, .008, 'silver', vertices=32, parent=pen_cup)
    # A real open cup: four thin walls keep the pen stems visible from above.
    for side in (-1, 1):
        h.box('WarmV2_PenCup_Side', (side * .034, 0, .046), (.004, .068, .084), 'steel', .002, pen_cup)
        h.box('WarmV2_PenCup_Face', (0, side * .034, .046), (.064, .004, .084), 'steel', .002, pen_cup)
    for index, (x, y) in enumerate([(-.017, -.009), (.010, -.012), (.018, .016), (-.012, .017)]):
        height = .125 + index * .008
        h.cylinder(f'WarmV2_Pen_{index}', (x, y, .008 + height / 2), .0035, height,
                   'blue' if index % 2 else 'silver', vertices=12, parent=pen_cup)
        h.cylinder(f'WarmV2_PenCap_{index}', (x, y, height), .004, .025, 'dark', vertices=12, parent=pen_cup)
        h.box(f'WarmV2_PenClip_{index}', (x + .004, y, height - .004), (.0015, .002, .022),
              'steel', .0005, pen_cup)
    return [trays, clipboard, pen_cup]


def _desk_phone(h, parent):
    phone = h.empty('WarmV2_DeskTelephone', parent)
    phone.location = (1.115, .305, .75)
    h.box('WarmV2_Phone_Base', (0, 0, .018), (.192, .222, .036), 'white', .014, phone)
    h.box('WarmV2_Phone_KeyRecess', (.041, .012, .037), (.076, .143, .004), 'silver', .005, phone)
    for row in range(4):
        for col in range(3):
            h.box(f'WarmV2_Phone_Key_{row}_{col}', (.014 + col * .026, -.037 + row * .030, .044),
                  (.019, .022, .010), 'dark', .003, phone)
    h.box('WarmV2_Phone_ReceiverBridge', (-.054, -.003, .067), (.047, .118, .021), 'white', .009, phone)
    for y in (-.074, .074):
        h.box('WarmV2_Phone_ReceiverCap', (-.054, y, .0535), (.060, .059, .035), 'white', .014, phone)
        for x in (-.067, -.054, -.041):
            h.box('WarmV2_Phone_SpeakerSlot', (x, y, .0715), (.002, .018, .001), 'silver', .0004, phone)
    h.tube('WarmV2_Phone_ReceiverCord', [(-.078, -.065, .047), (-.088, -.088, .039),
           (-.085, -.103, .013), (-.065, -.10, .011), (-.045, -.086, .016)], .0028, 'dark', phone)
    return phone


def _monitor_details(h, station, number):
    detail = h.empty(f'WarmV2_MonitorDetails_{number:02d}', station)
    for x in (-.241, .241):
        h.box('WarmV2_Monitor_RearSideJoint', (x, -.0298, .31), (.0014, .0015, .275), 'silver', .0004, detail)
    for z in (.171, .448):
        h.box('WarmV2_Monitor_RearHorizontalJoint', (0, -.0298, z), (.478, .0015, .0014), 'silver', .0004, detail)
    for x in (-.218, .218):
        for z in (.188, .431):
            h.cylinder('WarmV2_Monitor_CaseFixing', (x, -.031, z), .003, .002, 'steel',
                       rotation=(math.pi / 2, 0, 0), vertices=12, parent=detail)
    h.box('WarmV2_Monitor_UnlabelledIdPlate', (.140, -.0305, .272), (.074, .0015, .027), 'silver', .001, detail)
    h.box('WarmV2_Monitor_PortRecess', (.135, -.0305, .211), (.124, .004, .024), 'screen', .003, detail)
    for index in range(3):
        h.box(f'WarmV2_Monitor_PortRim_{index}', (.094 + index * .031, -.0331, .211),
              (.022, .0018, .012), 'steel', .001, detail)
        h.box(f'WarmV2_Monitor_PortInset_{index}', (.094 + index * .031, -.0341, .211),
              (.017, .001, .007), 'dark', .0005, detail)
    h.box('WarmV2_Monitor_StandCableGuide', (.026, -.039, .112), (.016, .023, .071), 'dark', .005, detail)
    h.tube('WarmV2_Monitor_PowerLead', [(.14, -.035, .211), (.147, -.056, .18),
           (.083, -.061, .097), (.067, -.091, .025)], .0022, 'dark', detail)
    for x in (-.080, .080):
        h.cylinder('WarmV2_Monitor_BaseFastener', (x, -.049, .022), .003, .0015, 'steel',
                   vertices=12, parent=detail)
    return detail


def _long_leaves(h, plant):
    foliage = h.empty('WarmV2_LongLeafCrown_' + plant.name, plant)
    for index in range(14):
        angle = index * 2.399963
        outer = index % 3 != 0
        length = .21 if outer else .115
        width = .023 if outer else .017
        base_z = .143 + (index % 3) * .013
        direction = (math.cos(angle), math.sin(angle))
        lateral = (-direction[1], direction[0])
        vertices, faces, vein = [(0, 0, base_z)], [], [(0, 0, base_z)]
        for step in range(1, 16):
            t = step / 16
            radius = length * t ** .8
            rise = (.42 * t + .20 * math.sin(math.pi * t) - .18 * t ** 3) if outer else .49 * t
            center = (direction[0] * radius, direction[1] * radius, base_z + rise)
            vein.append((center[0], center[1], center[2] + .004 * math.sin(math.pi * t)))
            for side in (-1, 0, 1):
                half_width = width * math.sin(math.pi * t) ** .7
                vertices.append((center[0] + lateral[0] * half_width * side,
                                 center[1] + lateral[1] * half_width * side,
                                 center[2] + (1 - abs(side)) * .004 * math.sin(math.pi * t)))
        tip_z = base_z + (.24 if outer else .49)
        vertices.append((direction[0] * length, direction[1] * length, tip_z))
        vein.append(vertices[-1])
        faces.extend([(0, 1, 2), (0, 2, 3)])
        for row in range(14):
            a = 1 + row * 3
            faces.extend([(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)])
        tip, a = len(vertices) - 1, len(vertices) - 4
        faces.extend([(a, tip, a + 1), (a + 1, tip, a + 2)])
        leaf = h.mesh(f'WarmV2_LongLeaf_{plant.name}_{index:02d}', vertices, faces, 'green', foliage, smooth=True)
        leaf.modifiers.new('Thin botanical leaf', 'SOLIDIFY').thickness = .0007
        h.tube(f'WarmV2_LongLeafVein_{plant.name}_{index:02d}', vein, .00065, 'green', foliage)
    return foliage


def _surface_signature(obj):
    return (obj.name, tuple(tuple(row) for row in obj.matrix_local), tuple(obj.data.materials),
            tuple(tuple(vertex.co) for vertex in obj.data.vertices),
            tuple(tuple(loop.uv) for loop in obj.data.uv_layers.active.data))


def refine_details(h, root):
    """Add a single detail pass to editable v1; fail on incompatible scene inputs."""
    names = ['Equipment', 'Foliage'] + [f'Workstation_{index:02d}' for index in range(1, 5)]
    names += ['Counter_LivePlant', 'Background_Plant_Left', 'Background_Plant_Right']
    required = {name: _child(root, name) for name in names}
    missing = [name for name, obj in required.items() if obj is None]
    if missing:
        raise ValueError('Warm v2 needs editable v1 groups: ' + ', '.join(missing))
    if _child(root, 'WarmV2_EquipmentDetails') is not None:
        raise ValueError('Warm v2 furnishings were already added; reload the v1 source')
    surfaces = [obj for obj in root.children_recursive if obj.get('runtimeSurface')]
    if len(surfaces) != 13 or any(obj.type != 'MESH' or obj.data.uv_layers.active is None for obj in surfaces):
        raise ValueError('Expected the 13 original editable runtime screen meshes with UVs')
    signatures = {obj.name: _surface_signature(obj) for obj in surfaces}
    before = {obj.as_pointer() for obj in root.children_recursive}

    equipment = h.empty('WarmV2_EquipmentDetails', required['Equipment'])
    movable = [(_brochure_stand(h, equipment), 'left-return', 'public-ledge'),
               (_public_file_organizer(h, equipment), 'front-worktop', 'public-ledge')]
    movable.extend((obj, 'front-worktop', 'staff-worktop') for obj in _paperwork(h, equipment))
    movable.append((_desk_phone(h, equipment), 'front-worktop', 'staff-worktop'))
    inherited = []
    for number in range(1, 5):
        station = required[f'Workstation_{number:02d}']
        detail = _monitor_details(h, station, number)
        inherited.append((detail, 'left-return' if number == 4 else 'front-worktop', station))
    for name in ('Counter_LivePlant', 'Background_Plant_Left', 'Background_Plant_Right'):
        plant = required[name]
        crown = _long_leaves(h, plant)
        inherited.append((crown, 'left-return' if name == 'Counter_LivePlant' else 'background', plant))
    for obj, region, surface in movable:
        obj['physicalRegion'] = region
        obj['supportSurface'] = surface
        obj['transformOwner'] = obj.name
    for obj, region, owner in inherited:
        obj['physicalRegion'] = region
        obj['transformOwner'] = owner.name
        obj['inheritsPlacement'] = True

    bpy.context.view_layer.update()
    added = [obj for obj in root.children_recursive if obj.as_pointer() not in before]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    for obj in added:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    if triangles >= 80000:
        raise ValueError(f'Warm v2 furnishing detail exceeds budget: {triangles} triangles')
    if any(_surface_signature(obj) != signatures[obj.name] for obj in surfaces):
        raise ValueError('A runtime screen changed during the additive furnishings pass')
    report = {'addedObjects': len(added), 'addedTriangles': triangles, 'screensPreserved': len(surfaces),
              'coordinates': 'original warm-v1 metres; reposition independent anchors without scaling equipment',
              'movableGroups': [obj.name for obj, _, _ in movable],
              'inheritedGroups': [{'name': obj.name, 'owner': owner.name} for obj, _, owner in inherited],
              'patientData': False}
    equipment['detailTriangleCount'] = triangles
    return report
