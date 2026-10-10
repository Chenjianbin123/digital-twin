"""Incremental architectural refinement of the editable warm-v1 nurse station.

Call refine_architecture(h, root) after loading the v1 master. This module does
not rebuild the scene, save files, create lights or alter any runtime screen.
Dimensions and new static room numbers are illustrative, not surveyed data.
"""

import math

import bpy


def _screen_state(root):
    return {
        obj.name: (
            tuple(value for row in obj.matrix_world for value in row),
            tuple(tuple(vertex.co) for vertex in obj.data.vertices),
            tuple(tuple(poly.vertices) for poly in obj.data.polygons),
            tuple((layer.name, tuple(tuple(loop.uv) for loop in layer.data)) for layer in obj.data.uv_layers),
        )
        for obj in root.children_recursive if obj.get('runtimeSurface') and obj.type == 'MESH'
    }


def _box(h, parent, name, loc, size, material, bevel=.004):
    obj = h.box('V2_' + name, loc, size, material, bevel=bevel, parent=parent)
    # These thin architectural trims do not need the hero counter's four bevel segments.
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.segments = 2
    return obj


def _materials(h):
    for key, source, roughness, metallic in (
        ('v2_ceiling_metal', 'silver', .58, .35),
        ('v2_wall_panel', 'white', .60, 0),
    ):
        material = h.M[source].copy()
        material.name = 'WarmStationV2_' + key
        shader = material.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Roughness'].default_value = roughness
        shader.inputs['Metallic'].default_value = metallic
        h.M[key] = material


def _vent(h, parent, x, y, index, width=.83, depth=.34):
    group = h.empty(f'V2_Ceiling_Grille_{index:02d}', parent=parent)
    _box(h, group, 'Vent_Recess', (x, y, 3.140), (width, depth, .027), 'dark', 0)
    for sx in (-1, 1):
        _box(h, group, 'Vent_FrameSide', (x + sx * (width / 2 + .014), y, 3.132),
             (.030, depth + .064, .031), 'v2_ceiling_metal')
    for sy in (-1, 1):
        _box(h, group, 'Vent_FrameEnd', (x, y + sy * (depth / 2 + .014), 3.132),
             (width, .030, .031), 'v2_ceiling_metal')
    for blade in range(10):
        obj = _box(h, group, 'Vent_Louver', (x, y - depth / 2 + .021 + blade * (depth - .042) / 9, 3.129),
                   (width - .018, .016, .024), 'v2_ceiling_metal', .002)
        obj.rotation_euler.x = math.radians(18)
    for sx in (-1, 1):
        for sy in (-1, 1):
            h.cylinder('V2_Vent_Fixing', (x + sx * (width / 2 + .014), y + sy * (depth / 2 - .018), 3.114),
                       .005, .0025, 'steel', vertices=12, parent=group)


def _ceiling(h, parent):
    ceiling = h.empty('V2_Ceiling_Detail', parent=parent)
    # Shallow service panels interrupt the oversized smooth foreground ceiling.
    for index, x in enumerate((-.72, .91), 1):
        _box(h, ceiling, f'Ceiling_ServiceCassette_{index}', (x, -1.16, 3.111),
             (1.607, .955, .064), 'v2_ceiling_metal', .009)
        for yy in (-1.645, -.675):
            _box(h, ceiling, 'Ceiling_CassetteReveal', (x, yy, 3.107),
                 (1.635, .007, .045), 'steel', .001)
    # Stepped perimeter soffits emphasize the two circulation axes, not a solid canopy.
    for x, width in ((-2.907, .15), (4.085, .43)):
        _box(h, ceiling, 'Ceiling_PerimeterDownstand', (x, 12.82, 3.070),
             (width, 18.30, .145), 'white', .008)
        _box(h, ceiling, 'Ceiling_PerimeterShadowJoint', (x - width / 2 - .010, 12.82, 3.128),
             (.014, 18.30, .012), 'steel', .001)
    _box(h, ceiling, 'Ceiling_RightStationDownstand', (4.085, 1.10, 3.070),
         (.43, 5.13, .145), 'white', .008)
    for index, (x, y) in enumerate(((-2.03, -.83), (1.72, 2.63), (-4.30, 3.02),
                                    (-4.30, 9.74), (-4.30, 16.46)), 1):
        _vent(h, ceiling, x, y, index, width=.83 if index < 3 else .54, depth=.31)
    for x, y in ((-.61, 2.50), (-4.30, 5.74), (-4.30, 12.46), (-4.30, 19.18)):
        h.cylinder('V2_Ceiling_SmokeDetectorBase', (x, y, 3.127), .055, .026,
                   'white', vertices=20, parent=ceiling)
        h.cylinder('V2_Ceiling_SmokeDetectorCap', (x, y, 3.108), .047, .018,
                   'wall', vertices=20, parent=ceiling)
    return ceiling


def _right_portals(h, parent, nodes):
    group = h.empty('V2_RightWard_Portals', parent=parent)
    for number in range(301, 308):
        old_lintel = nodes.get(f'Door_{number}_OakLintel')
        if old_lintel is None:
            raise ValueError(f'Missing editable v1 door {number}')
        y = old_lintel.location.y
        for side in (-1, 1):
            _box(h, group, f'RightDoor_{number}_OuterOakJamb', (4.236, y + side * .724, 1.325),
                 (.096, .132, 2.650), 'oak', .006)
            _box(h, group, f'RightDoor_{number}_OuterReveal', (4.199, y + side * .797, 1.325),
                 (.026, .010, 2.650), 'silver', .002)
        _box(h, group, f'RightDoor_{number}_OakTransom', (4.239, y, 2.490),
             (.092, 1.58, .343), 'oak', .007)
        _box(h, group, f'RightDoor_{number}_HeaderReveal', (4.198, y, 2.669),
             (.024, 1.620, .012), 'silver', .002)
        # All added portal pieces end before Y+0.82; the original screen is at Y+1.023.
        if number < 307:
            _box(h, group, f'RightDoor_{number}_WallProtectionPanel', (4.277, y + 1.650, .432),
                 (.026, 1.680, .593), 'v2_wall_panel', .006)
            _box(h, group, f'RightDoor_{number}_ProtectionCap', (4.258, y + 1.650, .739),
                 (.025, 1.685, .018), 'silver', .003)
        number_text = nodes.get(f'Door_{number}_Number')
        if number_text is not None and number_text.type == 'FONT':
            number_text.data = number_text.data.copy()
            number_text.data.size = .116
    return group


def _left_door(h, parent, y, label):
    door = h.empty(f'V2_LeftCorridor_StaticDoor_{label}', parent=parent)
    door['designPlaceholder'] = True
    door['note'] = 'Static illustrative door; not a hospital room identifier or runtime screen'
    for side in (-1, 1):
        _box(h, door, 'LeftDoor_OakJamb', (-2.787, y + side * .634, 1.235),
             (.12, .119, 2.470), 'oak', .006)
        _box(h, door, 'LeftDoor_MetalReveal', (-2.854, y + side * .568, 1.135),
             (.018, .018, 2.270), 'silver', .003)
    _box(h, door, 'LeftDoor_OakHeader', (-2.785, y, 2.365), (.12, 1.39, .250), 'oak', .006)
    _box(h, door, 'LeftDoor_BackRecess', (-2.665, y, 1.105), (.035, 1.133, 2.20), 'dark', 0)
    low, high = y - .544, y + .544
    slot_lo, slot_hi = y - .22, y - .035
    for a, b in ((low, slot_lo), (slot_hi, high)):
        _box(h, door, 'LeftDoor_LeafStile', (-2.745, (a + b) / 2, 1.112),
             (.048, b - a, 2.179), 'oak', .004)
    for z, height in ((.560, 1.075), (2.016, .370)):
        _box(h, door, 'LeftDoor_LeafRail', (-2.745, (slot_lo + slot_hi) / 2, z),
             (.048, slot_hi - slot_lo, height), 'oak', .003)
    _box(h, door, 'LeftDoor_ObservationGlass', (-2.754, (slot_lo + slot_hi) / 2, 1.465),
         (.007, .170, .713), 'glass', .001)
    for yy in (slot_lo, slot_hi):
        _box(h, door, 'LeftDoor_VisionFrameVertical', (-2.779, yy, 1.465),
             (.022, .021, .752), 'silver', .003)
    for zz in (1.098, 1.832):
        _box(h, door, 'LeftDoor_VisionFrameHorizontal', (-2.779, (slot_lo + slot_hi) / 2, zz),
             (.022, .207, .021), 'silver', .003)
    _box(h, door, 'LeftDoor_KickPlate', (-2.775, y, .150), (.013, 1.061, .252), 'silver', .005)
    _box(h, door, 'LeftDoor_HandlePlate', (-2.780, y + .430, 1.020), (.025, .060, .177), 'steel', .005)
    h.tube('V2_LeftDoor_Lever', [(-2.80, y + .43, 1.054), (-2.848, y + .43, 1.054),
                              (-2.853, y + .300, 1.054)], .009, 'steel', parent=door)
    _box(h, door, 'LeftDoor_StaticNumberPlate', (-2.755, y + .914, 2.050),
         (.051, .254, .168), 'blue', .007)
    h.text(f'V2_LeftDoor_Number_{label}', str(label), (-2.785, y + .914, 2.050), .09,
           'white', parent=door, rotation=(math.pi / 2, 0, -math.pi / 2))
    return door


def _left_corridor(h, parent):
    group = h.empty('V2_LeftCorridor_DoorRhythm', parent=parent)
    centres = (5.87, 10.51, 15.04, 19.48)
    # The deeper counter and its background now end near Y=5.1; keep the near bay open.
    cursor = 5.080
    for label, y in enumerate(centres, 308):
        lo, hi = y - .63, y + .63
        width = lo - cursor
        _box(h, group, 'LeftCorridor_InnerWallPier', (-2.555, (cursor + lo) / 2, 1.575),
             (.350, width, 3.15), 'wall', .003)
        _box(h, group, 'LeftCorridor_InnerSkirting', (-2.747, (cursor + lo) / 2, .077),
             (.037, width, .154), 'silver', .006)
        if width > .7:
            h.tube('V2_LeftCorridor_InnerHandrail', [(-2.850, cursor + .10, .90), (-2.850, lo - .10, .90)],
                   .033, 'white', parent=group)
        _box(h, group, 'LeftCorridor_InnerWallLintel', (-2.555, y, 2.725),
             (.350, 1.260, .850), 'wall', .003)
        _left_door(h, group, y, label)
        cursor = hi
    _box(h, group, 'LeftCorridor_InnerWallEndPier', (-2.555, (cursor + 22.02) / 2, 1.575),
         (.350, 22.02 - cursor, 3.15), 'wall', .003)
    return group


def refine_architecture(h, root):
    """Refine the loaded editable master and enforce the original 13-screen contract."""
    bpy.context.view_layer.update()
    before = _screen_state(root)
    if len(before) != 13:
        raise ValueError(f'Expected 13 original runtime surfaces, found {len(before)}')
    nodes = {obj.name: obj for obj in root.children_recursive}
    for name in ('Architecture',):
        if name not in nodes:
            raise ValueError(f'Load the editable warm-v1 master first; missing {name}')
    if 'Architecture_V2_Detail' in nodes:
        raise ValueError('Architecture v2 refinement has already been applied')
    _materials(h)
    detail = h.empty('Architecture_V2_Detail', parent=nodes['Architecture'])
    detail['referenceBased'] = True
    detail['surveyed'] = False
    detail['staticDoorNumbersAreIllustrative'] = True
    ceiling = _ceiling(h, detail)
    portals = _right_portals(h, detail, nodes)
    corridor = _left_corridor(h, detail)
    bpy.context.view_layer.update()
    if _screen_state(root) != before:
        raise RuntimeError('Architectural refinement changed a protected runtime surface')
    return {'detail': detail, 'ceiling_detail': ceiling, 'right_portals': portals,
            'left_corridor': corridor, 'preserved_runtime_surfaces': len(before),
            'new_static_door_count': 4}
