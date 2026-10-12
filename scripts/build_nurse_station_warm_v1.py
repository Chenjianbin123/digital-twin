"""Reconstruct the supplied light wood nurse-station image in Blender 4.5.

Standalone reference reconstruction, not a surveyed hospital or a production swap.
The editable master is saved before any export-only consolidation.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ward_graphite_common as h
from nurse_warm_architecture import build_architecture
from nurse_warm_desk import build_desk
from nurse_warm_furnishings import build_furnishings

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/nurse-station-warm-v1'
ASSET = ROOT / 'public/models/smart-ward-nurse-station/nurse-station-warm-v1.glb'
CAMERA = (-4.9, -6.2, 2.15)
TARGET = (-.45, 3.0, 1.45)


def materials():
    definitions = {
        'white': ('#e1e5e3', .33, 0), 'wall': ('#d1d6d4', .72, 0),
        'silver': ('#aebabc', .36, .55), 'steel': ('#7e929b', .28, .75),
        'dark': ('#243037', .47, .08), 'oak': ('#b59b79', .51, 0),
        'floor': ('#a4b4bf', .24, 0), 'floor_blue': ('#628ba6', .23, 0),
        'glass': ('#afc7d2', .12, .1), 'blue': ('#21445a', .48, 0),
        'paper': ('#f1f2eb', .79, 0), 'lamp': ('#fff0d9', .35, 0, 4.2),
        'green': ('#537850', .73, 0), 'screen': ('#0c202e', .42, 0),
        'fabric': ('#7194a8', .90, 0),
    }
    for key, values in definitions.items():
        material = h.material(key, *values)
        material.name = 'WarmStationV1_' + key
    glass = h.M['glass'].node_tree.nodes['Principled BSDF']
    glass.inputs['Transmission Weight'].default_value = .36
    glass.inputs['IOR'].default_value = 1.45
    size = 512
    yy, xx = np.mgrid[0:size, 0:size] / size
    rng = np.random.default_rng(10092026)
    noise = rng.normal(0, 1, (size, size))
    for key in ('oak', 'floor', 'floor_blue', 'fabric'):
        mat = h.M[key]
        grain = (.42 * np.sin(xx * 330 + np.sin(yy * 8) * 1.6 + np.sin(xx * 39))
                 + .12 * np.sin(xx * 911 + yy * 11) + .07 * noise) if key == 'oak' else noise * .18
        base = np.array(mat.diffuse_color[:3])
        color = np.clip(base[None, None, :] * (1 + grain[:, :, None] * .19), 0, 1)
        rough = np.clip(mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value + grain * .04, .1, .95)
        gy, gx = np.gradient(grain)
        normal = np.stack((-gx * .22, -gy * .22, np.ones_like(gx)), axis=-1)
        normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
        for suffix, pixels, is_color in [('color', color, True), ('roughness', np.repeat(rough[:, :, None], 3, axis=2), False), ('normal', normal * .5 + .5, False)]:
            img = bpy.data.images.new(f'warm-station-{key}-{suffix}', width=size, height=size, alpha=False)
            img.colorspace_settings.name = 'sRGB' if is_color else 'Non-Color'
            rgba = np.ones((size, size, 4), dtype=np.float32)
            rgba[:, :, :3] = np.where(pixels <= .0031308, pixels * 12.92, 1.055 * np.power(pixels, 1/2.4) - .055) if is_color else pixels
            img.pixels.foreach_set(rgba.ravel())
            img.filepath_raw = str(OUT / 'textures' / (img.name + '.png'))
            img.file_format = 'PNG'; img.save(); img.pack()
            nodes, links = mat.node_tree.nodes, mat.node_tree.links
            tex = nodes.new('ShaderNodeTexImage'); tex.image = img
            bsdf = nodes['Principled BSDF']
            if suffix == 'normal':
                bump = nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value = .17
                links.new(tex.outputs['Color'], bump.inputs['Color']); links.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
            else:
                links.new(tex.outputs['Color'], bsdf.inputs['Base Color' if is_color else 'Roughness'])


def display_materials(screens):
    """Synthetic, unlabelled graphics only; no patient or hospital binding baked in."""
    for index, obj in enumerate(screens):
        width, height = (128, 224) if obj.name.startswith('DoorScreen') else ((512, 160) if obj.name == 'Clock_Display' else (512, 288))
        rgba = np.ones((height, width, 4), dtype=np.float32)
        rgba[:, :, :3] = (.035, .10, .16)
        rgba[height - 30:height - 13, 12:width - 12, :3] = (.11, .26, .35)
        if obj.name == 'Clock_Display':
            rgba[:, :, :3] = (.035, .10, .16)
            segments = {'0': 'abcdef', '1': 'bc', '2': 'abdeg'}
            bounds = {'a': (11, 69, 124, 135), 'b': (69, 80, 81, 124),
                      'c': (69, 80, 36, 79), 'd': (11, 69, 25, 36),
                      'e': (0, 11, 36, 79), 'f': (0, 11, 81, 124),
                      'g': (11, 69, 75, 86)}
            for x, digit in zip((42, 143, 287, 388), '1200'):
                for segment in segments[digit]:
                    x0, x1, y0, y1 = bounds[segment]
                    rgba[y0:y1, x+x0:x+x1, :3] = (.42, .76, .83)
            for y in (53, 96):
                rgba[y:y+12, 248:260, :3] = (.42, .76, .83)
        else:
            for row in range(5):
                y = 20 + row * max(22, (height-62)//5)
                rgba[y:y + 2, 12:width - 12, :3] = (.13, .24, .31)
                for col in range(3):
                    x = 15 + col * ((width - 30)//3)
                    rgba[y+7:y+14, x:x + max(9, (width-48)//5), :3] = (.20, .49, .61) if (row+col+index)%3 else (.46, .68, .69)
        image = bpy.data.images.new('demo-' + obj.name, width=width, height=height, alpha=False)
        image.colorspace_settings.name = 'sRGB'; image.pixels.foreach_set(rgba.ravel())
        image.filepath_raw = str(OUT / 'textures' / (image.name + '.png'))
        image.file_format = 'PNG'; image.save(); image.pack()
        material = h.M['screen'].copy(); material.name = 'WarmStation_Demo_' + obj.name
        nodes, links = material.node_tree.nodes, material.node_tree.links
        tex = nodes.new('ShaderNodeTexImage'); tex.image = image
        shader = nodes['Principled BSDF']
        links.new(tex.outputs['Color'], shader.inputs['Base Color'])
        links.new(tex.outputs['Color'], shader.inputs['Emission Color'])
        shader.inputs['Emission Strength'].default_value = .35
        obj.data.materials.clear(); obj.data.materials.append(material)
        obj['contentSource'] = 'synthetic-preview; replace material at runtime'
        if obj.name == 'Clock_Display': obj['previewTime'] = '12:00; static demo, not a live clock'


def align_surface_grain(root):
    # Cube-generated UVs rotate neighbouring faces. Joinery grain must stay vertical.
    for obj in root.children_recursive:
        if obj.type != 'MESH' or not obj.data.materials: continue
        material = obj.data.materials[0]
        if material not in (h.M['oak'], h.M['floor'], h.M['floor_blue']): continue
        uv = obj.data.uv_layers.active
        if uv is None: uv = obj.data.uv_layers.new(name='UVMap')
        for polygon in obj.data.polygons:
            dominant = max(range(3), key=lambda axis: abs(polygon.normal[axis]))
            axes = ((1, 2) if dominant == 0 else (0, 2)) if material == h.M['oak'] and dominant != 2 else (0, 1)
            for loop_id in polygon.loop_indices:
                co = obj.data.vertices[obj.data.loops[loop_id].vertex_index].co
                uv.data[loop_id].uv = (co[axes[0]], co[axes[1]])


def lighting(width, samples):
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new('Neutral clinical daylight'); scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.71, .81, .93, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .22
    h.area_light('Entrance softbox', (-1, -3, 2.7), (0, 1, .5), 460, 7, (.9, .96, 1), 3)
    h.area_light('Left daylight fill', (-5.4, 1.5, 2.1), (0, 2, 1), 170, 3, (.83, .93, 1), 2.6)
    for x in (-1.55, 1.50):
        h.area_light('Desk neutral task light', (x, 1.15, 3.00), (x, 1.15, 0), 90, 1.15, (.96, .98, 1), .65)
    for y in (2, 7, 12, 17, 21):
        h.area_light('Hall lighting', (-4.25, y, 3.04), (-4.25, y, 0), 55, .9, (.89, .95, 1), .7)
        h.area_light('Ward lighting', (3.48, y, 3.04), (3.48, y, 0), 45, .9, (.96, .98, 1), .7)
    h.area_light('Corridor window daylight', (-4.3, 21.80, 1.8), (-4.3, 10, 1.3), 170, 2.6, (.73, .88, 1), 2.2)
    for x in (-1.6, .2, 1.8):
        h.area_light('Counter toe wash', (x, -.03, .14), (x, -.32, 0), 4, 1.5, (1, .90, .68), .03)
    bpy.ops.object.camera_add(location=CAMERA)
    camera = bpy.context.object; camera.name = 'Reference_Camera'; camera.data.lens = 36
    camera.data.clip_start = .02; camera.data.clip_end = 100
    h.aim(camera, TARGET); scene.camera = camera
    scene.render.engine = 'CYCLES'; scene.cycles.samples = samples; scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8; scene.cycles.adaptive_threshold = .035
    scene.render.resolution_x = width; scene.render.resolution_y = round(width * 324 / 480)
    scene.render.resolution_percentage = 100; scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.filepath = str(OUT / 'nurse-station-warm-hero.png')
    return camera


def export_runtime(root, camera):
    geometry = [obj for obj in root.children_recursive if obj.type in {'MESH', 'CURVE', 'FONT'}]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in geometry: obj.select_set(True)
    bpy.context.view_layer.objects.active = geometry[0]; bpy.ops.object.convert(target='MESH')
    groups = {}
    for obj in list(root.children_recursive):
        if obj.type != 'MESH' or obj.get('runtimeSurface'): continue
        parent = obj.parent
        while parent.parent and parent.parent != root: parent = parent.parent
        groups.setdefault(parent, []).append(obj)
    for parent, objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects: obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1: bpy.ops.object.join()
        bpy.context.object.name = parent.name + '_Static'
    bpy.ops.object.select_all(action='DESELECT')
    for obj in [root] + list(root.children_recursive): obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(filepath=str(ASSET), export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False, export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6, export_draco_position_quantization=18,
        export_draco_normal_quantization=14, export_draco_texcoord_quantization=16)
    triangles = 0
    for obj in root.children_recursive:
        if obj.type == 'MESH':
            obj.data.calc_loop_triangles(); triangles += len(obj.data.loop_triangles)
    report = {'asset': str(ASSET.relative_to(ROOT)), 'bytes': ASSET.stat().st_size,
              'triangles': triangles, 'blenderVersion': bpy.app.version_string,
              'units': 'metres', 'surveyed': False, 'productionSceneReplaced': False,
              'camera': {'position': [camera.location.x, camera.location.z, -camera.location.y],
                         'target': [TARGET[0], TARGET[2], -TARGET[1]], 'lens': camera.data.lens},
              'surfaces': [obj.name for obj in root.children_recursive if obj.get('runtimeSurface')],
              'referenceSize': [480, 324], 'content': 'synthetic display graphics, no patient data'}
    (OUT / 'manifest.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'nurse-station-warm-runtime.blend'))
    print('WARM_STATION_EXPORT ' + json.dumps(report, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=1920); parser.add_argument('--samples', type=int, default=64)
    parser.add_argument('--skip-render', action='store_true'); parser.add_argument('--skip-export', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 256 <= args.width <= 4096 or not 1 <= args.samples <= 512: parser.error('width 256..4096; samples 1..512')
    (OUT / 'textures').mkdir(parents=True, exist_ok=True); ASSET.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene; scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
    # h.text uses this stable name; one packed font avoids a duplicate 20MB font per label.
    font = bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc'); font.name = 'Microsoft YaHei'
    materials()
    root = h.empty('NurseStationWarmV1'); root['units'] = 'metres'; root['surveyed'] = False
    architecture = build_architecture(h, root); build_desk(h, root); equipment = build_furnishings(h, root)
    align_surface_grain(root)
    display_materials(architecture['door_screens'] + equipment['screens'])
    camera = lighting(args.width, args.samples)
    bpy.context.view_layer.update(); bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'nurse-station-warm-v1.blend'))
    print('WARM_STATION_EDITABLE_SAVED', flush=True)
    if not args.skip_render: bpy.ops.render.render(write_still=True)
    if not args.skip_export: export_runtime(root, camera)


if __name__ == '__main__': main()
