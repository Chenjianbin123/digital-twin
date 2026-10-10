"""Inspect native sources without writing them."""
import json
import sys
from collections import Counter
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
kind = sys.argv[sys.argv.index('--') + 1]
source = ROOT / ('output/hospital-floor-reference-v4/hospital-floor-reference-v4.blend' if kind == 'floor'
                 else 'output/hospital-exterior-reference-v3/hospital-exterior-reference-v3.blend')
bpy.ops.wm.open_mainfile(filepath=str(source))
if kind == 'floor':
    bpy.context.window.scene = bpy.data.scenes['Floor_Light']
scene = bpy.context.scene
roots = []
for obj in scene.objects:
    if obj.parent is None:
        roots.append({'name': obj.name, 'type': obj.type, 'children': len(obj.children_recursive),
                      'location': list(obj.location), 'hidden': obj.hide_render})
camera = bpy.data.objects['Floor_Overview_Camera' if kind == 'floor' else 'Reference_Hero_Camera']
report = {'roots': roots, 'camera': {'matrix': [list(row) for row in camera.matrix_world],
    'type': camera.data.type, 'scale': camera.data.ortho_scale},
    'meshes': len([o for o in scene.objects if o.type == 'MESH']),
    'materials': [{'name': m.name, 'color': list(m.diffuse_color)} for m in bpy.data.materials],
    'prefixes': Counter(o.name.split('.')[0] for o in scene.objects if o.type == 'MESH').most_common(70)}
out = ROOT / 'output/hospital-navigation-3d'
out.mkdir(parents=True, exist_ok=True)
(out / (kind + '-inspection.json')).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('INSPECTED', kind, len(roots), 'roots', flush=True)
