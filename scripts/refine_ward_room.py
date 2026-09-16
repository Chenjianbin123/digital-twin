"""Create an isolated empty-ward refinement sample; keep live assets/configuration untouched."""
from pathlib import Path
import json, math
import bpy, bmesh
from mathutils import Vector
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/ward-model-refinement'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT/'areaRoom-noBed-working.blend'), load_ui=False, use_scripts=False)
assets = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# Missing height textures must not feed displacement during either comparison render.
missing_displacement=[]
for material in bpy.data.materials:
    if not material.use_nodes: continue
    tree=material.node_tree
    missing=[n for n in tree.nodes if n.type=='TEX_IMAGE' and n.image and 'Displacement' in n.image.name and not n.image.packed_file and not Path(bpy.path.abspath(n.image.filepath)).is_file()]
    if missing:
        for node in tree.nodes:
            if node.type=='OUTPUT_MATERIAL':
                for link in list(node.inputs['Displacement'].links): tree.links.remove(link)
        for node in missing:
            missing_displacement.append({'material':material.name,'image':node.image.name})
            tree.nodes.remove(node)
for obj in list(bpy.context.scene.objects):
    if obj.type in {'LIGHT','CAMERA'}: bpy.data.objects.remove(obj, do_unlink=True)
def bounds(obj):
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return [[min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]]
original = {o.name: bounds(o) for o in assets if o.type == 'MESH'}
def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=1000
scene.render.resolution_y=700
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='JPEG'
scene.render.image_settings.quality=92
scene.world=bpy.data.worlds.new('Preview daylight')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.72,0.8,0.9,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.25
scene.view_settings.view_transform='AgX'
for i,y in enumerate([-2.5,.3]):
    data=bpy.data.lights.new('Preview indoor '+str(i),'AREA');data.energy=80;data.shape='DISK';data.size=2
    obj=bpy.data.objects.new(data.name,data);scene.collection.objects.link(obj);obj.location=(-.7,y,2.78)
    aim(obj,(-1,y,1))
data=bpy.data.cameras.new('Preview camera');camera=bpy.data.objects.new('Preview camera',data);scene.collection.objects.link(camera)
scene.camera=camera;camera.data.lens=24;camera.data.clip_start=.03
views={'overview':((.52,-3.95,2.4),(-1.35,-.3,1.45)), 'window':((.35,-.8,1.9),(-.25,2.08,1.85)), 'door':((-.8,-1.1,1.7),(.78,-2.45,1.6))}
def render(stage):
    for name,(position,target) in views.items():
        camera.location=position;aim(camera,target)
        scene.render.filepath=str(OUT/f'{stage}-{name}.jpg')
        bpy.ops.render.render(write_still=True)
render('before')
changes=[]
for name,width in [('外壳',.003),('底边条',.002),('窗2',.0015),('门',.0015),('窗帘杆',.001)]:
    obj=bpy.data.objects.get(name)
    if obj is None or obj.type!='MESH':continue
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    # Weld only coincident points so manufactured edges can receive a continuous bevel.
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bm.to_mesh(obj.data);bm.free()
    modifier=obj.modifiers.new('Small manufactured edge bevel','BEVEL');modifier.width=width;modifier.segments=3;modifier.limit_method='ANGLE';modifier.angle_limit=math.radians(35);modifier.use_clamp_overlap=True
    changes.append({'object':name,'bevel':width})
light=bpy.data.objects.get('灯')
if light:
    bpy.ops.object.select_all(action='DESELECT');light.select_set(True);bpy.context.view_layer.objects.active=light
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    normal=light.matrix_world.to_3x3() @ light.data.polygons[0].normal
    solid=light.modifiers.new('Ceiling panel thickness above original underside','SOLIDIFY');solid.thickness=.012;solid.offset=1 if normal.z>=0 else -1
    bevel=light.modifiers.new('Diffuser edge','BEVEL');bevel.width=.001;bevel.segments=2
    changes.append({'object':'灯','thickness':.012})
# Preserve color maps. Separate surface response instead of recoloring the room.
for name,roughness,metallic in [('门框',.38,.35),('天花板杆',.4,.55),('深蓝',.4,.35),('门周',.5,0),('门口机周.002',.42,0),('材质.020',.28,.7),('蓝色纹理.001',.88,0),('白色光滑.003',.6,0),('lambert13',.58,0)]:
    material=bpy.data.materials.get(name)
    if not material or not material.use_nodes:continue
    node=next((n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if not node:continue
    for key,value in [('Roughness',roughness),('Metallic',metallic)]:
        socket=node.inputs[key]
        if not socket.is_linked:socket.default_value=value
    changes.append({'material':name,'roughness':roughness,'metallic':metallic})
# Keep the editable modifiers and packed texture sources in the reviewable Blender file.
# Recovered textures are already packed; do not pack unused missing source datablocks.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ward-room-refined-v1.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in assets:obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'noBed-refined-v1.glb'),export_format='GLB',use_selection=True,export_apply=True,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
evaluated=bpy.context.evaluated_depsgraph_get()
updated={o.name:bounds(o.evaluated_get(evaluated)) for o in assets if o.type=='MESH'}
(OUT/'refinement-report.json').write_text(json.dumps({'missingDisplacementDisabled':missing_displacement,'changes':changes,'beforeBounds':original,'afterBounds':updated},ensure_ascii=False,indent=2),encoding='utf8')
render('after')
print('REFINEMENT_COMPLETE')
