"""Build a reviewable hospital-room design variant from the recovered Blender source.

New facilities are design proposals, not surveyed hospital assets. Never replaces live GLBs.
"""
from pathlib import Path
import json
import math
import sys
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/ward-model-refinement/v2'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(OUT.parent / 'areaRoom-noBed-working.blend'),
                         load_ui=False, use_scripts=False)
scene = bpy.context.scene
original = {o.name: [list(o.matrix_world @ Vector(c)) for c in o.bound_box]
            for o in scene.objects if o.type == 'MESH'}
for material in bpy.data.materials:
    if not material.use_nodes:
        continue
    tree = material.node_tree
    missing = [n for n in tree.nodes if n.type == 'TEX_IMAGE' and n.image
               and 'Displacement' in n.image.name and not n.image.packed_file
               and not Path(bpy.path.abspath(n.image.filepath)).is_file()]
    if missing:
        for node in tree.nodes:
            if node.type == 'OUTPUT_MATERIAL':
                for link in list(node.inputs['Displacement'].links):
                    tree.links.remove(link)
        for node in missing:
            tree.nodes.remove(node)
for obj in list(scene.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()


scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 980
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 95
scene.view_settings.view_transform = 'AgX'
scene.world = bpy.data.worlds.new('Ward review daylight')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.82, .88, 1, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .25
for i, y in enumerate([-2.5, .3]):
    data = bpy.data.lights.new(f'Preview ceiling {i}', 'AREA')
    data.energy, data.size, data.color = 95, 2, (1, .94, .85)
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = (-.65, y, 2.78)
    aim(obj, (-1, y, 1))
data = bpy.data.lights.new('Preview window fill', 'AREA')
data.energy, data.size = 65, 1.7
obj = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(obj)
obj.location = (-.35, 1.85, 2.45)
aim(obj, (-1, -1, 1.4))
data = bpy.data.cameras.new('Review camera')
camera = bpy.data.objects.new(data.name, data)
scene.collection.objects.link(camera)
scene.camera = camera
camera.data.lens, camera.data.clip_start = 24, .03
views = {
    'overview': ((.52, -3.95, 2.4), (-1.35, -.3, 1.45)),
    'door': ((-.8, -1.1, 1.7), (.78, -2.45, 1.6)),
    'window': ((.35, -.8, 1.9), (-.25, 2.08, 1.85)),
}


def render(stage, selected=views):
    for name, (position, target) in selected.items():
        camera.location = position
        aim(camera, target)
        scene.render.filepath = str(OUT / f'{stage}-{name}.jpg')
        bpy.ops.render.render(write_still=True)


if '--after-only' not in sys.argv:
    render('before')
added = []


def material(name, color, roughness=.5, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Metallic'].default_value = metallic
    return mat


wall = material('Ward warm cleanable wall', (.72, .74, .70), .82)
ceiling = material('Ward matte ceiling', (.84, .85, .82), .88)
lower = material('Ward lower wall protection', (.43, .57, .54), .58)
rail = material('Ward rounded impact rail', (.20, .36, .34), .46)
trim = material('Ward coved base', (.36, .44, .42), .55)
white = material('Ward equipment polymer', (.81, .84, .81), .38)
steel = material('Ward brushed stainless', (.46, .50, .52), .3, .85)
dark = material('Ward recess and seals', (.035, .055, .055), .7)
diffuser = material('Ward light diffuser', (.92, .93, .87), .38)
diffuser.node_tree.nodes['Principled BSDF'].inputs['Emission Color'].default_value = (.9, .92, .82, 1)
diffuser.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .65
floor = material('Ward seamless vinyl', (.6, .62, .57), .48)
# An embedded, deterministic color texture also survives glTF export, unlike procedural shader noise.
rng = np.random.default_rng(4271)
size = 512
grain = rng.normal(0, .007, (size, size, 1))
pixels = np.ones((size, size, 4), dtype=np.float32)
pixels[:, :, :3] = np.clip(np.array([.68, .70, .66]) + grain, 0, 1)
speckles = rng.random((size, size)) < .018
pixels[speckles, :3] *= .90
img = bpy.data.images.new('Ward vinyl subtle grain', width=size, height=size)
img.pixels.foreach_set(pixels.ravel())
img.filepath_raw = str(OUT / 'vinyl-grain.png')
img.file_format = 'PNG'
img.save()
img.pack()
tex = floor.node_tree.nodes.new('ShaderNodeTexImage')
tex.image = img
floor.node_tree.links.new(tex.outputs['Color'], floor.node_tree.nodes['Principled BSDF'].inputs['Base Color'])

shell = bpy.data.objects['外壳']
shell.data.materials.clear()
for mat in [wall, floor, ceiling]:
    shell.data.materials.append(mat)
uv = shell.data.uv_layers.active or shell.data.uv_layers.new(name='UVMap')
for polygon in shell.data.polygons:
    coords = [shell.matrix_world @ shell.data.vertices[shell.data.loops[i].vertex_index].co
              for i in polygon.loop_indices]
    heights = [v.z for v in coords]
    polygon.material_index = 1 if max(heights) < .93 else 2 if min(heights) > 2.90 else 0
    if polygon.material_index == 1:
        for i, v in zip(polygon.loop_indices, coords):
            uv.data[i].uv = (v.x / .65, v.y / .65)
# Reduce the original blue checkerboard ceiling to a quiet neutral surface.
lamp = bpy.data.objects['灯']
# The original detached panels leave dark open gaps; retain the runtime node but rebuild a closed lining.
ceiling_mesh = bpy.data.meshes.new('Ward continuous ceiling lining')
ceiling_mesh.from_pydata([(-2.70, -4.18, 2.947), (.81, -4.18, 2.947),
                         (.81, 2.087, 2.947), (-2.70, 2.087, 2.947)], [], [(3, 2, 1, 0)])
inverse = lamp.matrix_world.inverted()
for vertex in ceiling_mesh.vertices:
    vertex.co = inverse @ vertex.co
lamp.data = ceiling_mesh
lamp.data.materials.append(ceiling)
for polygon in lamp.data.polygons:
    polygon.material_index = 0
skirt = bpy.data.objects.get('底边条')
if skirt:
    skirt.data.materials.clear()
    skirt.data.materials.append(trim)
    for polygon in skirt.data.polygons:
        polygon.material_index = 0


def parent_keep_world(obj, parent):
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = world


def box(name, center, dimensions, mat, bevel=.004, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new('Manufactured soft edge', 'BEVEL')
        mod.width, mod.segments = bevel, 3
    if parent:
        parent_keep_world(obj, parent)
    obj['designProposal'] = True
    added.append(obj.name)
    return obj


# Continuous profiles belong to the shell so future room-length changes can extend them.
box('WallProtection_BedSide', (-2.667, -1.05, 1.225), (.025, 6.20, .61), lower, .006, shell)
box('ImpactRail_BedSide', (-2.631, -1.05, 1.445), (.065, 6.12, .085), rail, .02, shell)
box('WallProtection_ServiceSide', (.793, .085, 1.225), (.025, 3.91, .61), lower, .006, shell)
box('ImpactRail_ServiceSide', (.757, .085, 1.445), (.065, 3.83, .085), rail, .02, shell)
box('WallProtection_EntrySide', (.793, -3.52, 1.225), (.025, 1.22, .61), lower, .006, shell)
box('ImpactRail_EntrySide', (.757, -3.52, 1.445), (.065, 1.14, .085), rail, .02, shell)


def cove(name, x, y_start, y_end, sign):
    # Curved floor-to-wall profile, not a dark rectangular strip.
    radius = .025
    profile = [(x, 1.005), (x, .928)]
    for step in range(9):
        angle = math.pi + math.pi / 2 * step / 8
        profile.append((x + sign * radius * (1 + math.cos(angle)), .928 + radius * math.sin(angle)))
    verts = [(px, y, z) for y in [y_start, y_end] for px, z in profile]
    n = len(profile)
    faces = [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.materials.append(trim)
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    parent_keep_world(obj, shell)
    added.append(name)


cove('CovedBase_BedSide', -2.648, -4.14, 2.04, 1)
cove('CovedBase_ServiceSide', .774, -1.94, 2.04, -1)
cove('CovedBase_EntrySide', .774, -4.14, -2.92, -1)
for i, y in enumerate([.35, -2.35]):
    fixture = box(f'CeilingLight_{i+1}', (-.65, y, 2.926), (.42, 1.08, .025), steel, .006, lamp)
    box(f'CeilingDiffuser_{i+1}', (-.65, y, 2.909), (.38, 1.04, .009), diffuser, .004, fixture)
    fixture['repeatWithBedBay'] = True
vent = box('CeilingVent_Frame', (.32, -.65, 2.925), (.31, .48, .02), white, .006, lamp)
box('CeilingVent_Recess', (.32, -.65, 2.912), (.26, .43, .008), dark, .003, vent)
for i in range(9):
    box(f'CeilingVent_Slat_{i:02}', (.32, -.845 + i * .048, 2.903), (.26, .018, .01), white, .002, vent)

door = bpy.data.objects['门']
door.data.materials[0] = steel
door.data.materials[1] = white
door.data.materials[2] = material('Ward muted teal door', (.19, .37, .36), .42)
door.data.materials[3] = material('Ward door vision glass', (.20, .30, .31), .18, .15)
box('Door_KickPlate', (.734, -2.447, 1.06), (.008, .70, .23), steel, .004, door)
box('Door_Closer', (.724, -2.43, 2.165), (.043, .18, .043), steel, .006, door)

# A recognizable hand-rub dispenser beside the entrance, independently identifiable for future binding.
dispenser = box('HandRubDispenser', (.732, -1.73, 1.72), (.12, .115, .20), white, .018, shell)
dispenser['assetType'] = 'hand-hygiene-dispenser'
dispenser['bindingState'] = 'unmapped'
box('HandRub_LevelWindow', (.664, -1.73, 1.69), (.008, .046, .075), rail, .004, dispenser)
box('HandRub_Lever', (.657, -1.73, 1.818), (.033, .088, .018), steel, .004, dispenser)
box('HandRub_DripTray', (.70, -1.73, 1.585), (.18, .14, .018), white, .005, dispenser)
sign = box('HandHygiene_Sign', (.785, -1.73, 1.955), (.012, .20, .15), rail, .006, shell)
font = bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc')


def wall_text(name, body, location, size, parent):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body, curve.size, curve.align_x = body, size, 'CENTER'
    curve.font = font
    curve.extrude = .0001
    obj = bpy.data.objects.new(name, curve)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    curve.materials.append(white)
    bpy.context.view_layer.update()
    parent_keep_world(obj, parent)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.object.convert(target='MESH')
    added.append(obj.name)


wall_text('HandHygiene_Label', '手部消毒', (.777, -1.73, 1.954), .032, sign)
wall_text('HandHygiene_Subtitle', 'HAND HYGIENE', (.777, -1.73, 1.919), .016, sign)
# Material changes are local to room fittings; bed-terminal textures stay untouched.
for name in ['窗帘3', '窗帘1']:
    curtain = bpy.data.objects.get(name)
    if curtain:
        for slot in curtain.material_slots:
            if slot.material and slot.material.use_nodes:
                slot.material = slot.material.copy()
                for node in slot.material.node_tree.nodes:
                    if node.type == 'BSDF_PRINCIPLED':
                        for link in list(node.inputs['Base Color'].links):
                            slot.material.node_tree.links.remove(link)
                        node.inputs['Base Color'].default_value = (.27, .46, .45, 1)
                        node.inputs['Metallic'].default_value = 0
                        if not node.inputs['Roughness'].is_linked:
                            node.inputs['Roughness'].default_value = .88
for name in ['外壳', '门', '窗2']:
    obj = bpy.data.objects[name]
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('Edge highlights', 'BEVEL')
    mod.width, mod.segments = .002, 3

# Do not ship stale authoring add-on properties as runtime glTF extras.
allowed_extras = {'designProposal', 'repeatWithBedBay', 'assetType', 'bindingState'}
for owner in [scene, *scene.objects]:
    for key in list(owner.keys()):
        if key not in allowed_extras and key not in owner.bl_rna.properties:
            del owner[key]
camera.location = views['overview'][0]
aim(camera, views['overview'][1])
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'ward-room-hospital-v2.blend'))
bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type == 'MESH' and not obj.hide_render:
        obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'ward-room-hospital-v2.glb'), export_format='GLB',
                          use_selection=True, export_apply=True, export_cameras=False,
                          export_lights=False, export_extras=True,
                          export_draco_mesh_compression_enable=True)
render('after')
(OUT / 'design-report.json').write_text(json.dumps({
    'source': 'areaRoom-noBed-working.blend', 'addedObjects': added,
    'originalObjectBounds': original, 'liveAssetReplaced': False,
    'siteVerified': False,
    'integrationPending': ['Repeat ceiling fixtures with added bed bays',
                           'Map dispenser to a real asset only after site confirmation',
                           'Verify Three.js materials, shadows and selection'],
}, ensure_ascii=False, indent=2), encoding='utf8')
print('HOSPITAL_ROOM_V2_COMPLETE', flush=True)
