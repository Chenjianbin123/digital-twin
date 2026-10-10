"""Visible-first refinement of the editable silver-v1 source, Blender 4.5 LTS.

Never modifies the v1 .blend/GLB. Screen transforms and UVs are retained verbatim.
"""
from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_nurse_station_silver_v1 as source
import design_nurse_station_reference as base
from refine_nurse_station_reference import surface_maps
from render_high_fidelity_nurse_station import pbr_material, point_at
from silver_station_export import export_refined_station

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/nurse-station-silver-v2"
M = source.M


def remove_named(prefixes):
    # Only the in-memory working copy is edited. Existing deliverables stay intact.
    for obj in list(bpy.context.scene.objects):
        if any(obj.name == p or obj.name.startswith(p + ".") for p in prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def material(name, color, roughness, metal=0):
    result = pbr_material("SilverV1_" + name, color, roughness, metal)
    M[name] = result
    return result


def manufactured(obj, width=.008, segments=5):
    for modifier in obj.modifiers:
        if modifier.type == "BEVEL":
            modifier.width = width
            modifier.segments = segments
            modifier.harden_normals = True
    normal = obj.modifiers.new("Planar face weighted normals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True
    return obj


def path(inset=0):
    r = .78-inset
    points = [(-4.52+inset, 2.10), (-4.52+inset, -.30)]
    points += [(-3.74+r*math.cos(a), -.30+r*math.sin(a)) for a in np.linspace(math.pi, math.pi*1.5, 97)[1:]]
    points += [(2.85, -1.08+inset)]
    return points


def panel(name, points, bottom, top, mat, thickness=.028):
    return manufactured(source.ribbon(name, points, bottom, top, mat, thickness))


def refine_materials():
    for mat in bpy.data.materials:
        if mat.name.startswith("SilverV1_"):
            M[mat.name.removeprefix("SilverV1_")] = mat
    material("backplate", (.12, .23, .28), .62, .16)
    material("joint", (.028, .048, .059), .65, .10)
    material("header", (.035, .12, .17), .42, .30)
    material("porcelain", (.78, .79, .77), .48)
    material("glass_trim", (.11, .22, .27), .24, .35)
    for name, color, rough, metal in [
        ("wall", (.61, .64, .64), .78, 0), ("steel", (.22, .28, .31), .38, .78),
        ("teal", (.012, .16, .22), .36, .45), ("white", (.80, .81, .79), .38, 0),
    ]:
        bsdf = M[name].node_tree.nodes.get("Principled BSDF")
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    rng = np.random.default_rng(92902)
    # Resolution follows visible material scale, not every hidden object.
    for name, size in (("silver", 2048), ("white", 1024), ("floor", 1024)):
        u, v = np.meshgrid(np.linspace(0, 1, size), np.linspace(0, 1, size))
        noise = rng.normal(0, 1, u.shape)
        if name == "silver":
            grain = .009*np.sin(v*2900) + .004*np.sin(v*790) + .0015*noise
            color = np.array((.54, .60, .63))[None, None, :] + grain[:, :, None]
            roughness, strength = .41 + grain*.65, .6
        elif name == "white":
            grain = .0015*noise
            color = np.array((.86, .855, .825))[None, None, :] + grain[:, :, None]
            roughness, strength = .39+grain, .5
        else:
            grain = .0025*noise + .002*np.sin(u*39)*np.cos(v*31)
            color = np.array((.61, .64, .64))[None, None, :] + grain[:, :, None]
            roughness, strength = .48+grain*.7, .8
        surface_maps(M[name], "silver-v2-"+name, color, grain, roughness, OUT, strength)
    for name, strength in (("cyan", 1.5), ("lamp", 2)):
        M[name].node_tree.nodes.get("Principled BSDF").inputs["Emission Strength"].default_value = strength


def refine_counter():
    remove_named(["Counter_Silver_Front", "Counter_Cyan_Inlay", "Nurse_Counter", "Counter_Steel_Plinth",
                  "Counter_Reveal_LED", "Nurse_Counter_Top", "Front_Panel_Seam"])
    contour = path()
    panel("Counter_Recess_Back", path(.020), .09, 1.17, "joint", .035)
    panel("Counter_Corner_Satin", contour[:-1], .155, .746, "silver")
    # Real separated metal cassettes, not dark stripes pasted over one flat face.
    edges = np.linspace(-3.74, 2.85, 6)
    for i, (left, right) in enumerate(zip(edges[:-1], edges[1:])):
        gap = .010
        panel(f"Counter_Cassette_{i:02d}", [(left+gap/2, -1.08), (right-gap/2, -1.08)], .155, .746, "silver")
    panel("Counter_Recessed_Teal", path(.012), .756, .802, "teal")
    panel("Counter_Porcelain_Fascia", contour, .82, 1.148, "white", .065)
    panel("Counter_Underlip_Shadow", path(.008), 1.153, 1.170, "joint", .035)
    panel("Counter_Recessed_Plinth", path(.055), .022, .132, "steel", .04)
    for z in (.758, .802):
        base.tube("Counter_Fine_Light", [(x, y-.002, z) for x, y in path(.007)], .0028, M["cyan"])
    panel("Counter_Bottom_Reveal", path(.010), .137, .148, "steel", .020)
    cap = base.slab("Nurse_Counter_Top", contour+list(reversed(path(.32))), 1.17, .038, M["white"])
    manufactured(cap, .010, 6)
    # Small static wayfinding, not an invented live device/patient status.
    for body, x, size in (("护理服务", -2.60, .090), ("NURSING CARE", -2.60, .032)):
        text = source.label("Counter_Service_Lettering", body, (x, -1.117, 1.007 if size > .05 else .927), size, "header")
        text.data.extrude = .002
        text.data.resolution_u = 3
        text.data.bevel_depth = .0004 if size > .05 else 0
        text.data.bevel_resolution = 1


def refine_canopy():
    remove_named(["Station_Canopy", "Canopy_Soffit", "Canopy_Lower_LED", "Station_Header", "Canopy_Vertical_Accent"])
    contour = base.rounded_path(10.4, 4.25, .63, -.77)
    inner = base.rounded_path(10.20, 4.05, .57, -.67)
    for name, shape, z, height, mat in (
        ("Canopy_Fascia", contour, 3.102, .258, "silver"),
        ("Canopy_Crown_Reveal", contour, 3.366, .018, "steel"),
        ("Canopy_Recess_Soffit", inner, 3.032, .052, "header"),
    ):
        slab = manufactured(base.slab(name, shape, z, height, M[mat]), .008, 5)
        # Continuous corner reflections; increasing polygons alone leaves faceted normals.
        for face in slab.data.polygons:
            face.use_smooth = len(face.vertices) == 4
    led = base.rounded_path(10.25, 4.10, .60, -.695)
    base.tube("Canopy_Recess_LED", [(x, y, 3.047) for x, y in led]+[(*led[0], 3.047)], .0035, M["cyan"])
    source.box("Canopy_Header_Inlay", (.50, -.788, 3.237), (3.24, .022, .224), "header", .012)
    title = source.label("Station_Header", "护 士 站", (.50, -.807, 3.238), .262, "porcelain")
    title.data.extrude = .010
    title.data.resolution_u = 6
    title.data.bevel_depth = .0018
    title.data.bevel_resolution = 2
    for x in (-3.45, -1.72, 2.74, 4.0):
        source.box("Canopy_Manufactured_Seam", (x, -.779, 3.238), (.007, .004, .219), "joint", 0)
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(("Recessed_Lamp_Bezel", "Recessed_Lamp_Diffuser")):
            obj.location.z += .087


def refine_wall_and_equipment():
    # Thin cladding stays behind the existing screen mounts and exact display faces.
    source.box("Display_Wall_Recess", (1.25, 3.476, 2.18), (6.53, .046, 1.82), "joint", .018)
    for x, width in ((-.12, 3.69), (2.00, .51), (3.55, 2.47)):
        source.box("Display_Wall_Cladding", (x, 3.446, 2.18), (width, .018, 1.77), "backplate", .008)
    for z in (1.278, 3.081):
        source.box("Display_Wall_Edge_Trim", (1.25, 3.455, z), (6.49, .020, .012), "silver", .003)
    for i in range(5):
        x = -4.49+i*.60
        source.box("Cabinet_Inset_Reveal", (x, 3.070, 2.30), (.597, .020, 1.118), "joint", .006)
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("Upper_Cabinet_Door"):
            manufactured(obj, .004, 5)
    for i, x in enumerate((-3.32, -1.68, .12, 1.92), 1):
        source.box("Monitor_Back_Badge", (x, -.160, 1.32), (.13, .007, .046), "steel", .003)
        text = source.label("Workstation_Position", f"0{i}", (x, -.165, 1.32), .027, "porcelain")
        text.data.resolution_u = 2
        text.data.extrude = .0005
        text.data.bevel_depth = 0
        # These fine slots are visible from the public side, unlike individual keys.
        source.box("Monitor_Rear_Rib", (x, -.156, 1.425), (.47, .006, .010), "silver", .002)
    # A compact wall dispenser gives nursing context without cluttering the desk.
    source.box("Hygiene_Dispenser_Mount", (-4.55, 2.999, 1.47), (.22, .035, .38), "steel", .016)
    source.box("Hygiene_Dispenser_Body", (-4.55, 2.935, 1.47), (.205, .108, .32), "white", .025)
    source.box("Hygiene_Dispenser_Window", (-4.55, 2.876, 1.44), (.069, .010, .125), "glass_trim", .015)
    source.box("Hygiene_Dispenser_Nozzle", (-4.55, 2.868, 1.302), (.046, .03, .029), "steel", .008)


def simplify_secondary():
    removed = []
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(("Keyboard_Keycaps", "Binder_Ring")):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
        elif obj.name.startswith(("Chair_Caster", "Chair_Gas_Lift", "Chair_Star_Base", "Desk_Under_Support")):
            for modifier in list(obj.modifiers):
                if modifier.type == "BEVEL": obj.modifiers.remove(modifier)
            if obj.type == "CURVE": obj.data.bevel_resolution = 1
    return removed


def ensure_uvs():
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("Screen_") or obj.data.uv_layers:
            continue
        uv = obj.data.uv_layers.new(name="UVMap")
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            for li in face.loop_indices:
                p = obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv = (p.y if axis == 0 else p.x, p.y if axis == 2 else p.z)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--ao-size", type=int, default=2048)
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    (OUT/"textures").mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/"output/nurse-station-silver-v1/nurse-station-silver-v1.blend"))
    # Loaded v1 preview cards are excluded from both the source and production export.
    for obj in list(bpy.context.scene.objects):
        if any(c.name.startswith("PREVIEW_ONLY") for c in obj.users_collection):
            bpy.data.objects.remove(obj, do_unlink=True)
    base.FONT = bpy.data.fonts.load("C:/Windows/Fonts/msyh.ttc", check_existing=True)
    refine_materials()
    refine_counter()
    refine_canopy()
    refine_wall_and_equipment()
    removed = simplify_secondary()
    ensure_uvs()
    scene = bpy.context.scene
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 6
    scene.cycles.samples = 24
    bpy.ops.file.pack_all()
    blend_path = OUT/"nurse-station-silver-v2.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_refined_station(ROOT, OUT, args.ao_size, removed)
    if not args.skip_render:
        bpy.ops.wm.open_mainfile(filepath=str(blend_path))
        camera = bpy.context.scene.camera
        camera.location = (-6.5, -9.2, 2.0)
        camera.data.lens = 37
        point_at(camera, (0, 1.0, 1.65))
        scene = bpy.context.scene
        scene.render.resolution_x, scene.render.resolution_y = 1440, 900
        scene.render.filepath = str(OUT/"front.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
