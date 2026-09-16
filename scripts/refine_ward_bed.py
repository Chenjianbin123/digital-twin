"""Refine the verified bed unit without changing its runtime anchors or screen mesh."""
import bpy, math, json
import numpy as np
from pathlib import Path
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin'); OUT=ROOT/'output/ward-model-refinement/bed-refined';OUT.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/smart-ward-interior/bed-unit-v3.glb'))
scene=bpy.context.scene; unit=bpy.data.objects['BedUnit']; original=set(scene.objects)
def mat(name,color,rough=.5,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
def box(name,loc,scale,material,parent=None,bevel=.003):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material)
 if bevel:
  mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
 if parent:o.parent=parent
 return o
def aim(o,target):o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
# Identical lighting and camera for the before/after inspection.
floor=box('PreviewFloor',(0,0,-.025),(7,7,.04),mat('Preview neutral floor',(.48,.51,.49)),bevel=0)
bpy.ops.object.camera_add(location=(2.9,-3.5,2.4));cam=bpy.context.object;aim(cam,(.2,.15,.65));cam.data.lens=48;scene.camera=cam
for loc,power,size in [((1,-1,4),400,3),((-2,-1,2.5),250,2),((0,2,3),250,2)]:
 bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;aim(l,(0,0,.5))
scene.world=bpy.data.worlds.new('ReviewWorld');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.7,.8,.95,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.4
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=1400;scene.render.resolution_y=1100;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=94
if not (OUT/'before.jpg').exists():
 scene.render.filepath=str(OUT/'before.jpg');bpy.ops.render.render(write_still=True)
white=mat('Bed warm white moulded polymer',(.78,.82,.81),.32)
teal=mat('Bed muted sage polymer',(.27,.49,.48),.4)
steel=mat('Bed satin stainless steel',(.57,.62,.64),.42,.45)
rubber=mat('Bed non marking rubber',(.065,.082,.085),.78)
linen=mat('Bed fine woven linen',(.77,.84,.84),.92)
mattress=mat('Bed mattress woven side',(.40,.56,.58),.88)
# Exportable normal texture; microscopic weave remains restrained at room scale.
y,x=np.mgrid[0:256,0:256];h=np.sin(x*math.pi/2)*np.cos(y*math.pi/2);dy,dx=np.gradient(h*.055);n=np.stack([-dx,-dy,np.ones_like(dx)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True);pixels=np.ones((256,256,4),np.float32);pixels[:,:,:3]=n*.5+.5
im=bpy.data.images.new('Bed woven normal',width=256,height=256);im.colorspace_settings.name='Non-Color';im.pixels.foreach_set(pixels.ravel());im.filepath_raw=str(OUT/'bed-weave-normal.png');im.file_format='PNG';im.save();im.pack()
for m in [linen,mattress]:
 t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=im;normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.25;m.node_tree.links.new(t.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],m.node_tree.nodes['Principled BSDF'].inputs['Normal'])
body=bpy.data.objects['BedBody']; replacements={'材质.019':linen,'材质.017':mattress,'材质.001':white,'铁':steel,'更淡-青蓝.001':teal,'Archmodels70_015_08.001':steel,'Archmodels70_015_02':rubber,'材质.008':steel,'金属.001':steel}
for i,m in enumerate(body.data.materials):
 if m.name in replacements:body.data.materials[i]=replacements[m.name]
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.mesh.customdata_custom_splitnormals_clear()
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=0.00001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
for name,materials in [('CabinetBody',[teal,white,teal]),('CabinetHandle',[steel]),('BedHeadWall',[mat('Bed head wall washable warm finish',(.69,.72,.69),.72)]),('BedHeadServicePanel',[white,teal]),('BedChair',[steel,mat('Chair washable sage upholstery',(.23,.38,.36),.65)])]:
 o=bpy.data.objects[name]
 for i in range(len(o.data.materials)):o.data.materials[i]=materials[min(i,len(materials)-1)]
# New geometry is authored in normalized bed coordinates under the existing root.
box('Cabinet_CleanableTop',(.9236,.693,.437),(.357,.337,.015),white,unit,.007)
# Mattress piping follows the original flat mattress perimeter, below the linen.
cu=bpy.data.curves.new('Mattress edge piping','CURVE');cu.dimensions='3D';cu.bevel_depth=.002;cu.bevel_resolution=3
s=cu.splines.new('POLY');pts=[]
for cx,cy,start in [(.38,.75,0),(-.38,.75,90),(-.38,-.75,180),(.38,-.75,270)]:
 for k in range(13):
  a=math.radians(start+k*90/12);pts.append((cx+.015*math.cos(a),cy+.015*math.sin(a),.314,1))
s.points.add(len(pts)-1)
for p,co in zip(s.points,pts):p.co=co
s.use_cyclic_u=True;o=bpy.data.objects.new('Mattress_PerimeterPiping',cu);scene.collection.objects.link(o);o.data.materials.append(white);o.parent=unit
bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');o.select_set(False)
for x in [-.345,.345]:
 for y in [-.70,.70]:box('Caster_BrakePedal', (x,y-.025,.065),(.037,.055,.010),teal,unit,.003)
# The screen surface is deliberately untouched: patient content belongs to runtime.
scene.render.filepath=str(OUT/'after.jpg');bpy.ops.render.render(write_still=True)
assets=set(unit.children_recursive)|{unit}
bpy.ops.object.select_all(action='DESELECT')
for o in assets:o.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'bed-unit-refined.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'bed-unit-refined.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_draco_mesh_compression_enable=True)
print('BED_REFINED_EXPORTED')
