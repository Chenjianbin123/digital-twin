"""Finalize the clinical floor with a native navigation sign and theme lighting."""
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import build_hospital_floor_reference_v1 as pipeline

OUT = h.ROOT / 'output/hospital-floor-reference-v4'
SOURCE = OUT / 'hospital-floor-reference-v4.blend'
PREVIOUS = h.ROOT / 'output/hospital-floor-reference-v3/hospital-floor-reference-v3.blend'
VIEWS = {'light': 'Floor_Light', 'dark': 'Floor_Dark', 'top': 'Floor_Light',
         'detail': 'Floor_Light', 'station': 'Floor_Light'}
CAMERAS = {'light': 'Floor_Overview_Camera', 'dark': 'Floor_Overview_Camera',
           'top': 'Floor_Top_Camera', 'detail': 'Floor_Detail_Camera', 'station': 'Nursing_Detail_Camera'}


def navigation_sign(parent):
    h.material('V4_SignTeal', '#126f80', .32, metal=.18, emission=.15)
    h.material('V4_SignText', '#eefeff', .32, emission=.8)
    root = h.empty('NurseStation_Navigation', parent)
    root.location = (0, 1.55, 2.38)
    root.rotation_euler.x = math.radians(-28)
    root['assetRole'] = 'scene-navigation'
    root['navigationId'] = 'floor-nurse-station'
    root['targetScene'] = 'nurse-station'
    root['label'] = '护士站'
    root['interaction'] = 'activate-scene'
    root['integrationStatus'] = 'anchor-only; no web event handler installed'
    h.box('NurseStation_SignBody', (0, 0, 0), (2.75, .12, .78), 'V4_SignTeal', .052, root)
    h.box('NurseStation_SignBack', (0, .068, 0), (2.79, .032, .82), 'Floor_Steel', .014, root)
    h.cylinder('NurseStation_SignIconDisk', (-1.02, -.078, .02), .233, .019,
               'V4_SignText', (math.pi / 2, 0, 0), root, 64)
    h.box('NurseStation_IconVertical', (-1.02, -.094, .02), (.078, .012, .29), 'V4_SignTeal', .005, root)
    h.box('NurseStation_IconHorizontal', (-1.02, -.095, .02), (.29, .013, .078), 'V4_SignTeal', .005, root)
    h.text('NurseStation_Title', '护士站', (.18, -.068, .12), .35, 'V4_SignText', root)
    h.text('NurseStation_ActionLabel', '进入护士站  ›', (.18, -.070, -.19), .155, 'V4_SignText', root)
    for x in [-.78, .78]:
        h.bar('NurseStation_SignSupport', (x, 1.73, 1.12), (x, 1.73, 2.20), .026, 'Floor_Steel', parent)
        h.bar('NurseStation_SignBracket', (x, 1.73, 2.20), (x, 1.55, 2.26), .021, 'Floor_Steel', parent)
    anchor = h.empty('NurseStation_ClickAnchor', root)
    anchor.location = (0, -.09, 0)
    anchor['assetRole'] = 'navigation-anchor'
    anchor['navigationId'] = root['navigationId']
    anchor['targetScene'] = root['targetScene']
    # Raycast the visible plaque or counter; no invisible volume covers rooms.
    station = bpy.data.objects['Central_Nurse_Station']
    for obj in [station, bpy.data.objects['NurseStation_SignBody']]:
        obj['navigationId'] = root['navigationId']
        obj['targetScene'] = root['targetScene']
    return root


def theme_lighting(light, dark):
    for obj in list(light.objects):
        if obj.type != 'LIGHT':
            continue
        if obj.name.startswith('Room practical light'):
            obj.location.y += math.copysign(.9, obj.location.y)
        night = obj.copy()
        night.data = obj.data.copy()
        night.name = 'Night_' + obj.name
        dark.collection.objects.link(night)
        dark.collection.objects.unlink(obj)
        if obj.name.startswith('Room practical light'):
            night.data.energy = 115
            night.data.color = (1, .90, .76)
        else:
            night.data.energy *= .22
            night.data.color = (.58, .76, 1)
    ambient = dark.world.node_tree.nodes['Background']
    ambient.inputs[0].default_value = (.15, .26, .43, 1)
    ambient.inputs[1].default_value = .065
    dark.view_settings.exposure = -.10
    bpy.context.window.scene = dark
    h.area('Night_NursingTaskLight', (0, .5, 5.5), (0, .5, .5), 240, 4.5, (.81, .95, 1), 2.5)
    h.area('Night_LeftRim', (-13, 1, 7), (0, 0, 1), 420, 9, (.28, .69, 1), 4)
    h.area('Night_RightRim', (13, 5, 8), (0, 0, 1), 500, 9, (.32, .74, 1), 4)
    bpy.context.window.scene = light


def build():
    bpy.ops.wm.open_mainfile(filepath=str(PREVIOUS))
    light = bpy.data.scenes['Floor_Light']; dark = bpy.data.scenes['Floor_Dark']
    bpy.context.window.scene = light
    h.M.clear(); h.M.update({m.name: m for m in bpy.data.materials})
    root = bpy.data.objects['Hospital_Floor_Reference_V3']; root.name = 'Hospital_Floor_Reference_V4'
    navigation_sign(root)
    top = pipeline.camera('Floor_Top_Camera', (0, 0, 40), (0, 0, 0), 28.0)
    top.rotation_euler = (0, 0, 0)
    # Remove the old middle keyboard keys left after V3 removed its keyboard body.
    station = bpy.data.objects['Central_Nurse_Station']
    for obj in list(station.children):
        if obj.name.startswith('Keyboard key') and abs(obj.location.x) < .4:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in list(light.objects):
        if obj.name not in dark.objects:
            dark.collection.objects.link(obj)
    theme_lighting(light, dark)
    for scene in [light, dark]:
        scene['revision'] = 'V4 nurse station navigation sign and distinct night lighting'
        scene['deliveredViews'] = json.dumps(CAMERAS)
    h.save(OUT, SOURCE.stem, pipeline.REFERENCE, {'version': 4, 'basedOn': str(PREVIOUS),
        'rooms': 8, 'beds': 16, 'views': CAMERAS, 'navigationTarget': 'nurse-station',
        'navigationRoot': 'NurseStation_Navigation', 'webNavigationImplemented': False})
    bpy.context.view_layer.update()
    anchor = bpy.data.objects['NurseStation_ClickAnchor']
    (OUT / 'navigation.json').write_text(json.dumps({'version': 1,
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'navigationId': 'floor-nurse-station', 'label': '护士站', 'targetScene': 'nurse-station',
        'rootObject': 'NurseStation_Navigation', 'anchorObject': anchor.name,
        'raycastObjects': ['NurseStation_SignBody', 'Central_Nurse_Station'],
        'anchorPositionBlenderZUp': list(anchor.matrix_world.translation),
        'exportNote': 'Export custom properties as glTF extras; resolve hit parents to targetScene. Use exported anchor world transform; do not copy Blender Z-up coordinates into Three.js Y-up.',
        'implemented': False}, ensure_ascii=False, indent=2), encoding='utf-8')


def render(view, width, samples):
    scene = bpy.data.scenes[VIEWS[view]]; bpy.context.window.scene = scene
    scene.camera = bpy.data.objects[CAMERAS[view]]
    width = min(width, 2400) if view in {'detail', 'station'} else width
    scene.render.resolution_x = width; scene.render.resolution_y = round(width * 2 / 3)
    scene.cycles.samples = samples; scene.cycles.use_denoising = False
    scene.render.film_transparent = True; scene.view_layers[0].cycles.denoising_store_passes = True
    scene.render.use_compositing = False
    scene.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'
    scene.render.image_settings.color_depth = '32'; scene.render.image_settings.exr_codec = 'ZIP'
    scene.render.filepath = str(OUT / (view + '-raw.exr'))
    bpy.ops.render.render(write_still=True)
    metadata = {'width': width, 'height': scene.render.resolution_y, 'samples': samples,
        'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        'viewTransform': scene.view_settings.view_transform, 'look': scene.view_settings.look,
        'exposure': scene.view_settings.exposure, 'gamma': scene.view_settings.gamma,
        'output': view + '.png', 'scene': scene.name, 'camera': scene.camera.name}
    (OUT / (view + '-render-settings.json')).write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print('FLOOR_V4_RENDER_FINISHED ' + view, flush=True)


if __name__ == '__main__':
    pipeline.OUT = OUT; pipeline.SOURCE = SOURCE; pipeline.VIEWS = VIEWS
    pipeline.build = build; pipeline.render = render; pipeline.main()
