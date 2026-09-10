"""Refine the saved v1 design into a separate v2 scene and actual render set.

Blender 4.5.3; no changes to the live scene or v1 deliverables.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import design_nurse_station_reference as base
from render_high_fidelity_nurse_station import cube, cylinder, sphere, pbr_material, add_area_light, point_at

ROOT = Path(__file__).resolve().parents[1]


def remove_objects(names):
    # Only removes explicitly identified objects in the loaded working scene.
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj is not None:
            bpy.data.objects.remove(obj, do_unlink=True)


def place(obj, location, parent=None):
    obj.parent = None
    obj.location = location
    bpy.context.view_layer.update()
    if parent is not None:
        matrix = obj.matrix_world.copy()
        obj.parent = parent
        obj.matrix_world = matrix


def image_map(name, pixels, output, non_color=False):
    height, width = pixels.shape[:2]
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(np.asarray(pixels, dtype=np.float32).ravel())
    image.filepath_raw = str(output / "textures" / f"{name}.png")
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def surface_maps(material, name, color, height, roughness, output, strength):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    for node in list(nodes):
        if node.type in {"TEX_IMAGE", "NORMAL_MAP"}:
            nodes.remove(node)
    shape = height.shape
    rgba = np.ones((*shape, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(color, 0, 1)
    gx, gy = np.gradient(height)
    normal = np.dstack((-gy*strength, -gx*strength, np.ones(shape)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    normal_rgba = np.ones_like(rgba)
    normal_rgba[:, :, :3] = normal*.5+.5
    rough_rgba = np.ones_like(rgba)
    rough_rgba[:, :, :3] = np.clip(roughness, .08, .95)[:, :, None]
    for suffix, pixels, target in (("color", rgba, "Base Color"),
                                    ("roughness", rough_rgba, "Roughness"),
                                    ("normal", normal_rgba, "Normal")):
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image_map(f"v2-{name}-{suffix}", pixels, output, suffix != "color")
        if suffix == "normal":
            normal_map = nodes.new("ShaderNodeNormalMap")
            links.new(texture.outputs["Color"], normal_map.inputs["Color"])
            links.new(normal_map.outputs["Normal"], bsdf.inputs[target])
        else:
            links.new(texture.outputs["Color"], bsdf.inputs[target])


def refine_materials(m, output):
    rng = np.random.default_rng(94)
    u, v = np.meshgrid(np.linspace(0, 1, 1024), np.linspace(0, 1, 1024))
    fine = rng.normal(size=u.shape)
    warp = u+.0018*np.sin(v*11+u*3)+.001*np.sin(v*37)
    grain = .022*np.sin(warp*340)+.012*np.sin(warp*1090)+.013*np.sin(u*37+v*.4)
    grain += .003*fine
    wood = np.array((.55, .435, .30))[None, None, :] + grain[:, :, None]
    surface_maps(m["oak"], "oak", wood, grain, .48+grain*.8, output, 10)
    mineral = .008*fine+.005*np.sin(u*31)*np.cos(v*23)
    floor = np.array((.44, .435, .414))[None, None, :] + mineral[:, :, None]
    surface_maps(m["floor"], "vinyl", floor, mineral, .30+.025*np.sin(u*29)*np.sin(v*27), output, 3)
    stone = np.array((.78, .775, .755))[None, None, :] + (.002*fine)[:, :, None]
    surface_maps(m["stone"], "solid-surface", stone, .001*fine, .30+.012*np.sin(u*23)*np.sin(v*11), output, 2)
    weave = .008*np.sin(u*math.tau*128)*np.sin(v*math.tau*128)
    fabric = np.array((.075, .085, .09))[None, None, :] + weave[:, :, None]
    surface_maps(m["fabric"], "chair-fabric", fabric, weave, np.full(u.shape, .8), output, 13)
    bsdf = m["metal"].node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = .32
    bsdf.inputs["Anisotropic"].default_value = .42


def open_working_side(m):
    # Cut only the back apron faces; the curved visitor-facing silhouette remains.
    for name in ("Nurse_Counter", "Nurse_Counter_Oak", "Counter_Steel_Plinth"):
        obj = bpy.data.objects[name]
        editable = bmesh.new()
        editable.from_mesh(obj.data)
        back_faces = [face for face in editable.faces
                      if face.calc_center_median().y > .6 and abs(face.calc_center_median().x) < 4.18]
        bmesh.ops.delete(editable, geom=back_faces, context="FACES")
        editable.to_mesh(obj.data)
        editable.free()
    remove_objects(["Nurse_Counter_Top", "Counter_Reveal_LED"])
    base.slab("Nurse_Counter_Top", base.rounded_path(9.23, .47, .23, -.015), 1.065, .032, m["stone"])
    base.slab("Staff_Worktop", base.rounded_path(8.5, 1.18, .075, .43), .755, .035, m["stone"])
    cube("Staff_Worktop_Riser", (0, .464, .925), (8.48, .028, .285), m["oak"], .004)
    # An internal modesty panel supports the desk while leaving knee clearance.
    cube("Staff_Modesty_Panel", (0, .76, .45), (8.45, .028, .59), m["oak"], .005)
    path = [p for p in base.rounded_path(9.2, 1.05, .42, 0) if p[1] < .56]
    start = min(range(len(path)), key=lambda i: (path[i][0], -path[i][1]))
    path = path[start:] + path[:start]
    points = []
    for x, y in path:
        t = max(0, min(1, (x+2.4)/2))
        points.append((x, y+.013, .18+.49*t*t*(3-2*t)-.012))
    base.tube("Counter_Reveal_LED", points, .004, m["led"])
    for i, x in enumerate((-3.72, -1.8, 0, 1.8, 3.72)):
        cube(f"Staff_Pedestal_{i}", (x, 1.09, .405), (.34, .63, .69), m["oak"], .007)
        for j, z in enumerate((.215, .43, .645)):
            cube(f"Staff_Drawer_{i}_{j}", (x, 1.418, z), (.328, .025, .199), m["stone"], .003)
            cube(f"Staff_Drawer_Handle_{i}_{j}", (x, 1.439, z+.053), (.15, .022, .009), m["metal"], .003)
    for x in (-2.7, -.9, .9, 2.7):
        cylinder(f"Desk_Grommet_{x}", (x+.39, .88, .795), .036, .008, m["metal"])
        cylinder(f"Desk_Grommet_Insert_{x}", (x+.39, .88, .8), .027, .003, m["dark"])
        cube(f"Desk_Outlet_{x}", (x+.4, .731, .54), (.18, .025, .075), m["dark"], .004)
        for dx in (-.043, .043):
            cube(f"Outlet_Slot_{x}_{dx}", (x+.4+dx, .716, .54), (.007, .003, .018), m["stone"], .001)
    # Pull the rear cabinetry back to provide a usable route behind the chairs.
    rear_prefixes = ("Back_", "Oak_Wall_", "Cabinet_", "Upper_", "Under_Cabinet_", "Rear_Plant_",
                     "Printer_", "Screen_Main", "Clock_", "Wall_Motto", "Preview_Clock_",
                     "Preview_Dashboard_", "Preview_Data_")
    for obj in bpy.context.scene.objects:
        if obj.name.startswith(rear_prefixes):
            obj.location.y += 1.0
    canopy = bpy.data.objects["Station_Canopy"]
    for vertex in canopy.data.vertices:
        if vertex.co.y > 2.7:
            vertex.co.y += 1.0
    for point in bpy.data.objects["Canopy_Lower_LED"].data.splines[0].points:
        if point.co.y > 2.7:
            point.co.y += 1.0


def joined_keys(name, x, y, z, material):
    vertices, faces = [], []
    for row in range(5):
        for column in range(14):
            cx, cy = x-.199+column*.0304, y-.063+row*.027
            start = len(vertices)
            vertices.extend((cx+dx, cy+dy, z+dz) for dx, dy, dz in
                            ((-.012, -.009, 0), (.012, -.009, 0), (.012, .009, 0), (-.012, .009, 0),
                             (-.012, -.009, .006), (.012, -.009, .006), (.012, .009, .006), (-.012, .009, .006)))
            faces.extend(tuple(start+i for i in face) for face in
                         ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)))
    return base.mesh(name, vertices, faces, material)


def refine_workstations(m):
    remove_objects([obj.name for obj in bpy.context.scene.objects
                    if obj.name.startswith(("Monitor_", "Keyboard_", "Cable_"))])
    for i, x in enumerate((-2.7, -.9, .9, 2.7), 1):
        root = bpy.data.objects[f"Workstation_{i:02d}"]
        frame = cube(f"Monitor_Frame_{i:02d}", (x, 1.07, 1.275), (.65, .047, .40), m["dark"], .012)
        display = bpy.data.objects[f"Screen_Work_{i:02d}"]
        place(display, (x, 1.097, 1.275), root)
        for name, location, dimensions, material in (
            ("Stand", (x, 1.013, .986), (.047, .058, .37), m["metal"]),
            ("Base", (x, 1.02, .807), (.26, .20, .02), m["dark"]),
            ("Hinge", (x, 1.035, 1.20), (.145, .07, .05), m["dark"]),
            ("Brand_Inset", (x, 1.045, 1.315), (.13, .004, .027), m["fabric"]),
        ):
            part = cube(f"Monitor_{name}_{i:02d}", location, dimensions, material, .006)
            place(part, location, root)
        place(frame, (x, 1.07, 1.275), root)
        for j in range(18):
            cube(f"Monitor_Vent_{i}_{j}", (x-.2+j*.023, 1.044, 1.16), (.010, .003, .036), m["fabric"], .001)
        keyboard = cube(f"Keyboard_{i:02d}", (x, 1.38, .802), (.455, .157, .022), m["dark"], .006)
        place(keyboard, (x, 1.38, .802), root)
        keys = joined_keys(f"Keyboard_Keys_{i}", x, 1.38, .815, m["fabric"])
        bpy.context.view_layer.update()
        world = keys.matrix_world.copy()
        keys.parent = root
        keys.matrix_world = world
        sphere(f"Mouse_{i}", (x+.34, 1.4, .823), (.035, .055, .025), m["dark"])
        cube(f"Mouse_Pad_{i}", (x+.34, 1.4, .793), (.17, .21, .003), m["fabric"], .008)
        base.tube(f"Cable_{i}", [(x, 1.044, 1.17), (x+.06, 1, .95),
                  (x+.38, .87, .82), (x+.39, .88, .73)], .0035, m["dark"])
        for obj in bpy.context.scene.objects:
            if obj.name.startswith((f"Chair_Seat_{i}", f"Chair_Back_Frame_{i}", f"Chair_Back_Mesh_{i}",
                    f"Chair_Column_{i}", f"Chair_Base_{i}_", f"Chair_Caster_{i}_", f"Chair_Arm_{i}_")):
                obj.location.y += .48
    # Worksurface shadows and small reveals help the inner construction read clearly.
    for x in (-4.06, 4.06):
        cube(f"Staff_Side_Support_{x}", (x, 1.06, .4), (.027, .55, .71), m["oak"], .003)


def corridor_depth(m):
    glass = pbr_material("V2_Window_Glass", (.84, .90, .93), .09)
    bsdf = glass.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Transmission Weight"].default_value = 1
    bsdf.inputs["IOR"].default_value = 1.45
    sky = pbr_material("V2_Exterior_Daylight", (.61, .75, .85), .8,
                       emission=(.61, .75, .85), emission_strength=.55)
    # Close the visitor-side background, outside the main camera's view.
    cube("Lobby_Back_Wall", (0, -9.88, 1.66), (15.2, .12, 3.32), m["wall"])
    for side in (-1, 1):
        cube(f"Lobby_Side_Return_{side}", (side*7.6, -8.43, 1.66), (.18, 2.9, 3.32), m["wall"])
    cube("Lobby_Window_Recess", (0, -9.806, 1.75), (5.4, .016, 2.55), sky)
    for x in (-2.7, -.9, .9, 2.7):
        cube(f"Lobby_Window_Mullion_{x}", (x, -9.78, 1.75), (.035, .055, 2.59), m["stone"], .004)
    for z in (.46, 1.43, 3.04):
        cube(f"Lobby_Window_Transom_{z}", (0, -9.78, z), (5.45, .055, .035), m["stone"], .004)
    for side in (-1, 1):
        x = side*6.1
        remove_objects([f"Corridor_Handrail_{side}", f"End_Window_{side}"])
        cube(f"Corridor_Inner_Wall_{side}", (side*4.64, 7.63, 1.66), (.15, 6.85, 3.32), m["wall"], .008)
        cube(f"Corridor_Inner_Skirting_{side}", (side*4.725, 7.63, .073), (.017, 6.83, .135), m["metal"], .002)
        for j, (start, end) in enumerate(((-2, .88), (2.32, 3.88), (5.32, 6.88), (8.32, 10.8))):
            base.tube(f"Corridor_Handrail_{side}_{j}", [(side*7.33, start, .86), (side*7.33, end, .86)], .033, m["teal"])
            for y in (start+.2, end-.2):
                base.tube(f"Handrail_Bracket_{side}_{j}_{y}", [(side*7.33, y, .86), (side*7.43, y, .79)], .009, m["metal"])
        for i, y in enumerate((1.6, 4.6, 7.6)):
            dx = side*7.48
            for offset in (-.19, .19):
                cube(f"Door_Glazing_Frame_V_{side}_{i}_{offset}", (dx-side*.1, y+offset, 1.60), (.012, .027, .64), m["metal"], .003)
            for z in (1.29, 1.91):
                cube(f"Door_Glazing_Frame_H_{side}_{i}_{z}", (dx-side*.1, y, z), (.012, .4, .025), m["metal"], .003)
            bpy.data.objects[f"Door_Window_{side}_{i}"].data.materials[0] = glass
            cube(f"Door_Threshold_{side}_{i}", (dx-side*.08, y, .014), (.23, 1.15, .018), m["metal"], .002)
            cube(f"Door_Terminal_{side}_{i}", (dx-side*.11, y+.85, 1.47), (.055, .14, .24), m["stone"], .009)
            cube(f"Door_Terminal_Face_{side}_{i}", (dx-side*.142, y+.85, 1.485), (.004, .105, .16), m["screen"], .003)
        cube(f"Window_Glazing_{side}", (x, 11.07, 1.75), (2.71, .014, 3.1), glass)
        for dx in (-1.4, -.47, .47, 1.4):
            cube(f"Window_Mullion_{side}_{dx}", (x+dx, 11.04, 1.75), (.035, .075, 3.20), m["stone"], .004)
        for z in (.14, 1.15, 3.35):
            cube(f"Window_Transom_{side}_{z}", (x, 11.04, z), (2.82, .075, .035), m["stone"], .004)
        cube(f"Exterior_Sky_{side}", (x, 13.6, 2.0), (3.5, .025, 5), sky)
        for j in range(6):
            sphere(f"Exterior_Foliage_{side}_{j}", (x-1.15+j*.42, 12.3, .2+(j % 3)*.35), (.55, .35, .7), m["leaf"])
        base.plant(f"Corridor_Plant_{side}", x+side*.83, 9.8, 0, 1.5, m)


def planar_uv(m):
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not any(mat in obj.data.materials[:] for mat in (m["oak"], m["stone"], m["floor"], m["fabric"])):
            continue
        if obj.name in {"Nurse_Counter", "Nurse_Counter_Oak", "Clock_Display"} or obj.name.startswith("Preview_"):
            continue
        layer = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
        for polygon in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(polygon.normal[i]))
            for index in polygon.loop_indices:
                p = obj.data.vertices[obj.data.loops[index].vertex_index].co
                layer.data[index].uv = (p.y if axis == 0 else p.x, p.y if axis == 2 else p.z)


def light_scene(scene):
    # The v1 reveal helpers light the white fascia above the actual recess.
    # Use the continuous emissive strip that follows the curved reveal.
    remove_objects([obj.name for obj in scene.objects if obj.name.startswith("Reveal_Bounce_")])
    front = bpy.data.objects["Front_Softbox"]
    front.location = (-3.7, -4.0, 2.9)
    front.data.energy = 380
    front.data.size = 4.8
    point_at(front, (0, 1, 1))
    bpy.data.objects["Right_Window_Fill"].data.energy = 190
    add_area_light("V2_Left_Daylight", (-6.5, -.7, 2.65), 720, (2.4, 2.7), (.84, .92, 1), (0, 1.5, .8))
    add_area_light("V2_Rear_Cabinet_Fill", (0, 2.9, 2.84), 95, (6.5, .8), (1, .93, .83), (0, 4.1, 1.5))
    for obj in bpy.context.scene.objects:
        if obj.type != "LIGHT":
            continue
        if obj.name.startswith("Canopy_Light_"):
            obj.data.energy = 28
        if obj.name.startswith("Window_Daylight_"):
            obj.data.energy = 480
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .23
    scene.view_settings.exposure = .12


def validate_scene():
    expected = ((-2.7, 1.097, 1.275), (-.9, 1.097, 1.275),
                (.9, 1.097, 1.275), (2.7, 1.097, 1.275))
    bpy.context.view_layer.update()
    for i, position in enumerate(expected, 1):
        display = bpy.data.objects[f"Screen_Work_{i:02d}"]
        assert (display.matrix_world.translation-Vector(position)).length < 1e-5
        normal = display.matrix_world.to_3x3() @ display.data.polygons[0].normal
        assert normal.y > .99, "Work screens must face staff"
    assert (bpy.data.objects["Staff_Worktop"].bound_box[0][2]) > .74
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            assert all(math.isfinite(value) for vertex in obj.data.vertices for value in vertex.co), obj.name


def main():
    argv = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "output/nurse-station-reference-v1/nurse-station-design-v1.blend")
    parser.add_argument("--output", type=Path, default=ROOT / "output/nurse-station-reference-v2")
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--views", nargs="+", choices=("front", "detail", "wall", "workstation"), default=["front", "detail", "workstation"])
    args = parser.parse_args(argv)
    assert args.input.is_file(), f"Missing source model: {args.input}"
    assert args.output.resolve() != args.input.resolve().parent, "Preserve the v1 deliverable directory"
    assert 1 <= args.samples <= 1024 and 320 <= args.width <= 7680
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "textures").mkdir(exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=str(args.input))
    base.FONT = bpy.data.fonts.load("C:/Windows/Fonts/msyh.ttc")
    names = {"stone": "Warm_White_Solid_Surface", "oak": "Natural_Oak", "floor": "Warm_Grey_Vinyl",
             "metal": "Brushed_Stainless", "fabric": "Charcoal_Mesh_Fabric", "dark": "Monitor_Bezel",
             "teal": "Sign_Teal", "leaf": "Leaf_Green", "wall": "Warm_White_Paint",
             "screen": "Screen_Glass", "led": "Warm_LED", "soil": "Pot_Soil", "stem": "Plant_Stem"}
    m = {key: bpy.data.materials[name] for key, name in names.items()}
    refine_materials(m, args.output)
    open_working_side(m)
    refine_workstations(m)
    corridor_depth(m)
    planar_uv(m)
    scene = bpy.context.scene
    light_scene(scene)
    validate_scene()
    scene.cycles.samples = args.samples
    scene.render.resolution_x = args.width
    scene.render.resolution_y = round(args.width*9/16)
    base.PREVIEW = [obj for obj in scene.objects if obj.name.startswith("Preview_")]
    base.SCREENS = [bpy.data.objects[name] for name in ["Screen_Main", "Screen_Work_01", "Screen_Work_02", "Screen_Work_03", "Screen_Work_04"]]
    base.configure_camera(scene, "front")
    base.export_and_validate(args.output, "v2")
    report_path = args.output / "model-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report.update({"refinements": ["PBR color/normal/roughness maps", "open staff side and seated worktop",
                  "drawers and cable management", "articulated monitor supports", "corridor window/door details"],
                   "staff_worktop_height": .79, "rear_wall_offset": 1.0,
                   "source": str(args.input), "v1_preserved": True})
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "nurse-station-design-v2.blend"))
    for view in args.views:
        if view == "workstation":
            scene.camera.location = (-3.8, 3.4, 1.85)
            scene.camera.data.lens = 24
            point_at(scene.camera, (-1.1, 1.1, .87))
        elif view == "wall":
            base.configure_camera(scene, view)
            scene.camera.location.y += 1
        else:
            base.configure_camera(scene, view)
        scene.render.filepath = str(args.output / f"{view}.png")
        bpy.ops.render.render(write_still=True)
    print(f"NURSE_STATION_V2_COMPLETE {args.output}", flush=True)


if __name__ == "__main__":
    main()
