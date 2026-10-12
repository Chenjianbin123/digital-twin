"""Validate the saved floor, added clinical furniture and four render views."""
import json
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0, str(Path(__file__).resolve().parent))
import verify_hospital_floor_reference_v1 as base
from refine_hospital_floor_reference_v3 import CAMERAS, VIEWS

base.OUT = base.ROOT / 'output/hospital-floor-reference-v3'
base.SOURCE = base.OUT / 'hospital-floor-reference-v3.blend'
base.main()
report = json.loads((base.OUT / 'validation.json').read_text(encoding='utf-8'))
scene = bpy.data.scenes['Floor_Light']
graph = bpy.context.evaluated_depsgraph_get()


def bounds(root):
    points = []
    for obj in [root, *root.children_recursive]:
        if obj.type != 'MESH' or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(graph)
        points.extend(evaluated.matrix_world @ Vector(v) for v in evaluated.bound_box)
    if not points:
        raise ValueError('No physical geometry: ' + root.name)
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


roles = {role: [o for o in scene.objects if o.get('assetRole') == role]
         for role in ['clinical-storage', 'overbed-table', 'equipment-parking', 'workstation-display']}
checks = {'storageCount': len(roles['clinical-storage']) == 9,
          'tableCount': len(roles['overbed-table']) == 8,
          'parkingCount': len(roles['equipment-parking']) == 3,
          'workstationCount': sum(o.parent == bpy.data.objects['Central_Nurse_Station']
                                  for o in roles['workstation-display']) == 2,
          'printer': bpy.data.objects.get('Nurse document printer') is not None}
parking = []
for bay in roles['equipment-parking']:
    asset = bpy.data.objects[bay['assetName']]
    lo, hi = bounds(asset)
    inside = all(lo[i] >= bay.location[i] - bay[key] / 2 - .005 and
                 hi[i] <= bay.location[i] + bay[key] / 2 + .005
                 for i, key in [(0, 'width'), (1, 'length')])
    parking.append({'asset': asset.name, 'insideBay': inside, 'min': lo, 'max': hi})
checks['equipmentInsideBays'] = all(item['insideBay'] for item in parking)

table_contacts = []
for table in roles['overbed-table']:
    room = table.parent
    floor = next(o for o in room.children if o.name.startswith('Room resilient floor'))
    floor_z = max((floor.matrix_world @ Vector(v)).z for v in floor.bound_box)
    for caster in [o for o in table.children if o.name.startswith('Table caster')]:
        evaluated = caster.evaluated_get(graph)
        gap = min((evaluated.matrix_world @ v.co).z for v in evaluated.data.vertices) - floor_z
        table_contacts.append(gap)
checks['tableCastersGrounded'] = len(table_contacts) == 32 and all(abs(g) < .002 for g in table_contacts)

v2 = base.ROOT / 'output/hospital-floor-reference-v2/hospital-floor-reference-v2.blend'
checks['preservedV2'] = base.sha(v2) == '7348803bfe4b68593e91dea890a3544d4068c6096ff76495601d8af0366007b3'
if '--source-only' not in sys.argv:
    for view in VIEWS:
        path = base.OUT / (view + '.png')
        meta = json.loads((base.OUT / (view + '-render-settings.json')).read_text())
        width, height = struct.unpack('>II', path.read_bytes()[16:24])
        expected_width = 1600 if view in {'detail', 'station'} else 2000
        valid = (base.sha(path) == meta.get('pngSha256') and
                 meta.get('sourceSha256') == report['sourceSha256'] and
                 (width, height) == (expected_width, round(expected_width * 2 / 3)) and
                 (width, height) == (meta['width'], meta['height']) and meta['samples'] >= 64 and
                 meta.get('camera') == CAMERAS[view] and meta.get('scene') == VIEWS[view])
        checks['render_' + view] = valid
        report['renderProvenance'][view] = {'width': width, 'height': height,
            'samples': meta['samples'], 'valid': valid, 'sha256': base.sha(path)}

report.update({'furnishingCounts': {role: len(objects) for role, objects in roles.items()},
               'equipmentParking': parking, 'tableCasterContacts': len(table_contacts),
               'maxTableCasterFloorGapMetres': max(abs(g) for g in table_contacts),
               'v2Preserved': checks['preservedV2'], 'v3Checks': checks})
report['failures'].extend('V3 check failed: ' + key for key, ok in checks.items() if not ok)
(base.OUT / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('HOSPITAL_FLOOR_V3_CHECKS ' + json.dumps(checks), flush=True)
if report['failures']:
    raise RuntimeError(str(report['failures']))
