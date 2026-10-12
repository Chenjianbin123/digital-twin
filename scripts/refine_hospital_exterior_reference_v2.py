"""Refine the preserved hospital V1 native scene and render V2 camera views.

blender --background --threads 8 --python-exit-code 1 --python scripts/refine_hospital_exterior_reference_v2.py -- --width 960 --samples 24
"""
import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import hospital_exterior_architecture_v2 as architecture
import hospital_exterior_landscape_v2 as landscape

OUT = h.ROOT/'output/hospital-exterior-reference-v2'
SOURCE = OUT/'hospital-exterior-reference-v2.blend'
V1 = h.ROOT/'output/hospital-exterior-reference-v1/hospital-exterior-reference-v1.blend'
REFERENCE = h.ROOT/'output/imagegen/hospital-concepts-20261005/hospital-exterior-high-fidelity-v1.png'
VIEWS = {
    'hero': ('Reference_Hero_Camera', (68, -166, 30), (5, -7, 14), 55),
    'entrance': ('Entrance_Detail_Camera', (23, -46, 9), (0, -17, 4.5), 38),
    'facade': ('Facade_Detail_Camera', (30, -43, 28), (-3, -.55, 28), 70),
    'comparison': ('V1_Comparison_Camera', None, None, None),
}


def cameras():
    for key, (name, position, target, lens) in VIEWS.items():
        if key == 'comparison':
            continue
        camera = bpy.data.objects.get(name)
        if camera is None:
            camera = bpy.data.objects.new(name, bpy.data.cameras.new(name+' lens'))
            bpy.context.collection.objects.link(camera)
        camera.location = position
        camera.data.lens = lens
        camera.data.clip_start = .10
        camera.data.clip_end = 3000
        h.aim(camera, target)
    bpy.context.scene.camera = bpy.data.objects[VIEWS['hero'][0]]


def daylight():
    scene = bpy.context.scene
    world = scene.world
    nodes, links = world.node_tree.nodes, world.node_tree.links
    # Retain the packed urban HDR for reflections; the sky seen by the camera
    # has atmospheric colour without the HDR's incorrectly scaled nearby towers.
    environment_background = nodes.get('Background')
    environment_background.inputs['Strength'].default_value = .40
    sky_background = nodes.get('Background.001')
    if sky_background is None:
        raise RuntimeError('V1 camera background was not found')
    direction = nodes.new('ShaderNodeTexCoord')
    separate = nodes.new('ShaderNodeSeparateXYZ')
    links.new(direction.outputs['Normal'], separate.inputs[0])
    elevation = nodes.new('ShaderNodeMath')
    elevation.operation = 'ABSOLUTE'
    links.new(separate.outputs['Z'], elevation.inputs[0])
    gradient = nodes.new('ShaderNodeValToRGB')
    gradient.name = 'V2 horizon to blue sky'
    gradient.color_ramp.elements[0].position = .005
    gradient.color_ramp.elements[0].color = (.70, .79, .83, 1)
    gradient.color_ramp.elements[1].position = .13
    gradient.color_ramp.elements[1].color = (.08, .35, .75, 1)
    links.new(elevation.outputs[0], gradient.inputs[0])
    stretch = nodes.new('ShaderNodeVectorMath')
    stretch.operation = 'MULTIPLY'
    stretch.inputs[1].default_value = (7, 7, 28)
    links.new(direction.outputs['Normal'], stretch.inputs[0])
    cloud = nodes.new('ShaderNodeTexNoise')
    cloud.name = 'V2 distant soft cloud field'
    cloud.inputs['Scale'].default_value = 1
    cloud.inputs['Detail'].default_value = 4
    cloud.inputs['Roughness'].default_value = .65
    links.new(stretch.outputs[0], cloud.inputs['Vector'])
    density = nodes.new('ShaderNodeValToRGB')
    density.color_ramp.elements[0].position = .56
    density.color_ramp.elements[1].position = .70
    density.color_ramp.elements[1].color = (.8, .8, .8, 1)
    links.new(cloud.outputs['Fac'], density.inputs[0])
    sky = nodes.new('ShaderNodeMixRGB')
    sky.name = 'V2 blue sky and clouds'
    links.new(density.outputs['Color'], sky.inputs[0])
    links.new(gradient.outputs['Color'], sky.inputs[1])
    sky.inputs[2].default_value = (.93, .96, 1, 1)
    links.new(sky.outputs[0], sky_background.inputs['Color'])
    sky_background.inputs['Strength'].default_value = .8
    sun = bpy.data.objects['Soft afternoon sun']
    sun.data.energy = 3.0
    sun.data.color = (1, .93, .82)
    sun.data.angle = .045
    sun.location = (-90, -75, 115)
    h.aim(sun, (0, 0, 0))
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .20


def build():
    bpy.ops.wm.open_mainfile(filepath=str(V1))
    comparison = bpy.data.objects['Reference_Hero_Camera'].copy()
    comparison.data = comparison.data.copy()
    comparison.name = VIEWS['comparison'][0]
    bpy.context.collection.objects.link(comparison)
    root = bpy.data.objects['HospitalExterior_Reference_V1']
    root.name = 'HospitalExterior_Reference_V2'
    architecture.finishes()
    architecture.tower_interiors()
    architecture.entry_and_podium()
    landscape.refine(root)
    # V1's footprint made the tower read too slender relative to the concept.
    # Widen the architectural site together while preserving people/vehicle widths.
    root.scale.x = 1.23
    root['referenceInferredCampusWidthMetres'] = 79*1.23
    bpy.data.objects['Ambulance'].scale.x /= 1.23
    for obj in bpy.data.objects:
        if obj.type == 'EMPTY' and obj.name.startswith('V2 scale person'):
            obj.scale.x /= 1.23
    cameras()
    daylight()
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .035
    scene.cycles.max_bounces = 8
    scene.cycles.transmission_bounces = 6
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = 2560
    scene.render.resolution_y = 1441
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.filepath = str(OUT/'hero.png')
    scene['revision'] = 'V2 - transparent facades, entry structure, planting and campus context'
    scene['sourceV1'] = str(V1)
    scene['deliveredViews'] = json.dumps({key: value[0] for key, value in VIEWS.items()})
    scene['inferredDesign'] = 'Visual reconstruction from one concept image, not a surveyed or engineering model'
    h.save(OUT, SOURCE.stem, REFERENCE, {
        'version': 2, 'basedOn': str(V1), 'kind': 'Editable native Blender refinement',
        'camera': scene.camera.name, 'views': {key: value[0] for key, value in VIEWS.items()},
        'fidelity': 'Reference-led visual reconstruction; no exact-match or surveyed geometry claim',
    })
    shutil.copy2(V1.parent/'environment-license.txt', OUT/'environment-license.txt')
    print('HOSPITAL_V2_SOURCE_SAVED '+str(SOURCE), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--width', type=int, default=2560)
    parser.add_argument('--samples', type=int, default=96)
    parser.add_argument('--views', nargs='+', choices=VIEWS, default=['hero'])
    parser.add_argument('--render-only', action='store_true')
    parser.add_argument('--skip-render', action='store_true')
    parser.add_argument('--raw', action='store_true', help='Save linear EXR passes for denoising in a fresh process')
    parser.add_argument('--denoise-only', action='store_true', help='Composite previously rendered EXR passes without loading geometry')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 320 <= args.width <= 4096 or not 1 <= args.samples <= 1024:
        parser.error('width must be 320..4096 and samples 1..1024')
    if args.denoise_only:
        if args.raw or args.skip_render:
            parser.error('denoise-only cannot be combined with raw or skip-render')
        for view in args.views:
            denoise(view)
        return
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
        name = view+'.png' if width >= 1600 else 'preview-'+view+'.png'
        scene.render.filepath = str(OUT/name)
        if args.raw:
            scene.cycles.use_denoising = False
            scene.view_layers[0].cycles.denoising_store_passes = True
            scene.render.use_compositing = False
            scene.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
            scene.render.image_settings.color_depth = '32'
            scene.render.image_settings.exr_codec = 'ZIP'
            scene.render.filepath = str(OUT/(view+'-raw.exr'))
        print('HOSPITAL_V2_RENDER_BEGIN '+view, flush=True)
        bpy.ops.render.render(write_still=True)
        if args.raw:
            metadata = {
                'width': width, 'height': scene.render.resolution_y, 'samples': args.samples,
                'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                'viewTransform': scene.view_settings.view_transform,
                'look': scene.view_settings.look, 'exposure': scene.view_settings.exposure,
                'gamma': scene.view_settings.gamma, 'output': name,
            }
            (OUT/(view+'-render-settings.json')).write_text(json.dumps(metadata, indent=2), encoding='utf-8')
        print('HOSPITAL_V2_RENDER_FINISHED '+view, flush=True)


def denoise(view):
    """Release all scene geometry before full-frame OIDN allocates its buffers."""
    metadata = json.loads((OUT/(view+'-render-settings.json')).read_text(encoding='utf-8'))
    if metadata['sourceSha256'] != hashlib.sha256(SOURCE.read_bytes()).hexdigest():
        raise RuntimeError('Raw render belongs to a different saved scene: '+view)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 1
    scene.cycles.use_denoising = False
    camera = bpy.data.objects.new('Composite camera', bpy.data.cameras.new('Composite camera'))
    scene.collection.objects.link(camera)
    scene.camera = camera
    scene.render.resolution_x = metadata['width']
    scene.render.resolution_y = metadata['height']
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.filepath = str(OUT/metadata['output'])
    scene.view_settings.view_transform = metadata['viewTransform']
    scene.view_settings.look = metadata['look']
    scene.view_settings.exposure = metadata['exposure']
    scene.view_settings.gamma = metadata['gamma']
    scene.use_nodes = True
    nodes, links = scene.node_tree.nodes, scene.node_tree.links
    nodes.clear()
    source = nodes.new('CompositorNodeImage')
    source.image = bpy.data.images.load(str(OUT/(view+'-raw.exr')))
    print('RAW_PASS_SOCKETS '+str([o.name for o in source.outputs]), flush=True)
    filter_node = nodes.new('CompositorNodeDenoise')
    filter_node.prefilter = 'FAST'
    filter_node.quality = 'HIGH'
    filter_node.inputs['HDR'].default_value = True
    links.new(source.outputs['Combined'], filter_node.inputs['Image'])
    links.new(source.outputs['Denoising Normal'], filter_node.inputs['Normal'])
    links.new(source.outputs['Denoising Albedo'], filter_node.inputs['Albedo'])
    output = nodes.new('CompositorNodeComposite')
    links.new(filter_node.outputs['Image'], output.inputs['Image'])
    bpy.ops.render.render(write_still=True)
    metadata['denoising'] = 'Blender compositor OIDN, FAST prefilter, separate empty-scene process'
    metadata['pngSha256'] = hashlib.sha256((OUT/metadata['output']).read_bytes()).hexdigest()
    (OUT/(view+'-render-settings.json')).write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print('HOSPITAL_V2_DENOISED '+view, flush=True)


if __name__ == '__main__':
    main()
