"""Read-only acceptance checks for saved, editable warm-v2/v3 Blender masters.

Run after loading nurse-station-warm-v2.blend, with --python-exit-code 1.
For v3, load its master instead and append -- --version v3.
No scene, render, image, or report file is saved by this script.
"""

import argparse
import json
import math
import sys
from collections import Counter

import bpy
from bpy_extras.object_utils import world_to_camera_view


EXPECTED_SCREENS = {f'DoorScreen_{number}' for number in range(301, 308)} | {
    'Screen_Main', 'Clock_Display', *(f'Screen_Work_{number:02d}' for number in range(1, 5))}
CONTACT_TOLERANCE = .001
EXPECTED_TEXTURES = {'v2': 25, 'v3': 25}


def _world_points(obj, depsgraph):
    """Include modifiers and parents, without applying either to source data."""
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        if mesh is None or not mesh.vertices:
            raise ValueError(f'No evaluated geometry: {obj.name}')
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        if not all(math.isfinite(value) for point in points for value in point):
            raise ValueError(f'Non-finite evaluated geometry: {obj.name}')
        return points
    finally:
        evaluated.to_mesh_clear()


def _bounds(points):
    return tuple(min(point[axis] for point in points) for axis in range(3)), tuple(
        max(point[axis] for point in points) for axis in range(3))


def _overlap(a, b, axis):
    return min(a[1][axis], b[1][axis]) - max(a[0][axis], b[0][axis])


def _linked_images(material):
    """Count texture images reachable from an active material output, not orphans."""
    if not material.use_nodes or material.node_tree is None:
        return set()
    images, visited = set(), set()

    def visit(tree, node):
        key = (tree.as_pointer(), node.as_pointer())
        if key in visited:
            return
        visited.add(key)
        if node.type == 'TEX_IMAGE' and node.image is not None:
            images.add(node.image)
        if node.type == 'GROUP' and node.node_tree is not None:
            for output in node.node_tree.nodes:
                if output.type == 'GROUP_OUTPUT' and output.is_active_output:
                    visit(node.node_tree, output)
        for socket in node.inputs:
            for link in socket.links:
                visit(tree, link.from_node)

    for node in material.node_tree.nodes:
        if node.type == 'OUTPUT_MATERIAL' and node.is_active_output:
            visit(material.node_tree, node)
    return images


def _verify(report, errors, version='v2'):
    def check(condition, message):
        if not condition:
            errors.append(message)

    scene = bpy.context.scene
    root_name = f'NurseStationWarmV{version[1:]}'
    root = scene.objects.get(root_name)
    if root is None or root.type != 'EMPTY':
        raise ValueError(f'Loaded scene is missing the {root_name} root empty')
    report['asset'] = {'root': root.name, 'revision': root.get('assetRevision')}
    check(root.get('assetRevision') == f'warm-{version}', 'Incorrect assetRevision')
    objects = [root, *root.children_recursive]
    nodes = {obj.name: obj for obj in objects}
    depsgraph = bpy.context.evaluated_depsgraph_get()
    point_cache = {}

    def points(obj):
        if obj.name not in point_cache:
            point_cache[obj.name] = _world_points(obj, depsgraph)
        return point_cache[obj.name]

    def bounds(obj):
        return _bounds(points(obj))

    screens = sorted((obj for obj in objects if obj.get('runtimeSurface')), key=lambda obj: obj.name)
    check({obj.name for obj in screens} == EXPECTED_SCREENS,
          'Runtime screen names/count differ from the 13-surface contract')
    invalid_uv, shared_data, shared_material = [], [], []
    full_uv = ((0, 0), (1, 0), (1, 1), (0, 1))
    for obj in screens:
        if obj.type != 'MESH':
            invalid_uv.append(obj.name)
            continue
        mesh = obj.data
        layer = mesh.uv_layers.active
        valid = (len(mesh.vertices) == 4 and len(mesh.polygons) == 1
                 and len(mesh.loops) == 4 and layer is not None and len(layer.data) == 4)
        if valid:
            uv = [layer.data[index].uv for index in mesh.polygons[0].loop_indices]
            valid = len(uv) == 4 and all(
                math.isfinite(value[axis]) and abs(value[axis] - expected[axis]) <= 1e-6
                for value, expected in zip(uv, full_uv) for axis in (0, 1))
        if not valid:
            invalid_uv.append(obj.name)
        if any(other != obj and other.data == mesh for other in objects):
            shared_data.append(obj.name)
        material = obj.material_slots[0].material if len(obj.material_slots) == 1 else None
        if material is None or any(other != obj and any(slot.material == material for slot in other.material_slots)
                                   for other in objects):
            shared_material.append(obj.name)
        check(not obj.hide_render and not obj.hide_get(), f'Runtime screen is hidden: {obj.name}')
    check(not invalid_uv, f'Screens lack a full ordered 0-1 UV quad: {invalid_uv}')
    check(not shared_data, f'Screen meshes are not independent: {shared_data}')
    check(not shared_material, f'Screen materials are not independent: {shared_material}')
    report['screens'] = {'count': len(screens), 'fullUV': not invalid_uv,
                         'independent': not shared_data and not shared_material,
                         'names': [obj.name for obj in screens]}

    modifier_types = Counter(modifier.type for obj in objects for modifier in obj.modifiers)
    modified_objects = sum(bool(obj.modifiers) for obj in objects)
    modifier_count = sum(modifier_types.values())
    # A flattened runtime export must never pass as the editable authoring master.
    check(modifier_count >= 300 and modified_objects >= 150 and modifier_types['BEVEL'] >= 100,
          'Too few retained modifiers; the loaded asset may be a flattened runtime export')
    report['editable'] = {'modifiedObjects': modified_objects, 'modifiers': modifier_count,
                          'types': dict(sorted(modifier_types.items()))}

    materials = set()
    for obj in objects:
        indices = ({polygon.material_index for polygon in obj.data.polygons} if obj.type == 'MESH'
                   else range(len(obj.material_slots)))
        for index in indices:
            if index < len(obj.material_slots) and obj.material_slots[index].material is not None:
                materials.add(obj.material_slots[index].material)
    if version == 'v3':
        glass = next((material for material in materials if material.name == 'WarmStationV1_glass'), None)
        shader = glass.node_tree.nodes.get('Principled BSDF') if glass and glass.use_nodes else None
        if shader is None:
            raise ValueError('Editable v3 source is missing its authored glass material')
        transmission = shader.inputs['Transmission Weight'].default_value
        alpha = shader.inputs['Alpha'].default_value
        authored_glass_preserved = abs(transmission - .36) <= 1e-5 and abs(alpha - 1) <= 1e-6
        check(authored_glass_preserved,
              'Runtime thin-glass optimization leaked into the editable authoring source')
        report['authoringGlass'] = {'material': glass.name, 'transmission': round(transmission, 6),
                                   'alpha': round(alpha, 6), 'runtimeOptimizationExcluded': authored_glass_preserved}
    images = set().union(*(_linked_images(material) for material in materials))
    unpacked = sorted(image.name for image in images if image.packed_file is None and not image.packed_files)
    invalid_images = sorted(image.name for image in images if min(image.size) <= 0 or not image.has_data)
    expected_images = EXPECTED_TEXTURES[version]
    check(len(images) == expected_images, f'Expected {expected_images} used texture images, found {len(images)}')
    check(not unpacked, f'Used textures are not packed: {unpacked}')
    check(not invalid_images, f'Used textures lack readable pixels: {invalid_images}')
    report['textures'] = {'used': len(images), 'packed': len(images) - len(unpacked),
                          'unpacked': unpacked, 'invalid': invalid_images}

    cabinet = nodes['BackgroundCabinet_ClinicalTop']
    piers = [obj for obj in objects if obj.name.startswith('Station_BackgroundOakPier')]
    if len(piers) != 2:
        raise ValueError(f'Expected two background oak piers, found {len(piers)}')
    left_pier = min(piers, key=lambda obj: bounds(obj)[0][0])
    cabinet_bounds, pier_bounds = bounds(cabinet), bounds(left_pier)
    gap = pier_bounds[0][1] - cabinet_bounds[1][1]
    check(_overlap(cabinet_bounds, pier_bounds, 0) > 0 and _overlap(cabinet_bounds, pier_bounds, 2) > 0,
          'Cabinet and left oak pier no longer share the expected X/Z comparison region')
    check(gap >= .015 - 1e-6, f'Cabinet-to-left-pier Y clearance is only {gap:.6f} m')
    report['cabinetClearance'] = {'method': 'evaluated-world-AABB', 'pier': left_pier.name,
                                 'cabinetMaxY': round(cabinet_bounds[1][1], 6),
                                 'pierMinY': round(pier_bounds[0][1], 6),
                                 'gapM': round(gap, 6), 'minimumM': .015}

    frame = nodes['Sign_SilverPerimeter']
    frame_bounds = bounds(frame)
    rods = sorted((obj for obj in objects if obj.name.startswith('Sign_SuspensionRod')), key=lambda obj: obj.name)
    rosettes = [obj for obj in objects if obj.name.startswith('Sign_CeilingRosette')]
    if len(rods) != 2 or len(rosettes) != 2:
        raise ValueError('Hanging sign requires two suspension rods and two ceiling rosettes')
    connections, matched_rosettes = [], set()
    for rod in rods:
        rod_bounds = bounds(rod)
        center = [(rod_bounds[0][axis] + rod_bounds[1][axis]) / 2 for axis in (0, 1)]
        rosette = min(rosettes, key=lambda obj: sum(
            ((bounds(obj)[0][axis] + bounds(obj)[1][axis]) / 2 - center[axis]) ** 2 for axis in (0, 1)))
        rosette_bounds = bounds(rosette)
        matched_rosettes.add(rosette.name)
        bottom_in_frame = (frame_bounds[0][2] - CONTACT_TOLERANCE <= rod_bounds[0][2]
                           <= frame_bounds[1][2] + CONTACT_TOLERANCE)
        top_in_rosette = (rosette_bounds[0][2] - CONTACT_TOLERANCE <= rod_bounds[1][2]
                          <= rosette_bounds[1][2] + CONTACT_TOLERANCE)
        check(bottom_in_frame and all(_overlap(rod_bounds, frame_bounds, axis) > 0 for axis in (0, 1)),
              f'Sign rod bottom is disconnected from the frame: {rod.name}')
        check(top_in_rosette and all(_overlap(rod_bounds, rosette_bounds, axis) > 0 for axis in (0, 1)),
              f'Sign rod top is disconnected from the rosette: {rod.name}')
        check(rod_bounds[1][2] > frame_bounds[1][2] + .05,
              f'Sign rod does not extend above the frame: {rod.name}')
        connections.append({'rod': rod.name, 'rosette': rosette.name,
                            'frameOverlapM': round(frame_bounds[1][2] - rod_bounds[0][2], 6),
                            'rosetteOverlapM': round(rod_bounds[1][2] - rosette_bounds[0][2], 6)})
    check(len(matched_rosettes) == 2, 'Both rods are matched to the same rosette')
    camera = scene.camera
    if camera is None:
        raise ValueError('Loaded scene has no active camera')
    projected = [world_to_camera_view(scene, camera, point) for point in points(frame)]
    ndc_min, ndc_max = _bounds(projected)
    limits = ((scene.render.border_min_x, scene.render.border_min_y),
              (scene.render.border_max_x, scene.render.border_max_y)) if scene.render.use_border else ((0, 0), (1, 1))
    in_frame = all(limits[0][axis] - 1e-6 <= ndc_min[axis] <= ndc_max[axis]
                   <= limits[1][axis] + 1e-6 for axis in (0, 1))
    in_frame = in_frame and camera.data.clip_start <= ndc_min[2] <= ndc_max[2] <= camera.data.clip_end
    check(in_frame, 'Hanging sign frame is clipped by the active camera or render border')
    report['sign'] = {'connections': connections, 'fullyInFrame': in_frame,
                      'camera': camera.name, 'ndcMin': [round(value, 6) for value in ndc_min[:2]],
                      'ndcMax': [round(value, 6) for value in ndc_max[:2]]}

    corridor_piers = [obj for obj in objects if obj.name.startswith('V2_LeftCorridor_InnerWallPier')]
    if len(corridor_piers) != 4:
        raise ValueError(f'Expected four left corridor wall piers, found {len(corridor_piers)}')
    first_pier = min(corridor_piers, key=lambda obj: bounds(obj)[0][1])
    near_y = bounds(first_pier)[0][1]
    check(near_y >= 5.07 - 1e-6, f'Near left corridor wall obstructs the station again: Y={near_y:.6f}')
    report['leftCorridor'] = {'firstPier': first_pier.name, 'minY': round(near_y, 6), 'minimumY': 5.07}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', choices=('v2', 'v3'), default='v2')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    report, errors = {}, []
    try:
        _verify(report, errors, args.version)
    except Exception as error:
        errors.append(f'{type(error).__name__}: {error}')
    report['ok'] = not errors
    report['errors'] = errors
    print(json.dumps(report, ensure_ascii=False, separators=(',', ':'), allow_nan=False), flush=True)
    if errors:
        raise RuntimeError(f'Warm-{args.version} acceptance failed ({len(errors)} checks); see JSON evidence')


if __name__ == '__main__':
    main()
