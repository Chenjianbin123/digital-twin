"""Add two top-hung window sashes to the review glass wall, without replacing live assets."""
from pathlib import Path
import bpy,math,json
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin')
OUT=ROOT/'output/ward-model-refinement/windows'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/ward-model-refinement/glass-wall/ward-room-glass-wall.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
root=bpy.data.objects['窗2']
frame=bpy.data.materials['GlassWall aluminum frame']
glass=bpy.data.materials['GlassWall clear upper glazing']
seal=bpy.data.materials.get('GlassWall glazing seal')
if seal is None:
 seal=bpy.data.materials.new('GlassWall glazing seal');seal.use_nodes=True
 node=seal.node_tree.nodes['Principled BSDF']
 node.inputs['Base Color'].default_value=(.055,.08,.08,1)
 node.inputs['Roughness'].default_value=.62
added=[]
def attach(obj,parent):
 bpy.context.view_layer.update()
 world=obj.matrix_world.copy()
 obj.parent=parent
 obj.matrix_world=world

def box(name,center,dimensions,material,parent,bevel=.002):
 bpy.ops.mesh.primitive_cube_add(size=1,location=center)
 obj=bpy.context.object;obj.name=name;obj.dimensions=dimensions
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 obj.data.materials.append(material)
 if bevel:
  modifier=obj.modifiers.new('Machined edge','BEVEL');modifier.width=bevel;modifier.segments=3
 attach(obj,parent)
 added.append(name)
 return obj

left,right=-2.675,.80
pitch=(right-left)/4
sashes=[]
for index in [1,2]:
 old=bpy.data.objects['GlassWall_Clear_%02d'%index]
 bpy.data.objects.remove(old,do_unlink=True)
 x=left+pitch*(index+.5)
 outer_width=pitch-.032
 bottom,top=2.09,2.88
 # Retain the fixed glazing below the opening: no overlapping full-height pane behind the sash.
 box('Window_%02d_FixedLower'%index,(x,2.10,(1.44+bottom-.02)/2),(outer_width,.009,bottom-.02-1.44),glass,root,0)
 for side,px in [('Left',x-outer_width/2+.012),('Right',x+outer_width/2-.012)]:
  box('Window_%02d_Outer%s'%(index,side),(px,2.10,(top+bottom)/2),(.026,.070,top-bottom),frame,root)
 for side,z in [('Top',top),('Bottom',bottom)]:
  box('Window_%02d_Outer%s'%(index,side),(x,2.10,z),(outer_width,.070,.027),frame,root)
 sash=bpy.data.objects.new('Window_%02d_Sash'%index,None)
 scene.collection.objects.link(sash)
 sash.location=(x,2.075,top-.015)
 attach(sash,root)
 sash['assetType']='top-hung-window'
 sash['bindingState']='unmapped'
 sash['designProposal']=True
 sash['openingAngleDegrees']=8 if index==1 else 0
 sash_width=outer_width-.055
 lower,upper=bottom+.035,top-.029
 for side,px in [('Left',x-sash_width/2+.012),('Right',x+sash_width/2-.012)]:
  box('Window_%02d_Sash%s'%(index,side),(px,2.072,(lower+upper)/2),(.026,.038,upper-lower),frame,sash)
 for side,z in [('Top',upper),('Bottom',lower)]:
  box('Window_%02d_Sash%s'%(index,side),(x,2.072,z),(sash_width,.038,.029),frame,sash)
 box('Window_%02d_Glass'%index,(x,2.078,(lower+upper)/2),(sash_width-.036,.009,upper-lower-.034),glass,sash,0)
 for side,px in [('Left',x-sash_width/2+.029),('Right',x+sash_width/2-.029)]:
  box('Window_%02d_Seal%s'%(index,side),(px,2.057,(lower+upper)/2),(.005,.008,upper-lower-.035),seal,sash,.001)
 box('Window_%02d_HandleBase'%index,(x,2.042,lower+.067),(.035,.014,.064),seal,sash,.006)
 box('Window_%02d_HandleNeck'%index,(x,2.018,lower+.074),(.017,.038,.019),frame,sash,.004)
 box('Window_%02d_HandleGrip'%index,(x,1.999,lower+.04),(.021,.019,.084),frame,sash,.006)
 for h,px in enumerate([x-sash_width*.30,x+sash_width*.30]):
  box('Window_%02d_Hinge%d'%(index,h),(px,2.07,top-.012),(.095,.027,.025),frame,root,.006)
 sash.rotation_mode='XYZ'
 sash.rotation_euler.x=math.radians(sash['openingAngleDegrees'])
 sashes.append(sash)
bpy.context.view_layer.update()
assert len(sashes)==2 and abs(sashes[0].rotation_euler.x-math.radians(8))<1e-6
camera=scene.camera
views={'overview':((.52,-3.95,2.4),(-1.35,-.3,1.45),24),
       'window-detail':((-.2,-.9,2.15),(-.85,2.10,2.05),28)}
camera.location=views['overview'][0]
camera.rotation_euler=(Vector(views['overview'][1])-camera.location).to_track_quat('-Z','Y').to_euler()
scene.cycles.samples=40
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ward-room-with-windows.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
 if obj.type in {'MESH','EMPTY'} and not obj.hide_render and not obj.get('previewOnly'):obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ward-room-with-windows.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True)
for name,(location,target,lens) in views.items():
 camera.location=location;camera.data.lens=lens
 camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(OUT/(name+'.jpg'))
 bpy.ops.render.render(write_still=True)
(OUT/'report.json').write_text(json.dumps({'windows':[{'name':s.name,'openingAngleDegrees':s['openingAngleDegrees']} for s in sashes],'addedObjects':added,'liveAssetReplaced':False,'interactiveControlImplemented':False},ensure_ascii=False,indent=2),encoding='utf8')
print('WINDOWS_COMPLETE')
