"""Load the preserved V1 source, refine V2 and render reproducible camera views.

blender --background --threads 8 --python-exit-code 1 --python scripts/refine_operating_room_reference_v2.py -- --width 960 --samples 24
Use --render-only --views hero bed lights anesthesia for final output.
"""
import argparse
import json
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import operating_room_refinement_v2 as refinement

OUT = h.ROOT/'output/operating-room-reference-v2'
SOURCE = OUT/'operating-room-reference-v2.blend'
V1 = h.ROOT/'output/operating-room-reference-v1/operating-room-reference-v1.blend'
REFERENCE = h.ROOT/'output/imagegen/hospital-concepts-20261005/operating-room-high-fidelity-v1.png'
VIEWS = {
    'hero': ('Reference_Hero_Camera', (-3.30, -5.20, 2.12), (-.13, 1.12, 1.48), 28),
    'bed': ('Bed_Detail_Camera', (-1.84, -3.30, 1.85), (-.11, -.45, .93), 47),
    'lights': ('Lights_Detail_Camera', (-2.80, -3.10, 1.62), (-.60, .25, 2.62), 39),
    'anesthesia': ('Anesthesia_Detail_Camera', (-2.67, -1.00, 1.74), (-1.23, 1.77, 1.17), 32),
    'comparison': ('V1_Comparison_Camera', (-3.30, -4.90, 2.38), (-.05, 1.08, 1.35), 28),
}


def cameras():
    for view, (name, location, target, lens) in VIEWS.items():
        if view == 'comparison':
            continue
        obj = bpy.data.objects.get(name)
        if obj is None:
            data = bpy.data.cameras.new(name+' lens')
            obj = bpy.data.objects.new(name, data)
            bpy.context.collection.objects.link(obj)
        obj.location = location
        obj.data.lens = lens
        obj.data.clip_start = .03
        obj.data.clip_end = 100
        h.aim(obj, target)
    bpy.context.scene.camera = bpy.data.objects['Reference_Hero_Camera']


def lighting():
    scene = bpy.context.scene
    for obj in scene.objects:
        if obj.type == 'LIGHT':
            if obj.name.startswith('Ceiling clinical'):
                obj.data.energy = 185
                obj.data.color = (1, .995, .99)
            elif obj.name.startswith('Entrance reflected'):
                obj.data.energy = 48
    h.area('V2 ceiling forward key', (-.6, -2.7, 3.14), (0, -.5, .8), 155, 2.2, (1, .98, .95), .7)
    h.area('V2 wall reflection strip', (-4.08, .9, 2.25), (0, .2, 1.2), 105, .55, (.96, .98, 1), 1.65)
    h.area('V2 stainless edge reflection', (2.9, -.55, 2.85), (.0, -.65, .65), 90, .40, (1, 1, 1), 1.6)
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (1, 1, 1, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .08
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -.65


def build():
    bpy.ops.wm.open_mainfile(filepath=str(V1))
    # Preserve the actual saved lens, sensor, shift and transform, rather than
    # relying on coordinates from an older generation script.
    comparison = bpy.data.objects['Reference_Hero_Camera'].copy()
    comparison.data = comparison.data.copy()
    comparison.name = VIEWS['comparison'][0]
    bpy.context.collection.objects.link(comparison)
    root = bpy.data.objects['OperatingRoom_Reference_V1']
    root.name = 'OperatingRoom_Reference_V2'
    refinement.material_finish()
    refinement.refine_table()
    refinement.rebuild_lights(root)
    refinement.refine_screens()
    refinement.refine_anesthesia()
    refinement.refine_cart_and_room()
    refinement.ground_casters()
    cameras()
    lighting()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .025
    scene.cycles.max_bounces = 10
    scene.cycles.transmission_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1441
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.filepath = str(OUT/'hero.png')
    scene['revision'] = 'V2 - geometry, optical assemblies, material and lighting refinement'
    scene['sourceV1'] = str(V1)
    scene['clinicalDisplays'] = 'Synthetic demo values; no patient data or clinical simulation'
    scene['deliveredViews'] = json.dumps({k: v[0] for k, v in VIEWS.items()})
    h.save(OUT, SOURCE.stem, REFERENCE, {
        'version': 2, 'basedOn': str(V1), 'kind': 'Editable native Blender refinement',
        'camera': scene.camera.name, 'views': {k: v[0] for k, v in VIEWS.items()},
        'fidelity': 'Manual reference reconstruction; not an exact or surveyed hospital model',
    })
    print('V2_SOURCE_SAVED '+str(SOURCE), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=2560)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--views', nargs='+', choices=VIEWS, default=['hero'])
    parser.add_argument('--render-only', action='store_true')
    parser.add_argument('--skip-render', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 320 <= args.width <= 4096 or not 1 <= args.samples <= 1024:
        parser.error('width must be 320..4096 and samples 1..1024')
    if args.render_only:
        bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:
        build()
    if args.skip_render:
        return
    scene = bpy.context.scene
    scene.cycles.samples = args.samples
    for view in args.views:
        scene.camera = bpy.data.objects[VIEWS[view][0]]
        width = args.width if view in {'hero', 'comparison'} else min(args.width, 1600)
        scene.render.resolution_x = width
        scene.render.resolution_y = round(width*941/1672)
        filename = view+'.png' if width >= 1600 else 'preview-'+view+'.png'
        scene.render.filepath = str(OUT/filename)
        print('V2_RENDER_BEGIN '+view, flush=True)
        bpy.ops.render.render(write_still=True)
        print('V2_RENDER_FINISHED '+view, flush=True)


if __name__ == '__main__':
    main()
