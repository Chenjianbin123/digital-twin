"""Work-position and planting refinement of the editable warm-v2 master.

Only furniture anchors and rigid monitor assemblies move. Desk, camera, existing
materials, screen meshes and UVs remain untouched; all dimensions are in metres.
"""
import json
import math

import bpy
from mathutils import Matrix


def _box(h, name, position, size, material, parent, bevel=.003):
    obj = h.box(name, position, size, material, bevel=bevel, parent=parent)
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.segments = 2
    return obj


def _mesh_signature(obj):
    return (obj.data.as_pointer(), tuple(mat.as_pointer() for mat in obj.data.materials),
            tuple(tuple(vertex.co) for vertex in obj.data.vertices),
            tuple(tuple(poly.vertices) for poly in obj.data.polygons),
            tuple((layer.name, tuple(tuple(loop.uv) for loop in layer.data)) for layer in obj.data.uv_layers))


def _matrix_close(left, right):
    return all(abs(left[row][col] - right[row][col]) < .000002
               for row in range(4) for col in range(4))


def _raise_monitor(h, station, number, rise):
    prefix = f'Monitor_{number:02d}_'
    screen_name = f'Screen_Work_{number:02d}'
    detail_name = f'WarmV2_MonitorDetails_{number:02d}'
    parts = [obj for obj in station.children
             if obj.name.startswith(prefix) or obj.name in (screen_name, detail_name)]
    names = {obj.name for obj in parts}
    if not {prefix + 'Base', prefix + 'Stand', prefix + 'Back', screen_name, detail_name} <= names:
        raise ValueError(f'Missing editable monitor components in {station.name}')

    # Reparent at the same origin first, then lift the complete rigid assembly.
    assembly = h.empty(f'WarmV3_MonitorAssembly_{number:02d}', station)
    for obj in parts:
        local = obj.matrix_local.copy()
        obj.parent = assembly
        obj.matrix_parent_inverse = Matrix.Identity(4)
        obj.matrix_basis = local
    assembly.location.z = rise
    assembly['rigidScreenLiftMetres'] = rise
    assembly['screenGeometryModified'] = False

    support = h.empty(f'WarmV3_MonitorRiser_{number:02d}', station)
    support['supportSurface'] = 'staff-worktop'
    support['topHeightAboveWorktop'] = rise
    _box(h, f'WarmV3_RiserTop_{number:02d}', (0, -.025, rise - .007),
         (.290, .190, .014), 'silver', support, .004)
    for index, (x, y) in enumerate(((-.12, -.091), (.12, -.091), (-.12, .041), (.12, .041))):
        _box(h, f'WarmV3_RiserFootPad_{number}_{index}', (x, y, .0015),
             (.026, .028, .003), 'dark', support, .001)
        _box(h, f'WarmV3_RiserLeg_{number}_{index}', (x, y, (rise - .011) / 2),
             (.020, .021, rise - .017), 'steel', support, .002)
    # The original lead rests on the raised shelf; this short tail reaches the desk.
    h.tube(f'WarmV3_RiserCableDrop_{number:02d}',
           [(.11, -.095, rise + .004), (.150, -.105, rise - .011),
            (.158, -.113, .016), (.176, -.114, .004)], .0024, 'dark', support)
    return {'station': station.name, 'assembly': assembly.name, 'support': support.name,
            'screen': screen_name, 'liftMetres': rise,
            'riserFootprint': [.290, .190], 'keyboardAndMouseUnchanged': True}


def _move_anchor(obj, position):
    previous = [float(value) for value in obj.location]
    obj.location = position
    return {'name': obj.name, 'before': previous, 'after': list(position),
            'delta': [float(position[index] - previous[index]) for index in range(3)]}


def _file_cluster(h, equipment):
    group = h.empty('WarmV3_CentralReferenceFiles', equipment)
    group.location = (.64, .095, 1.07)
    group['physicalRegion'] = 'front-worktop'
    group['supportSurface'] = 'public-ledge'
    group['content'] = 'blank illustrative labels; no patient data'
    _box(h, 'WarmV3_FileCaddy_Base', (0, 0, .005), (.276, .14, .010), 'silver', group)
    for index, x in enumerate((-.133, -.045, .045, .133)):
        _box(h, f'WarmV3_FileCaddy_Divider_{index}', (x, 0, .051),
             (.004, .130, .082), 'glass', group, .001)
    for index, (x, height, color) in enumerate(((-.086, .242, 'blue'), (0, .214, 'wall'), (.086, .267, 'blue'))):
        bottom = .010
        _box(h, f'WarmV3_CentralFile_{index}_Pages', (x, 0, bottom + (height - .009) / 2),
             (.057, .105, height - .009), 'paper', group, .0007)
        for side in (-1, 1):
            _box(h, f'WarmV3_CentralFile_{index}_Cover_{side}',
                 (x + side * .0305, 0, bottom + height / 2), (.003, .112, height), color, group, .001)
        _box(h, f'WarmV3_CentralFile_{index}_Spine', (x, -.055, bottom + height / 2),
             (.064, .005, height), color, group, .001)
        _box(h, f'WarmV3_CentralFile_{index}_BlankLabel', (x, -.058, bottom + height * .68),
             (.038, .0015, .071), 'paper', group, .0005)
    return {'name': group.name, 'position': list(group.location), 'footprint': [.276, .14],
            'supportZ': 1.07, 'maxZ': 1.347, 'patientData': False}


def _planting(nodes):
    reports = []
    specifications = [
        ('Counter_LivePlant', (-2.205, 1.05, 1.07), .66, 18, .78, .55),
        ('Background_Plant_Left', (-2.03, 4.57, .82), .90, -24, .82, .80),
        ('Background_Plant_Right', (.23, 4.57, .82), 1.08, 41, 1.05, 1.00),
    ]
    for name, position, scale, angle, crown_xy, crown_z in specifications:
        plant = nodes[name]
        previous_scale = [float(value) for value in plant.scale]
        report = _move_anchor(plant, position)
        plant.scale = (scale, scale, scale)
        plant.rotation_euler.z = math.radians(angle)
        crown = nodes['WarmV2_LongLeafCrown_' + name]
        crown.scale = (crown_xy, crown_xy, crown_z)
        # Scale the supplementary long leaves around their soil-height attachment.
        crown.location.z = .143 * (1 - crown_z)
        report.update({'scaleBefore': previous_scale, 'scaleAfter': [scale] * 3,
                       'rotationDegrees': angle, 'longLeafScale': [crown_xy, crown_xy, crown_z],
                       'potBaseZ': position[2], 'sameEditableLeavesReused': True})
        reports.append(report)
    return reports


def _new_triangle_count(objects):
    graph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    for obj in objects:
        if obj.type not in {'MESH', 'CURVE'}:
            continue
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh()
        try:
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
        finally:
            evaluated.to_mesh_clear()
    return triangles


def refine_furnishings(h, root):
    """Refine loaded editable warm-v2 once and return JSON-only audit fields."""
    bpy.context.view_layer.update()
    nodes = {obj.name: obj for obj in root.children_recursive}
    required = ['Equipment', 'Desk', 'WarmV2_DeskTelephone', 'WarmV2_AnonymousClipboard',
                'WarmV2_DeskStationery', 'Counter_LivePlant', 'Background_Plant_Left', 'Background_Plant_Right']
    required += [f'Workstation_{number:02d}' for number in range(1, 5)]
    required += ['WarmV2_LongLeafCrown_' + name for name in ('Counter_LivePlant', 'Background_Plant_Left', 'Background_Plant_Right')]
    missing = [name for name in required if name not in nodes]
    if missing:
        raise ValueError('Load editable warm-v2 furnishings first: ' + ', '.join(missing))
    if 'WarmV3_FurnishingRefinement' in nodes:
        raise ValueError('Warm-v3 furnishing refinement has already been applied')
    missing_materials = {'white', 'dark', 'silver', 'steel', 'blue', 'wall', 'paper', 'glass'} - h.M.keys()
    if missing_materials:
        raise ValueError('Missing existing materials: ' + ', '.join(sorted(missing_materials)))

    surfaces = {obj.name: obj for obj in nodes.values() if obj.get('runtimeSurface')}
    expected_names = ({f'Screen_Work_{number:02d}' for number in range(1, 5)}
                      | {f'DoorScreen_{number}' for number in range(301, 308)} | {'Screen_Main', 'Clock_Display'})
    if surfaces.keys() != expected_names or any(obj.type != 'MESH' or not obj.data.uv_layers for obj in surfaces.values()):
        raise ValueError('Expected the 13 independently editable warm-v2 screen meshes and UVs')
    screen_geometry = {name: _mesh_signature(obj) for name, obj in surfaces.items()}
    screen_poses = {name: obj.matrix_world.copy() for name, obj in surfaces.items()}
    before = {obj.as_pointer() for obj in root.children_recursive}
    marker = h.empty('WarmV3_FurnishingRefinement', nodes['Equipment'])

    monitors = []
    for number, rise in enumerate((.075, .090, .075, .065), 1):
        station = nodes[f'Workstation_{number:02d}']
        name = f'Screen_Work_{number:02d}'
        screen_poses[name] = (station.matrix_world @ Matrix.Translation((0, 0, rise))
                              @ station.matrix_world.inverted() @ screen_poses[name])
        monitors.append(_raise_monitor(h, station, number, rise))

    anchors = [_move_anchor(nodes['WarmV2_DeskTelephone'], (.905, .62, .75)),
               _move_anchor(nodes['WarmV2_AnonymousClipboard'], (.64, .32, .75)),
               _move_anchor(nodes['WarmV2_DeskStationery'], (.43, .34, .75))]
    files = _file_cluster(h, marker)
    plants = _planting(nodes)
    bpy.context.view_layer.update()
    after_surfaces = {obj.name: obj for obj in root.children_recursive if obj.get('runtimeSurface')}
    if after_surfaces.keys() != surfaces.keys():
        raise RuntimeError('A business screen was added or removed')
    for name, obj in surfaces.items():
        if _mesh_signature(obj) != screen_geometry[name] or not _matrix_close(obj.matrix_world, screen_poses[name]):
            raise RuntimeError(f'Screen geometry, UV, material or allowed rigid pose changed: {name}')
    added = [obj for obj in root.children_recursive if obj.as_pointer() not in before]
    triangles = _new_triangle_count(added)
    if triangles > 15000:
        raise RuntimeError(f'Warm-v3 furnishing additions exceed 15k triangles: {triangles}')
    report = {'monitors': monitors, 'anchorAdjustments': anchors, 'centralFiles': files, 'plants': plants,
              'addedObjects': len(added), 'addedTriangles': triangles, 'businessScreensPreserved': len(surfaces),
              'screenGeometryUvsMaterialsPreserved': True, 'deskCameraMaterialsModified': False,
              'patientData': False, 'requiresCoordination': []}
    json.dumps(report, ensure_ascii=False)
    marker['addedTriangles'] = triangles
    return report
