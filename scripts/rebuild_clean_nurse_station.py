from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models" / "smart-ward-nurse-station"
BLEND_PATH = MODEL_DIR / "smart_ward_nurse_station.blend"
GLB_PATH = MODEL_DIR / "smart_ward_nurse_station.glb"
FONT_PATH = Path("/System/Library/Fonts/STHeiti Light.ttc")
MAIN_SCREEN = "Screen_Main"
WORK_SCREENS = [f"Screen_Work_{index:02d}" for index in range(1, 5)]
CLOCK_SCREEN = "Clock_Display"
REFERENCE_CAMERA = "Reference_Camera"


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def mat(name: str, color: tuple[float, float, float, float], roughness: float = 0.55, metallic: float = 0.0, emission=None, alpha=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Alpha"].default_value = alpha
        if emission:
            bsdf.inputs["Emission Color"].default_value = emission[0]
            bsdf.inputs["Emission Strength"].default_value = emission[1]
    material.diffuse_color = color
    if alpha < 1:
        material.blend_method = "BLEND"
        material.use_screen_refraction = True
    return material


MATS = {}


def setup_materials() -> None:
    MATS.update({
        "floor": mat("clean blue resilient hospital floor", (0.22, 0.43, 0.58, 1), 0.42),
        "floor_light": mat("pale blue corridor floor", (0.48, 0.67, 0.76, 1), 0.5),
        "wall": mat("quiet matte clinical wall", (0.9, 0.92, 0.92, 1), 0.84),
        "wall_panel": mat("soft blue hospital wall panel", (0.56, 0.74, 0.82, 1), 0.72),
        "wall_dark": mat("charcoal digital command wall", (0.035, 0.055, 0.07, 1), 0.7),
        "counter": mat("soft white solid surface counter", (0.92, 0.94, 0.94, 1), 0.32),
        "counter_side": mat("hospital wayfinding blue", (0.11, 0.35, 0.52, 1), 0.48),
        "wood": mat("pale maple door and worktop", (0.68, 0.53, 0.36, 1), 0.54),
        "screen": mat("deep glass screen", (0.015, 0.035, 0.045, 1), 0.38, 0.1, ((0.1, 0.75, 0.95, 1), 0.35)),
        "screen_glow": mat("cyan screen glow", (0.2, 0.88, 1.0, 0.72), 0.3, 0, ((0.1, 0.8, 1.0, 1), 1.8), 0.72),
        "fixture": mat("satin aluminum wall fixture", (0.72, 0.78, 0.77, 1), 0.5, 0.12),
        "soft_lamp": mat("warm opal lamp diffuser", (0.95, 0.98, 0.92, 0.86), 0.42, 0, ((0.8, 0.92, 0.86, 1), 0.28), 0.86),
        "whiteboard": mat("matte nurse station whiteboard", (0.92, 0.96, 0.95, 1), 0.72),
        "pink": mat("calling pink signal", (1.0, 0.26, 0.48, 1), 0.36, 0, ((1.0, 0.18, 0.45, 1), 1.2)),
        "amber": mat("infusion amber signal", (1.0, 0.68, 0.22, 1), 0.4, 0, ((1.0, 0.56, 0.12, 1), 0.8)),
        "waste_orange": mat("medical waste orange lid", (0.95, 0.42, 0.12, 1), 0.42, 0, ((0.95, 0.34, 0.1, 1), 0.22)),
        "green": mat("normal green signal", (0.22, 0.78, 0.62, 1), 0.44, 0, ((0.16, 0.8, 0.58, 1), 0.7)),
        "glass": mat("clear privacy glass", (0.72, 0.94, 0.98, 0.22), 0.18, 0, None, 0.22),
        "staff": mat("soft blue nurse uniform", (0.68, 0.86, 0.92, 1), 0.58),
        "staff_white": mat("clean white nurse trim", (0.94, 0.98, 0.98, 1), 0.5),
        "staff_mask": mat("pale surgical mask", (0.78, 0.95, 0.96, 1), 0.62),
        "staff_badge": mat("hospital badge accent", (0.13, 0.47, 0.62, 1), 0.45, 0, ((0.08, 0.65, 0.85, 1), 0.25)),
        "hair": mat("dark nurse hair", (0.055, 0.042, 0.035, 1), 0.64),
        "skin": mat("warm skin tone", (0.78, 0.62, 0.45, 1), 0.55),
        "dark": mat("soft graphite detail", (0.08, 0.12, 0.15, 1), 0.6),
    })


def cube(name: str, loc, scale, material_name: str):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MATS[material_name])
    return obj


def bevel(obj, amount=0.025, segments=2):
    modifier = obj.modifiers.new(name="softened edges", type="BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.affect = "EDGES"
    obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    return obj


def vertical_plane(name: str, loc, width: float, height: float, material_name: str):
    half_w = width / 2
    half_h = height / 2
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(
        [
            (-half_w, 0, -half_h),
            (half_w, 0, -half_h),
            (half_w, 0, half_h),
            (-half_w, 0, half_h),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.data.materials.append(MATS[material_name])
    uv = mesh.uv_layers.new(name="screen-uv")
    for loop, coord in zip(mesh.polygons[0].loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop].uv = coord
    return obj


def side_wall_plane(name: str, loc, width: float, height: float, material_name: str):
    half_w = width / 2
    half_h = height / 2
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(
        [
            (0, -half_w, -half_h),
            (0, half_w, -half_h),
            (0, half_w, half_h),
            (0, -half_w, half_h),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.data.materials.append(MATS[material_name])
    uv = mesh.uv_layers.new(name="screen-uv")
    for loop, coord in zip(mesh.polygons[0].loop_indices, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        uv.data[loop].uv = coord
    return obj


def arc_counter_mesh(
    name: str,
    center_y: float,
    inner_radius: float,
    outer_radius: float,
    z_min: float,
    z_max: float,
    material_name: str,
    angle_min=-68,
    angle_max=68,
    segments=44,
):
    verts = []
    for z in (z_min, z_max):
        for radius in (outer_radius, inner_radius):
            for i in range(segments + 1):
                t = math.radians(angle_min + (angle_max - angle_min) * i / segments)
                verts.append((math.sin(t) * radius, center_y - math.cos(t) * radius, z))

    def idx(layer: int, ring: int, i: int) -> int:
        return layer * (segments + 1) * 2 + ring * (segments + 1) + i

    faces = []
    for i in range(segments):
        faces.append((idx(0, 0, i), idx(0, 0, i + 1), idx(1, 0, i + 1), idx(1, 0, i)))
        faces.append((idx(0, 1, i + 1), idx(0, 1, i), idx(1, 1, i), idx(1, 1, i + 1)))
        faces.append((idx(1, 0, i), idx(1, 0, i + 1), idx(1, 1, i + 1), idx(1, 1, i)))
        faces.append((idx(0, 0, i + 1), idx(0, 0, i), idx(0, 1, i), idx(0, 1, i + 1)))

    faces.append((idx(0, 0, 0), idx(1, 0, 0), idx(1, 1, 0), idx(0, 1, 0)))
    faces.append((idx(0, 1, segments), idx(1, 1, segments), idx(1, 0, segments), idx(0, 0, segments)))

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MATS[material_name])
    return obj


def cyl(name: str, loc, radius: float, depth: float, material_name: str, vertices: int = 48, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATS[material_name])
    return obj


def sphere(name: str, loc, radius: float, material_name: str, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(MATS[material_name])
    return obj


def cone(name: str, loc, radius1: float, radius2: float, depth: float, material_name: str, vertices: int = 32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MATS[material_name])
    return obj


def capsule(name: str, loc, length: float, radius: float, material_name: str, rotation=(0, 0, 0), scale=(1, 1, 1)):
    obj = cyl(name, loc, radius, length, material_name, vertices=24, rotation=rotation)
    obj.scale = scale
    return obj


def lowpoly_torso(name: str, x: float, y: float, z: float, height: float, material_name: str, rotation_z=0.0):
    levels = [
        (-height / 2, 0.135, 0.058),
        (-height * 0.18, 0.115, 0.052),
        (height * 0.22, 0.145, 0.058),
        (height / 2, 0.18, 0.064),
    ]
    verts = []
    for dz, half_w, half_d in levels:
        verts.extend([
            (-half_w, -half_d, dz),
            (half_w, -half_d, dz),
            (half_w, half_d, dz),
            (-half_w, half_d, dz),
        ])

    faces = []
    for i in range(len(levels) - 1):
        a = i * 4
        b = (i + 1) * 4
        faces.extend([
            (a, a + 1, b + 1, b),
            (a + 1, a + 2, b + 2, b + 1),
            (a + 2, a + 3, b + 3, b + 2),
            (a + 3, a, b, b + 3),
        ])
    faces.append((0, 1, 2, 3))

    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, y, z)
    obj.rotation_euler.z = rotation_z
    obj.data.materials.append(MATS[material_name])
    bevel(obj, 0.018, 2)
    return obj


def text(name: str, value: str, loc, size: float, material_name: str, rot=(math.radians(90), 0, 0), align="CENTER"):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = value
    obj.data.align_x = align
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.002
    if FONT_PATH.exists():
        obj.data.font = bpy.data.fonts.load(str(FONT_PATH), check_existing=True)
    obj.data.materials.append(MATS[material_name])
    return obj


def build_architecture() -> None:
    cube("Station_Floor", (0, 0.25, -0.055), (12.4, 8.5, 0.11), "floor")
    cube("Rear_Wall", (0, 3.32, 1.65), (11.8, 0.16, 3.3), "wall")
    cube("Station_Ceiling", (0, 0.3, 3.28), (12.4, 8.4, 0.12), "wall")
    cube("Rear_Command_Alcove", (0, 3.20, 2.05), (5.25, 0.12, 1.95), "wall_panel")

    for side, sign in [(-1, "Left"), (1, "Right")]:
        x_outer = side * 5.85
        corridor = cube(f"Corridor_{sign}", (side * 4.95, 0.45, 0.02), (1.75, 6.9, 0.04), "floor_light")
        corridor["scene_anchor"] = True
        cube(f"Corridor_{sign}_Outer_Wall", (x_outer, 0.5, 1.58), (0.12, 6.6, 3.16), "wall")
        cube(f"Corridor_{sign}_Inner_Pier", (side * 3.92, 2.66, 1.58), (0.42, 1.28, 3.16), "wall")
        cube(f"Corridor_{sign}_Blue_Rail", (x_outer - side * 0.09, 0.55, 0.9), (0.06, 5.75, 0.12), "counter_side")

        for index, y in enumerate([-1.55, 0.35, 2.12], start=1):
            door = cube(f"Door_{sign}_{index}", (x_outer - side * 0.075, y, 1.12), (0.08, 1.08, 2.18), "wood")
            bevel(door, 0.018, 2)
            side_wall_plane(
                f"Door_Window_{sign}_{index}",
                (x_outer - side * 0.125, y, 1.38),
                0.42,
                0.72,
                "glass",
            )
            cube(f"Door_Header_{sign}_{index}", (x_outer - side * 0.11, y, 2.28), (0.12, 1.22, 0.12), "counter_side")
            cube(f"Door_Plate_{sign}_{index}", (x_outer - side * 0.14, y - 0.73, 1.55), (0.05, 0.32, 0.24), "wall_panel")

    for row, y in enumerate([-2.45, -0.82, 0.82, 2.45]):
        for column, x in enumerate([-4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8]):
            cube(f"Ceiling_Tile_{row}_{column}", (x, y, 3.205), (1.48, 1.5, 0.035), "counter")
        for x in [-4.0, -2.0, 0, 2.0, 4.0]:
            cube(f"Ceiling_Light_{row}_{x}", (x, y, 3.17), (1.05, 0.42, 0.045), "soft_lamp")


def build_command_wall() -> None:
    frame = cube("Main_Screen_Frame", (0, 3.105, 2.12), (4.55, 0.16, 1.68), "dark")
    bevel(frame, 0.04, 3)
    vertical_plane(MAIN_SCREEN, (0, 3.012, 2.12), 4.27, 1.4, "screen")

    for x in [-2.25, -1.35, -0.45, 0.45, 1.35, 2.25]:
        cabinet = cube(f"Rear_Cabinet_{x}", (x, 3.02, 0.55), (0.82, 0.52, 0.92), "counter")
        bevel(cabinet, 0.025, 2)
        cube(f"Rear_Cabinet_Handle_{x}", (x, 2.735, 0.58), (0.12, 0.02, 0.025), "fixture")
    top = cube("Rear_Cabinet_Top", (0, 2.98, 1.04), (5.55, 0.64, 0.09), "counter")
    bevel(top, 0.025, 2)

    clock_frame = cube("Clock_Frame", (4.32, 3.10, 2.46), (1.42, 0.14, 0.52), "dark")
    bevel(clock_frame, 0.025, 2)
    vertical_plane(CLOCK_SCREEN, (4.32, 3.018, 2.46), 1.2, 0.32, "screen")


def build_counter() -> None:
    counter = arc_counter_mesh(
        "Nurse_Counter", center_y=1.05, inner_radius=2.08, outer_radius=3.42,
        z_min=0.06, z_max=0.88, material_name="counter",
        angle_min=-78, angle_max=78, segments=72,
    )
    counter["scene_anchor"] = True
    top = arc_counter_mesh(
        "Nurse_Counter_Top", center_y=1.05, inner_radius=1.98, outer_radius=3.52,
        z_min=0.88, z_max=1.02, material_name="counter",
        angle_min=-78, angle_max=78, segments=72,
    )
    bevel(top, 0.025, 2)
    cube("Nurse_Counter_Blue_Band", (0, -2.385, 0.46), (4.5, 0.06, 0.28), "counter_side")
    sign = cube("Nurse_Station_Sign", (0, -2.43, 0.45), (2.25, 0.05, 0.56), "counter_side")
    bevel(sign, 0.07, 4)
    text("Nurse_Station_Sign_CN", "护士站", (0, -2.466, 0.54), 0.23, "whiteboard", rot=(math.radians(90), 0, 0))
    text("Nurse_Station_Sign_EN", "NURSE STATION", (0, -2.468, 0.30), 0.075, "whiteboard", rot=(math.radians(90), 0, 0))

    for index, x in enumerate([-1.62, -0.54, 0.54, 1.62], start=1):
        build_workstation_set(x, index)

    for x in [-1.4, -0.46, 0.46, 1.4]:
        build_task_chair(x, -0.42)


def build_workstation_set(x: float, index: int) -> None:
    name = f"{index:02d}"
    frame = cube(f"Workstation_Monitor_Frame_{name}", (x, -0.82, 1.31), (0.8, 0.08, 0.48), "dark")
    bevel(frame, 0.012, 2)
    vertical_plane(WORK_SCREENS[index - 1], (x, -0.866, 1.31), 0.7, 0.38, "screen")
    cyl(f"Workstation_Monitor_Neck_{name}", (x, -0.77, 1.08), 0.025, 0.2, "dark")
    base = cube(f"Workstation_Monitor_Base_{name}", (x, -0.77, 0.99), (0.38, 0.18, 0.03), "dark")
    bevel(base, 0.018, 2)

    keyboard = cube(f"Workstation_Keyboard_{name}", (x, -1.22, 1.045), (0.56, 0.22, 0.035), "dark")
    keyboard.rotation_euler.x = math.radians(3)
    bevel(keyboard, 0.012, 1)
    mouse_x = x + 0.38
    pad = cube(f"Workstation_Mouse_Pad_{name}", (mouse_x, -1.18, 1.035), (0.2, 0.18, 0.012), "counter_side")
    bevel(pad, 0.012, 1)
    mouse = sphere(f"Workstation_Mouse_{name}", (mouse_x, -1.18, 1.07), 0.06, "dark", scale=(0.82, 1.12, 0.28))
    bevel(mouse, 0.003, 1)


def build_task_chair(x: float, y: float) -> None:
    seat = cyl(f"task chair rounded seat {x}", (x, y, 0.54), 0.22, 0.08, "dark", vertices=32)
    seat.scale.x = 1.22
    seat.scale.y = 0.88
    bevel(seat, 0.012, 2)

    cushion = cyl(f"task chair teal cushion {x}", (x, y - 0.01, 0.595), 0.19, 0.035, "counter_side", vertices=32)
    cushion.scale.x = 1.2
    cushion.scale.y = 0.82
    bevel(cushion, 0.01, 2)

    back = cube(f"task chair curved back {x}", (x, y + 0.18, 0.82), (0.48, 0.07, 0.42), "dark")
    back.rotation_euler.x = math.radians(-8)
    bevel(back, 0.035, 3)
    back_pad = cube(f"task chair back teal pad {x}", (x, y + 0.145, 0.82), (0.38, 0.025, 0.28), "counter_side")
    back_pad.rotation_euler.x = math.radians(-8)
    bevel(back_pad, 0.02, 2)

    cyl(f"task chair gas lift {x}", (x, y, 0.32), 0.035, 0.42, "dark", vertices=24)
    cyl(f"task chair hub {x}", (x, y, 0.15), 0.07, 0.05, "dark", vertices=24)
    for i, angle in enumerate([90, 162, 234, 306, 18]):
        rad = math.radians(angle)
        arm_x = x + math.cos(rad) * 0.16
        arm_y = y + math.sin(rad) * 0.16
        arm = cube(f"task chair five star foot {x} {i}", (arm_x, arm_y, 0.13), (0.28, 0.045, 0.035), "dark")
        arm.rotation_euler.z = rad
        bevel(arm, 0.01, 1)
        wheel = cyl(
            f"task chair caster {x} {i}",
            (x + math.cos(rad) * 0.3, y + math.sin(rad) * 0.3, 0.09),
            0.035,
            0.035,
            "dark",
            vertices=16,
            rotation=(math.radians(90), 0, rad),
        )
        wheel.scale.y = 0.7


def build_staff() -> None:
    def add_nurse(prefix: str, x: float, y: float, rot: float, sitting=False, gesture="typing"):
        torso_z = 0.87 if sitting else 0.92
        torso_h = 0.58 if sitting else 0.74
        lowpoly_torso(f"{prefix} tailored torso", x, y, torso_z, torso_h, "staff", rot)

        # Small planar uniform details are deliberately on the front side so the
        # figure reads as a nurse even from the app's default 3/4 view.
        collar_z = torso_z + torso_h * 0.34
        left_collar = cube(f"{prefix} left lapel", (x - 0.035, y - 0.072, collar_z), (0.058, 0.01, 0.086), "staff_white")
        right_collar = cube(f"{prefix} right lapel", (x + 0.035, y - 0.072, collar_z), (0.058, 0.01, 0.086), "staff_white")
        left_collar.rotation_euler.z = math.radians(-18)
        right_collar.rotation_euler.z = math.radians(18)
        bevel(left_collar, 0.006, 1)
        bevel(right_collar, 0.006, 1)
        badge = cube(f"{prefix} slim name badge", (x + 0.072, y - 0.077, torso_z + 0.055), (0.042, 0.01, 0.026), "staff_badge")
        bevel(badge, 0.005, 1)
        belt = cube(f"{prefix} uniform waist line", (x, y - 0.068, torso_z - torso_h * 0.2), (0.18, 0.01, 0.012), "staff_white")
        bevel(belt, 0.004, 1)

        neck_z = torso_z + torso_h / 2 + 0.005
        collar_ring = cube(f"{prefix} rounded collar base", (x, y - 0.01, neck_z - 0.018), (0.18, 0.08, 0.035), "staff_white")
        bevel(collar_ring, 0.018, 2)
        cyl(f"{prefix} slim neck", (x, y - 0.004, neck_z + 0.012), 0.028, 0.064, "skin", vertices=20)
        head_z = neck_z + 0.086
        head = sphere(f"{prefix} oval face", (x, y - 0.018, head_z), 0.082, "skin", (0.72, 0.6, 1.04))
        head.rotation_euler.z = rot

        hair = sphere(f"{prefix} hair shell", (x, y + 0.004, head_z + 0.024), 0.082, "hair", (0.76, 0.52, 0.36))
        hair.rotation_euler.z = rot
        for sx in [-1, 1]:
            side_hair = capsule(
                f"{prefix} side hair {sx}",
                (x + sx * 0.064, y - 0.006, head_z - 0.018),
                0.09,
                0.02,
                "hair",
                rotation=(0, math.radians(6) * sx, 0),
                scale=(0.72, 0.55, 1),
            )
            side_hair.rotation_euler.z = rot
        sphere(f"{prefix} back hair bun", (x, y + 0.072, head_z + 0.004), 0.032, "hair", (1.05, 0.72, 0.78))

        mask = cube(f"{prefix} curved mask", (x, y - 0.078, head_z - 0.024), (0.078, 0.01, 0.034), "staff_mask")
        bevel(mask, 0.008, 2)
        nose = sphere(f"{prefix} nose bridge", (x, y - 0.091, head_z + 0.006), 0.009, "skin", (0.62, 0.4, 0.75))
        for sx in [-1, 1]:
            sphere(f"{prefix} calm eye {sx}", (x + sx * 0.027, y - 0.088, head_z + 0.034), 0.0058, "dark", (1, 0.5, 1))
            brow = cube(f"{prefix} eyebrow {sx}", (x + sx * 0.027, y - 0.091, head_z + 0.048), (0.022, 0.004, 0.0035), "hair")
            brow.rotation_euler.z = sx * math.radians(8)
            strap = capsule(f"{prefix} mask strap {sx}", (x + sx * 0.057, y - 0.08, head_z - 0.018), 0.058, 0.003, "staff_mask", rotation=(0, 0, 0))
            strap.rotation_euler.z = math.radians(3) * sx

        cap_base = cube(f"{prefix} fitted nurse cap base", (x, y - 0.016, head_z + 0.07), (0.108, 0.03, 0.012), "staff_white")
        bevel(cap_base, 0.006, 2)
        cap_top = cone(f"{prefix} folded nurse cap", (x, y - 0.016, head_z + 0.09), 0.04, 0.022, 0.026, "staff_white", vertices=4, rotation=(0, 0, math.radians(45)))
        cap_top.scale.y = 0.56
        cap_mark = cube(f"{prefix} cap blue accent", (x, y - 0.033, head_z + 0.071), (0.06, 0.004, 0.005), "staff_badge")
        bevel(cap_mark, 0.002, 1)

        shoulder_z = torso_z + torso_h * 0.31
        if gesture == "typing":
            arm_pose = [
                (-1, x - 0.135, y - 0.028, shoulder_z - 0.02, x - 0.16, y - 0.17, torso_z - 0.04, rot - 0.34),
                (1, x + 0.135, y - 0.028, shoulder_z - 0.02, x + 0.16, y - 0.17, torso_z - 0.04, rot + 0.34),
            ]
        else:
            arm_pose = [
                (-1, x - 0.145, y - 0.018, shoulder_z - 0.02, x - 0.19, y - 0.1, torso_z - 0.04, rot - 0.22),
                (1, x + 0.145, y - 0.018, shoulder_z - 0.02, x + 0.2, y - 0.11, torso_z - 0.02, rot + 0.34),
            ]
        for sx, sx0, sy0, sz0, hx, hy, hz, rz in arm_pose:
            shoulder = sphere(f"{prefix} rounded shoulder {sx}", (x + sx * 0.14, y - 0.018, shoulder_z), 0.033, "staff", (0.9, 0.7, 0.72))
            sleeve = capsule(f"{prefix} upper sleeve {sx}", (sx0, sy0, sz0), 0.18, 0.021, "staff", rotation=(math.radians(68), 0, rz), scale=(0.78, 0.78, 1))
            bevel(shoulder, 0.001, 1)
            bevel(sleeve, 0.002, 1)
            forearm = capsule(f"{prefix} forearm {sx}", ((sx0 + hx) / 2, (sy0 + hy) / 2, (sz0 + hz) / 2), 0.22, 0.015, "skin", rotation=(math.radians(74), 0, rz), scale=(0.72, 0.72, 1))
            bevel(forearm, 0.002, 1)
            sphere(f"{prefix} hand {sx}", (hx, hy, hz), 0.018, "skin", (1.12, 0.72, 0.55))

        if not sitting:
            for sx in [-1, 1]:
                thigh = capsule(f"{prefix} trouser thigh {sx}", (x + sx * 0.052, y + 0.005, 0.48), 0.42, 0.026, "staff", rotation=(math.radians(5), 0, rot + sx * 0.05), scale=(0.74, 0.74, 1))
                calf = capsule(f"{prefix} trouser calf {sx}", (x + sx * 0.064, y - 0.015, 0.24), 0.36, 0.022, "staff", rotation=(math.radians(5), 0, rot + sx * 0.03), scale=(0.74, 0.74, 1))
                shoe = cube(f"{prefix} low white shoe {sx}", (x + sx * 0.07, y - 0.075, 0.055), (0.105, 0.064, 0.034), "staff_white")
                bevel(thigh, 0.001, 1)
                bevel(calf, 0.001, 1)
                bevel(shoe, 0.016, 2)

    add_nurse("seated charge nurse", -0.7, -1.4, 0.0, True, "typing")
    add_nurse("rounding nurse", 1.45, -0.73, math.radians(-18), False, "rounding")


def build_ward_status_wall() -> None:
    # Kept as subtle physical status lights; detailed room data is supplied by
    # the dynamic Three.js texture on dynamic-room-status-board-screen.
    for i, material in enumerate(["pink", "green", "amber", "amber"]):
        cube(f"physical room status light {i}", (2.18 + i * 0.24, 1.84, 0.92), (0.12, 0.02, 0.12), material)


def build_reference_details() -> None:
    for index, x in enumerate([-1.85, -1.65, -1.45, -1.25]):
        folder = cube(f"Rear_File_Folder_{index}", (x, 2.61, 1.27), (0.13, 0.34, 0.42), "counter_side")
        folder.rotation_euler.z = math.radians((index - 1.5) * 2)
        cube(f"Rear_File_Label_{index}", (x, 2.425, 1.27), (0.07, 0.015, 0.18), "whiteboard")

    for index, x in enumerate([-2.38, 2.35, 2.72]):
        cyl(f"Plant_Pot_{index}", (x, 2.7, 1.23), 0.13, 0.25, "counter", vertices=32)
        for leaf_index, angle in enumerate([-38, -18, 0, 18, 38]):
            leaf = cube(
                f"Plant_{index}_Leaf_{leaf_index}",
                (x + math.sin(math.radians(angle)) * 0.08, 2.7, 1.52 + leaf_index * 0.012),
                (0.07, 0.025, 0.34),
                "green",
            )
            leaf.rotation_euler.y = math.radians(angle)

    for side, x in [("Left", -2.88), ("Right", 2.88)]:
        printer = cube(f"Printer_{side}", (x, -1.02, 1.18), (0.58, 0.56, 0.42), "counter")
        bevel(printer, 0.045, 3)
        cube(f"Printer_{side}_Output", (x, -1.315, 1.2), (0.34, 0.025, 0.08), "dark")
        cube(f"Printer_{side}_Panel", (x + 0.16, -1.31, 1.34), (0.15, 0.025, 0.08), "screen_glow")

    phone = cube("Desk_Phone", (2.35, -1.32, 1.12), (0.38, 0.24, 0.11), "dark")
    bevel(phone, 0.035, 3)
    handset = cube("Desk_Phone_Handset", (2.35, -1.34, 1.23), (0.4, 0.09, 0.075), "dark")
    bevel(handset, 0.03, 3)

    for side, x in [("Left", -3.55), ("Right", 3.55)]:
        cube(f"Waste_Bin_{side}", (x, -1.58, 0.38), (0.48, 0.42, 0.68), "counter")
        lid = cube(f"Waste_Bin_{side}_Lid", (x, -1.58, 0.75), (0.52, 0.46, 0.08), "counter_side")
        bevel(lid, 0.025, 2)


def build_floor_guides() -> None:
    for i, y in enumerate([-1.62, -0.88, -0.14, 0.6]):
        cube(f"subtle floor guide {i}", (0, y, 0.012), (4.4 - i * 0.45, 0.022, 0.012), "screen_glow")
    # Left side: patient waiting / self-service corner.
    bench = cube("left waiting bench", (-2.55, -1.42, 0.28), (0.95, 0.32, 0.12), "wood")
    bevel(bench, 0.025, 2)
    cube("left waiting bench back", (-2.55, -1.25, 0.6), (0.95, 0.08, 0.46), "counter")
    for x in [-2.92, -2.18]:
        cyl(f"waiting bench leg {x}", (x, -1.42, 0.14), 0.025, 0.26, "dark")
    second_seat = cube("left waiting single seat", (-1.82, -1.42, 0.3), (0.34, 0.34, 0.14), "counter")
    bevel(second_seat, 0.022, 2)
    cube("left single seat back", (-1.82, -1.22, 0.62), (0.34, 0.08, 0.42), "counter_side")
    table_top = cube("left waiting side table top", (-2.08, -1.05, 0.52), (0.36, 0.28, 0.06), "counter")
    bevel(table_top, 0.014, 1)
    for dx in [-0.13, 0.13]:
        for dy in [-0.1, 0.1]:
            cyl(f"left waiting side table leg {dx} {dy}", (-2.08 + dx, -1.05 + dy, 0.3), 0.018, 0.4, "dark", vertices=16)
    cube("left waiting side table glow slot", (-2.08, -1.195, 0.54), (0.22, 0.016, 0.035), "screen_glow")
    tissue = cube("left waiting tabletop tissue box", (-2.08, -1.05, 0.59), (0.2, 0.12, 0.08), "whiteboard")
    bevel(tissue, 0.01, 1)
    cube("left waiting tissue slot", (-2.08, -1.115, 0.635), (0.11, 0.012, 0.014), "dark")

    edu_frame = cube("left education ultra slim wall display frame", (-3.045, -0.92, 1.7), (0.035, 1.56, 0.9), "dark")
    bevel(edu_frame, 0.012, 2)
    cube("left education display thin wall bracket", (-3.075, -0.92, 1.7), (0.045, 0.42, 0.28), "fixture")
    cube("left education display lower speaker slot", (-3.02, -0.92, 1.22), (0.012, 1.14, 0.035), "dark")
    cube("left education display status light", (-3.012, -0.2, 1.22), (0.01, 0.044, 0.026), "green")
    side_wall_plane("dynamic-left-education-screen", (-3.018, -0.92, 1.71), 1.42, 0.8, "screen")
    cube("left queue number display frame", (-2.08, -0.78, 1.22), (0.46, 0.055, 0.42), "dark")
    vertical_plane("dynamic-left-queue-screen", (-2.08, -0.818, 1.23), 0.34, 0.3, "screen")
    cube("left queue display accent", (-1.81, -0.818, 1.23), (0.055, 0.018, 0.28), "green")

    cube("left wall brochure tall rack", (-3.08, -0.12, 0.74), (0.08, 0.34, 0.56), "counter")
    bevel(bpy.context.object, 0.012, 1)
    for i, z in enumerate([0.56, 0.7, 0.84, 0.98]):
        cube(f"left brochure bright leaflet {i}", (-3.03, -0.12, z), (0.012, 0.25, 0.06), "screen_glow" if i % 2 == 0 else "whiteboard")

    kiosk = cube("self service kiosk body", (-2.16, 0.48, 0.86), (0.36, 0.22, 1.12), "dark")
    bevel(kiosk, 0.024, 2)
    vertical_plane("dynamic-self-service-kiosk-screen", (-2.16, 0.345, 1.08), 0.26, 0.46, "screen")
    cube("self service kiosk lower slot", (-2.16, 0.335, 0.62), (0.22, 0.018, 0.07), "counter")
    cube("self service kiosk base light", (-2.16, 0.34, 0.34), (0.28, 0.018, 0.034), "green")
    cube("triage sign post", (-2.72, -0.12, 0.58), (0.05, 0.05, 1.02), "dark")
    sign = cube("triage direction sign", (-2.72, -0.18, 1.16), (0.62, 0.04, 0.3), "counter_side")
    bevel(sign, 0.012, 1)
    cube("triage sign light strip", (-2.72, -0.21, 1.22), (0.46, 0.014, 0.04), "screen_glow")
    cube("triage sign lower text band", (-2.72, -0.21, 1.08), (0.42, 0.012, 0.035), "whiteboard")
    cyl("plant pot", (-3.08, 0.78, 0.2), 0.22, 0.32, "counter_side")
    for i, angle in enumerate([-42, -24, -8, 12, 32, 50]):
        leaf = cube(f"plant leaf {i}", (-3.08 + math.sin(math.radians(angle)) * 0.11, 0.78, 0.5 + i * 0.018), (0.082, 0.024, 0.34), "green")
        leaf.rotation_euler.x = math.radians(18)
        leaf.rotation_euler.z = math.radians(angle)
    cube("left floor guidance block", (-2.52, -0.98, 0.03), (0.88, 0.055, 0.018), "screen_glow")
    cube("left floor waiting zone mark", (-2.86, -1.14, 0.032), (0.26, 0.055, 0.018), "green")
    cube("wall hand sanitizer station", (-3.02, 0.2, 0.98), (0.08, 0.18, 0.34), "counter")
    cube("sanitizer blue window", (-2.965, 0.2, 1.02), (0.012, 0.12, 0.16), "screen_glow")
    cube("left wall brochure pocket", (-3.03, -0.52, 0.82), (0.08, 0.22, 0.28), "counter")
    for z in [0.76, 0.85]:
        cube(f"brochure cyan card {z}", (-2.978, -0.52, z), (0.012, 0.16, 0.055), "screen_glow")

    # Right side: equipment and supply corner.
    zone_plate = cube("right equipment zone wall sign plate", (2.72, 1.99, 1.18), (1.36, 0.026, 0.34), "counter")
    bevel(zone_plate, 0.012, 1)
    text("right equipment zone wall sign title", "护理设备区", (2.72, 1.972, 1.27), 0.08, "dark", rot=(math.radians(90), 0, 0))
    text("right equipment zone wall sign subtitle", "查房车 / 耗材柜 / 监护设备", (2.72, 1.971, 1.13), 0.04, "counter_side", rot=(math.radians(90), 0, 0))

    cart_body = cube("mobile nursing workstation body", (2.72, -0.86, 0.62), (0.34, 0.22, 0.72), "counter")
    bevel(cart_body, 0.024, 2)
    cube("mobile nursing workstation dark bezel", (2.72, -0.985, 0.92), (0.3, 0.03, 0.34), "dark")
    cube("mobile nursing workstation screen", (2.72, -1.003, 0.92), (0.22, 0.012, 0.23), "screen_glow")
    cube("mobile nursing workstation drawer", (2.72, -0.985, 0.48), (0.25, 0.024, 0.09), "counter_side")
    text("mobile nursing workstation label", "移动护理车", (2.72, -1.02, 0.73), 0.055, "dark", rot=(math.radians(82), 0, 0))
    text("mobile nursing workstation status", "查房 / 录入", (2.72, -1.021, 0.61), 0.038, "counter_side", rot=(math.radians(82), 0, 0))
    cube("mobile nursing workstation top tag", (2.72, -1.02, 1.14), (0.38, 0.02, 0.1), "green")
    text("mobile nursing workstation top tag text", "在线", (2.72, -1.033, 1.145), 0.038, "whiteboard", rot=(math.radians(82), 0, 0))
    for x in [2.58, 2.86]:
        cyl(f"mobile nursing workstation caster {x}", (x, -0.98, 0.2), 0.035, 0.025, "dark", vertices=16, rotation=(math.radians(90), 0, 0))

    cabinet = cube("right medical storage cabinet", (2.82, 0.64, 0.72), (0.5, 0.22, 1.18), "counter")
    bevel(cabinet, 0.025, 2)
    for z in [0.42, 0.72, 1.02]:
        cube(f"cabinet teal drawer {z}", (2.82, 0.52, z), (0.4, 0.028, 0.12), "counter_side")
    text("right medical storage cabinet label", "耗材柜", (2.82, 0.505, 1.28), 0.058, "dark", rot=(math.radians(82), 0, 0))
    text("right medical storage cabinet status", "口罩 / 输液贴 / 消毒", (2.82, 0.503, 1.15), 0.034, "counter_side", rot=(math.radians(82), 0, 0))
    cube("right medical storage cabinet top tag", (2.82, 0.505, 1.38), (0.36, 0.02, 0.08), "counter_side")
    text("right medical storage cabinet top tag text", "备用", (2.82, 0.492, 1.382), 0.034, "whiteboard", rot=(math.radians(82), 0, 0))

    cube("compact medicine cart", (2.42, -1.42, 0.46), (0.42, 0.3, 0.58), "counter")
    cube("medicine cart teal drawer", (2.42, -1.58, 0.47), (0.34, 0.035, 0.18), "counter_side")
    text("medicine cart label", "抢救推车", (2.42, -1.603, 0.78), 0.045, "dark", rot=(math.radians(82), 0, 0))
    for x in [2.25, 2.59]:
        cyl(f"medicine cart wheel {x}", (x, -1.57, 0.15), 0.055, 0.035, "dark", vertices=16, rotation=(math.radians(90), 0, 0))

    cyl("iv pole stand", (2.05, -0.14, 0.78), 0.018, 1.34, "dark")
    cyl("iv pole base", (2.05, -0.14, 0.08), 0.12, 0.035, "dark")
    cube("iv bag left", (1.98, -0.14, 1.42), (0.1, 0.018, 0.18), "screen_glow")
    cube("iv bag right", (2.12, -0.14, 1.38), (0.1, 0.018, 0.18), "screen_glow")

    cube("wall mounted vital monitor", (3.04, -0.1, 1.18), (0.12, 0.06, 0.32), "dark")
    cube("vital monitor glow", (3.04, -0.138, 1.2), (0.08, 0.012, 0.2), "screen_glow")
    text("vital monitor label", "生命体征", (3.035, -0.165, 1.47), 0.05, "dark", rot=(math.radians(82), 0, 0))
    text("vital monitor status", "HR 78  SpO2 98", (3.035, -0.166, 1.34), 0.034, "green", rot=(math.radians(82), 0, 0))

    cube("supply shelf frame", (2.18, 0.6, 0.72), (0.36, 0.2, 0.86), "dark")
    for z in [0.46, 0.68, 0.9]:
        cube(f"supply shelf tray {z}", (2.18, 0.49, z), (0.32, 0.035, 0.045), "counter")
    text("supply shelf label", "备用耗材", (2.18, 0.475, 1.18), 0.04, "counter", rot=(math.radians(82), 0, 0))

    for i, (x, label, material, icon) in enumerate([
        (1.78, "生活垃圾", "green", "LIFE"),
        (2.08, "医疗废物", "waste_orange", "MED"),
    ]):
        cube(f"waste sorting bin rear shadow gap {i}", (x, -1.315, 0.3), (0.29, 0.035, 0.42), "dark")
        base = cube(f"waste sorting bin raised base {i}", (x, -1.55, 0.105), (0.29, 0.22, 0.055), "dark")
        bevel(base, 0.014, 1)
        bin_body = cube(f"waste sorting bin body {i}", (x, -1.52, 0.32), (0.26, 0.24, 0.46), "counter")
        bevel(bin_body, 0.035, 3)
        cube(f"waste sorting bin side depth accent {i}", (x + 0.112, -1.505, 0.34), (0.018, 0.19, 0.36), "wall_panel")
        lid = cube(f"waste sorting bin color lid {i}", (x, -1.52, 0.575), (0.3, 0.28, 0.06), material)
        bevel(lid, 0.018, 2)
        cube(f"waste sorting bin lid front lip {i}", (x, -1.67, 0.56), (0.28, 0.028, 0.055), material)
        cube(f"waste sorting bin front color panel {i}", (x, -1.648, 0.41), (0.2, 0.018, 0.18), material)
        cube(f"waste sorting bin slot {i}", (x, -1.666, 0.525), (0.17, 0.012, 0.026), "dark")
        text(f"waste sorting bin icon {i}", icon, (x, -1.673, 0.45), 0.04, "whiteboard", rot=(math.radians(82), 0, 0))
        text(f"waste sorting bin label {i}", label, (x, -1.676, 0.29), 0.044, "dark", rot=(math.radians(82), 0, 0))
        for wheel_x in [x - 0.08, x + 0.08]:
            cyl(f"waste sorting bin caster {i} {wheel_x}", (wheel_x, -1.645, 0.06), 0.026, 0.018, "dark", vertices=16, rotation=(math.radians(90), 0, 0))
    text("waste sorting group label", "医废分类", (1.93, -1.69, 0.7), 0.052, "dark", rot=(math.radians(82), 0, 0))


def setup_lighting_and_camera() -> None:
    bpy.context.scene.world.color = (0.055, 0.07, 0.085)
    bpy.ops.object.light_add(type="AREA", location=(0, -1.4, 4.8))
    light = bpy.context.object
    light.name = "Main_Clinical_Area_Light"
    light.data.energy = 900
    light.data.shape = "RECTANGLE"
    light.data.size = 7.0
    light.data.size_y = 4.0

    for side, x in [("Left", -4.8), ("Right", 4.8)]:
        bpy.ops.object.light_add(type="AREA", location=(x, 0.4, 2.85))
        corridor_light = bpy.context.object
        corridor_light.name = f"Corridor_{side}_Fill_Light"
        corridor_light.data.energy = 420
        corridor_light.data.shape = "RECTANGLE"
        corridor_light.data.size = 1.2
        corridor_light.data.size_y = 3.8

    bpy.ops.object.light_add(type="POINT", location=(0, 2.1, 2.1))
    accent = bpy.context.object
    accent.name = "Main_Screen_Bounce"
    accent.data.energy = 85
    accent.data.color = (0.35, 0.68, 1.0)

    camera_location = Vector((0, -10.8, 2.58))
    camera_target = Vector((0, 0.35, 1.42))
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = REFERENCE_CAMERA
    camera.rotation_euler = (camera_target - camera_location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 32
    camera.data.clip_end = 80
    bpy.context.scene.camera = camera


def set_origin_and_export() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj.select_set(True)
        else:
            obj.select_set(False)
    bpy.ops.object.shade_smooth()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_visible=True,
        export_apply=True,
    )


def main() -> None:
    clear_scene()
    setup_materials()
    build_architecture()
    build_command_wall()
    build_counter()
    build_reference_details()
    setup_lighting_and_camera()
    set_origin_and_export()


if __name__ == "__main__":
    main()
