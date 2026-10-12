"""Reopen V4 and verify layout, navigation metadata, themes and final renders."""
import json
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_hospital_floor_reference_v1 as base
from refine_hospital_floor_reference_v4 import OUT, SOURCE, PREVIOUS, CAMERAS, VIEWS

base.OUT = OUT; base.SOURCE = SOURCE
base.main(theme_object_types={'MESH', 'CURVE', 'FONT', 'EMPTY', 'CAMERA'})
report = json.loads((OUT / 'validation.json').read_text(encoding='utf-8'))
scene = bpy.data.scenes['Floor_Light']; dark = bpy.data.scenes['Floor_Dark']
graph = bpy.context.evaluated_depsgraph_get()


def bounds(root):
    points = []
    for obj in [root, *root.children_recursive]:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(graph)
        points.extend(evaluated.matrix_world @ Vector(v) for v in evaluated.bound_box)
    return ([min(p[i] for p in points) for i in range(3)],
            [max(p[i] for p in points) for i in range(3)])


def overlap(a, b):
    return all(min(a[1][i], b[1][i]) - max(a[0][i], b[0][i]) > .002 for i in range(3))


roles = lambda role: [o for o in scene.objects if o.get('assetRole') == role]
nav = bpy.data.objects['NurseStation_Navigation']
anchor = bpy.data.objects['NurseStation_ClickAnchor']
navigation = json.loads((OUT / 'navigation.json').read_text(encoding='utf-8'))
checks = {'v3Preserved': base.sha(PREVIOUS) == 'c4b207270e53774b60b0508249abed5eb88ddff5bfc2d8aa847568337772c2a5',
          'uniqueNavigation': len(roles('scene-navigation')) == 1,
          'navigationTarget': nav['targetScene'] == anchor['targetScene'] == navigation['targetScene'] == 'nurse-station',
          'navigationSource': navigation['sourceSha256'] == report['sourceSha256'],
          'anchorParent': anchor.parent == nav,
          'visibleSign': not bpy.data.objects['NurseStation_SignBody'].hide_render,
          'cabinetCount': len(roles('clinical-storage')) == 9,
          'tableCount': len(roles('overbed-table')) == 8,
          'topCamera': abs(bpy.data.objects['Floor_Top_Camera'].rotation_euler.x) < 1e-6}
collisions = []; table_contacts = []
for room in [o for o in scene.objects if o.get('capacity') == 2]:
    beds = [o for o in room.children if o.get('assetRole') == 'physical-bed']
    bed_bodies = [next(o for o in bed.children if o.get('assetRole') == 'bed-body') for bed in beds]
    door = next(o for o in room.children if o.name.startswith('Room door open'))
    table = next(o for o in room.children if o.get('assetRole') == 'overbed-table')
    for body in bed_bodies:
        for other in [door, table]:
            if overlap(bounds(body), bounds(other)):
                collisions.append([body.name, other.name])
    floor = next(o for o in room.children if o.name.startswith('Room resilient floor'))
    floor_z = bounds(floor)[1][2]
    for wheel in [o for o in table.children if o.name.startswith('Table caster')]:
        ev = wheel.evaluated_get(graph)
        table_contacts.append(min((ev.matrix_world @ v.co).z for v in ev.data.vertices) - floor_z)
checks['staticDoorsTablesClearBeds'] = not collisions
checks['tableCastersGrounded'] = len(table_contacts) == 32 and max(abs(g) for g in table_contacts) < .002
parking = []
for bay in roles('equipment-parking'):
    lo, hi = bounds(bpy.data.objects[bay['assetName']])
    parking.append(all(lo[i] >= bay.location[i] - bay[key] / 2 - .005 and
                       hi[i] <= bay.location[i] + bay[key] / 2 + .005
                       for i, key in [(0, 'width'), (1, 'length')]))
checks['equipmentInsideBays'] = len(parking) == 3 and all(parking)
station = bpy.data.objects['Central_Nurse_Station']
counter = bpy.data.objects['Stone countertop']
rear_cabinets = [o for o in roles('clinical-storage') if o.name.startswith('Nurse rear preparation cabinet')]
rear_max = max(bounds(o)[1][1] for o in rear_cabinets)
walls = [o for o in scene.objects if o.name.startswith('Corridor wall cutaway')]
north_wall = min(bounds(o)[0][1] for o in walls if o.matrix_world.translation.y > 0)
south_wall = max(bounds(o)[1][1] for o in walls if o.matrix_world.translation.y < 0)
clearance = {'northCabinetToWall': north_wall - rear_max, 'southCounterToWall': bounds(counter)[0][1] - south_wall}
checks['mainAisleClearance'] = min(clearance.values()) >= 1.0
chairs = [o for o in station.children if o.name.startswith('Visitor chair')]
checks['rearCabinetsClearChairs'] = not any(overlap(bounds(cab), bounds(chair)) for cab in rear_cabinets for chair in chairs)
supports = [o for o in scene.objects if o.name.startswith('NurseStation_SignSupport')]
supplies = [o for o in scene.objects if o.name.startswith(('Labelled supply tray', 'Wrapped supply pack'))]
checks['signSupportsClearSupplies'] = len(supports) == 2 and not any(
    overlap(bounds(support), bounds(supply)) for support in supports for supply in supplies)
light_lights = {o.as_pointer() for o in scene.objects if o.type == 'LIGHT'}
dark_lights = {o.as_pointer() for o in dark.objects if o.type == 'LIGHT'}
checks['independentNightLights'] = bool(light_lights and dark_lights) and not light_lights.intersection(dark_lights)
navigation_rays = []
for camera_name in ['Floor_Overview_Camera', 'Floor_Top_Camera', 'Nursing_Detail_Camera']:
    camera = bpy.data.objects[camera_name]
    forward = camera.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    position = anchor.matrix_world.translation
    hit, _, _, _, hit_object, _ = scene.ray_cast(graph, position - forward * 100, forward, distance=110)
    owner = hit_object
    while owner is not None and not owner.get('targetScene'):
        owner = owner.parent
    projected = world_to_camera_view(scene, camera, position)
    visible = 0 <= projected.x <= 1 and 0 <= projected.y <= 1 and projected.z > 0
    navigation_rays.append({'camera': camera_name, 'hit': hit_object.name if hit else None,
                            'targetScene': owner.get('targetScene') if owner else None,
                            'insideFrame': visible, 'screenUV': [projected.x, projected.y]})
checks['navigationRayHits'] = all(r['targetScene'] == 'nurse-station' and r['insideFrame'] for r in navigation_rays)
if '--source-only' not in sys.argv:
    for view in VIEWS:
        path = OUT / (view + '.png'); meta = json.loads((OUT / (view + '-render-settings.json')).read_text())
        width, height = struct.unpack('>II', path.read_bytes()[16:24])
        expected_width = 2400 if view in {'detail', 'station'} else 3840
        valid = (base.sha(path) == meta.get('pngSha256') and meta['sourceSha256'] == report['sourceSha256'] and
                 (width, height) == (expected_width, round(expected_width * 2 / 3)) and
                 (width, height) == (meta['width'], meta['height']) and
                 meta['samples'] >= 64 and meta['camera'] == CAMERAS[view] and meta['scene'] == VIEWS[view])
        checks['render_' + view] = valid
        report['renderProvenance'][view] = {'width': width, 'height': height, 'samples': meta['samples'],
                                           'valid': valid, 'sha256': base.sha(path)}
report.update({'v4Checks': checks, 'checkedStaticCollisions': collisions,
               'aisleClearanceMetres': clearance, 'tableCasterContacts': len(table_contacts),
               'navigation': navigation, 'navigationRayChecks': navigation_rays, 'v3Preserved': checks['v3Preserved'],
               'layoutCheckScope': 'Static bed-body AABBs versus open doors and tables; rear cabinets versus station chairs; main north/south aisle boundary gaps. No swept-door, accessibility or full-scene collision certification.'})
report['failures'].extend('V4 check failed: ' + key for key, ok in checks.items() if not ok)
(OUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('FLOOR_V4_CHECKS ' + json.dumps(checks), flush=True)
print('FLOOR_V4_LAYOUT ' + json.dumps({'collisions': collisions, 'clearance': clearance}), flush=True)
if report['failures']:
    raise RuntimeError(str(report['failures']))
