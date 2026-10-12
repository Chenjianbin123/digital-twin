"""Reopen the delivered V2 .blend and verify geometry, dependencies and renders."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from refine_operating_room_reference_v2 import OUT, SOURCE, V1, VIEWS


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-only', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene = bpy.context.scene
    failures = []
    required = ['OperatingRoom_Reference_V2', 'Room_Shell', 'Integrated_Wall_Equipment',
                'Operating_Table', 'Dual_Surgical_Lights', 'Anesthesia_Workstation',
                'Equipment_Pendant', 'Dual_Monitor_Arm', 'Foreground_Instrument_Cart']
    for name in required:
        obj = scene.objects.get(name)
        if obj is None or not obj.children_recursive:
            failures.append('Missing or empty assembly: '+name)
    if not V1.is_file() or SOURCE.resolve() == V1.resolve():
        failures.append('V1 source must be preserved separately')
    if scene.render.engine != 'CYCLES' or scene.unit_settings.system != 'METRIC':
        failures.append('Expected Cycles rendering with metric units')
    if scene.camera is None or scene.camera.name != VIEWS['hero'][0]:
        failures.append('Hero camera must be the saved default')
    for view, (name, _, _, _) in VIEWS.items():
        if not scene.objects.get(name) or scene.objects[name].type != 'CAMERA':
            failures.append('Missing view camera: '+view)
    with bpy.data.libraries.load(str(V1), link=False) as (available, selected):
        selected.objects = ['Reference_Hero_Camera']
    original_camera = selected.objects[0]
    if original_camera:
        scene.collection.objects.link(original_camera)
        bpy.context.view_layer.update()
    comparison = scene.objects.get(VIEWS['comparison'][0])
    comparison_matches = bool(original_camera and comparison) and all(
        abs(original_camera.matrix_world[i][j]-comparison.matrix_world[i][j]) < 1e-5
        for i in range(4) for j in range(4)) and abs(original_camera.data.lens-comparison.data.lens) < 1e-5
    if not comparison_matches:
        failures.append('Comparison camera does not match the persisted V1 camera')
    if original_camera:
        bpy.data.objects.remove(original_camera, do_unlink=True)
    reference = bpy.data.images.get(scene.get('referenceImage', ''))
    if reference is None or not reference.packed_file or not reference.use_fake_user:
        failures.append('Reference image must stay embedded after reopening')
    packed_images = []
    for img in bpy.data.images:
        if img.source == 'FILE':
            if not img.packed_file:
                failures.append('External image dependency: '+img.name)
            else:
                packed_images.append(img.name)
    for font in bpy.data.fonts:
        if font.filepath and font.filepath != '<builtin>' and not font.packed_file:
            failures.append('External font dependency: '+font.name)
    meshes = [o for o in scene.objects if o.type == 'MESH']
    unique_meshes = {o.data.as_pointer(): o.data for o in meshes}.values()
    for mesh in unique_meshes:
        positions = np.empty(len(mesh.vertices)*3, dtype=np.float32)
        mesh.vertices.foreach_get('co', positions)
        if not np.isfinite(positions).all():
            failures.append('Non-finite mesh coordinates: '+mesh.name)
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):
            failures.append('Non-finite transform: '+obj.name)
        if obj.type in {'MESH', 'CURVE', 'FONT'} and not obj.data.materials:
            failures.append('Missing material: '+obj.name)
    heads = [o for o in meshes if o.name.startswith('Parabolic LED reflector')]
    if len(heads) != 132:
        failures.append('Expected 66 separate reflectors per surgical light')
    pads = [o for o in meshes if 'contoured upholstery' in o.name]
    if len(pads) != 5 or any(not all(p.use_smooth for p in o.data.polygons) for o in pads):
        failures.append('Expected five smooth contoured upholstery sections')
    triangles = 0
    contacts = []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in scene.objects:
        if obj.type not in {'MESH', 'CURVE', 'FONT'}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
        if obj.name.startswith('Non marking tyre'):
            lowest = min((evaluated.matrix_world@v.co).z for v in mesh.vertices)
            contacts.append(lowest)
            if abs(lowest) > .002:
                failures.append('Wheel misses floor by more than 2 mm: '+obj.name)
        evaluated.to_mesh_clear()
    dimensions = {}
    if not args.source_only:
        for view in ['hero', 'bed', 'lights', 'anesthesia', 'comparison']:
            path = OUT/(view+'.png')
            if not path.is_file():
                failures.append('Missing final render: '+view)
                continue
            img = bpy.data.images.load(str(path), check_existing=False)
            dimensions[view] = list(img.size)
            minimum = 2560 if view == 'hero' else 1600
            if img.size[0] < minimum:
                failures.append('Render below delivery resolution: '+view)
            bpy.data.images.remove(img)
    report = {
        'source': str(SOURCE), 'blenderVersion': bpy.app.version_string,
        'sourceBytes': SOURCE.stat().st_size, 'meshObjects': len(meshes),
        'comparisonCameraMatchesV1': comparison_matches,
        'evaluatedTriangles': triangles, 'individualOpticalReflectors': len(heads),
        'contouredCushions': len(pads), 'wheelContactCount': len(contacts),
        'wheelFloorToleranceMetres': .002,
        'largestWheelFloorGapMetres': max(abs(v) for v in contacts) if contacts else None,
        'packedImages': packed_images, 'requiredAssemblies': required,
        'renderDimensions': dimensions, 'failures': failures,
        'scope': 'Reopened native source, finite geometry, materials, embedded assets, camera and floor contacts. Visual fidelity requires render inspection. No web-runtime validation.',
    }
    filename = 'source-validation.json' if args.source_only else 'validation.json'
    (OUT/filename).write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    print('V2_VALIDATION '+json.dumps(report, ensure_ascii=False), flush=True)
    if failures:
        raise RuntimeError('; '.join(failures))


if __name__ == '__main__':
    main()
