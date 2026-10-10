"""Read-only native V3 verification, including the small visitor parking area.

Run with Blender --python-exit-code 1 --python <this file> -- [--source-only].
Only JSON reports are written. V2 is opened as a camera reference, never saved.
Geometry checks establish scene consistency, not surveyed or engineering approval.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_hospital_exterior_reference_v2 as shared


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/hospital-exterior-reference-v3'
SOURCE = OUT / 'hospital-exterior-reference-v3.blend'
V2 = ROOT / 'output/hospital-exterior-reference-v2/hospital-exterior-reference-v2.blend'
REQUIRED = [
    'HospitalExterior_Reference_V3', 'Hospital_Buildings', 'Central_Inpatient_Tower',
    'West_Wing', 'East_Wing', 'Outpatient_Podium', 'Campus_Hardscape',
    'Landscape_Planting', 'Ambulance', 'Background_Context', 'V3_Campus',
]
VIEWS = {
    'hero': 'Reference_Hero_Camera', 'entrance': 'Entrance_Detail_Camera',
    'parking': 'Parking_Detail_Camera', 'comparison': 'V2_Comparison_Camera',
}
EMERGENCY_CORRIDOR = [(50.4, 57.8), (-58, 25)]
PARKING_REGION = [(-48, -22), (-56, -37.5)]


def configure_shared_helpers():
    # The V2 module is a CLI verifier with module-level paths. Reconfigure only
    # this process; no V2 source/script is changed or saved.
    shared.OUT = OUT
    shared.SOURCE = SOURCE
    shared.V1 = V2
    shared.VIEWS = VIEWS


def xy_overlaps(a, b, tolerance=1e-5):
    return all(min(a[i][1], b[i][1]) - max(a[i][0], b[i][0]) > tolerance for i in [0, 1])


def xy_contains(container, item, tolerance=.025):
    return all(container[i][0] - tolerance <= item[i][0] and
               item[i][1] <= container[i][1] + tolerance for i in [0, 1])


def pavement_connects(a, b, tolerance=.025):
    return abs(a[2][1] - b[2][1]) <= .04 and all(
        max(a[i][0], b[i][0]) <= min(a[i][1], b[i][1]) + tolerance for i in [0, 1]
    )


def evaluated_points(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        if mesh is None:
            return []
        return [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
    finally:
        evaluated.to_mesh_clear()


def group_bounds(obj, depsgraph):
    points = []
    for child in [obj, *obj.children_recursive]:
        if child.type in shared.GEOMETRY_TYPES:
            points.extend(evaluated_points(child, depsgraph))
    return shared.bounds(points) if points else None


def surface_tree(obj, depsgraph):
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    try:
        if mesh is None or not mesh.polygons:
            return None
        points = [evaluated.matrix_world @ vertex.co for vertex in mesh.vertices]
        mesh.calc_loop_triangles()
        return BVHTree.FromPolygons(points, [tuple(t.vertices) for t in mesh.loop_triangles],
                                   all_triangles=True), shared.bounds(points)
    finally:
        evaluated.to_mesh_clear()


def road_below(x, y, z, surfaces):
    hits = []
    for name, tree, _ in surfaces:
        position, normal, _, _ = tree.ray_cast(Vector((x, y, z)), Vector((0, 0, -1)), 10)
        if position is not None and normal.z > .5:
            hits.append((position.z, name))
    return max(hits) if hits else None


def parking_report(scene, failures):
    """Use painted bay boundaries, evaluated cars and actual pavement surfaces."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    campus = scene.objects.get('V3_Campus')
    identity = campus is not None and campus.parent is None and all(
        abs(campus.matrix_world[i][j] - (1 if i == j else 0)) < 1e-6
        for i in range(4) for j in range(4)
    )
    if not identity:
        failures.append('V3_Campus must use unscaled, unrotated world coordinates without a parent')
    parking = scene.objects.get('V3_Parking')
    objects = list(parking.children_recursive) if parking is not None else []
    if not objects or campus is None or parking not in campus.children_recursive:
        failures.append('Missing V3_Parking geometry under V3_Campus')
    slots = [o for o in objects if o.type == 'EMPTY' and
             'parkingSpaceId' in o and 'accessible' in o and not o.get('carRoot')]
    cars = [o for o in objects if o.type == 'EMPTY' and o.get('carRoot')]
    accessible_count = sum(bool(o.get('accessible')) for o in slots)
    if not 12 <= len(slots) <= 16:
        failures.append('Expected 12 to 16 visitor parking spaces; found ' + str(len(slots)))
    if accessible_count != 2:
        failures.append('Expected exactly two accessible parking spaces')
    if not 5 <= len(cars) <= 7:
        failures.append('Expected 5 to 7 parked vehicles; found ' + str(len(cars)))
    surfaces, aisles = [], []
    for obj in objects:
        if obj.type != 'MESH' or not obj.get('parkingSurface'):
            continue
        geometry = surface_tree(obj, depsgraph)
        if geometry is None:
            failures.append('Parking surface is empty: ' + obj.name)
            continue
        tree, footprint = geometry
        surfaces.append((obj.name, tree, footprint))
        if obj.get('parkingAisle'):
            aisles.append((obj.name, footprint))
    if not surfaces:
        failures.append('Missing modeled parking asphalt surfaces')
    if not aisles:
        failures.append('Missing modeled parking maneuver aisle')
    access = scene.objects.get('Front service road')
    access_geometry = surface_tree(access, depsgraph) if access is not None else None
    network = {name: footprint for name, _, footprint in surfaces}
    reached = set()
    if access_geometry is not None:
        network[access.name] = access_geometry[1]
        reached.add(access.name)
        pending = [access.name]
        while pending:
            current = pending.pop()
            for name, footprint in network.items():
                if name not in reached and pavement_connects(network[current], footprint):
                    reached.add(name)
                    pending.append(name)
    access_connected = bool(aisles) and all(name in reached for name, _ in aisles)
    if not access_connected:
        failures.append('Parking maneuver aisle lacks a continuous asphalt connection to Front service road')

    slot_reports, car_reports, contacts = [], [], []
    slot_bounds = {}
    for slot in slots:
        space_id = slot.get('parkingSpaceId')
        if not isinstance(space_id, str) or not space_id.strip() or space_id in slot_bounds:
            failures.append('Missing or duplicate parkingSpaceId: ' + slot.name)
            continue
        boundaries = [o for o in slot.children_recursive if o.type == 'MESH' and o.get('parkingBoundary')]
        if slot.get('boundaryObjectNames'):
            names = json.loads(slot['boundaryObjectNames'])
            boundaries = [scene.objects.get(name) for name in names]
            if any(o is None or o not in objects or o.type != 'MESH' or not o.get('parkingBoundary') for o in boundaries):
                failures.append('Invalid shared parking boundary reference: ' + slot.name)
                continue
        points = [point for boundary in boundaries for point in evaluated_points(boundary, depsgraph)]
        footprint = shared.bounds(points) if points else None
        slot_reports.append({'spaceId': space_id, 'accessible': bool(slot.get('accessible')),
                             'boundaryMeshCount': len(boundaries), 'worldBoundsMetres': footprint})
        if len(boundaries) < 3 or footprint is None:
            failures.append('Parking space lacks three physical boundary lines: ' + slot.name)
            continue
        slot_bounds[space_id] = footprint
        width, length = footprint[0][1] - footprint[0][0], footprint[1][1] - footprint[1][0]
        declared_width, declared_length = slot.get('widthMetres'), slot.get('lengthMetres')
        if not isinstance(declared_width, (int, float)) or abs(width - declared_width) > .12:
            failures.append('Parking space width disagrees with its real boundary: ' + slot.name)
        if not isinstance(declared_length, (int, float)) or abs(length - declared_length) > .12:
            failures.append('Parking space length disagrees with its real boundary: ' + slot.name)
        if not xy_contains(PARKING_REGION, footprint):
            failures.append('Parking space leaves the designated visitor area: ' + slot.name)
        if xy_overlaps(EMERGENCY_CORRIDOR, footprint):
            failures.append('Parking space intrudes into the emergency corridor: ' + slot.name)
        for aisle_name, aisle_bounds in aisles:
            # The physical 8 cm paint may straddle an asphalt edge. This small
            # tolerance does not permit a stall to occupy the maneuvering lane.
            if xy_overlaps(footprint, aisle_bounds, tolerance=.1):
                failures.append('Parking space occupies the maneuver aisle: ' + slot.name)
        if surfaces:
            start_z = max(s[2][2][1] for s in surfaces) + 1
            for x in footprint[0]:
                for y in footprint[1]:
                    if road_below(x, y, start_z, surfaces) is None:
                        failures.append('Parking boundary corner lacks asphalt below: ' + slot.name)
    slot_items = list(slot_bounds.items())
    for index, (space_id, footprint) in enumerate(slot_items):
        for other_id, other in slot_items[index + 1:]:
            if xy_overlaps(footprint, other, tolerance=.1):
                failures.append('Parking spaces overlap: ' + space_id + ' / ' + other_id)

    car_bounds = []
    occupied = set()
    for car in cars:
        space_id = car.get('parkingSpaceId')
        footprint = group_bounds(car, depsgraph)
        tyres = [o for o in car.children_recursive if o.type == 'MESH' and 'wheelRadius' in o]
        record = {'vehicle': car.name, 'spaceId': space_id, 'worldBoundsMetres': footprint,
                  'tyreCount': len(tyres)}
        car_reports.append(record)
        if space_id not in slot_bounds:
            failures.append('Vehicle is not assigned to a modeled space: ' + car.name)
        if space_id in occupied:
            failures.append('Multiple vehicles assigned to the same parking space: ' + str(space_id))
        occupied.add(space_id)
        if footprint is None:
            failures.append('Parking vehicle has no real geometry: ' + car.name)
            continue
        car_bounds.append((car.name, footprint))
        if space_id in slot_bounds and not xy_contains(slot_bounds[space_id], footprint):
            failures.append('Vehicle geometry extends outside its assigned space: ' + car.name)
        if not xy_contains(PARKING_REGION, footprint):
            failures.append('Vehicle leaves the designated visitor parking area: ' + car.name)
        if xy_overlaps(EMERGENCY_CORRIDOR, footprint):
            failures.append('Parked vehicle intrudes into the emergency corridor: ' + car.name)
        for aisle_name, aisle_bounds in aisles:
            if xy_overlaps(footprint, aisle_bounds):
                failures.append('Vehicle blocks the maneuver aisle: ' + car.name)
        if len(tyres) != 4:
            failures.append('Expected four modeled tyres per parked vehicle: ' + car.name)
        for tyre in tyres:
            if tyre.get('parkingSpaceId') != space_id:
                failures.append('Tyre parkingSpaceId differs from its vehicle: ' + tyre.name)
            points = evaluated_points(tyre, depsgraph)
            if not points:
                failures.append('Parking tyre geometry is empty: ' + tyre.name)
                continue
            box = shared.bounds(points)
            bottom = box[2][0]
            hit = road_below(sum(box[0]) / 2, sum(box[1]) / 2, bottom + 1, surfaces)
            contact = {'vehicle': car.name, 'tyre': tyre.name, 'bottomZ': bottom,
                       'surface': hit[1] if hit else None, 'gapMetres': bottom - hit[0] if hit else None}
            contacts.append(contact)
            if hit is None or abs(contact['gapMetres']) >= shared.WHEEL_TOLERANCE:
                failures.append('Parking tyre must be within 2 cm of actual asphalt: ' + tyre.name)
    for index, (name, footprint) in enumerate(car_bounds):
        for other_name, other in car_bounds[index + 1:]:
            if xy_overlaps(footprint, other):
                failures.append('Parked vehicle geometry bounds overlap: ' + name + ' / ' + other_name)
    return {
        'campusWorldTransformIdentity': identity, 'spaceCount': len(slots),
        'accessibleSpaceCount': accessible_count, 'parkedVehicleCount': len(cars),
        'parkingSurfaceCount': len(surfaces), 'maneuverAisles': [
            {'name': name, 'worldBoundsMetres': box} for name, box in aisles
        ],
        'maneuverAisleConnectedToFrontServiceRoad': access_connected,
        'connectedAsphaltObjects': sorted(reached),
        'visitorParkingRegionXYMetres': PARKING_REGION,
        'emergencyCorridorXYMetres': EMERGENCY_CORRIDOR,
        'spaces': slot_reports, 'vehicles': car_reports, 'wheelContacts': contacts,
        'wheelRoadToleranceMetres': shared.WHEEL_TOLERANCE,
        'largestWheelRoadGapMetres': max(
            (abs(c['gapMetres']) for c in contacts if c['gapMetres'] is not None), default=None
        ),
        'scope': 'World geometry bounds, actual asphalt hits and an unobstructed modeled aisle '
                 'connected to the front road by axis-aligned pavement bounds; '
                 'not an accessibility-code audit or traffic turning-path simulation.',
    }


def packed_resources(scene, failures):
    reference = bpy.data.images.get(scene.get('referenceImage', ''))
    if reference is None or not reference.packed_file or not reference.use_fake_user:
        failures.append('Reference image must remain packed with a fake user after reopening')
    images, fonts = [], []
    for image in bpy.data.images:
        if image.source == 'FILE':
            if image.packed_file:
                images.append(image.name)
            else:
                failures.append('External image dependency: ' + image.name)
    for font in bpy.data.fonts:
        if font.filepath and font.filepath != '<builtin>':
            if font.packed_file:
                fonts.append(font.name)
            else:
                failures.append('External font dependency: ' + font.name)
    return images, fonts


def hospital_routes(scene, failures):
    """Check actual driveway joins and ramp endpoints, without a code-compliance claim."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    names = ['Public boulevard', 'Front service road', 'Ambulance side lane',
             'V3 ambulance approach', 'V3 visitor entrance road',
             'V3 accessible entrance ramp', 'V3 ramp lower landing', 'Entrance platform']
    bounds_by_name = {}
    for name in names:
        obj = scene.objects.get(name)
        geometry = surface_tree(obj, depsgraph) if obj is not None else None
        if geometry is None:
            failures.append('Missing hospital circulation surface: ' + name)
        else:
            bounds_by_name[name] = geometry[1]
    links = {}
    for a, b in [('Public boulevard', 'V3 visitor entrance road'),
                 ('Front service road', 'V3 visitor entrance road'),
                 ('Public boulevard', 'V3 ambulance approach'),
                 ('V3 ambulance approach', 'Ambulance side lane')]:
        connected = a in bounds_by_name and b in bounds_by_name and pavement_connects(bounds_by_name[a], bounds_by_name[b])
        links[a+' -> '+b] = connected
        if not connected:
            failures.append('Road surfaces are disconnected: ' + a + ' / ' + b)
    ramp_report = {}
    ramp = scene.objects.get('V3 accessible entrance ramp')
    if ramp is not None and len(bounds_by_name) == len(names):
        tree, box = surface_tree(ramp, depsgraph)
        for label, x, target in [('upper', box[0][0]+.002, 'Entrance platform'),
                                  ('lower', box[0][1]-.002, 'V3 ramp lower landing')]:
            hit, _, _, _ = tree.ray_cast(Vector((x, sum(box[1])/2, 2)), Vector((0,0,-1)), 3)
            gap = hit.z-bounds_by_name[target][2][1] if hit is not None else None
            ramp_report[label+'HeightGapMetres'] = gap
            if gap is None or abs(gap) > .01:
                failures.append('Ramp endpoint height disagrees with its landing: ' + label)
        ramp_report['clearDeckWidthMetres'] = box[1][1]-box[1][0]
    return {'roadConnections': links, 'ramp': ramp_report,
            'scope': 'Modeled surface continuity only; no turning-path or statutory accessibility audit.'}


def source_geometry(scene, failures):
    meshes = [o for o in scene.objects if o.type == 'MESH']
    unique_vertices = 0
    for mesh in {o.data.as_pointer(): o.data for o in meshes}.values():
        positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get('co', positions)
        unique_vertices += len(mesh.vertices)
        if not np.isfinite(positions).all():
            failures.append('Non-finite source coordinates: ' + mesh.name)
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):
            failures.append('Non-finite source transform: ' + obj.name)
        if obj.type in shared.GEOMETRY_TYPES:
            if not obj.data.materials or any(mat is None for mat in obj.data.materials):
                failures.append('Missing or empty material slot: ' + obj.name)
    details = {}
    for prefix in ['V2 room back wall', 'V2 canopy laminated glass']:
        details[prefix] = sum(o.name.startswith(prefix) and o.type == 'MESH' and
                              len(o.data.polygons) > 0 for o in scene.objects)
        if not details[prefix]:
            failures.append('Missing retained architectural detail: ' + prefix)
    return len(meshes), unique_vertices, details


def final_renders(source_sha256, failures):
    dimensions, provenance = {}, {}
    for view in VIEWS:
        path = OUT / (view + '.png')
        if not path.is_file():
            failures.append('Missing final render: ' + view)
        else:
            image = None
            try:
                image = bpy.data.images.load(str(path), check_existing=False)
                dimensions[view] = list(image.size)
                minimum = 2560 if view == 'hero' else 1600
                if image.size[0] < minimum or image.size[1] < round(minimum * 9 / 16):
                    failures.append('Render is below delivery resolution: ' + view)
            except RuntimeError as error:
                failures.append('Unreadable final render ' + view + ': ' + str(error))
            finally:
                if image is not None:
                    bpy.data.images.remove(image)
        provenance[view] = shared.verify_render_provenance(
            view, dimensions.get(view), source_sha256, failures
        )
    return dimensions, provenance


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not SOURCE.is_file() or SOURCE.resolve() == V2.resolve():
        raise RuntimeError('A separate saved V3 source is required: ' + str(SOURCE))
    if not V2.is_file():
        raise RuntimeError('Preserved V2 reference source is required: ' + str(V2))
    v2_sha256 = shared.file_sha256(V2)
    configure_shared_helpers()
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    failures = []
    for name in REQUIRED:
        obj = scene.objects.get(name)
        if obj is None or not any(o.type in shared.GEOMETRY_TYPES for o in obj.children_recursive):
            failures.append('Missing or empty assembly: ' + name)
    if scene.render.engine != 'CYCLES' or scene.unit_settings.system != 'METRIC' or \
            not math.isclose(scene.unit_settings.scale_length, 1, abs_tol=1e-6):
        failures.append('Expected a Cycles scene using metric units')
    if not scene.world or not scene.world.use_nodes:
        failures.append('Missing lighting world')
    if not scene.camera or scene.camera.name != VIEWS['hero']:
        failures.append('Hero camera must be the saved default')
    for name in VIEWS.values():
        camera = scene.objects.get(name)
        if camera is None or camera.type != 'CAMERA':
            failures.append('Missing view camera: ' + name)
    camera_failures = []
    comparison_matches = shared.compare_camera(scene, camera_failures)
    failures.extend(failure.replace('V1', 'V2') for failure in camera_failures)
    images, fonts = packed_resources(scene, failures)
    mesh_count, vertex_count, details = source_geometry(scene, failures)
    geometry = shared.geometry_report(scene, failures)
    parking = parking_report(scene, failures)
    circulation = hospital_routes(scene, failures)
    source_sha256 = shared.file_sha256(SOURCE)
    dimensions, provenance = ({}, {}) if args.source_only else final_renders(source_sha256, failures)
    v2_unchanged = shared.file_sha256(V2) == v2_sha256
    if not v2_unchanged:
        failures.append('The preserved V2 reference changed during verification')
    report = {
        'source': str(SOURCE), 'blenderVersion': bpy.app.version_string,
        'sourceBytes': SOURCE.stat().st_size, 'sourceOnly': args.source_only,
        'sourceSha256': source_sha256, 'preservedV2Source': str(V2),
        'preservedV2Sha256': v2_sha256, 'v2UnchangedDuringVerification': v2_unchanged,
        'meshObjects': mesh_count, 'uniqueVertices': vertex_count,
        'comparisonCameraMatchesV2': comparison_matches, 'requiredAssemblies': REQUIRED,
        'packedImages': images, 'packedFonts': fonts, 'retainedArchitecturalDetailCounts': details,
        **geometry, 'parking': parking, 'hospitalCirculation': circulation, 'renderDimensions': dimensions,
        'renderProvenance': provenance, 'failures': failures,
        'scope': 'Reopened native scene, geometry, packed resources, V2 comparison camera, '
                 'ambulance and visitor parking clearance, actual tyre-to-pavement contacts, '
                 'and source-bound final PNGs. Visual checks remain necessary. '
                 'No surveyed dimensions, civil/accessible-parking compliance, '
                 'traffic swept-path simulation or web-runtime certification.',
    }
    filename = 'source-validation.json' if args.source_only else 'validation.json'
    (OUT / filename).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('HOSPITAL_V3_VALIDATION ' + json.dumps(report, ensure_ascii=False), flush=True)
    if failures:
        raise RuntimeError('; '.join(failures))


if __name__ == '__main__':
    main()
