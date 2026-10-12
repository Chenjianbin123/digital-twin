"""Reference-led refinement of the editable warm-v1 station. Never writes v1 assets."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ward_graphite_common as h
import nurse_warm_desk as desk_builder
import nurse_warm_architecture as architecture_builder
import build_nurse_station_warm_v1 as exporter
from nurse_warm_v2_architecture import refine_architecture
from nurse_warm_v2_details import refine_details
from nurse_warm_v2_materials import refine_materials

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/nurse-station-warm-v2'
SOURCE = ROOT / 'output/nurse-station-warm-v1/nurse-station-warm-v1.blend'
ASSET = ROOT / 'public/models/smart-ward-nurse-station/nurse-station-warm-v2.glb'
CAMERA = (-4.225, -3.945, 2.000)
TARGET = (-.524, 2.5, 1.693)
LENS = 29.445


def remove_objects(objects):
    # Only called on objects in the loaded working copy, never on a source file.
    for obj in list(objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def move(obj, x=0, y=0, z=0):
    obj.location += Vector((x, y, z))


def counter(root):
    old = bpy.data.objects['Desk']
    remove_objects(list(old.children_recursive) + [old])
    desk_builder._HALF_WIDTH = 2.3
    desk_builder._LEFT_RETURN = 3.7
    desk_builder._CORNER = .42
    desk_builder._OAK_START = -.35
    desk = desk_builder.build_desk(h, root)
    desk['referenceWidth'] = 4.6
    desk['referenceLeftReturn'] = 3.7
    desk['referenceCornerRadius'] = .42
    for obj in list(desk.children_recursive):
        if any(obj.name.startswith(prefix) for prefix in ('Desk_WhiteFascia_ExpansionJoint',
                'Desk_OakFascia_PanelJoint', 'Desk_Label_FineUnderline')):
            remove_objects([obj])
        elif obj.name.startswith(('Desk_LeftReturn_EndCap', 'Desk_Return_WorktopBracket', 'Desk_Return_BracketWallFoot')):
            move(obj, x=.5)
        elif obj.name.startswith('Desk_RightReturn_EndCap'):
            move(obj, x=-.5)
    h.box('Desk_WhiteFascia_QuietJoint', (-1.63, -.0008, .585), (.0016, .002, .84),
          'silver', bevel=.0004, parent=desk)
    for x in (.30, .96, 1.62):
        h.box('Desk_OakFascia_FineJoint', (x, -.0008, .585), (.0012, .002, .84),
              'oak', bevel=.0003, parent=desk)
    h.box('Desk_LongReturn_SupportBracket', (-1.89, 3.2, .693), (.558, .035, .028),
          'silver', bevel=.004, parent=desk)
    h.box('Desk_LongReturn_BracketWallFoot', (-2.163, 3.2, .624), (.030, .035, .155),
          'silver', bevel=.004, parent=desk)
    bold = bpy.data.fonts.load('C:/Windows/Fonts/msyhbd.ttc')
    bold.name = 'WarmStation_Signage_Bold'
    for name, size, z in [('Desk_Chinese_NurseStation', .224, .730),
                          ('Desk_English_NurseStation', .065, .548)]:
        obj = bpy.data.objects[name]
        obj.location.x = -1.04
        obj.location.z = z
        obj.data.size = size
        obj.data.font = bold
        obj.data.extrude = .0015
    for obj in desk.children_recursive:
        if obj.name == 'Desk_Continuous_WarmBaseDiffuser':
            for vertex in obj.data.vertices:
                vertex.co.z = .138 + (vertex.co.z - .136) * 2.4
            glow = h.M['lamp'].copy()
            glow.name = 'WarmStationV2_RecessedWarmLED'
            shader = glow.node_tree.nodes['Principled BSDF']
            shader.inputs['Emission Color'].default_value = (*h.linear('#ffe6b9'), 1)
            shader.inputs['Emission Strength'].default_value = 8
            obj.data.materials[0] = glow
    return desk


def layout(root, details):
    ratio = 4.6 / 5.6
    equipment = bpy.data.objects['Equipment']
    for obj in equipment.children:
        if obj.name.startswith(('Workstation_', 'Nursing_Chair_')):
            if obj.name.endswith('04'):
                move(obj, x=.5, y=.6)
            else:
                obj.location.x *= ratio
        elif obj.name in ('Transparent_FileRack', 'Paperwork_Stack', 'Hand_Sanitizer'):
            obj.location.x *= ratio
        elif obj.name == 'Background_ClinicalLowCabinet':
            # The left timber pier moves inward; maintain clearance in front of its new face.
            move(obj, y=1.22)
        elif obj.name == 'Wall_DisplayAssembly':
            move(obj, y=1.3)
        elif obj.name == 'Clinical_SupplyCart':
            move(obj, x=-.3, y=1.0)
    for obj in bpy.data.objects['Foliage'].children:
        if obj.name == 'Counter_LivePlant':
            move(obj, x=.5, y=.6)
        elif obj.name.startswith('Background_Plant_'):
            move(obj, y=1.22)
    # Added table objects retain device proportions: translate anchors, do not squash meshes.
    for item in details['movableGroups']:
        obj = bpy.data.objects[item] if isinstance(item, str) else item
        if obj.get('physicalRegion') == 'left-return':
            move(obj, x=.5, y=.65)
        else:
            obj.location.x *= ratio
    for obj in list(bpy.data.objects['Architecture'].children_recursive):
        if obj.name.startswith('Station_Background'):
            move(obj, y=1.3)
            if obj.name.startswith(('Station_BackgroundWall', 'Station_BackgroundSkirting')):
                obj.scale.x *= 3.2 / 3.7
                move(obj, x=.25)
            elif obj.name.startswith('Station_BackgroundOakPier') and obj.location.x < 0:
                move(obj, x=.5)
    # The ring follows the deeper, narrower counter while remaining a true rounded rectangle.
    ceiling = bpy.data.objects['Ceiling']
    remove_objects([obj for obj in ceiling.children_recursive
                    if obj.name.startswith(('Station_Ceiling_RoundedSoffit', 'Station_Ceiling_ContinuousLight'))])
    outer = architecture_builder._rounded_rectangle(5.40, 4.9, .57, 2.0, 20)
    inner = architecture_builder._rounded_rectangle(5.10, 4.6, .42, 2.0, 20)
    count = len(outer)
    vertices = [(x, y, z) for z in (3.025, 3.113) for path in (outer, inner) for x, y in path]
    faces = []
    for i in range(count):
        j = (i + 1) % count
        faces.extend([(i, count+i, count+j, j),
                      (2*count+i, 2*count+j, 3*count+j, 3*count+i),
                      (i, j, 2*count+j, 2*count+i),
                      (count+i, 3*count+i, 3*count+j, count+j)])
    desk_builder._edge_finish(h.mesh('Station_Ceiling_RefinedFloatingRing', vertices, faces,
                                    'white', parent=ceiling), .004)
    trace = architecture_builder._rounded_rectangle(5.23, 4.73, .485, 2.0, 24)
    h.tube('Station_Ceiling_ContinuousLight_V2', [(x, y, 3.017) for x, y in trace],
           .010, 'lamp', parent=ceiling, cyclic=True)
    # The reference sign hangs at the front of the canopy, not deep inside the work bay.
    sign = bpy.data.objects['NurseStation_HangingSign']
    pivot = Vector((.66, 1.12, 2.63))
    for obj in sign.children:
        if obj.name.startswith(('Sign_SuspensionRod', 'Sign_CeilingRosette')):
            continue
        if obj.type == 'MESH':
            obj.data.transform(obj.matrix_basis)
            obj.location = (0, 0, 0)
            obj.rotation_euler = (0, 0, 0)
            obj.scale = (1, 1, 1)
            for vertex in obj.data.vertices:
                vertex.co = pivot + (vertex.co - pivot) * .98
        else:
            obj.location = pivot + (obj.location - pivot) * .98
            obj.scale *= .98
    move(sign, x=-1.35, y=-1.45, z=.16)
    for obj in sign.children:
        if obj.name.startswith('Sign_SuspensionRod'):
            obj.location.z = 2.872
            obj.dimensions.z = .196
        elif obj.name.startswith('Sign_CeilingRosette'):
            obj.location.z = 2.971
        if obj.name.startswith('Sign_Chinese'):
            obj.data.font = bpy.data.fonts['WarmStation_Signage_Bold']


def lighting(width, samples):
    scene = bpy.context.scene
    remove_objects([obj for obj in bpy.data.objects if obj.type == 'LIGHT'])
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.73, .80, .88, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .18
    h.area_light('V2_EntranceDaylight', (-2, -3, 2.8), (0, 1.8, .7), 235, 5.5, (.94, .97, 1), 2.4)
    h.area_light('V2_LeftDaylight', (-5.35, 1.5, 2.2), (0, 3, .8), 140, 2.6, (.85, .92, 1), 2.0)
    for x in (-1.1, 1.1):
        h.area_light('V2_DeskLight', (x, 1.7, 3.03), (x, 1.7, 0), 95, 1.1, (.96, .98, 1), .5)
    for y in (.8, 4.15, 7.5, 10.85, 14.2, 17.55, 20.9):
        for x in (-4.29, 3.52):
            light = h.area_light('V2_CeilingPanel', (x, y, 3.06), (x, y, 0), 42, .67, (.94, .98, 1), .35)
            light.visible_glossy = True
    h.area_light('V2_WindowDaylight', (-4.3, 21.7, 1.9), (-4.3, 10, 1.3), 400, 2.55, (.80, .91, 1), 2.1)
    for x in (-1.55, -.15, 1.25):
        h.area_light('V2_BaseWarmWash', (x, -.035, .14), (x, -.32, 0), 7, 1.30, (1, .84, .60), .025)
    for y in (.8, 2.1, 3.3):
        h.area_light('V2_ReturnWarmWash', (-2.335, y, .14), (-2.7, y, 0), 5, .025, (1, .84, .60), 1.15)
    camera = scene.camera
    camera.location = CAMERA
    h.aim(camera, TARGET)
    camera.data.lens = LENS
    scene.render.resolution_x = width
    scene.render.resolution_y = round(width * 324 / 480)
    scene.cycles.samples = samples
    scene.cycles.adaptive_threshold = .02
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.view_settings.exposure = 0
    scene.render.filepath = str(OUT / 'nurse-station-warm-v2-hero.png')
    return camera


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--skip-render', action='store_true')
    parser.add_argument('--skip-export', action='store_true')
    parser.add_argument('--alternate-camera', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 256 <= args.width <= 4096 or not 1 <= args.samples <= 512:
        parser.error('width 256..4096; samples 1..512')
    (OUT / 'textures').mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    h.M.clear()
    for mat in bpy.data.materials:
        if mat.name.startswith('WarmStationV1_'):
            h.M[mat.name.removeprefix('WarmStationV1_')] = mat
    root = bpy.data.objects['NurseStationWarmV1']
    root.name = 'NurseStationWarmV2'
    root['assetRevision'] = 'warm-v2'
    root['referenceReconstruction'] = 'single-image visual reconstruction; not a surveyed hospital'
    print('WARM_V2_ARCHITECTURE', flush=True)
    architecture = refine_architecture(h, root)
    print('WARM_V2_FURNISHINGS', flush=True)
    details = refine_details(h, root)
    print('WARM_V2_COUNTER_AND_LAYOUT', flush=True)
    counter(root)
    layout(root, details)
    print('WARM_V2_MATERIALS', flush=True)
    materials = refine_materials(h, root, OUT)
    architecture_report = {key: value.name if isinstance(value, bpy.types.Object) else value
                           for key, value in architecture.items()}
    exporter.align_surface_grain(root)
    camera = lighting(args.width, args.samples)
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'nurse-station-warm-v2.blend'))
    print('WARM_V2_EDITABLE_SAVED', flush=True)
    if not args.skip_render:
        bpy.ops.render.render(write_still=True)
        if args.alternate_camera:
            camera.location = (-5.58, -4.137, 1.60)
            h.aim(camera, (-.3, 2.5, 1.751))
            camera.data.lens = 35.92
            bpy.context.scene.render.filepath = str(OUT / 'nurse-station-warm-v2-camera-b.png')
            bpy.ops.render.render(write_still=True)
            camera.location = CAMERA
            h.aim(camera, TARGET)
            camera.data.lens = LENS
    if not args.skip_export:
        exporter.OUT, exporter.ASSET, exporter.TARGET = OUT, ASSET, TARGET
        exporter.export_runtime(root, camera)
        manifest_path = OUT / 'manifest.json'
        report = json.loads(manifest_path.read_text(encoding='utf-8'))
        report.update({'assetRevision': 'warm-v2', 'source': str(SOURCE.relative_to(ROOT)),
                       'architectureRefinement': architecture_report, 'detailRefinement': details,
                       'materialsRefinement': materials})
        manifest_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
