"""Editable, reference-led hospital bed for the graphite ward.

All geometry belongs to the returned BedBody node.  The head is negative Y;
there are no patient identifiers or runtime display surfaces in this module.
"""

import math

import bpy
from mathutils import Vector

import ward_graphite_common as h


def _bevel(obj, width=.008, segments=3):
    mod = obj.modifiers.new('Cleanable moulded edge', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.harden_normals = True
    return obj


def _rounded_outline(width, height, radius, steps=10):
    points = []
    for cx, cz, start in [
        (width / 2 - radius, -height / 2 + radius, -90),
        (width / 2 - radius, height / 2 - radius, 0),
        (-width / 2 + radius, height / 2 - radius, 90),
        (-width / 2 + radius, -height / 2 + radius, 180),
    ]:
        for index in range(steps + 1):
            angle = math.radians(start + index * 90 / steps)
            points.append((cx + radius * math.cos(angle), cz + radius * math.sin(angle)))
    return points


def _panel(name, center, width, height, depth, radius, material, parent, side=False):
    """Extruded rounded silhouette; radius is independent of panel thickness."""
    outline = _rounded_outline(width, height, radius)
    vertices = []
    for offset in (-depth / 2, depth / 2):
        for horizontal, vertical in outline:
            point = (offset, horizontal, vertical) if side else (horizontal, offset, vertical)
            vertices.append(tuple(center[axis] + point[axis] for axis in range(3)))
    count = len(outline)
    faces = [tuple(range(count)), tuple(range(count * 2 - 1, count - 1, -1))]
    faces.extend((i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count))
    # Exchanging the horizontal and extrusion axes reverses the winding.
    if side:
        faces = [tuple(reversed(face)) for face in faces]
    result = h.mesh(name, vertices, faces, material, parent=parent)
    for polygon in result.data.polygons:
        polygon.use_smooth = polygon.index >= 2
    return _bevel(result, .006, 3)


def _cut_handle(obj, name, center, width, height, depth, parent, side=False):
    cutter = _panel(name, center, width, height, depth, min(height / 2 - .002, .035),
                    'plastic', parent, side=side)
    # Apply only this bed's local cutter, leaving the outer manufactured edge editable.
    for selected in list(bpy.context.selected_objects):
        selected.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mod = obj.modifiers.new('Open hand grip', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    # Cut the silhouette before the edge modifier so the new hand openings are rounded too.
    bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    obj.select_set(False)


def _rod(name, a, b, radius, material, parent, vertices=20):
    start, end = Vector(a), Vector(b)
    obj = h.cylinder(name, (start + end) / 2, radius, (end - start).length,
                     material, vertices=vertices, parent=parent)
    obj.rotation_euler = (end - start).to_track_quat('Z', 'Y').to_euler()
    return obj


def _smooth(value):
    value = min(1.0, max(0.0, value))
    return value * value * (3 - 2 * value)


def _head_rise(y):
    return .13 * _smooth((-.23 - y) / .72)


def _sheet_position(u, v, extra=.0):
    x = .581 * u
    y = -.975 + 2.012 * v
    # Fabric only turns down after the mattress edge; an early falloff cuts
    # through its top surface instead of draping over the upholstered corner.
    side = _smooth((abs(x) - .482) / .099)
    foot = _smooth((y - .985) / .052)
    # Broad edge folds and quieter central rumpling avoid a uniformly noisy surface.
    ripples = (.0038 * math.sin(21 * x + 6 * y)
               + .0028 * math.sin(33 * y - 8 * x)
               + .002 * math.cos(51 * x + 19 * y))
    edge_folds = .016 * math.sin(37 * y + 4 * math.sin(9 * y)) * side
    crease = .008 * math.sin(49 * x + 13 * y) * math.exp(-((y - .2) / .57) ** 2)
    z = .799 + _head_rise(y) - .172 * side - .088 * foot + ripples + edge_folds + crease + extra
    x += .006 * side * math.sin(29 * y)
    return x, y, z


def _cloth_grid(name, columns, rows, position, material, parent, uv_scale=(1, 1)):
    vertices, uvs, faces = [], [], []
    for row in range(rows + 1):
        v = row / rows
        for col in range(columns + 1):
            u = col / columns
            vertices.append(position(u, v))
            uvs.append((u * uv_scale[0], v * uv_scale[1]))
    for row in range(rows):
        for col in range(columns):
            a = row * (columns + 1) + col
            faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    obj = h.mesh(name, vertices, faces, material, parent=parent, uvs=uvs, smooth=True)
    thickness = obj.modifiers.new('Hem and fabric thickness', 'SOLIDIFY')
    thickness.thickness = .0025
    thickness.offset = -1
    return obj


def _bedding(parent):
    # One profiled mattress follows the shallow raised head section of the deck.
    verts = []
    sections = 24
    for section in range(sections + 1):
        y = -.995 + 1.98 * section / sections
        rise = _head_rise(y)
        verts.extend([(-.485, y, .64 + rise), (.485, y, .64 + rise),
                      (.485, y, .778 + rise), (-.485, y, .778 + rise)])
    end = sections * 4
    faces = [(0, 1, 2, 3), (end + 3, end + 2, end + 1, end)]
    for section in range(sections):
        for corner in range(4):
            a = section * 4 + corner
            b = section * 4 + (corner + 1) % 4
            faces.append((a + 4, b + 4, b, a))
    _bevel(h.mesh('Bed_Mattress_Profile', verts, faces, 'linen', parent=parent), .027, 5)
    for side in (-1, 1):
        h.tube('Bed_Mattress_PipedSeam', [(side * .482, y, .667 + _head_rise(y))
                                         for y in [-.96 + i * 1.92 / 48 for i in range(49)]],
               .0026, 'plastic', parent=parent)
    _cloth_grid('Bed_WhiteLinen_Drape', 54, 82,
                lambda u, v: _sheet_position(u * 2 - 1, v), 'linen', parent, (1.3, 2.3))
    for side in (-1, 1):
        h.tube('Bed_Linen_StitchedHem', [_sheet_position(side, i / 72, .001) for i in range(73)],
               .0018, 'linen', parent=parent)

    # A closed, compressed superellipsoid gives the pillow a sewn rectangular form.
    vertices, faces, uvs = [], [], []
    around, rings = 64, 24
    for ring in range(rings + 1):
        latitude = -math.pi / 2 + math.pi * ring / rings
        radial = max(.00001, math.cos(latitude)) ** .48
        z_curve = math.copysign(abs(math.sin(latitude)) ** .72, math.sin(latitude))
        for step in range(around):
            angle = 2 * math.pi * step / around
            x = .367 * math.copysign(abs(math.cos(angle)) ** .48, math.cos(angle)) * radial
            y = -.672 + .232 * math.copysign(abs(math.sin(angle)) ** .48, math.sin(angle)) * radial
            seams = .0042 * math.sin(angle * 17 + latitude * 7) * abs(math.sin(latitude)) ** .7
            z = .889 + _head_rise(y) + .088 * z_curve + seams
            # The compressed pillow underside follows the same linen profile,
            # rather than burying its bottom half inside the raised mattress.
            linen_z = _sheet_position(x / .581, (y + .975) / 2.012)[2]
            z = max(z, linen_z + .002)
            vertices.append((x, y, z))
            uvs.append((step / around, ring / rings))
    for ring in range(rings):
        for step in range(around):
            a = ring * around + step
            b = ring * around + (step + 1) % around
            faces.append((a, b, b + around, a + around))
    faces.extend([tuple(range(around - 1, -1, -1)),
                  tuple(range(rings * around, (rings + 1) * around))])
    h.mesh('Bed_Pillow_LoftedLinen', vertices, faces, 'linen', parent=parent, uvs=uvs, smooth=True)
    h.tube('Bed_Pillow_SewnPiping', [vertices[12 * around + i] for i in range(around)],
           .0023, 'linen', parent=parent, cyclic=True)

    def throw_position(u, v):
        x = (u * 2 - 1) * .581
        y = .36 + v * .57
        px, py, pz = _sheet_position(x / .581, (y + .975) / 2.012)
        loft = .014 + .002 * math.sin(31 * x + 7 * y) + .0015 * math.cos(57 * x - 11 * y)
        return px, py, pz + loft

    _cloth_grid('Bed_BlueGrey_Throw', 64, 38, throw_position, 'blanket', parent, (1.7, .9))
    for v in (0, 1):
        h.tube('Bed_Throw_BoundEdge', [throw_position(i / 80, v) for i in range(81)],
               .0024, 'blanket', parent=parent)
    for u in (0, 1):
        h.tube('Bed_Throw_SideHem', [throw_position(u, i / 32) for i in range(33)],
               .0024, 'blanket', parent=parent)


def _caster(parent, x, y, index):
    caster = h.empty('Bed_Caster_%02d' % index, parent=parent)
    # The two tyres are separate meshes, with a central brake yoke and satin hubs.
    for offset in (-.033, .033):
        h.cylinder('Bed_Caster_Tyre', (x + offset, y, .105), .105, .043,
                   'rubber', rotation=(0, math.pi / 2, 0), vertices=40, parent=caster)
        h.cylinder('Bed_Caster_Hub', (x + offset + math.copysign(.023, offset), y, .105), .077, .007,
                   'plastic', rotation=(0, math.pi / 2, 0), vertices=40, parent=caster)
        h.cylinder('Bed_Caster_AxleCap', (x + offset + math.copysign(.028, offset), y, .105), .018, .009,
                   'silver', rotation=(0, math.pi / 2, 0), vertices=24, parent=caster)
    _rod('Bed_Caster_Axle', (x - .075, y, .105), (x + .075, y, .105), .018, 'steel', caster)
    h.box('Bed_Caster_Fork', (x, y + .035, .196), (.042, .107, .111), 'graphite', bevel=.016, parent=caster)
    h.cylinder('Bed_Caster_Swivel', (x, y + .025, .255), .041, .062,
               'steel', vertices=28, parent=caster)
    h.box('Bed_Caster_BrakePedal', (x, y + .132, .158), (.11, .088, .025),
          'rubber', bevel=.009, parent=caster)
    for line in range(4):
        h.box('Bed_Caster_PedalGrip', (x, y + .105 + line * .015, .172), (.082, .004, .002),
              'graphite', bevel=.001, parent=caster)


def _chassis(parent):
    h.box('Bed_Base_SatinSpine', (0, .02, .282), (.77, 1.70, .093), 'steel', bevel=.025, parent=parent)
    h.box('Bed_Base_GraphiteShell', (0, .02, .335), (.65, 1.40, .082), 'graphite', bevel=.045, parent=parent)
    for index, (x, y) in enumerate([(-.455, -.85), (.455, -.85), (-.455, .85), (.455, .85)], 1):
        _caster(parent, x, y, index)
        h.box('Bed_Base_CasterOutrigger', (x * .65, y, .283), (.43, .092, .071),
              'steel', bevel=.02, parent=parent)
    for x in (-.315, .315):
        for a, b in [((x, -.67, .353), (x, .58, .598)), ((x, .63, .353), (x, -.61, .598))]:
            _rod('Bed_Lift_ArticulatedArm', a, b, .028, 'steel', parent)
        for y in (-.62, .62):
            h.cylinder('Bed_Lift_Pivot', (x, y, .377 if y > 0 else .579), .046, .042,
                       'graphite', rotation=(0, math.pi / 2, 0), vertices=24, parent=parent)
    _rod('Bed_Lift_ActuatorBody', (.05, -.64, .367), (.05, -.05, .48), .042, 'graphite', parent)
    _rod('Bed_Lift_ActuatorPiston', (.05, -.05, .48), (.05, .51, .585), .018, 'silver', parent)
    h.box('Bed_Mattress_Deck', (0, 0, .623), (1.022, 2.095, .068), 'plastic', bevel=.021, parent=parent)
    h.box('Bed_Deck_ShadowGasket', (0, 0, .592), (.94, 1.95, .024), 'graphite', bevel=.01, parent=parent)
    for side in (-1, 1):
        x = side * .442
        h.tube('Bed_Base_ProtectionRail', [(x, -.89, .317), (x, -.95, .357), (x, -.95, .456),
                                         (x, .96, .456), (x, .96, .34), (x, .89, .317)],
               .015, 'steel', parent=parent)
        for y in (-.77, .73):
            _rod('Bed_Deck_SideRailSupport', (side * .475, y, .568), (side * .516, y, .78),
                 .015, 'steel', parent)
    h.box('Bed_Foot_CentralBrake', (0, 1.015, .262), (.28, .07, .044),
          'graphite', bevel=.012, parent=parent)


def _end_board(parent, at_head):
    prefix = 'Head' if at_head else 'Foot'
    y = -1.07 if at_head else 1.085
    center_z = .792 if at_head else .735
    height = .42 if at_head else .602
    board = _panel('Bed_%s_WhiteMoulding' % prefix, (0, y, center_z), 1.108, height, .077,
                   .09, 'plastic', parent)
    for x in (-.30, .30):
        _cut_handle(board, 'Temporary_%sGrip' % prefix, (x, y, center_z + height / 2 - .095),
                    .267, .071, .20, parent)
    front = y + (-.043 if at_head else .043)
    if not at_head:
        _panel('Bed_Foot_GraphiteInset', (0, front, .712), .943, .320, .010,
               .055, 'graphite', parent)
        _panel('Bed_Foot_SatinLowerInset', (0, front, .498), .996, .074, .012,
               .018, 'silver', parent)
        h.box('Bed_Foot_FineCyanAccent', (0, front + .009, .546), (.956, .005, .007),
              'cyan', bevel=.003, parent=parent)
        h.box('Bed_Foot_InformationRecess', (0, front + .002, .934), (.253, .008, .048),
              'white', bevel=.012, parent=parent)
    else:
        _panel('Bed_Head_QuietInset', (0, y + .044, .756), .90, .17, .008,
               .04, 'white', parent)
    for x in (-.491, .491):
        h.box('Bed_%s_LowerMount' % prefix, (x, y, .462 if not at_head else .52), (.10, .112, .177),
              'graphite', bevel=.018, parent=parent)


def _side_rails(parent):
    for side in (-1, 1):
        x = side * .543
        # Split rails leave the middle access gap used by nursing staff.
        for section, y, length, height in [('Head', -.59, .84, .357), ('Foot', .50, .65, .248)]:
            z = .832 if section == 'Head' else .744
            rail = _panel('Bed_%sRail_Moulding' % section, (x, y, z), length, height, .054,
                          .075, 'plastic', parent, side=True)
            grip_z = z + height / 2 - .075
            _cut_handle(rail, 'Temporary_SideGrip', (x, y - .01, grip_z), length - .22, .071,
                        .14, parent, side=True)
            _panel('Bed_%sRail_InnerInset' % section, (x + side * .030, y, z - .071),
                   length - .114, .113 if section == 'Head' else .060, .007,
                   .024, 'white', parent, side=True)
            for hinge_y in (y - length * .29, y + length * .29):
                h.cylinder('Bed_SideRail_Hinge', (x, hinge_y, .644), .032, .08, 'graphite',
                           rotation=(0, math.pi / 2, 0), vertices=24, parent=parent)
            if section == 'Head':
                outer_x = x + side * .038
                _panel('Bed_Rail_ControlInset', (outer_x, y - .07, .807), .277, .106, .008,
                       .014, 'graphite', parent, side=True)
                for row in range(2):
                    for column in range(4):
                        button_y = y - .165 + column * .060
                        button_z = .784 + row * .042
                        h.cylinder('Bed_Rail_ControlKey', (outer_x + side * .006, button_y, button_z),
                                   .009, .004, 'silver', rotation=(0, math.pi / 2, 0),
                                   vertices=16, parent=parent)
                h.box('Bed_Rail_ControlStatus', (outer_x + side * .007, y + .045, .826),
                      (.003, .025, .009), 'cyan', bevel=.0015, parent=parent)
            h.tube('Bed_Rail_LowerCyanTrace', [(x + side * .033, y - length * .35, z - height * .36),
                                             (x + side * .033, y + length * .35, z - height * .36)],
                   .0016, 'cyan', parent=parent)


def build_bed(parent):
    """Return a fully parented, metre-scale, editable bed subassembly."""
    body = h.empty('BedBody', parent=parent)
    body['assetRole'] = 'bed-body'
    body['headDirection'] = '-Y'
    body['detailStrategy'] = 'hero mouldings, woven bedding and mechanical chassis'
    _chassis(body)
    _bedding(body)
    _end_board(body, at_head=True)
    _end_board(body, at_head=False)
    _side_rails(body)
    return body
