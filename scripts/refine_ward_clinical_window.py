"""A conventional recessed ward window proposal, kept separate from live assets."""
from pathlib import Path
import bpy,math,json
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin')
OUT=ROOT/'output/ward-model-refinement/clinical-window'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/ward-model-refinement/glass-wall/ward-room-glass-wall.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene
old=bpy.data.objects['窗2']
for obj in list(old.children_recursive):bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.objects.remove(old,do_unlink=True)
root=bpy.data.objects.new('窗2',None);scene.collection.objects.link(root)
root['designProposal']=True;root['assetType']='recessed-ward-window';root['bindingState']='unmapped'
def material(name,color,roughness=.5,metallic=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF']
 n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=roughness;n.inputs['Metallic'].default_value=metallic
 return m
wall=bpy.data.materials['Ward warm cleanable wall']
white=material('WardWindow powder coated white',(.80,.82,.79),.36)
sill=material('WardWindow pale solid sill',(.75,.77,.73),.42)
seal=material('WardWindow thin seals',(.075,.095,.09),.75)
steel=material('WardWindow satin handle',(.48,.52,.52),.3,.75)
glass=bpy.data.materials['GlassWall clear upper glazing']
added=[]
def box(name,loc,dim,mat,parent=root,bevel=.002,preview=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
 o=bpy.context.object;o.name=name;o.dimensions=dim
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat)
 if bevel:
  mod=o.modifiers.new('Soft manufactured edge','BEVEL');mod.width=bevel;mod.segments=3
 bpy.context.view_layer.update();world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
 if preview:o['previewOnly']=True
 else:added.append(name)
 return o
left,right,bottom,top=-2.50,-.05,1.60,2.78
outer_left,outer_right,floor,ceiling=-2.675,.80,.906,2.947
box('WardWindow_WallBelow',((outer_left+outer_right)/2,2.15,(floor+bottom)/2),(outer_right-outer_left,.14,bottom-floor),wall)
box('WardWindow_WallAbove',((outer_left+outer_right)/2,2.15,(top+ceiling)/2),(outer_right-outer_left,.14,ceiling-top),wall)
box('WardWindow_LeftReturn',((outer_left+left)/2,2.15,(bottom+top)/2),(left-outer_left,.14,top-bottom),wall)
box('WardWindow_RightReturn',((right+outer_right)/2,2.15,(bottom+top)/2),(outer_right-right,.14,top-bottom),wall)
box('WardWindow_Sill',((left+right)/2,2.10,bottom),(right-left+.10,.25,.035),sill,bevel=.008)
base=bpy.data.materials['Ward coved base']
box('WardWindow_BaseTrim',((outer_left+outer_right)/2,2.065,.955),(outer_right-outer_left,.025,.098),base,bevel=.006)
for side,x in [('Left',left+.03),('Right',right-.03)]:
 box('WardWindow_Frame'+side,(x,2.125,(bottom+top)/2),(.06,.08,top-bottom),white,bevel=.004)
for side,z in [('Head',top-.03),('Base',bottom+.034)]:
 box('WardWindow_Frame'+side,((left+right)/2,2.125,z),(right-left-.12,.08,.06),white,bevel=.004)
divisions=[left+.60,right-.60]
for i,x in enumerate(divisions):box('WardWindow_Mullion%d'%i,(x,2.125,(bottom+top)/2),(.058,.08,top-bottom-.12),white,bevel=.004)
ranges=[(left+.061,divisions[0]-.032),(divisions[0]+.032,divisions[1]-.032),(divisions[1]+.032,right-.061)]
for i,(lo,hi) in enumerate(ranges):
 cx=(lo+hi)/2;low,high=bottom+.068,top-.065
 parent=root
 if i!=1:
  parent=bpy.data.objects.new('WardWindow_Casement_%d'%i,None);scene.collection.objects.link(parent);parent.parent=root
  parent['assetType']='window-sash';parent['bindingState']='unmapped';parent['openingAngleDegrees']=0
  for label,x in [('Left',lo+.014),('Right',hi-.014)]:box('WardWindow_Sash%d_%s'%(i,label),(x,2.097,(low+high)/2),(.028,.035,high-low),white,parent)
  for label,z in [('Top',high-.014),('Bottom',low+.014)]:box('WardWindow_Sash%d_%s'%(i,label),(cx,2.097,z),(hi-lo-.056,.035,.028),white,parent)
  handle_x=hi-.064 if i==0 else lo+.064
  box('WardWindow_HandlePlate%d'%i,(handle_x,2.068,2.14),(.025,.016,.065),white,parent,.004)
  box('WardWindow_HandleNeck%d'%i,(handle_x,2.049,2.15),(.015,.032,.017),steel,parent,.003)
  box('WardWindow_Handle%d'%i,(handle_x,2.032,2.12),(.017,.018,.078),steel,parent,.005)
  lo+=.034;hi-=.034;low+=.034;high-=.034
 box('WardWindow_Glazing%d'%i,((lo+hi)/2,2.145,(low+high)/2),(hi-lo,.009,high-low),glass,parent,0)
 for label,x in [('L',lo),('R',hi)]:box('WardWindow_Seal%d%s'%(i,label),(x,2.132,(low+high)/2),(.004,.006,high-low),seal,parent,.001)
curtain=bpy.data.objects.get('窗帘3')
if curtain:
 coords=[curtain.matrix_world @ v.co for v in curtain.data.vertices];anchor=min(p.x for p in coords);inverse=curtain.matrix_world.inverted()
 for v,p in zip(curtain.data.vertices,coords):p.x=anchor+(p.x-anchor)*.60;p.y-=.05;v.co=inverse@p
rod=bpy.data.objects.get('窗帘杆')
if rod:
 rod.data.materials.clear();rod.data.materials.append(white)
 for poly in rod.data.polygons:poly.material_index=0
scene.cycles.samples=32
views={'overview':((.52,-3.95,2.4),(-1.35,-.3,1.45),24),'window-detail':((-.2,-.9,2.15),(-.85,2.10,2.05),28)}
camera=scene.camera;camera.location=views['overview'][0];camera.data.lens=24
camera.rotation_euler=(Vector(views['overview'][1])-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ward-room-clinical-window.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in {'MESH','EMPTY'} and not o.hide_render and not o.get('previewOnly'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ward-room-clinical-window.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True)
for name,(loc,target,lens) in views.items():
 camera.location=loc;camera.data.lens=lens;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(OUT/(name+'.jpg'));bpy.ops.render.render(write_still=True)
(OUT/'report.json').write_text(json.dumps({'style':'recessed three-part white window with solid lower wall','addedObjects':added,'previewLandscapeIsSiteReference':False,'liveAssetReplaced':False},ensure_ascii=False,indent=2),encoding='utf8')
print('CLINICAL_WINDOW_COMPLETE')
