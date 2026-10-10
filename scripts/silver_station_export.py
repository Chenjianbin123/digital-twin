"""Export-only consolidation and ambient-occlusion bake for silver-v2.

The editable master is saved before this module runs. Business screens never
participate in joining, unwrapping, baking, or lossy image conversion.
"""
import json
import math

import bpy
import numpy as np

from build_nurse_station_silver_v1 import PRESERVE


def select(objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def join(objects, name):
    select(objects)
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def occlusion_socket(material):
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    node = material.node_tree.nodes.new("ShaderNodeGroup")
    node.node_tree = group
    return node.inputs["Occlusion"]


def bake_ao(obj, size, out, name):
    select([obj])
    mesh = obj.data
    # Imported screen UV0 is not touched; only static, non-display meshes reach here.
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    mesh.uv_layers[0].name = "UVMap"
    uv = mesh.uv_layers.new(name="AOMap")
    mesh.uv_layers.active_index = len(mesh.uv_layers)-1
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.003,
                             area_weight=.5, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    image = bpy.data.images.new(name, width=size, height=size, alpha=False)
    image.colorspace_settings.name = "Non-Color"
    image.generated_color = (1, 1, 1, 1)
    for slot in obj.material_slots:
        material = slot.material.copy()
        material.name = slot.material.name + "_AO"
        slot.material = material
        nodes, links = material.node_tree.nodes, material.node_tree.links
        primary = nodes.new("ShaderNodeUVMap")
        primary.uv_map = "UVMap"
        for node in list(nodes):
            if node.type == "TEX_IMAGE":
                links.new(primary.outputs["UV"], node.inputs["Vector"])
            elif node.type == "NORMAL_MAP":
                node.uv_map = "UVMap"
        ao_uv = nodes.new("ShaderNodeUVMap")
        ao_uv.uv_map = "AOMap"
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        links.new(ao_uv.outputs["UV"], target.inputs["Vector"])
        links.new(target.outputs["Color"], occlusion_socket(material))
        nodes.active = target
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.world.light_settings.distance = .75
    scene.render.bake.margin = 6
    scene.render.bake.use_clear = True
    print(f"SILVER_V2_AO_START {name} {size}px", flush=True)
    bpy.ops.object.bake(type="AO")
    image.filepath_raw = str(out/"textures"/(name+".png"))
    image.file_format = "PNG"
    image.save()
    image.pack()
    values = np.empty(size*size*4, dtype=np.float32)
    image.pixels.foreach_get(values)
    rgb = values.reshape(-1, 4)[:, 0]
    stats = {"name": name, "size": size, "minimum": float(rgb.min()),
             "maximum": float(rgb.max()), "standardDeviation": float(rgb.std())}
    if stats["standardDeviation"] < .005:
        raise RuntimeError(f"AO bake contains no useful shading: {stats}")
    mesh.uv_layers.active_index = 0
    mesh.uv_layers[0].active_render = True
    print("SILVER_V2_AO_DONE "+json.dumps(stats), flush=True)
    return stats


def export_refined_station(root_path, out, ao_size, removed):
    scene = bpy.context.scene
    runtime = [o for o in scene.objects if o.type in {"MESH", "CURVE", "FONT"}]
    select(runtime)
    bpy.ops.object.convert(target="MESH")
    hero, groups = [], {}
    for obj in list(bpy.context.selected_objects):
        if obj.name in PRESERVE or obj.name.startswith("Screen_"):
            continue
        if any(s in obj.name for s in ("Corridor", "Window", "Ceiling", "Return_Wall", "Back_Wall")):
            groups.setdefault(obj.data.materials[0].name, []).append(obj)
        else:
            hero.append(obj)
    hero_mesh = join(hero, "Hero_SilverV2")
    # Keep a stable runtime shadow contract even when glTF splits material primitives.
    hero_mesh["castStationShadow"] = True
    for name, objects in groups.items():
        join(objects, "Architecture_"+name)
    ao = [bake_ao(hero_mesh, ao_size, out, "silver-v2-contact-ao")]
    floor = bpy.data.objects["地板"]
    ao.append(bake_ao(floor, 1024, out, "silver-v2-floor-ao"))
    scene.render.image_settings.quality = 90
    for image in bpy.data.images:
        if image.name.endswith("-color"):
            image.file_format = "JPEG"
            image.filepath_raw = str(out/"textures"/(image.name+"-runtime.jpg"))
            image.save()
            image.pack()
    runtime = [o for o in scene.objects if o.type == "MESH"]
    root = bpy.data.objects.new("NurseStationSilverV1", None)
    bpy.context.collection.objects.link(root)
    root["units"], root["surveyed"] = "metres", False
    root["layout"] = "silver-v1; authored dimensions and display UVs retained"
    root["assetRevision"], root["detailPolicy"] = "silver-v2", "visible-first"
    for obj in runtime:
        obj.parent = root
    select([root]+runtime)
    asset = root_path/"public/models/smart-ward-nurse-station/nurse-station-silver-v2.glb"
    bpy.ops.export_scene.gltf(filepath=str(asset), export_format="GLB", use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False,
        # Reuse the project's existing Draco decoder. 18-bit positions retain
        # sub-millimetre bevels; UV16 keeps both tiny screen text and AO seams stable.
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=18, export_draco_normal_quantization=14,
        export_draco_texcoord_quantization=16)
    triangles = 0
    for obj in runtime:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/"nurse-station-silver-v2-runtime.blend"))
    report = {"source": "output/nurse-station-silver-v2/nurse-station-silver-v2.blend",
        "asset": str(asset.relative_to(root_path)), "surveyed": False,
        "triangles": triangles, "meshObjects": len(runtime), "bytes": asset.stat().st_size,
        "compression": {"method": "Draco", "positionBits": 18, "normalBits": 14, "uvBits": 16},
        "aoBakes": ao, "removedHiddenObjects": len(removed), "layoutContract": "silver-v1",
        "blenderVersion": bpy.app.version_string, "detailPolicy": "visible-first",
        "screenNodes": [o.name for o in runtime if o.name.startswith("Screen_")],
        "liveDataConnectedInAsset": False}
    (out/"manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("NURSE_SILVER_V2_EXPORT "+json.dumps(report, ensure_ascii=False), flush=True)
