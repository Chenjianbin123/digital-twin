"""Glass rear-wall variant; original source and live project assets stay unchanged."""
from pathlib import Path
import bpy,bmesh,json,math
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin')
OUT=ROOT/'output/ward-model-refinement/glass-wall'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/ward-model-refinement/v2/ward-room-hospital-v2.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
shell=bpy.data.objects['外壳']
bm=bmesh.new();bm.from_mesh(shell.data)
remove=[]
for f in bm.faces:
 points=[shell.matrix_world @ v.co for v in f.verts]
 ys=[p.y for p in points]
 if min(ys)>2.035 and max(ys)-min(ys)<.12 and abs((shell.matrix_world.to_3x3() @ f.normal).normalized().y)>.8:
  remove.append(f)
bmesh.ops.delete(bm,geom=remove,context='FACES')
bm.to_mesh(shell.data);bm.free()
old=bpy.data.objects.get('窗2')
if old:bpy.data.objects.remove(old,do_unlink=True)
root=bpy.data.objects.new('窗2',None);scene.collection.objects.link(root)
root['designProposal']=True
root['assetType']='glazed-rear-wall'
root['bindingState']='unmapped'

def mat(name,color,roughness,metal=0,transmission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True
 n=m.node_tree.nodes['Principled BSDF']
 n.inputs['Base Color'].default_value=(*color,1)
 n.inputs['Roughness'].default_value=roughness
 n.inputs['Metallic'].default_value=metal
 n.inputs['Transmission Weight'].default_value=transmission
 n.inputs['IOR'].default_value=1.45
 return m
frame=mat('GlassWall aluminum frame',(.34,.43,.43),.29,.7)
clear=mat('GlassWall clear upper glazing',(.88,.96,.97),.035,0,1)
frost=mat('GlassWall frosted lower glazing',(.83,.92,.92),.40,0,.88)
seal=mat('GlassWall glazing seal',(.055,.08,.08),.62)
added=[]
def box(name,loc,dim,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 o=bpy.context.object;o.name=name;o.dimensions=dim
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(material)
 if bevel:
  m=o.modifiers.new('Rounded frame edge','BEVEL');m.width=bevel;m.segments=3
 world=o.matrix_world.copy();o.parent=root;o.matrix_world=world
 added.append(name)
 return o
left,right,bottom,top=-2.675,.80,.906,2.898
width=right-left
for i in range(5):
 x=left+width*i/4
 box('GlassWall_Mullion_%02d'%i,(x,2.10,(top+bottom)/2),(.028,.06,top-bottom),frame,.003)
for name,z in [('Sill',bottom),('Head',top),('PrivacyRail',1.43)]:
 box('GlassWall_'+name,((left+right)/2,2.10,z),(width,.06,.027 if name!='PrivacyRail' else .015),frame,.002)
for i in range(4):
 x=left+width*(i+.5)/4
 for suffix,low,high,material in [('Clear',1.44,top-.016,clear),('Frost',bottom+.016,1.42,frost)]:
  box('GlassWall_%s_%02d'%(suffix,i),(x,2.10,(low+high)/2),(width/4-.033,.009,high-low),material)
# Keep the folds and left anchor, compress the curtain stack instead of deleting it.
curtain=bpy.data.objects.get('窗帘3')
if curtain:
 coords=[curtain.matrix_world @ v.co for v in curtain.data.vertices]
 anchor=min(p.x for p in coords)
 inverse=curtain.matrix_world.inverted()
 for vertex,point in zip(curtain.data.vertices,coords):
  point.x=anchor+(point.x-anchor)*.38
  vertex.co=inverse @ point
 curtain['curtainOpenFraction']=.62
# Preview-only outside ground gives the glazing a horizon; it is excluded from the room export.
preview_ground=box('PreviewExteriorGround',(-1,15,.88),(40,26,.025),mat('Preview ground',(.43,.48,.45),.9))
preview_ground.parent=None
preview_ground['previewOnly']=True
added.remove(preview_ground.name)
# Retain the same indoor lights and camera used by the previous comparison.
views={'overview':((.52,-3.95,2.4),(-1.35,-.3,1.45)),
       'window':((.35,-.8,1.9),(-.8,2.08,1.85))}
scene.cycles.samples=40
# Broad preview fill lights should not appear as solid white shapes in the glazing.
for light_obj in scene.objects:
 if light_obj.name=='Preview window fill':
  light_obj.location.y=1.15
  light_obj.data.size=.9
 if light_obj.type=='LIGHT':
  light_obj.visible_glossy=False
  light_obj.data.specular_factor=0
  light_obj.data.use_nodes=True
  tree=light_obj.data.node_tree
  emission=next(n for n in tree.nodes if n.type=='EMISSION')
  strength=emission.inputs['Strength'].default_value
  path=tree.nodes.new('ShaderNodeLightPath')
  inverse=tree.nodes.new('ShaderNodeMath');inverse.operation='SUBTRACT';inverse.inputs[0].default_value=1
  tree.links.new(path.outputs['Is Glossy Ray'],inverse.inputs[1])
  energy=tree.nodes.new('ShaderNodeMath');energy.operation='MULTIPLY';energy.inputs[1].default_value=strength
  tree.links.new(inverse.outputs[0],energy.inputs[0])
  tree.links.new(energy.outputs[0],emission.inputs['Strength'])
background=scene.world.node_tree.nodes.get('Background')
background.inputs[0].default_value=(.72,.83,.98,1)
background.inputs[1].default_value=.6
camera=scene.camera
camera.location=views['overview'][0]
camera.rotation_euler=(Vector(views['overview'][1])-camera.location).to_track_quat('-Z','Y').to_euler()
allowed={'designProposal','assetType','bindingState','repeatWithBedBay','curtainOpenFraction','previewOnly'}
for owner in [scene,*scene.objects]:
 for key in list(owner.keys()):
  if key not in allowed and key not in owner.bl_rna.properties:del owner[key]
scene.cycles.samples=40
assert scene.cycles.samples==40
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ward-room-glass-wall.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in {'MESH','EMPTY'} and not o.hide_render and not o.get('previewOnly'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ward-room-glass-wall.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_extras=True,export_draco_mesh_compression_enable=True)
for name,(loc,target) in views.items():
 camera.location=loc;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(OUT/(name+'.jpg'))
 bpy.ops.render.render(write_still=True)
(OUT/'report.json').write_text(json.dumps({'removedRearFaces':len(remove),'addedObjects':added,'curtainOpenFraction':.62,'liveAssetReplaced':False,'siteVerified':False,'previewEnvironmentExported':False},ensure_ascii=False,indent=2),encoding='utf8')
print('GLASS_WALL_COMPLETE')
