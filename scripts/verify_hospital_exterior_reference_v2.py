"""Reopen and validate the delivered hospital exterior V2 native asset.

Run in Blender with ``--python-exit-code 1 --python <this file> --``.
Add ``--source-only`` before the final renders exist. This does not save the
opened source or modify V1; image fidelity still requires visual inspection.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/hospital-exterior-reference-v2'
SOURCE = OUT / 'hospital-exterior-reference-v2.blend'
V1 = ROOT / 'output/hospital-exterior-reference-v1/hospital-exterior-reference-v1.blend'
REQUIRED = [
    'HospitalExterior_Reference_V2', 'Hospital_Buildings',
    'Central_Inpatient_Tower', 'West_Wing', 'East_Wing', 'Outpatient_Podium',
    'Campus_Hardscape', 'Landscape_Planting', 'Ambulance', 'Background_Context',
]
VIEWS = {
    'hero': 'Reference_Hero_Camera',
    'entrance': 'Entrance_Detail_Camera',
    'facade': 'Facade_Detail_Camera',
    'comparison': 'V1_Comparison_Camera',
}
GEOMETRY_TYPES = {'MESH', 'CURVE', 'FONT', 'SURFACE'}
WHEEL_TOLERANCE = .02


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def verify_render_provenance(view, dimensions, source_sha256, failures):
    """Reject stale PNGs even when their names and dimensions look correct."""
    settings_path = OUT / (view + '-render-settings.json')
    image_path = OUT / (view + '.png')
    result = {'settingsFile': str(settings_path), 'valid': False}
    try:
        metadata = json.loads(settings_path.read_text(encoding='utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        failures.append('Missing or unreadable render provenance for ' + view + ': ' + str(error))
        return result
    if not isinstance(metadata, dict):
        failures.append('Render provenance must be a JSON object: ' + view)
        return result
    image_sha256 = file_sha256(image_path) if image_path.is_file() else None
    minimum_samples = 64 if view == 'hero' else 48
    checks = {
        'sourceMatches': metadata.get('sourceSha256') == source_sha256,
        'pngMatches': image_sha256 is not None and metadata.get('pngSha256') == image_sha256,
        'dimensionsMatch': dimensions is not None and
                           type(metadata.get('width')) is int and type(metadata.get('height')) is int and
                           [metadata['width'], metadata['height']] == list(dimensions),
        'samplesMeetMinimum': type(metadata.get('samples')) is int and metadata['samples'] >= minimum_samples,
        'denoisingRecorded': isinstance(metadata.get('denoising'), str) and bool(metadata['denoising'].strip()),
        'outputMatches': metadata.get('output') == image_path.name,
    }
    for check, passed in checks.items():
        if not passed:
            failures.append('Render provenance ' + check + ' failed: ' + view)
    result.update({
        'valid': all(checks.values()), 'checks': checks,
        'sourceSha256': metadata.get('sourceSha256'),
        'pngSha256': metadata.get('pngSha256'),
        'width': metadata.get('width'), 'height': metadata.get('height'),
        'samples': metadata.get('samples'), 'minimumSamples': minimum_samples,
        'denoising': metadata.get('denoising'),
    })
    return result


def bounds(points):
    return [(min(p[i] for p in points), max(p[i] for p in points)) for i in range(3)]


def compare_camera(scene, failures):
    """Link appended data before evaluating world matrices and then discard it."""
    comparison = scene.objects.get(VIEWS['comparison'])
    if not V1.is_file():
        failures.append('V1 source is missing')
        return False
    with bpy.data.libraries.load(str(V1), link=False) as (available, selected):
        if VIEWS['hero'] not in available.objects:
            failures.append('Persisted V1 hero camera is missing')
            return False
        selected.objects = [VIEWS['hero']]
    original = selected.objects[0]
    if original is None:
        failures.append('Could not append the persisted V1 camera')
        return False
    camera_data = original.data
    try:
        scene.collection.objects.link(original)
        bpy.context.view_layer.update()
        matches = bool(comparison and comparison.type == 'CAMERA')
        if matches:
            matches = all(
                abs(original.matrix_world[i][j] - comparison.matrix_world[i][j]) < 1e-5
                for i in range(4) for j in range(4)
            )
            matches = matches and all(
                abs(getattr(original.data, attr) - getattr(comparison.data, attr)) < 1e-5
                for attr in ['lens', 'sensor_width', 'sensor_height', 'shift_x', 'shift_y', 'ortho_scale']
            )
            matches = matches and all(
                getattr(original.data, attr) == getattr(comparison.data, attr)
                for attr in ['type', 'sensor_fit']
            )
        if not matches:
            failures.append('Comparison camera does not match the saved V1 transform and framing')
        return matches
    finally:
        bpy.data.objects.remove(original, do_unlink=True)
        if camera_data.users == 0:
            bpy.data.cameras.remove(camera_data)


def geometry_report(scene, failures):
    """Include render instances, modifiers and text, releasing every temp mesh."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    ambulance = scene.objects.get('Ambulance')
    ambulance_names = {o.name for o in ambulance.children_recursive} if ambulance else set()
    road_names = {'Front service road', 'Ambulance side lane'}
    triangles = 0
    rendered_geometry_count = 0
    ambulance_points, podium_points, tyres, road_trees = [], [], [], []
    for instance in depsgraph.object_instances:
        evaluated = instance.object
        if evaluated.type not in GEOMETRY_TYPES:
            continue
        mesh = evaluated.to_mesh()
        try:
            if mesh is None or not mesh.vertices:
                failures.append('Empty evaluated geometry: ' + evaluated.name)
                continue
            positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
            mesh.vertices.foreach_get('co', positions)
            if not np.isfinite(positions).all():
                failures.append('Non-finite evaluated coordinates: ' + evaluated.name)
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            rendered_geometry_count += 1
            matrix = instance.matrix_world
            if not all(math.isfinite(v) for row in matrix for v in row):
                failures.append('Non-finite instance transform: ' + evaluated.name)
            name = evaluated.original.name
            is_road = name in road_names or any(name.startswith(n + '.') for n in road_names)
            is_podium_footprint = name.startswith('V2 podium ceiling underside')
            if name in ambulance_names or is_podium_footprint or is_road:
                points = [matrix @ v.co for v in mesh.vertices]
                if name in ambulance_names:
                    ambulance_points.extend(points)
                    if name.startswith('Ambulance tyre'):
                        tyres.append((name, bounds(points)))
                if is_podium_footprint:
                    podium_points.extend(points)
                if is_road:
                    road_trees.append((name, BVHTree.FromPolygons(
                        points, [tuple(t.vertices) for t in mesh.loop_triangles], all_triangles=True
                    )))
        finally:
            evaluated.to_mesh_clear()

    ambulance_bounds = bounds(ambulance_points) if ambulance_points else None
    podium_bounds = bounds(podium_points) if podium_points else None
    outside_podium = False
    if ambulance_bounds and podium_bounds:
        # The podium is axis-aligned in this model. These are evaluated world
        # bounds, so moving only the empty or renaming a part cannot pass.
        outside_podium = any(
            ambulance_bounds[axis][1] < podium_bounds[axis][0] or
            ambulance_bounds[axis][0] > podium_bounds[axis][1]
            for axis in [0, 1]
        )
    if not outside_podium:
        failures.append('Ambulance geometry is missing or its XY bounds intersect the podium')
    if len(tyres) != 4:
        failures.append('Expected four evaluated ambulance tyres; found ' + str(len(tyres)))
    if not road_trees:
        failures.append('No drivable road mesh available for wheel contact checks')
    contacts = []
    for name, tyre_bounds in tyres:
        bottom = tyre_bounds[2][0]
        origin = Vector((sum(tyre_bounds[0]) / 2, sum(tyre_bounds[1]) / 2, bottom + 1.0))
        hits = []
        for road_name, tree in road_trees:
            position, normal, _, _ = tree.ray_cast(origin, Vector((0, 0, -1)), 10)
            if position is not None and normal.z > .5:
                hits.append((position.z, road_name))
        if not hits:
            failures.append('No road surface below ambulance tyre: ' + name)
            contacts.append({'tyre': name, 'bottomZ': bottom, 'road': None, 'gapMetres': None})
            continue
        road_z, road_name = max(hits)
        gap = bottom - road_z
        contacts.append({'tyre': name, 'bottomZ': bottom, 'road': road_name,
                         'roadZ': road_z, 'gapMetres': gap})
        if abs(gap) >= WHEEL_TOLERANCE:
            failures.append('Ambulance tyre is at least 2 cm from road surface: ' + name)
    return {
        'evaluatedTrianglesIncludingInstances': triangles,
        'evaluatedGeometryInstances': rendered_geometry_count,
        'ambulanceBoundsMetres': ambulance_bounds, 'podiumBoundsMetres': podium_bounds,
        'ambulanceOutsidePodium': outside_podium, 'wheelContacts': contacts,
        'wheelRoadToleranceMetres': WHEEL_TOLERANCE,
        'largestWheelRoadGapMetres': max(
            (abs(c['gapMetres']) for c in contacts if c['gapMetres'] is not None), default=None
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not SOURCE.is_file() or SOURCE.resolve() == V1.resolve():
        raise RuntimeError('A separate saved V2 source is required: ' + str(SOURCE))
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    bpy.context.view_layer.update()
    failures = []
    for name in REQUIRED:
        obj = scene.objects.get(name)
        if obj is None or not any(o.type in GEOMETRY_TYPES for o in obj.children_recursive):
            failures.append('Missing or empty assembly: ' + name)
    if scene.render.engine != 'CYCLES' or scene.unit_settings.system != 'METRIC':
        failures.append('Expected a Cycles scene using metric units')
    if not scene.world or not scene.world.use_nodes:
        failures.append('Missing lighting world')
    if not scene.camera or scene.camera.name != VIEWS['hero']:
        failures.append('Hero camera must be the saved default')
    for name in VIEWS.values():
        obj = scene.objects.get(name)
        if obj is None or obj.type != 'CAMERA':
            failures.append('Missing view camera: ' + name)
    comparison_matches = compare_camera(scene, failures)

    reference = bpy.data.images.get(scene.get('referenceImage', ''))
    if reference is None or not reference.packed_file or not reference.use_fake_user:
        failures.append('Reference image must remain packed with a fake user after reopening')
    packed_images = []
    for image in bpy.data.images:
        if image.source == 'FILE':
            if not image.packed_file:
                failures.append('External image dependency: ' + image.name)
            else:
                packed_images.append(image.name)
    packed_fonts = []
    for font in bpy.data.fonts:
        if font.filepath and font.filepath != '<builtin>':
            if not font.packed_file:
                failures.append('External font dependency: ' + font.name)
            else:
                packed_fonts.append(font.name)
    meshes = [o for o in scene.objects if o.type == 'MESH']
    unique_meshes = {o.data.as_pointer(): o.data for o in meshes}.values()
    unique_vertices = 0
    for mesh in unique_meshes:
        positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get('co', positions)
        unique_vertices += len(mesh.vertices)
        if not np.isfinite(positions).all():
            failures.append('Non-finite source coordinates: ' + mesh.name)
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):
            failures.append('Non-finite source transform: ' + obj.name)
        if obj.type in GEOMETRY_TYPES:
            if not obj.data.materials or any(mat is None for mat in obj.data.materials):
                failures.append('Missing or empty material slot: ' + obj.name)
    additions = {}
    for prefix in ['V2 room back wall', 'V2 canopy laminated glass']:
        additions[prefix] = sum(
            o.name.startswith(prefix) and o.type == 'MESH' and len(o.data.polygons) > 0
            for o in scene.objects
        )
        if not additions[prefix]:
            failures.append('Missing modeled V2 detail: ' + prefix)
    geometry = geometry_report(scene, failures)
    dimensions = {}
    render_provenance = {}
    source_sha256 = file_sha256(SOURCE) if not args.source_only else None
    if not args.source_only:
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
            render_provenance[view] = verify_render_provenance(
                view, dimensions.get(view), source_sha256, failures
            )
    report = {
        'source': str(SOURCE), 'blenderVersion': bpy.app.version_string,
        'sourceBytes': SOURCE.stat().st_size, 'sourceOnly': args.source_only,
        'meshObjects': len(meshes), 'uniqueVertices': unique_vertices,
        'comparisonCameraMatchesV1': comparison_matches,
        'packedImages': packed_images, 'packedFonts': packed_fonts,
        'requiredAssemblies': REQUIRED, 'v2DetailCounts': additions,
        **geometry, 'renderDimensions': dimensions, 'renderProvenance': render_provenance,
        'sourceSha256': source_sha256, 'failures': failures,
        'scope': 'Reopened native source, finite geometry, embedded assets, camera, '
                 'ambulance clearance, wheel contacts and source-bound PNG provenance. Visual fidelity requires '
                 'render inspection. No surveyed-dimension or web-runtime validation.',
    }
    filename = 'source-validation.json' if args.source_only else 'validation.json'
    (OUT / filename).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('HOSPITAL_V2_VALIDATION ' + json.dumps(report, ensure_ascii=False), flush=True)
    if failures:
        raise RuntimeError('; '.join(failures))


if __name__ == '__main__':
    main()
