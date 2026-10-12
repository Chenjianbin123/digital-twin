"""Export real Blender geometry for hospital navigation, without saving the masters.

Consolidate static meshes by material and interaction role. Retain evaluated edge
normals, UVs and text geometry; lower bevel tessellation only in this export copy.
"""
import argparse
import gc
import hashlib
import json
import math
import shutil
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public/models/hospital-navigation'
OUT = ROOT / 'output/hospital-navigation-3d'
CLINICAL_BUILDINGS = {'Central_Inpatient_Tower', 'West_Wing', 'East_Wing', 'Outpatient_Podium'}


def yup(v):
    return [float(v[0]), float(v[2]), -float(v[1])]


def floor_targets(scene):
    """Spatial click ranges from source windows, independent of clinical IDs."""
    result = []
    for building in sorted(CLINICAL_BUILDINGS):
        windows, front = [], []
        for obj in scene.objects:
            lineage = ancestors(obj)
            if building not in lineage or obj.hide_render:
                continue
            if obj.name.startswith(('Window insulated glazing', 'Podium storefront', 'Podium side glazing')):
                corners = [obj.matrix_world @ Vector(point) for point in obj.bound_box]
                windows.extend(corners)
                facade = 'East facade' if building == 'East_Wing' else 'South facade'
                if any(facade in name for name in lineage) or obj.name.startswith('Podium storefront'):
                    front.append(obj.matrix_world.translation.copy())
        rows = sorted({round(point.z, 3) for point in front})
        if len(rows) < 2:
            raise RuntimeError('Missing floor glazing: ' + building)
        pitch = float(np.median(np.diff(rows)))
        low, high = np.min(windows, axis=0), np.max(windows, axis=0)
        center_x = (low[0] + high[0]) / 2
        for z in rows:
            # An actual visible window supplies the click point; avoid testing an
            # empty volume, a roof, or a sign instead of the building facade.
            anchor = min((point for point in front if abs(point.z - z) < .01),
                         key=lambda point: abs(point.y - (low[1] + high[1]) / 2) if building == 'East_Wing' else abs(point.x - center_x)).copy()
            if building == 'East_Wing':
                anchor.x += .05
            else:
                anchor.y -= .05
            # Upper panes remain visible above the terrace planting.
            anchor.z += .85 if building != 'Outpatient_Podium' else .6
            result.append({'building': building, 'anchor': yup(anchor),
                           'bounds': [yup((low[0] - 1.5, high[1] + .6, z - pitch * .56)),
                                      yup((high[0] + 1.5, low[1] - .6, z + pitch * .44))]})
    return result


def ancestors(obj):
    result = []
    while obj:
        result.append(obj.name)
        obj = obj.parent
    return result


def main(kind):
    source = ROOT / ('output/hospital-floor-reference-v4/hospital-floor-reference-v4.blend' if kind == 'floor'
                     else 'output/hospital-exterior-reference-v3/hospital-exterior-reference-v3.blend')
    original_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    if kind == 'floor':
        bpy.context.window.scene = bpy.data.scenes['Floor_Light']
    scene = bpy.context.scene
    targets = floor_targets(scene) if kind == 'exterior' else []
    camera = bpy.data.objects['Floor_Overview_Camera' if kind == 'floor' else 'Reference_Hero_Camera']
    camera_position = list(camera.matrix_world.translation)
    direction = camera.matrix_world.to_quaternion() @ Vector((0, 0, 1))
    horizontal_fov = math.degrees(2 * math.atan(camera.data.sensor_width / (2 * camera.data.lens)))
    daylight = None
    if kind == 'exterior':
        environment = next(node.image for node in scene.world.node_tree.nodes if node.type == 'TEX_ENVIRONMENT')
        daylight = bytes(environment.packed_file.data) if environment.packed_file else Path(bpy.path.abspath(environment.filepath)).read_bytes()
    anchor = (bpy.data.objects['NurseStation_ClickAnchor'].matrix_world.translation.copy()
              if kind == 'floor' else Vector((0, 0, 0)))
    meshes = []
    for obj in scene.objects:
        if obj.type not in {'MESH', 'FONT', 'CURVE'} or obj.hide_render:
            continue
        lineage = ancestors(obj)
        for modifier in obj.modifiers:
            if modifier.type == 'BEVEL':
                modifier.segments = min(modifier.segments, 1 if kind == 'exterior' else 2)
        if kind == 'exterior' and obj.type == 'MESH' and len(obj.data.polygons) > 150:
            if any(token in obj.name.lower() for token in ('leaf', 'leaves', 'planting', 'shrub', 'crown')):
                simplify = obj.modifiers.new('Web foliage density', 'DECIMATE')
                simplify.ratio = .28
        if obj.type in {'FONT', 'CURVE'}:
            obj.data.resolution_u = min(obj.data.resolution_u, 4)
            obj.data.bevel_resolution = min(obj.data.bevel_resolution, 1)
        meshes.append((obj, lineage))
    graph = bpy.context.evaluated_depsgraph_get()
    groups = {}
    source_triangles = 0
    background_triangles = 0
    focus_points = []
    interaction_points = []
    for number, (obj, lineage) in enumerate(meshes):
        evaluated = obj.evaluated_get(graph)
        mesh = evaluated.to_mesh(preserve_all_data_layers=True, depsgraph=graph)
        if not mesh or not mesh.polygons:
            evaluated.to_mesh_clear()
            continue
        mesh.calc_loop_triangles()
        vertex = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get('co', vertex)
        matrix = np.array(evaluated.matrix_world, dtype=np.float32)
        vertex = vertex.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        triangles = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
        mesh.loop_triangles.foreach_get('vertices', triangles)
        triangles = triangles.reshape(-1, 3)
        loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
        mesh.loop_triangles.foreach_get('loops', loops)
        corner_normals = np.empty(len(mesh.corner_normals) * 3, dtype=np.float32)
        mesh.corner_normals.foreach_get('vector', corner_normals)
        normals = corner_normals.reshape(-1, 3)[loops].reshape(-1, 3, 3)
        normal_matrix = np.linalg.inv(matrix[:3, :3]).T
        normals = normals @ normal_matrix.T
        normals /= np.maximum(np.linalg.norm(normals, axis=2, keepdims=True), 1e-9)
        uv = np.zeros((len(triangles), 3, 2), dtype=np.float32)
        if mesh.uv_layers.active:
            raw_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
            mesh.uv_layers.active.data.foreach_get('uv', raw_uv)
            uv = raw_uv.reshape(-1, 2)[loops].reshape(-1, 3, 2)
        if np.linalg.det(matrix[:3, :3]) < 0:
            triangles = triangles[:, ::-1]
            normals = normals[:, ::-1]
            uv = uv[:, ::-1]
        edges = vertex[triangles[:, 1]] - vertex[triangles[:, 0]]
        cross = np.cross(edges, vertex[triangles[:, 2]] - vertex[triangles[:, 0]])
        valid = np.linalg.norm(cross, axis=1) > 1e-12
        valid &= np.isfinite(normals).all(axis=(1, 2))
        role = 'context' if 'Background_Context' in lineage else 'static'
        low, high = vertex.min(axis=0), vertex.max(axis=0)
        if kind == 'floor' and any(n in {'Central_Nurse_Station', 'NurseStation_Navigation'} for n in lineage):
            role = 'nurse-station'
        if kind == 'exterior' and CLINICAL_BUILDINGS.intersection(lineage):
            role = 'floor'
        if role in {'floor', 'nurse-station'}:
            interaction_points.extend([low, high])
        if kind == 'floor' or any(n in {'Central_Inpatient_Tower', 'West_Wing', 'East_Wing',
                                        'Outpatient_Podium', 'V3_Parking', 'V3_Hospital_Forecourt'} for n in lineage):
            focus_points.extend([low, high])
        slots = np.empty(len(mesh.loop_triangles), dtype=np.int32)
        mesh.loop_triangles.foreach_get('material_index', slots)
        for slot in np.unique(slots):
            material = mesh.materials[int(slot)] if len(mesh.materials) > int(slot) else None
            name = material.name if material else 'Default'
            # Evaluated meshes reference evaluated material IDs. Keep the
            # original datablock alive after releasing the dependency graph.
            material = bpy.data.materials.get(name) if material else None
            mask = (slots == slot) & valid
            if not np.any(mask):
                continue
            group = groups.setdefault((role, name), {'vertices': [], 'triangles': [], 'normals': [], 'uv': [], 'count': 0, 'material': material})
            group['vertices'].append(vertex)
            group['triangles'].append(triangles[mask] + group['count'])
            group['normals'].append(normals[mask].reshape(-1, 3))
            group['uv'].append(uv[mask].reshape(-1, 2))
            group['count'] += len(vertex)
        source_triangles += int(valid.sum())
        if role == 'context':
            background_triangles += int(valid.sum())
        evaluated.to_mesh_clear()
        if number % 1000 == 0:
            print('COLLECT', kind, number, '/', len(meshes), 'triangles', source_triangles, flush=True)
    if not focus_points or not interaction_points:
        raise RuntimeError('Required model or navigation geometry is missing')

    runtime_scene = bpy.data.scenes.new('HospitalNavigation_Runtime')
    bpy.context.window.scene = runtime_scene
    # The native scene is only a source. Free its evaluated geometry before
    # constructing the web scene, and export exactly one scene instead of
    # carrying selected objects from the master's other view layers into GLB.
    meshes.clear()
    del graph, evaluated, mesh
    for data in groups.values():
        if data['material']:
            data['material'].use_fake_user = True
    for old_scene in list(bpy.data.scenes):
        if old_scene != runtime_scene:
            bpy.data.scenes.remove(old_scene)
    for original in list(bpy.data.objects):
        bpy.data.objects.remove(original, do_unlink=True)
    for original_mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(original_mesh)
    for original_curve in list(bpy.data.curves):
        bpy.data.curves.remove(original_curve)
    gc.collect()
    root = bpy.data.objects.new('HospitalExteriorV3' if kind == 'exterior' else 'HospitalFloorV4', None)
    runtime_scene.collection.objects.link(root)
    root['sourceSha256'] = original_hash
    root['realGeometry'] = True
    root['surveyed'] = False
    runtime = [root]
    for (role, name), data in groups.items():
        vertices = np.concatenate(data['vertices'])
        faces = np.concatenate(data['triangles'])
        normals = np.concatenate(data['normals'])
        uv = np.concatenate(data['uv'])
        mesh = bpy.data.meshes.new(role + '_' + name)
        mesh.vertices.add(len(vertices))
        mesh.vertices.foreach_set('co', vertices.ravel())
        mesh.loops.add(faces.size)
        mesh.loops.foreach_set('vertex_index', faces.ravel())
        mesh.polygons.add(len(faces))
        mesh.polygons.foreach_set('loop_start', np.arange(0, faces.size, 3, dtype=np.int32))
        mesh.polygons.foreach_set('loop_total', np.full(len(faces), 3, dtype=np.int32))
        mesh.polygons.foreach_set('use_smooth', np.ones(len(faces), dtype=bool))
        mesh.update()
        print('NORMALS', role, name, len(faces), flush=True)
        mesh.normals_split_custom_set(normals.tolist())
        mesh.uv_layers.new(name='UVMap').data.foreach_set('uv', uv.ravel())
        if data['material']:
            mesh.materials.append(data['material'])
        obj = bpy.data.objects.new(role + '_' + name, mesh)
        obj.parent = root
        if role in {'floor', 'nurse-station'}:
            obj['targetScene'] = role
        if role == 'context':
            obj['backgroundContext'] = True
        runtime_scene.collection.objects.link(obj)
        runtime.append(obj)
        print('MERGED', obj.name, len(faces), flush=True)
        data['vertices'].clear()
        data['triangles'].clear()
        data['normals'].clear()
        data['uv'].clear()
        del vertices, faces, normals, uv
    low = np.min(focus_points, axis=0).tolist()
    high = np.max(focus_points, axis=0).tolist()
    nav_low = np.min(interaction_points, axis=0).tolist()
    nav_high = np.max(interaction_points, axis=0).tolist()
    if kind == 'exterior':
        point = next(target['anchor'] for target in targets if target['building'] == 'Central_Inpatient_Tower')
        anchor = Vector((point[0], -point[2], point[1]))
    node = bpy.data.objects.new('NavigationAnchor', None)
    node.location = anchor
    node.parent = root
    node['targetScene'] = 'floor' if kind == 'exterior' else 'nurse-station'
    runtime_scene.collection.objects.link(node)
    runtime.append(node)
    for obj in runtime:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = runtime[1]
    PUBLIC.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    if daylight:
        (PUBLIC / 'hospital-daylight.exr').write_bytes(daylight)
        shutil.copy2(source.parent / 'environment-license.txt', PUBLIC / 'hospital-daylight-license.txt')
    asset = PUBLIC / ('hospital-exterior-v3.glb' if kind == 'exterior' else 'hospital-floor-v4.glb')
    print('EXPORTING', str(asset), flush=True)
    bpy.ops.export_scene.gltf(filepath=str(asset), export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6, export_draco_position_quantization=18,
        export_draco_normal_quantization=14, export_draco_texcoord_quantization=14)
    metadata = {'source': str(source.relative_to(ROOT)), 'sourceSha256': original_hash,
                'asset': asset.name, 'triangles': source_triangles, 'drawMeshes': len(groups),
                'bytes': asset.stat().st_size, 'cameraPosition': yup(camera_position), 'cameraDirection': yup(direction),
                'focusBounds': [yup([low[0], high[1], low[2]]), yup([high[0], low[1], high[2]])],
                'navigationBounds': [yup([nav_low[0], nav_high[1], nav_low[2]]), yup([nav_high[0], nav_low[1], nav_high[2]])],
                'anchor': yup(anchor), 'skippedBackgroundObjects': 0,
                'backgroundTriangles': background_triangles,
                'backgroundMeshes': sum(role == 'context' for role, name in groups),
                'rooms': 8 if kind == 'floor' else None, 'beds': 16 if kind == 'floor' else None,
                'originalPreserved': hashlib.sha256(source.read_bytes()).hexdigest() == original_hash}
    if kind == 'exterior':
        metadata.update(cameraTarget=yup((-2, -24, 15)), cameraHorizontalFov=horizontal_fov,
                        floorTargets=targets,
                        environmentAsset='hospital-daylight.exr', environmentSha256=hashlib.sha256(daylight).hexdigest())
    if not metadata['originalPreserved']:
        raise RuntimeError('Native source changed')
    (PUBLIC / (kind + '-3d.json')).write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')
    print('EXPORTED', json.dumps(metadata), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('kind', choices=['exterior', 'floor'])
    main(parser.parse_args(sys.argv[sys.argv.index('--') + 1:]).kind)
