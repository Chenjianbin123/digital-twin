"""Small, reference-led corrections to the editable warm-v2 asset.

Writes only warm-v3 outputs. Production scene selection remains unchanged.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ward_graphite_common as h
import build_nurse_station_warm_v1 as exporter
from nurse_warm_v3_furnishings import refine_furnishings
from nurse_warm_v3_materials import refine_materials

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'output/nurse-station-warm-v2/nurse-station-warm-v2.blend'
OUT = ROOT / 'output/nurse-station-warm-v3'
ASSET = ROOT / 'public/models/smart-ward-nurse-station/nurse-station-warm-v3.glb'
CAMERA = (-4.548, -4.508, 2.027)
TARGET = (-.524, 2.5, 1.693)
LENS = 29.445


def extend_return():
    """Extend only the straight return endpoint, preserving manufactured radii."""
    desk = bpy.data.objects['Desk']
    previous, extension = float(desk['referenceLeftReturn']), .35
    changed = 0
    for obj in desk.children_recursive:
        if obj.name.startswith('Desk_LeftReturn_EndCap'):
            obj.location.y += extension
        elif obj.type == 'MESH':
            # The editable strips store their straight endpoint in mesh coordinates.
            # No whole-object scaling: worktop thickness and corner radius stay intact.
            inverse = obj.matrix_world.inverted()
            for vertex in obj.data.vertices:
                point = obj.matrix_world @ vertex.co
                if abs(point.y - previous) < .00001:
                    point.y += extension
                    vertex.co = inverse @ point
                    changed += 1
    if changed < 24:
        raise ValueError(f'Expected editable return-end vertices, found {changed}')
    desk['referenceLeftReturn'] = previous + extension
    return {'fromM': previous, 'toM': previous + extension, 'editedVertices': changed,
            'cornerRadiusM': desk['referenceCornerRadius']}


def lighting(width, samples):
    scene = bpy.context.scene
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .14
    for obj in scene.objects:
        if obj.type != 'LIGHT':
            continue
        if obj.name.startswith('V2_EntranceDaylight'):
            obj.data.energy = 175
            obj.data.color = (.96, .98, 1.0)
        elif obj.name.startswith('V2_LeftDaylight'):
            obj.data.energy = 155
        elif obj.name.startswith('V2_DeskLight'):
            obj.data.energy = 110
            obj.data.color = (1.0, .975, .94)
        elif obj.name.startswith('V2_CeilingPanel'):
            obj.data.energy = 46
            obj.data.color = (.975, .99, 1.0)
    camera = scene.camera
    camera.location = CAMERA
    h.aim(camera, TARGET)
    camera.data.lens = LENS
    scene.render.resolution_x = width
    scene.render.resolution_y = round(width * 324 / 480)
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .025
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(OUT / 'nurse-station-warm-v3-hero.png')
    return camera


def prepare_runtime_materials():
    """Keep thin glazing without a second full-scene refraction pass on the web.

    Called only after saving/rendering the master. Intel UHD 730 A/B sampling
    measured 98 -> 49 draw calls when this asset's sole transmission was removed.
    """
    glass = h.M['glass']
    shader = glass.node_tree.nodes['Principled BSDF']
    transmission = float(shader.inputs['Transmission Weight'].default_value)
    shader.inputs['Transmission Weight'].default_value = 0
    shader.inputs['Alpha'].default_value = .22
    glass.diffuse_color = (*glass.diffuse_color[:3], .22)
    glass.use_backface_culling = True
    return {'material': glass.name, 'mode': 'thin-glass-alpha', 'opacity': .22,
            'sourceTransmission': transmission, 'transmission': 0,
            'authoringMaterialPreserved': True,
            'reason': 'Avoid full-scene screen-space refraction for thin panes and file holders.'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--skip-render', action='store_true')
    parser.add_argument('--skip-export', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
    if not 256 <= args.width <= 4096 or not 1 <= args.samples <= 512:
        parser.error('width 256..4096; samples 1..512')
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    root = bpy.data.objects['NurseStationWarmV2']
    root.name = 'NurseStationWarmV3'
    root['assetRevision'] = 'warm-v3'
    h.M.clear()
    for material in bpy.data.materials:
        if material.name.startswith('WarmStationV1_'):
            h.M[material.name.removeprefix('WarmStationV1_')] = material
    bpy.context.view_layer.update()
    report = {'counterRefinement': extend_return()}
    report['furnishingRefinement'] = refine_furnishings(h, root)
    report['materialRefinement'] = refine_materials(h, root, OUT)
    camera = lighting(args.width, args.samples)
    bpy.context.view_layer.update()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'nurse-station-warm-v3.blend'))
    print('WARM_V3_EDITABLE_SAVED', flush=True)
    if not args.skip_render:
        bpy.ops.render.render(write_still=True)
    if not args.skip_export:
        report['runtimeMaterialProfile'] = prepare_runtime_materials()
        exporter.OUT, exporter.ASSET, exporter.TARGET = OUT, ASSET, TARGET
        exporter.export_runtime(root, camera)
        path = OUT / 'manifest.json'
        manifest = json.loads(path.read_text(encoding='utf-8'))
        manifest.update({'assetRevision': 'warm-v3', 'baseSource': str(SOURCE.relative_to(ROOT)),
                         'editableSource': str((OUT / 'nurse-station-warm-v3.blend').relative_to(ROOT)),
                         'renderSize': [args.width, round(args.width * 324 / 480)],
                         'refinement': report})
        path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
