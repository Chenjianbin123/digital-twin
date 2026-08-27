import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models" / "smart-ward-nurse-station"
IMAGE_DIR = ROOT / "public" / "images" / "smart-ward-nurse-station"
BLEND_PATH = MODEL_DIR / "high_fidelity_nurse_station.blend"
PNG_PATH = IMAGE_DIR / "nurse_station_high_fidelity.png"
WEBP_PATH = IMAGE_DIR / "nurse_station_high_fidelity.webp"
PREVIEW_PNG_PATH = IMAGE_DIR / "nurse_station_corridor_wayfinding_preview.png"


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--build-only", action="store_true")
    parser.add_argument("--preview", action="store_true")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.materials,
        bpy.data.curves,
        bpy.data.meshes,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(collection):
            collection.remove(block)


def pbr_material(name, base_color, roughness, metallic=0.0, emission=None, emission_strength=0.0):
    material = bpy.data.materials.new(name)
    material.use_fake_user = True
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return material


def add_noise_bump(material, scale=7.0, detail=3.0, strength=0.08):
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = detail
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.08
    links.new(noise.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])


def cube(name, location, dimensions, material=None, bevel=0.0, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material is not None:
        obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
    return obj


def cylinder(name, location, radius, depth, material=None, vertices=48, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    if material is not None:
        obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft edges", "BEVEL")
    bevel.width = min(radius * 0.12, 0.035)
    bevel.segments = 3
    return obj


def sphere(name, location, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def point_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_area_light(name, location, energy, size, color=(0.78, 0.9, 1.0), target=(0, 2, 0)):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "RECTANGLE"
    data.size = size[0]
    data.size_y = size[1]
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    point_at(obj, target)
    return obj


def add_text(name, body, location, size, material, align="CENTER"):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.008
    curve.bevel_depth = 0.003
    font_path = Path("/System/Library/Fonts/PingFang.ttc")
    if font_path.exists():
        try:
            curve.font = bpy.data.fonts.load(str(font_path))
        except RuntimeError:
            pass
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (math.radians(90), 0, 0)
    obj.data.materials.append(material)
    return obj


def arc_counter_mesh(name, z_min, z_max, material, outer=(5.65, 2.32), inner=(4.45, 1.15), center_y=1.12):
    segments = 96
    vertices = []
    for z in (z_min, z_max):
        for radius_x, radius_y in (outer, inner):
            for index in range(segments + 1):
                angle = math.radians(180 + 180 * index / segments)
                vertices.append((
                    radius_x * math.cos(angle),
                    center_y + radius_y * math.sin(angle),
                    z,
                ))

    stride = segments + 1
    faces = []
    outer_bottom = 0
    inner_bottom = stride
    outer_top = stride * 2
    inner_top = stride * 3
    for index in range(segments):
        next_index = index + 1
        faces.extend([
            (outer_top + index, outer_top + next_index, inner_top + next_index, inner_top + index),
            (outer_bottom + next_index, outer_bottom + index, inner_bottom + index, inner_bottom + next_index),
            (outer_bottom + index, outer_bottom + next_index, outer_top + next_index, outer_top + index),
            (inner_bottom + next_index, inner_bottom + index, inner_top + index, inner_top + next_index),
        ])
    faces.extend([
        (outer_bottom, outer_top, inner_top, inner_bottom),
        (outer_bottom + segments, inner_bottom + segments, inner_top + segments, outer_top + segments),
    ])

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Rounded counter edges", "BEVEL")
    bevel.width = 0.06
    bevel.segments = 4
    return obj


def rotate_plan_offset(origin_x, origin_y, offset_x, offset_y, angle):
    cosine = math.cos(angle)
    sine = math.sin(angle)
    return (
        origin_x + offset_x * cosine - offset_y * sine,
        origin_y + offset_x * sine + offset_y * cosine,
    )


def add_corridor_door(side, index, wall_x, y, angle, materials):
    direction = -1 if side == "Left" else 1
    face_x = wall_x - direction * 0.11
    rotation = (0.0, 0.0, angle)

    door = cube(
        f"Ward_Door_{side}_{index:02d}",
        (face_x, y, 1.12),
        (0.10, 1.16, 2.24),
        materials["wood"],
        bevel=0.035,
        rotation=rotation,
    )
    top_x, top_y = rotate_plan_offset(face_x, y, -direction * 0.035, 0.0, angle)
    cube(f"Door_Frame_{side}_{index:02d}", (top_x, top_y, 2.28), (0.16, 1.34, 0.12), materials["trim"], bevel=0.02, rotation=rotation)
    for offset in (-0.65, 0.65):
        side_x, side_y = rotate_plan_offset(face_x, y, -direction * 0.035, offset, angle)
        cube(
            f"Door_Frame_Side_{side}_{index:02d}_{offset}",
            (side_x, side_y, 1.15),
            (0.16, 0.10, 2.38),
            materials["trim"],
            bevel=0.018,
            rotation=rotation,
        )
    window_x, window_y = rotate_plan_offset(face_x, y, -direction * 0.065, 0.0, angle)
    cube(
        f"Door_Window_{side}_{index:02d}",
        (window_x, window_y, 1.52),
        (0.035, 0.53, 0.73),
        materials["glass"],
        bevel=0.025,
        rotation=rotation,
    )
    handle_x, handle_y = rotate_plan_offset(face_x, y, -direction * 0.085, -0.38, angle)
    cylinder(
        f"Door_Handle_{side}_{index:02d}",
        (handle_x, handle_y, 1.05),
        0.035,
        0.32,
        materials["metal"],
        vertices=24,
        rotation=(math.radians(90), 0, angle),
    )
    sign_x, sign_y = rotate_plan_offset(face_x, y, -direction * 0.075, 0.82, angle)
    cube(
        f"Door_Sign_{side}_{index:02d}",
        (sign_x, sign_y, 1.72),
        (0.045, 0.35, 0.44),
        materials["sign"],
        bevel=0.03,
        rotation=rotation,
    )
    return door


def build_corridor_wing(side, materials):
    direction = -1 if side == "Left" else 1
    wall_x = direction * 5.00
    face_x = wall_x - direction * 0.11
    cube(
        f"Corridor_Inner_Wall_{side}",
        (wall_x, 3.10, 1.65),
        (0.16, 5.80, 3.30),
        materials["wall"],
    )
    for index, y in enumerate((1.10, 3.10, 5.05), start=1):
        add_corridor_door(side, index, wall_x, y, 0.0, materials)
    cube(
        f"Corridor_Rail_{side}",
        (face_x - direction * 0.045, 3.15, 0.90),
        (0.13, 5.65, 0.15),
        materials["trim"],
        bevel=0.055,
    )
    cube(
        f"Corridor_Base_Trim_{side}",
        (face_x - direction * 0.025, 3.15, 0.39),
        (0.10, 5.70, 0.13),
        materials["trim"],
        bevel=0.025,
    )


def add_wayfinding_sign(side, title, subtitle, materials):
    direction = -1 if side == "Left" else 1
    x = direction * 5.15
    y = 0.18

    for index, rod_offset in enumerate((-0.38, 0.38), start=1):
        cylinder(
            f"Wayfinding_Sign_{side}_Rod_{index:02d}",
            (x + rod_offset, y + 0.02, 3.03),
            0.018,
            0.45,
            materials["metal"],
            vertices=20,
        )

    cube(
        f"Wayfinding_Sign_{side}_Frame",
        (x, y, 2.73),
        (1.36, 0.12, 0.46),
        materials["trim"],
        bevel=0.035,
    )
    cube(
        f"Wayfinding_Sign_{side}",
        (x, y - 0.071, 2.73),
        (1.22, 0.025, 0.33),
        materials["sign"],
        bevel=0.018,
    )
    add_text(
        f"Wayfinding_Sign_{side}_Title",
        title,
        (x, y - 0.092, 2.79),
        0.112,
        materials["text"],
    )
    add_text(
        f"Wayfinding_Sign_{side}_Subtitle",
        subtitle,
        (x, y - 0.094, 2.64),
        0.052,
        materials["text"],
    )


def add_workstation(index, x, materials):
    parent = bpy.data.objects.new(f"Workstation_{index:02d}", None)
    parent.location = (0.0, 0.0, 0.0)
    bpy.context.collection.objects.link(parent)

    frame = cube(
        f"Monitor_Frame_{index:02d}",
        (x, 0.18, 1.55),
        (1.34, 0.16, 0.82),
        materials["monitor"],
        bevel=0.055,
    )
    screen = cube(
        f"Monitor_Screen_{index:02d}",
        (x, 0.087, 1.56),
        (1.16, 0.022, 0.64),
        materials["dashboard"],
        bevel=0.028,
    )
    stand = cube(f"Monitor_Stand_{index:02d}", (x, 0.23, 1.06), (0.14, 0.18, 0.25), materials["monitor"], bevel=0.025)
    base = cube(f"Monitor_Base_{index:02d}", (x, 0.20, 0.96), (0.62, 0.36, 0.055), materials["monitor"], bevel=0.03)
    keyboard = cube(f"Keyboard_{index:02d}", (x, -0.43, 1.02), (0.82, 0.30, 0.045), materials["monitor"], bevel=0.035)
    mouse = sphere(f"Mouse_{index:02d}", (x + 0.54, -0.39, 1.045), (0.09, 0.13, 0.045), materials["monitor"])
    for obj in (frame, screen, stand, base, keyboard, mouse):
        obj.parent = parent

    for bar_index, width in enumerate((0.43, 0.70, 0.56)):
        bar = cube(
            f"Monitor_UI_{index:02d}_{bar_index:02d}",
            (x - 0.18 + bar_index * 0.08, 0.071, 1.71 - bar_index * 0.17),
            (width, 0.009, 0.045),
            materials["cyan" if bar_index == 0 else "ui_blue"],
            bevel=0.008,
        )
        bar.parent = parent


def add_printer(name, x, materials):
    cube(name, (x, 0.33, 1.18), (0.78, 0.68, 0.55), materials["equipment"], bevel=0.09)
    cube(f"{name}_Top", (x, 0.25, 1.49), (0.66, 0.54, 0.12), materials["equipment_dark"], bevel=0.045)
    cube(f"{name}_Slot", (x, -0.025, 1.20), (0.34, 0.02, 0.08), materials["monitor"], bevel=0.015)


def add_plant(name, location, scale, materials):
    x, y, z = location
    cylinder(f"{name}_Pot", (x, y, z), 0.18 * scale, 0.32 * scale, materials["pot"], vertices=36)
    cylinder(f"{name}_Stem", (x, y, z + 0.28 * scale), 0.025 * scale, 0.38 * scale, materials["stem"], vertices=16)
    for index, angle in enumerate((0, 72, 144, 216, 288)):
        radians = math.radians(angle)
        sphere(
            f"{name}_Leaf_{index:02d}",
            (
                x + math.cos(radians) * 0.15 * scale,
                y + math.sin(radians) * 0.10 * scale,
                z + (0.43 + 0.05 * (index % 2)) * scale,
            ),
            (0.08 * scale, 0.18 * scale, 0.055 * scale),
            materials["plant"],
        ).rotation_euler[2] = radians


def configure_cycles_device(scene):
    try:
        preferences = bpy.context.preferences.addons["cycles"].preferences
        preferences.compute_device_type = "METAL"
        preferences.get_devices()
        for device in preferences.devices:
            device.use = device.type != "CPU"
        scene.cycles.device = "GPU"
        print("Cycles Metal GPU enabled.")
    except Exception as exc:
        print(f"Cycles GPU unavailable, using CPU: {exc}")


def configure_scene(preview=False):
    scene = bpy.context.scene
    scene.render.resolution_x = 1920 if preview else 3840
    scene.render.resolution_y = 1080 if preview else 2160
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32 if preview else 256
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.cycles.glossy_bounces = 3
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.look = "AgX - Medium High Contrast"
    configure_cycles_device(scene)

    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.13, 0.16, 0.18, 1.0)
    background.inputs["Strength"].default_value = 0.22
    return scene


def build_materials():
    materials = {
        "white": pbr_material("White_Stone", (0.82, 0.85, 0.84), 0.23),
        "floor": pbr_material("Blue_Floor", (0.055, 0.25, 0.36), 0.30),
        "wood": pbr_material("Wood_Door", (0.46, 0.28, 0.14), 0.46),
        "wall": pbr_material("Wall_Paint", (0.76, 0.79, 0.78), 0.72),
        "ceiling": pbr_material("Ceiling_Paint", (0.60, 0.66, 0.68), 0.66, emission=(0.08, 0.11, 0.13), emission_strength=0.16),
        "whiteboard": pbr_material("Nursing_Whiteboard", (0.78, 0.82, 0.80), 0.58),
        "ink": pbr_material("Whiteboard_Ink", (0.015, 0.06, 0.085), 0.45),
        "screen": pbr_material("Screen_Glass", (0.003, 0.009, 0.014), 0.34, metallic=0.04),
        "monitor": pbr_material("Monitor_Bezel", (0.018, 0.025, 0.029), 0.22, metallic=0.15),
        "dashboard": pbr_material("Dashboard_Blue", (0.005, 0.035, 0.055), 0.18, emission=(0.0, 0.12, 0.20), emission_strength=0.32),
        "ui_blue": pbr_material("UI_Blue", (0.01, 0.22, 0.38), 0.22, emission=(0.01, 0.24, 0.42), emission_strength=1.2),
        "cyan": pbr_material("UI_Cyan", (0.03, 0.48, 0.66), 0.20, emission=(0.04, 0.55, 0.75), emission_strength=1.5),
        "trim": pbr_material("Hospital_Blue_Trim", (0.025, 0.33, 0.49), 0.35),
        "metal": pbr_material("Brushed_Metal", (0.32, 0.36, 0.38), 0.25, metallic=0.82),
        "glass": pbr_material("Door_Glass", (0.28, 0.48, 0.56), 0.12, metallic=0.06),
        "sign": pbr_material("Wayfinding_Blue", (0.01, 0.13, 0.24), 0.28),
        "equipment": pbr_material("Equipment_White", (0.66, 0.70, 0.70), 0.38),
        "equipment_dark": pbr_material("Equipment_Dark", (0.06, 0.08, 0.09), 0.34),
        "chair": pbr_material("Chair_Upholstery", (0.055, 0.07, 0.075), 0.52),
        "pot": pbr_material("Ceramic_Pot", (0.70, 0.73, 0.70), 0.44),
        "plant": pbr_material("Plant_Leaf", (0.055, 0.24, 0.11), 0.58),
        "stem": pbr_material("Plant_Stem", (0.12, 0.20, 0.075), 0.62),
        "light": pbr_material("Ceiling_Light", (0.78, 0.90, 1.0), 0.18, emission=(0.72, 0.88, 1.0), emission_strength=4.2),
        "red": pbr_material("Clock_Red", (0.32, 0.003, 0.003), 0.24, emission=(0.9, 0.005, 0.002), emission_strength=5.0),
        "text": pbr_material("Sign_Text", (0.73, 0.90, 0.96), 0.30, emission=(0.20, 0.45, 0.60), emission_strength=0.7),
    }
    add_noise_bump(materials["white"], scale=22.0, detail=2.0, strength=0.035)
    add_noise_bump(materials["floor"], scale=13.0, detail=3.0, strength=0.07)
    add_noise_bump(materials["wall"], scale=35.0, detail=2.0, strength=0.045)
    add_noise_bump(materials["wood"], scale=4.0, detail=2.0, strength=0.08)
    return materials


def build_architecture(materials):
    cube("Floor", (0, -3.0, -0.10), (14.2, 30.0, 0.20), materials["floor"], bevel=0.02)
    cube("Ceiling", (0, -3.0, 3.34), (14.2, 30.0, 0.16), materials["ceiling"])
    cube("Back_Wall", (0, 6.05, 1.65), (14.2, 0.22, 3.3), materials["wall"])
    cube("Side_Wall_Left", (-7.02, 1.3, 1.65), (0.22, 9.7, 3.3), materials["wall"])
    cube("Side_Wall_Right", (7.02, 1.3, 1.65), (0.22, 9.7, 3.3), materials["wall"])

    for side, x in (("Left", -5.35), ("Right", 5.35)):
        anchor = bpy.data.objects.new(f"Corridor_{side}", None)
        anchor.location = (x, 2.0, 0.0)
        bpy.context.collection.objects.link(anchor)
        build_corridor_wing(side, materials)

    add_wayfinding_sign("Left", "← 病房区", "WARD AREA", materials)
    add_wayfinding_sign("Right", "请保持安静", "QUIET ZONE", materials)

    for x in (-6.72, 6.72):
        cube(f"Handrail_{'L' if x < 0 else 'R'}", (x, 1.45, 0.91), (0.18, 8.9, 0.16), materials["trim"], bevel=0.07)
        cube(f"Wall_Trim_{'L' if x < 0 else 'R'}", (x, 1.45, 0.42), (0.10, 9.0, 0.15), materials["trim"], bevel=0.025)

    light_index = 1
    for y in (-1.4, 0.8, 3.0, 5.15):
        for x in (-4.7, -2.35, 0.0, 2.35, 4.7):
            cube(f"Ceiling_Panel_{light_index:02d}", (x, y, 3.235), (1.42, 0.62, 0.055), materials["light"], bevel=0.055)
            if x in (-4.7, 0.0, 4.7):
                add_area_light(
                    f"Ceiling_Area_{light_index:02d}",
                    (x, y, 3.17),
                    72,
                    (1.25, 0.52),
                    target=(x * 0.65, y + 0.2, 0.0),
                )
            light_index += 1


def build_counter_and_workstations(materials):
    counter = arc_counter_mesh("Nurse_Counter", 0.10, 0.91, materials["equipment"], center_y=1.12)
    countertop = arc_counter_mesh(
        "Nurse_Counter_Top",
        0.91,
        1.03,
        materials["white"],
        outer=(5.72, 2.39),
        inner=(4.38, 1.08),
        center_y=1.12,
    )
    cube("Counter_Front_Shadow", (0, -1.23, 0.22), (5.0, 0.08, 0.15), materials["trim"], bevel=0.045)
    sign = cube("Nurse_Station_Sign", (0, -1.33, 0.52), (2.65, 0.11, 0.68), materials["sign"], bevel=0.08)
    add_text("Nurse_Station_Text_CN", "护士站", (0, -1.402, 0.61), 0.34, materials["text"])
    add_text("Nurse_Station_Text_EN", "NURSE STATION", (0, -1.408, 0.34), 0.12, materials["text"])

    for index, x in enumerate((-3.0, -1.0, 1.0, 3.0), start=1):
        add_workstation(index, x, materials)

    add_printer("Printer_Left", -4.62, materials)
    add_printer("Printer_Right", 4.62, materials)

    for x in (-2.05, 0.0, 2.05):
        cylinder(f"Chair_Base_{x}", (x, 1.11, 0.18), 0.29, 0.08, materials["monitor"])
        cylinder(f"Chair_Stem_{x}", (x, 1.11, 0.45), 0.06, 0.48, materials["metal"], vertices=24)
        cube(f"Chair_Seat_{x}", (x, 1.11, 0.73), (0.72, 0.66, 0.18), materials["chair"], bevel=0.13)
        cube(f"Chair_Back_{x}", (x, 1.45, 1.17), (0.72, 0.16, 0.76), materials["chair"], bevel=0.14)

    cube("Desk_Phone", (4.02, -0.20, 1.10), (0.58, 0.38, 0.18), materials["monitor"], bevel=0.07)
    cylinder("Desk_Phone_Handset", (4.02, -0.21, 1.23), 0.075, 0.55, materials["monitor"], vertices=32, rotation=(0, math.radians(90), 0))
    return counter, countertop, sign


def add_information_board(name, x, z, size, frame_material, face_material):
    width, height = size
    cube(
        f"{name}_Frame",
        (x, 5.65, z),
        (width + 0.16, 0.16, height + 0.16),
        frame_material,
        bevel=0.055,
    )
    return cube(
        name,
        (x, 5.545, z),
        (width, 0.035, height),
        face_material,
        bevel=0.025,
    )


def add_information_board_content(materials):
    add_text("Nursing_Board_Title", "护理交班", (-2.95, 5.505, 2.62), 0.16, materials["ink"])
    for index, (bed_label, z) in enumerate((("101", 2.34), ("102", 2.10), ("103", 1.86)), start=1):
        add_text(f"Nursing_Bed_{index:02d}", bed_label, (-3.43, 5.502, z), 0.11, materials["ink"])
        cube(f"Nursing_Row_{index:02d}", (-2.81, 5.510, z), (0.68, 0.012, 0.045), materials["ui_blue"], bevel=0.008)
        cube(f"Nursing_Level_{index:02d}", (-2.30, 5.508, z), (0.12, 0.014, 0.10), materials["cyan" if index == 1 else "trim"], bevel=0.012)

    add_text("Main_Board_Title", "病区患者总览", (0.0, 5.502, 2.66), 0.17, materials["text"])
    add_text("Main_Board_Beds", "24 / 30", (-0.66, 5.500, 2.22), 0.20, materials["text"])
    add_text("Main_Board_Tasks", "待处理 3", (0.67, 5.500, 2.22), 0.15, materials["text"])
    for index, (x, width) in enumerate(((-0.72, 0.78), (0.0, 0.54), (0.68, 0.86)), start=1):
        cube(f"Main_Board_Bar_{index:02d}", (x, 5.508, 1.91), (width, 0.014, 0.07), materials["cyan" if index == 1 else "ui_blue"], bevel=0.012)

    add_text("Patient_Board_Title", "患者状态", (2.95, 5.502, 2.62), 0.16, materials["text"])
    for index, (room_label, z) in enumerate((("601", 2.34), ("602", 2.10), ("603", 1.86)), start=1):
        add_text(f"Patient_Room_{index:02d}", room_label, (2.52, 5.500, z), 0.11, materials["text"])
        cube(f"Patient_Status_Dot_{index:02d}", (2.91, 5.507, z), (0.10, 0.014, 0.10), materials["cyan" if index < 3 else "red"], bevel=0.025)
        cube(f"Patient_Status_Bar_{index:02d}", (3.35, 5.508, z), (0.52, 0.014, 0.045), materials["ui_blue"], bevel=0.008)


def build_command_wall(materials):
    cube("Command_Wall_Accent", (0, 5.82, 1.73), (8.15, 0.24, 3.02), materials["equipment"], bevel=0.05)
    add_information_board("Board_Nursing", -2.95, 2.25, (1.72, 1.22), materials["metal"], materials["whiteboard"])
    add_information_board("Screen_Main", 0.0, 2.25, (2.65, 1.34), materials["monitor"], materials["screen"])
    add_information_board("Board_Patient_Status", 2.95, 2.25, (1.72, 1.22), materials["monitor"], materials["dashboard"])
    add_information_board_content(materials)

    cube("Cabinet_Wall", (0, 5.42, 0.56), (8.05, 0.72, 0.96), materials["equipment"], bevel=0.055)
    cabinet_xs = (-3.48, -2.49, -1.50, -0.50, 0.50, 1.50, 2.49, 3.48)
    for index, x in enumerate(cabinet_xs, start=1):
        cube(f"Cabinet_Door_{index:02d}", (x, 5.045, 0.54), (0.88, 0.035, 0.76), materials["white"], bevel=0.025)
        cylinder(f"Cabinet_Handle_{index:02d}", (x + 0.31, 5.015, 0.58), 0.014, 0.12, materials["metal"], vertices=16)

    for index, x in enumerate((-3.62, -3.38, -3.14, -2.90), start=1):
        cube(f"File_Binder_{index:02d}", (x, 4.98, 1.22), (0.16, 0.28, 0.52), materials["trim" if index % 2 else "sign"], bevel=0.018)

    for index, (x, scale) in enumerate(((-1.72, 0.68), (1.62, 0.78), (3.76, 0.62)), start=1):
        add_plant(f"Command_Plant_{index:02d}", (x, 4.98, 1.15), scale, materials)

    cube("Clock_Frame", (3.45, 5.80, 3.04), (1.02, 0.18, 0.34), materials["monitor"], bevel=0.055)
    cube("Clock_Display", (3.45, 5.69, 3.04), (0.88, 0.035, 0.23), materials["screen"], bevel=0.025)
    add_text("Clock_Preview_Text", "14:35:26", (3.45, 5.66, 3.04), 0.16, materials["red"])


def build_camera_and_lighting(scene, materials):
    camera_data = bpy.data.cameras.new("Reference_Camera")
    camera = bpy.data.objects.new("Reference_Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.0, -17.8, 2.55)
    camera.data.lens = 54
    camera.data.sensor_width = 36
    point_at(camera, (0.0, 1.75, 1.38))
    scene.camera = camera

    add_area_light("Counter_Key", (0, -4.3, 5.1), 430, (6.0, 3.0), color=(0.80, 0.90, 1.0), target=(0, 0.4, 0.8))
    add_area_light("Command_Wall_Fill", (0, 3.6, 3.0), 240, (7.2, 2.0), color=(0.70, 0.86, 1.0), target=(0, 5.5, 1.3))
    add_area_light("Left_Corridor_Fill", (-5.90, 1.20, 2.70), 125, (1.7, 2.6), color=(0.68, 0.82, 0.95), target=(-4.53, 3.45, 1.1))
    add_area_light("Right_Corridor_Fill", (5.90, 1.20, 2.70), 125, (1.7, 2.6), color=(0.68, 0.82, 0.95), target=(4.53, 3.45, 1.1))
    add_area_light("Counter_Rim", (0, 3.6, 2.7), 180, (5.0, 1.2), color=(0.55, 0.80, 1.0), target=(0, 0.3, 1.1))


def build_scene(preview=False):
    clear_scene()
    scene = configure_scene(preview=preview)
    materials = build_materials()
    build_architecture(materials)
    build_counter_and_workstations(materials)
    build_command_wall(materials)
    build_camera_and_lighting(scene, materials)
    return scene


def render_outputs(scene, preview=False):
    png_path = PREVIEW_PNG_PATH if preview else PNG_PATH
    scene.render.filepath = str(png_path)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 35
    bpy.ops.render.render(write_still=True)

    outputs = [png_path]
    if not preview:
        scene.render.image_settings.file_format = "WEBP"
        scene.render.image_settings.quality = 92
        bpy.data.images["Render Result"].save_render(filepath=str(WEBP_PATH), scene=scene)
        outputs.append(WEBP_PATH)
    return outputs


def main():
    args = parse_args()
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    scene = build_scene(preview=args.preview)
    if not args.preview:
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    if not args.build_only:
        for output_path in render_outputs(scene, preview=args.preview):
            print(f"Rendered {output_path}")


if __name__ == "__main__":
    main()
