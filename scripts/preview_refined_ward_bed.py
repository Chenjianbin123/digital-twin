import bpy,math,json
from pathlib import Path
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin');OUT=ROOT/'output/ward-model-refinement/bed-refined'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/ward-model-refinement/plants/ward-room-with-plants.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
for o in scene.objects:
 if o.name.startswith('cgaxis_models_55_07_'):o.location+=Vector((2,-2.4,0))
 if o.name in ['Medicinal_Props.020_Medical_Props_0.005','Medicinal_Props.020_Medical_Props_0.002']:o.hide_render=True
report=[]
for i,z in enumerate([-.070125,2.301]):
 before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/'bed-unit-refined.glb'));imported=set(scene.objects)-before
 unit=next(o for o in imported if o.name.startswith('BedUnit') and not o.parent)
 for name in ['BedBody','BedsideCabinet','BedTerminal','IVStand','InfusionEquipment','BedTerminalSurface']:
  assert any(o.name==name or o.name.startswith(name+'.') for o in imported),name
 screen=next(o for o in imported if o.name.startswith('BedTerminalSurface'));assert screen.type=='MESH' and len(screen.data.vertices)>0
 unit.location=(-1.670222,-z,.903284);unit.rotation_mode='XYZ';unit.rotation_euler=(0,0,math.pi/2);bpy.context.view_layer.update()
 body=next(o for o in imported if o.name.startswith('BedBody'));coords=[body.matrix_world@Vector(c) for c in body.bound_box];dims=[max(c[a] for c in coords)-min(c[a] for c in coords) for a in range(3)];assert dims[0]>dims[1]
 report.append({'slot':i,'bodyDimensions':dims,'screenVertexCount':len(screen.data.vertices)})
 for o in imported:
  if 'CurtainRail' in o.name:o.visible_shadow=False
scene.cycles.samples=32;scene.camera.data.lens=22
scene.render.filepath=str(OUT/'room-overview.jpg');bpy.ops.render.render(write_still=True)
(OUT/'validation.json').write_text(json.dumps(report,indent=2))
print('ROUNDTRIP_ROOM_PREVIEW_COMPLETE')
