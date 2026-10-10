"""Refine the editable v1 corridor against its original concept; keep all screen anchors.

Blender 4.5: -b --python-exit-code 1 --python scripts/refine_corridor_reference_v2.py
The master is saved before export-only merging/AO. v1 is never overwritten.
"""
from pathlib import Path
import argparse
import json
import math
import sys
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_corridor_reference_v1 as base

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/corridor-reference-v2'
ASSET = ROOT / 'public/models/hospital-corridor/corridor-reference-v2.glb'
BOUNDS = {'地板', '天花板', '墙壁', '墙壁2'}


def select(objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def merge(objects, name):
    select(objects)
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def manufactured(obj, radius=.006, segments=3):
    for modifier in obj.modifiers:
        if modifier.type == 'BEVEL':
            modifier.width = radius
            modifier.segments = segments
            modifier.harden_normals = True
    return obj


def add_box(name, pos, size, mat, radius=.006, parent=None):
    return manufactured(base.box(name, pos, size, base.MATS[mat], radius, parent=parent), radius)


def image_map(name, pixels, noncolor=False):
    h, w = pixels.shape[:2]
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(pixels, 0, 1)
    image = bpy.data.images.new(name, width=w, height=h, alpha=False)
    if noncolor:
        image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(OUT / 'textures' / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def surface_maps(mat, name, color, grain, roughness):
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = nodes.get('Principled BSDF')
    for node in list(nodes):
        if node.type in {'TEX_IMAGE', 'NORMAL_MAP'}:
            nodes.remove(node)
    uv = nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'UVMap'
    for suffix, pixels, socket in (
        ('color', color, 'Base Color'),
        ('roughness', np.repeat(roughness[:, :, None], 3, axis=2), 'Roughness'),
    ):
        node = nodes.new('ShaderNodeTexImage')
        node.image = image_map(name + '-' + suffix, pixels, suffix != 'color')
        links.new(uv.outputs['UV'], node.inputs['Vector'])
        links.new(node.outputs['Color'], bsdf.inputs[socket])
    dy, dx = np.gradient(grain)
    normals = np.stack((-dx * 2.0, -dy * 2.0, np.ones_like(grain)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    node = nodes.new('ShaderNodeTexImage')
    node.image = image_map(name + '-normal', normals * .5 + .5, True)
    links.new(uv.outputs['UV'], node.inputs['Vector'])
    normal = nodes.new('ShaderNodeNormalMap')
    normal.uv_map = 'UVMap'
    normal.inputs['Strength'].default_value = .5
    links.new(node.outputs['Color'], normal.inputs['Color'])
    links.new(normal.outputs['Normal'], bsdf.inputs['Normal'])


def materials():
    rng = np.random.default_rng(929032)
    y, x = np.mgrid[0:1024, 0:1024]
    # Irregular fibres, not periodic sine stripes that resemble ribbed plastic at close range.
    warp = x + 3*np.sin(y*.006+x*.001)
    grain = (np.interp(warp, np.arange(1024), rng.normal(0,.014,1024))
             + np.interp(warp, np.linspace(0,1023,117), rng.normal(0,.009,117))
             + np.interp(x+8*np.sin(y*.002), np.linspace(0,1023,23), rng.normal(0,.005,23))
             + rng.normal(0,.001,x.shape))
    surface_maps(base.MATS['Door pale ash'], 'corridor-v2-ash',
                 np.array([.66, .61, .53])[None, None, :] + grain[:, :, None], grain, .48 + grain * .7)
    grain = .003 * np.sin(y * 2.1) + rng.normal(0, .0006, x.shape)
    surface_maps(base.MATS['Brushed aluminium'], 'corridor-v2-satin',
                 np.array([.68, .70, .70])[None, None, :] + grain[:, :, None], grain, .32 + grain)
    grain = rng.normal(0, .007, x.shape)
    surface_maps(base.MATS['Floor fine aggregate'], 'corridor-v2-floor',
                 np.array([.60, .61, .60])[None, None, :] + grain[:, :, None], grain, .39 + grain * .5)
    for name, color, roughness, metal in (
        ('Ceramic warm white', (.73, .72, .68), .68, 0),
        ('Impact panel pearl grey', (.50, .52, .51), .54, .12),
        ('Handrail ivory', (.80, .79, .74), .38, 0),
        ('Satin clinical teal', (.06, .23, .27), .42, .18),
        ('Brushed aluminium', (.53, .55, .55), .38, .68),
    ):
        bsdf = base.MATS[name].node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*color, 1)
        bsdf.inputs['Roughness'].default_value = roughness
        bsdf.inputs['Metallic'].default_value = metal
    base.material('Fine panel reveal', (.09, .105, .105), .68)
    base.material('Soft daylight sky', (.48, .69, .78), .7, 0, .45)
    base.material('Distant architecture', (.32, .48, .53), .8, 0, .2)


def geometry():
    # Increase edge quality only where the observer can approach; no subdivision of hidden shells.
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(('Door_', 'Protection_rail', 'Rail_teal_inlay', 'Device_', 'Wayfinding_')):
            close_door = obj.name.startswith(('Door_1_', 'Door_2_', 'Door_6_', 'Door_7_'))
            for modifier in obj.modifiers:
                if modifier.type == 'BEVEL':
                    manufactured(obj, modifier.width, 5 if close_door else 3)
        if obj.name.startswith('Wall_silver_reveal'):
            obj.dimensions.y = .55
            select([obj]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        if obj.name.startswith(('Station_', 'Desktop_monitor', 'Monitor_stem')):
            # A broader, closer destination matches the reference's visual endpoint.
            obj.location.y -= 1.25
            if obj.type == 'MESH' and obj.name.startswith('Station_'):
                for vertex in obj.data.vertices:
                    vertex.co.x = .82 + (vertex.co.x-.82)*1.04
            if obj.name.startswith('Station_counter'):
                for vertex in obj.data.vertices:
                    vertex.co.z *= 1.10
            elif obj.name.startswith(('Desktop_monitor', 'Monitor_stem')):
                obj.location.z += .10
            elif obj.name == 'Station_canopy':
                for vertex in obj.data.vertices:
                    vertex.co.z = 2.18 + (vertex.co.z-2.38)*1.475
            elif obj.name == 'Station_canopy_underlight':
                obj.location.z -= .20
            elif obj.name == 'Station_identity':
                obj.location.z = 2.47
                obj.data.size = .23
        if obj.name.startswith('Wayfinding_') or obj.name.startswith(('Direction_', 'Sign_suspension')):
            obj.location.y -= 1.45
        if obj.name.startswith('Device_') and obj.name.endswith('_mount'):
            # Keep the display plane fixed; thinner silver perimeter is closer to the reference.
            obj.dimensions.y = .278
        if obj.name == 'Planter':
            obj.location.z = .275
            obj.dimensions.z = .55
        elif obj.name.startswith(('Plant_stem', 'Plant_leaf')):
            obj.location.z -= .20
    for side in (-1, 1):
        x = side * base.WIDTH / 2
        for bay in range(5):
            n, y = (bay + 1 if side < 0 else bay + 6), 1.45 + bay * 3.72
            door = bpy.data.objects[f'门{n}']
            # A nested frame, visible gasket, latch and hinge details provide depth at grazing angles.
            for yy in (-.755, .755):
                add_box(f'V2_Door_{n}_inner_stop', (x-.071*side, y+yy, 1.195), (.035, .017, 2.32), 'Fine panel reveal', .002, door)
                add_box(f'V2_Door_{n}_frame_lip', (x-.105*side, y+yy*1.063, 1.20), (.018, .033, 2.43), 'Brushed aluminium', .004, door)
            add_box(f'V2_Door_{n}_top_stop', (x-.071*side, y, 2.342), (.035, 1.50, .018), 'Fine panel reveal', .002, door)
            add_box(f'V2_Door_{n}_threshold', (x, y, .009), (.18, 1.49, .014), 'Brushed aluminium', .002, door)
            for z in (.30, 1.15, 2.00):
                base.cylinder(f'V2_Door_{n}_hinge', (x-.046*side, y+.704, z), .014, .105, base.MATS['Brushed aluminium'], parent=door)
            add_box(f'V2_Door_{n}_key_slot', (x-.054*side, y-.29, .925), (.009, .016, .030), 'Graphite gaskets', .004, door)
            # Small fixings on the closest doors only; back-of-corridor detail is intentionally cheaper.
            if bay < 2:
                for z in (.865, 1.055):
                    base.cylinder(f'V2_Door_{n}_plate_fixing', (x-.053*side, y-.29, z), .004, .003, base.MATS['Graphite gaskets'], (1, 0, 0), door)
            # Door jamb meets the upper panel, avoiding the black open corners visible in v1.
            add_box(f'V2_Door_{n}_frame_corner', (x-.021*side, y, 2.419), (.148, 1.635, .02), 'Brushed aluminium', .003, door)
        for i in range(6):
            start = base.ENTRY if i == 0 else 1.45 + (i-1)*3.72 + .82
            end = base.LENGTH if i == 5 else 1.45 + i*3.72 - .82
            mid, span = (start+end)/2, end-start
            # Hospital wall protection has independent manufactured panels, not a continuous flat wall.
            for yy in np.arange(start+.65, end-.20, .84):
                add_box(f'V2_Panel_joint_{side}_{i}', (x-.026*side, yy, .51), (.006, .005, .88), 'Fine panel reveal', 0)
            add_box(f'V2_Wall_cap_{side}_{i}', (x-.03*side, mid, 1.059), (.025, span-.008, .012), 'Brushed aluminium', .002)
            for yy in (start+.12, end-.12):
                add_box(f'V2_Rail_return_{side}_{i}', (x-.035*side, yy, .965), (.18, .055, .139), 'Handrail ivory', .022)
        # Long ceiling coves are inset and stepped rather than thin coloured stripes.
        for xx in (side*1.49, side*1.235):
            add_box(f'V2_Ceiling_recess_{side}', (xx, 9.55, 3.086), (.018, 25.95, .032), 'Fine panel reveal', .002)
        add_box(f'V2_Ceiling_wall_trim_{side}', (x-.045*side, 9.55, 3.065), (.10, 25.95, .065), 'Brushed aluminium', .004)
    for i, y in enumerate((3.9, 8.8, 13.7, 18.6)):
        for xx in (-.755, .755):
            add_box(f'V2_Vent_end_{i}', (xx, y, 3.063), (.035, .215, .018), 'Brushed aluminium', .002)
        for j in range(10):
            angle = j * 2*math.pi/10
            add_box(f'V2_Detector_slot_{i}', (.35+.047*math.cos(angle), y-1.05+.047*math.sin(angle), 3.051), (.01, .01, .006), 'Graphite gaskets', .001)
    # Layered destination counter and canopy rims; retain an open sightline to the window.
    for name, rx, ry, z, h, mat in (
        ('V2_Station_plinth', 1.38, .66, .07, .09, 'Fine panel reveal'),
        ('V2_Station_top_reveal', 1.465, .733, 1.047, .018, 'Fine panel reveal'),
        ('V2_Station_canopy_shadowline', 1.56, .822, 2.175, .025, 'Fine panel reveal'),
        ('V2_Station_canopy_lip', 1.57, .834, 2.19, .025, 'Brushed aluminium'),
    ):
        base.oval_shell(name, .82, 18.0, rx, ry, z, h, base.MATS[mat])
    # Replace a blank cyan backdrop with actual shallow scenery, not a photo pasted over the corridor.
    for i in range(9):
        xx = -2.02 + i*.49
        height = .32 + (.19*i % .61)
        add_box(f'V2_Distant_building_{i}', (xx, 22.66, .45+height/2), (.34, .012, height), 'Distant architecture', .001)
        for z in np.arange(.52, .45+height, .14):
            add_box(f'V2_Distant_window_{i}', (xx, 22.65, z), (.22, .005, .018), 'Soft daylight sky', 0)
    # Add a second modest clinical planter near the destination, away from the walking path.
    base.cylinder('V2_Planter', (-1.92, 20.3, .24), .18, .44, base.MATS['Handrail ivory'])
    rng = np.random.default_rng(318)
    for i in range(15):
        end = Vector((-1.92+rng.uniform(-.18,.18), 20.3+rng.uniform(-.12,.12), rng.uniform(.7,1.2)))
        start = Vector((-1.92,20.3,.43))
        base.cylinder('V2_Plant_stem', (start+end)/2, .004, (end-start).length, base.MATS['Foliage'], end-start)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=end)
        leaf = bpy.context.object; leaf.name = 'V2_Plant_leaf'; leaf.scale = (.065,.16,.012)
        leaf.rotation_euler = (.3, .2, rng.uniform(0,6.28))
        base.register(leaf, base.MATS['Foliage'])


def bake_ao(obj, size, name):
    select([obj])
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name='UVMap')
    mesh.uv_layers[0].name = 'UVMap'
    mesh.uv_layers.new(name='AOMap')
    mesh.uv_layers.active_index = 1
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.003, area_weight=.5, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    group = bpy.data.node_groups.get('glTF Material Output')
    if not group:
        group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    for slot in obj.material_slots:
        original_name = slot.material.name
        slot.material = slot.material.copy(); slot.material.name = original_name + '_AO'
        nodes, links = slot.material.node_tree.nodes, slot.material.node_tree.links
        target = nodes.new('ShaderNodeTexImage'); target.image = image
        uv = nodes.new('ShaderNodeUVMap'); uv.uv_map = 'AOMap'
        links.new(uv.outputs['UV'], target.inputs['Vector'])
        output = nodes.new('ShaderNodeGroup'); output.node_tree = group
        links.new(target.outputs['Color'], output.inputs['Occlusion'])
        nodes.active = target
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'; scene.cycles.samples = 32
    scene.world.light_settings.distance = .6
    scene.render.bake.margin = 8
    print('CORRIDOR_AO_START ' + name, flush=True)
    bpy.ops.object.bake(type='AO')
    image.filepath_raw = str(OUT/'textures'/(name+'.png')); image.file_format = 'PNG'
    image.save(); image.pack()
    pixels = np.empty(size*size*4, dtype=np.float32); image.pixels.foreach_get(pixels)
    deviation = float(pixels.reshape(-1,4)[:,0].std())
    if deviation < .005:
        raise RuntimeError('Empty occlusion bake: ' + name)
    mesh.uv_layers.active_index = 0; mesh.uv_layers[0].active_render = True
    print('CORRIDOR_AO_DONE ' + name, flush=True)
    return {'image':name, 'size':size, 'standardDeviation':deviation}


def export_runtime():
    preview = [o for o in bpy.context.scene.objects if o.name.startswith('Preview_')]
    for obj in preview:
        bpy.data.objects.remove(obj, do_unlink=True)
    meshes = [o for o in bpy.context.scene.objects if o.type in {'MESH','FONT','CURVE'}]
    select(meshes); bpy.ops.object.convert(target='MESH')
    doors = []
    for n in range(1,11):
        door = bpy.data.objects[f'门{n}']
        doors.append(merge([o for o in door.children if o.type=='MESH'], f'DoorAssembly_{n}'))
    architecture = [o for o in bpy.context.scene.objects if o.type=='MESH' and not o.parent and o.name not in BOUNDS]
    arch = merge(architecture, 'Architecture_CorridorV2')
    ao = [bake_ao(arch, 2048, 'corridor-v2-architecture-ao'), bake_ao(bpy.data.objects['地板'],1024,'corridor-v2-floor-ao')]
    # Door topology differs near/far (visible-only fixings), so do not copy one prototype's UV blindly.
    # The door's gaskets, layered framing and physical bevels supply detail without ten extra AO atlases.
    scene = bpy.context.scene
    scene.render.image_settings.quality = 90
    for img in bpy.data.images:
        if img.name.startswith('corridor-v2-') and img.name.endswith('-color'):
            img.file_format = 'JPEG'; img.filepath_raw = str(OUT/'textures'/(img.name+'.jpg'))
            img.save(); img.pack()
    root = base.group('CorridorReferenceV2')
    root['units'], root['surveyed'] = 'metres', False
    root['assetRevision'], root['detailPolicy'] = 'reference-v2', 'visible-first'
    root['sourceReference'] = 'ward-corridor-concept-v1.png'
    runtime = [o for o in scene.objects if o.type in {'MESH','EMPTY'} and o!=root]
    for obj in runtime:
        if obj.parent is None:
            obj.parent=root
    root.rotation_euler.z = -math.pi/2
    bpy.context.view_layer.update()
    points = [o.matrix_world@Vector(c) for o in runtime if o.type=='MESH' for c in o.bound_box]
    root.location.x -= (min(p.x for p in points)+max(p.x for p in points))/2
    root.location.y -= (min(p.y for p in points)+max(p.y for p in points))/2
    select([root]+runtime)
    bpy.ops.export_scene.gltf(filepath=str(ASSET), export_format='GLB', use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=18, export_draco_normal_quantization=14, export_draco_texcoord_quantization=16)
    triangles = 0
    for obj in runtime:
        if obj.type=='MESH':
            obj.data.calc_loop_triangles(); triangles += len(obj.data.loop_triangles)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'corridor-reference-v2-runtime.blend'))
    report = {'asset':str(ASSET.relative_to(ROOT)), 'source':str((OUT/'corridor-reference-v2.blend').relative_to(ROOT)),
        'bytes':ASSET.stat().st_size, 'triangles':triangles, 'aoBakes':ao, 'doorSlots':10,
        'screenAspect':'9:16', 'surveyed':False, 'previewDataExported':False, 'compression':'Draco18/14/16',
        'detailPolicy':'visible-first', 'blenderVersion':bpy.app.version_string}
    (OUT/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('CORRIDOR_V2_EXPORT '+json.dumps(report,ensure_ascii=False),flush=True)


def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--skip-render',action='store_true')
    parser.add_argument('--width',type=int,default=1664); parser.add_argument('--samples',type=int,default=48)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    (OUT/'textures').mkdir(parents=True,exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/corridor-reference-v1/corridor-reference-v1.blend'))
    base.OUT=OUT; base.STATIC=[]; base.PREVIEW=[]
    base.MATS={mat.name:mat for mat in bpy.data.materials}
    base.FONT=bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc')
    materials(); geometry()
    scene=bpy.context.scene
    scene.camera.location=(.1,-3.25,1.52)
    scene.camera.rotation_euler=(Vector((.1,18,1.52))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.lens=24
    scene.render.resolution_x,scene.render.resolution_y=args.width,round(args.width*941/1672)
    scene.cycles.samples=args.samples
    scene.view_settings.exposure = -.2
    base.area_light('V2_Station_front_fill', (0,15.4,2.2), (.82,18,.8), 100, (.94,.97,1), 3.2, 1.2)
    scene.render.filepath=str(OUT/'corridor-reference-v2.png')
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'corridor-reference-v2.blend'))
    if not args.skip_render:
        bpy.ops.render.render(write_still=True)
    export_runtime()


if __name__=='__main__':
    main()
