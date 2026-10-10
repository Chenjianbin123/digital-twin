"""Build the editable reference-led double ward; never changes production URLs.

Blender 4.5: --background --threads 6 --python-exit-code 1
 --python scripts/build_ward_graphite_v1.py -- --width 1920 --samples 64
The reference is a design image, not surveyed geometry or a construction drawing.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ward_graphite_common as h
from ward_graphite_bed import build_bed
from ward_graphite_room import build_room
from ward_graphite_equipment import build_equipment
from ward_graphite_export import bake_contact_ao

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/ward-graphite-v1'
PUBLIC = ROOT / 'public/models/smart-ward-interior'
SLOTS = [(-1.45, 1.50, 0), (1.45, 1.50, 0)]
CAMERA = (-2.90, 6.60, 1.90)
TARGET = (-.05, 1.10, 1.15)


def clone_hierarchy(root, suffix):
    copies = {}
    for original in [root] + list(root.children_recursive):
        obj = original.copy(); obj.name = original.name + suffix
        bpy.context.collection.objects.link(obj); copies[original] = obj
    for original, obj in copies.items():
        obj.parent = copies.get(original.parent)
        obj.matrix_basis = original.matrix_basis.copy()
    return copies[root]


def preview_graphics():
    preview = h.empty('Preview_Graphics')
    preview['previewOnly'] = True
    for number, (x, y, _) in enumerate(SLOTS, 1):
        h.text('Preview_Bed_Number', f'{number:02d}床', (x - 1.04, y - 1.265, 2.03), .13, 'white', preview)
        sx, sy = x - .68, y - 1.298
        for offset, width, key in [(-.09, .10, 'cyan'), (.035, .11, 'silver'), (.135, .048, 'cyan')]:
            h.box('Preview_Terminal_Status', (sx + offset, sy + .003, 1.618), (width, .002, .06), key, .001, preview)
        for z in [1.565, 1.548]:
            h.box('Preview_Terminal_Line', (sx, sy + .003, z), (.30, .002, .006), 'silver', .001, preview)
    # The TV is a separate surface. Preview-only symbols never enter the runtime room asset.
    h.box('Preview_TV_Cross_H', (-3.030, 2.31, 1.98), (.003, .32, .11), 'cyan', .005, preview)
    h.box('Preview_TV_Cross_V', (-3.029, 2.31, 1.98), (.003, .11, .32), 'cyan', .005, preview)
    h.box('Preview_TV_Line', (-3.029, 2.31, 1.67), (.003, .94, .009), 'cyan', .002, preview)
    return preview


def scenery():
    root = h.empty('Preview_Exterior'); root['previewOnly'] = True
    h.material('sky', '#c4ddea', .9, emission=.6)
    h.material('building', '#9daeb7', .7)
    h.material('window', '#66869b', .34, .25)
    h.material('tree', '#66877a', .9)
    h.box('Preview_Sky', (22, 0, 7), (.1, 100, 50), 'sky', 0, root)
    for i in range(13):
        yy = -14 + i * 2.6
        height = 4.5 + (i * 1.71) % 4.1
        xx = 13 + (i % 3) * 1.4
        h.box('Preview_City_Block', (xx, yy, height/2 - 4), (1.7, 1.95, height), 'building', .025, root)
        for row in range(int(height/.48)):
            for col in range(4):
                h.box('Preview_City_Window', (xx - .858, yy - .72 + col * .47, -3.72 + row * .48),
                      (.005, .28, .24), 'window', 0, root)
    for i in range(16):
        h.sphere('Preview_Treetop', (7.6 + (i % 3) * .7, -10 + i * 1.5, -1.9 + (i % 4) * .18), (1.0, 1.1, .7), 'tree', root)
    return root


def lighting_and_camera(width, samples):
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Graphite ward neutral daylight')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.74, .82, .9, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .18
    daylight = h.area_light('Window daylight', (3.07, 2.25, 2.0), (-1.5, 1.8, .9), 200, 3.15, (.90, .96, 1), 1.9)
    daylight.visible_glossy = False
    for x in [-1.45, 1.45]:
        h.area_light('Ceiling neutral clinical light', (x, 1.85, 3.02), (x, 1.85, 0), 90, 1.35, (1, .98, .94), .70)
        h.area_light('Bed reading light', (x, .23, 1.99), (x, 1.3, .82), 11, .82, (1, .90, .75), .07)
    h.area_light('Door soft reflected fill', (-1.7, 4.4, 2.65), (0, .8, 1.0), 50, 3.4, (.97, .98, 1), 2)
    bpy.ops.object.camera_add(location=CAMERA)
    camera = bpy.context.object; camera.name = 'Reference_Hero_Camera'; camera.data.lens = 30
    h.aim(camera, TARGET); scene.camera = camera
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8; scene.cycles.transparent_max_bounces = 8
    scene.cycles.adaptive_threshold = .045
    scene.render.resolution_x = width; scene.render.resolution_y = round(width * 941 / 1672)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.filepath = str(OUT / 'ward-graphite-hero.png')
    return camera


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False); obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def consolidate(root):
    """Consolidate only the export copy; preserve dynamic surfaces and role parents."""
    geometry = [o for o in root.children_recursive if o.type in {'MESH', 'CURVE', 'FONT'}]
    select(geometry); bpy.ops.object.convert(target='MESH')
    protected = {'BedTerminalSurface', 'WardTVSurface'}
    roles = {'BedBody', 'BedsideCabinet', 'BedTerminal', 'IVStand', 'InfusionEquipment', '外壳', '灯'}
    groups = {}
    for obj in list(root.children_recursive):
        if obj.type != 'MESH' or obj.name in protected:
            continue
        parent = obj.parent
        while parent and parent != root and parent.name not in roles:
            parent = parent.parent
        groups.setdefault(parent or root, []).append(obj)
    for parent, objects in groups.items():
        select(objects)
        if len(objects) > 1:
            bpy.ops.object.join()
        obj = bpy.context.object
        world = obj.matrix_world.copy(); obj.parent = parent; obj.matrix_world = world
        obj.name = parent.name + '_Static'
    return [root] + list(root.children_recursive)


def export_asset(objects, path):
    select(objects)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=18, export_draco_normal_quantization=14,
        export_draco_texcoord_quantization=16)
    triangles = 0
    for obj in objects:
        if obj.type == 'MESH':
            evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
            mesh = evaluated.to_mesh(); mesh.calc_loop_triangles(); triangles += len(mesh.loop_triangles)
            evaluated.to_mesh_clear()
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'triangles': triangles}


def export_runtime(room, first, second, camera):
    room_objects = consolidate(room)
    # The source's second bed is only a visual instance; recreate it after consolidation.
    for obj in list(second.children_recursive) + [second]:
        bpy.data.objects.remove(obj, do_unlink=True)
    bed_objects = consolidate(first)
    ao = [bake_contact_ao(bpy.data.objects['BedBody_Static'], 1024, OUT, 'bed-contact-ao'),
          bake_contact_ao(bpy.data.objects['外壳_Static'], 2048, OUT, 'room-contact-ao')]
    second = clone_hierarchy(first, '_Instance02')
    second.location = SLOTS[1]
    bpy.context.view_layer.update()
    full = export_asset(room_objects + bed_objects + [second] + list(second.children_recursive), OUT / 'ward-graphite-scene-v1.glb')
    first.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bed = export_asset(bed_objects, PUBLIC / 'ward-graphite-bed-v1.glb')
    first.location = SLOTS[0]
    bpy.context.view_layer.update()
    shell = export_asset(room_objects, PUBLIC / 'ward-graphite-room-v1.glb')
    report = {'assetRevision': 'ward-graphite-v1', 'blenderVersion': bpy.app.version_string,
        'source': 'output/ward-graphite-v1/ward-graphite-v1.blend', 'reference': 'reference.png',
        'units': 'metres', 'surveyed': False, 'productionSceneReplaced': False,
        'referenceRoomSizeMetres': [6.4, 3.1, 4.6],
        'slots': [{'position': [x, z, -y], 'rotationY': 0} for x, y, z in SLOTS],
        'camera': {'position': [camera.location.x, camera.location.z, -camera.location.y],
                   'target': [TARGET[0], TARGET[2], -TARGET[1]], 'lensMm': camera.data.lens},
        'room': shell, 'bed': bed, 'assembledPreview': full, 'contactAO': ao,
        'bedHeadDirection': '+Z', 'bedFootDirection': '-Z', 'terminalPlane': 'local YZ',
        'terminalCanvasFlipY': False, 'livePatientData': False,
        'integrationNotes': 'Requires new slots/camera and a room expansion policy; old world-Z expansion is not compatible.'}
    (OUT / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'ward-graphite-v1-runtime.blend'))
    print('WARD_GRAPHITE_EXPORT ' + json.dumps(report, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=1920); parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--skip-render', action='store_true'); parser.add_argument('--skip-export', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    (OUT / 'textures').mkdir(parents=True, exist_ok=True); PUBLIC.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
    h.make_materials(OUT)
    room = h.empty('WardGraphiteRoomV1'); room['units'] = 'metres'; room['surveyed'] = False
    build_room(room)
    bed = h.empty('BedUnit'); bed['units'] = 'metres'; bed['assetRevision'] = 'ward-graphite-v1'
    build_bed(bed); build_equipment(bed)
    bed.location = SLOTS[0]
    other = clone_hierarchy(bed, '_Instance02'); other.location = SLOTS[1]
    preview_graphics(); scenery()
    camera = lighting_and_camera(args.width, args.samples)
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'ward-graphite-v1.blend'))
    print('WARD_GRAPHITE_EDITABLE_SAVED', flush=True)
    if not args.skip_render:
        bpy.ops.render.render(write_still=True)
        # A second real camera proves visible modelling detail without changing the hero.
        camera.location = (-3.05, 3.70, 1.38)
        h.aim(camera, (-1.42, 1.35, .69)); camera.data.lens = 31
        scene.render.filepath = str(OUT / 'ward-graphite-bed-detail.png')
        bpy.ops.render.render(write_still=True)
        camera.location = CAMERA; h.aim(camera, TARGET); camera.data.lens = 30
        scene.render.filepath = str(OUT / 'ward-graphite-hero.png')
    if not args.skip_export:
        export_runtime(room, bed, other, camera)


if __name__ == '__main__':
    main()
