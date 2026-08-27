from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models" / "smart-ward-nurse-station"
BLEND_PATH = MODEL_DIR / "high_fidelity_nurse_station.blend"
GLB_PATH = MODEL_DIR / "high_fidelity_nurse_station_v3.glb"
ENHANCEMENT_PREFIX = "Detail_"
BRIGHT_MODERN_SCENE_VERSION = 1
BRIGHT_MODERN_SCENE_KEY = "nurse_station_bright_modern_scene_version"
CORRIDOR_PRESENTATION_FOLD_DEGREES = 11.0
CORRIDOR_WING_EXTRA_WIDTH = 1.75
CORRIDOR_DOOR_SETBACK_Y = 1.55
CORRIDOR_REAR_EXTENSION_Y = 1.40
WAYFINDING_SIGN_MOUNT_X = 5.85
CORRIDOR_WIDTH_SCENE_KEY = "nurse_station_corridor_wing_extra_width"
CORRIDOR_DOOR_COMPONENTS_SCENE_KEY = "nurse_station_corridor_door_components_extra_width"
CORRIDOR_DOOR_SETBACK_SCENE_KEY = "nurse_station_corridor_door_setback_y"
CORRIDOR_REAR_EXTENSION_SCENE_KEY = "nurse_station_corridor_rear_extension_y"

SCREEN_RENAMES = {
    "Monitor_Screen_01": "Screen_Work_01",
    "Monitor_Screen_02": "Screen_Work_02",
    "Monitor_Screen_03": "Screen_Work_03",
    "Monitor_Screen_04": "Screen_Work_04",
}

STATIC_PLACEHOLDERS = {
    "Main_Board_Title",
    "Main_Board_Beds",
    "Main_Board_Tasks",
    "Clock_Preview_Text",
}

STATIC_PLACEHOLDER_PREFIXES = ("Monitor_UI_", "Main_Board_Bar_")
DYNAMIC_SCREENS = {"Screen_Main", "Screen_Work_01", "Screen_Work_02", "Screen_Work_03", "Screen_Work_04", "Clock_Display"}
PLANT_KEYWORDS = ("plant", "potted", "pot", "foliage", "leaf", "stem")
LEFT_CORRIDOR_PREFIXES = (
    "Corridor_Base_Trim_Left",
    "Corridor_Inner_Wall_Left",
    "Corridor_Left",
    "Corridor_Rail_Left",
    "Door_Frame_Left_",
    "Door_Frame_Side_Left_",
    "Door_Handle_Left_",
    "Door_Sign_Left_",
    "Door_Window_Left_",
    "Left_Corridor_Fill",
    "Ward_Door_Left_",
    "Wayfinding_Sign_Left",
)
RIGHT_CORRIDOR_PREFIXES = (
    "Corridor_Base_Trim_Right",
    "Corridor_Inner_Wall_Right",
    "Corridor_Right",
    "Corridor_Rail_Right",
    "Door_Frame_Right_",
    "Door_Frame_Side_Right_",
    "Door_Handle_Right_",
    "Door_Sign_Right_",
    "Door_Window_Right_",
    "Right_Corridor_Fill",
    "Ward_Door_Right_",
    "Wayfinding_Sign_Right",
)
LEFT_DOOR_COMPONENT_PREFIXES = (
    "Door_Frame_Left_",
    "Door_Frame_Side_Left_",
    "Door_Handle_Left_",
    "Door_Window_Left_",
)
RIGHT_DOOR_COMPONENT_PREFIXES = (
    "Door_Frame_Right_",
    "Door_Frame_Side_Right_",
    "Door_Handle_Right_",
    "Door_Window_Right_",
)
CORRIDOR_DOOR_SETBACK_PREFIXES = (
    "Door_Frame_Left_",
    "Door_Frame_Right_",
    "Door_Frame_Side_Left_",
    "Door_Frame_Side_Right_",
    "Door_Handle_Left_",
    "Door_Handle_Right_",
    "Door_Sign_Left_",
    "Door_Sign_Right_",
    "Door_Window_Left_",
    "Door_Window_Right_",
    "Ward_Door_Left_",
    "Ward_Door_Right_",
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=GLB_PATH)
    parser.add_argument("--preserve-source", action="store_true")
    return parser.parse_args(argv)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    *,
    metallic: float = 0.0,
    roughness: float = 0.45,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    else:
        material.diffuse_color = color
    return material


def remove_existing_enhancements() -> None:
    for target in list(bpy.data.objects):
        if target.name.startswith(ENHANCEMENT_PREFIX):
            bpy.data.objects.remove(target, do_unlink=True)


def add_cube(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    target = bpy.context.object
    target.name = name
    target.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    target.data.materials.append(material)
    if bevel > 0:
        modifier = target.modifiers.new("Detail soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.affect = "EDGES"
        target.modifiers.new("Detail weighted normals", "WEIGHTED_NORMAL")
    return target


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    *,
    vertices: int = 32,
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    target = bpy.context.object
    target.name = name
    target.data.materials.append(material)
    if bevel > 0:
        modifier = target.modifiers.new("Detail soft bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.affect = "EDGES"
        target.modifiers.new("Detail weighted normals", "WEIGHTED_NORMAL")
    return target


def add_text(
    name: str,
    body: str,
    location: tuple[float, float, float],
    size: float,
    material: bpy.types.Material,
    *,
    max_width: float | None = None,
) -> bpy.types.Object:
    font_path = Path("/System/Library/Fonts/STHeiti Medium.ttc")
    assert font_path.is_file(), f"missing Chinese header font: {font_path}"
    font = bpy.data.fonts.get("STHeiti Medium") or bpy.data.fonts.load(str(font_path))
    curve = bpy.data.curves.new(name, "FONT")
    curve.body = body
    curve.font = font
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.size = size
    curve.extrude = 0.007
    curve.bevel_depth = 0.002
    target = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(target)
    target.location = location
    target.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    target.data.materials.append(material)
    bpy.context.view_layer.update()
    if max_width and target.dimensions.x > max_width:
        scale = max_width / target.dimensions.x
        target.scale *= scale
    return target


def add_or_refresh_bevel(name: str, width: float, segments: int = 3) -> None:
    target = bpy.data.objects.get(name)
    if not target or target.type != "MESH":
        return
    for modifier in list(target.modifiers):
        if modifier.name.startswith("Detail soft bevel") or modifier.name.startswith("Detail weighted normals"):
            target.modifiers.remove(modifier)
    bevel = target.modifiers.new("Detail soft bevel", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.affect = "EDGES"
    target.modifiers.new("Detail weighted normals", "WEIGHTED_NORMAL")


def hide_plant_objects() -> None:
    for target in bpy.data.objects:
        name = target.name.lower()
        if any(keyword in name for keyword in PLANT_KEYWORDS):
            target.hide_viewport = True
            target.hide_render = True
            target.hide_set(True)


def shift_objects_by_prefix(prefixes: tuple[str, ...], dx: float) -> None:
    for target in bpy.data.objects:
        if any(target.name.startswith(prefix) for prefix in prefixes):
            target.location.x += dx


def shift_objects_depth_by_prefix(prefixes: tuple[str, ...], dy: float) -> None:
    for target in bpy.data.objects:
        if any(target.name.startswith(prefix) for prefix in prefixes):
            target.location.y += dy


def widen_corridor_wings() -> None:
    previous_width = float(bpy.context.scene.get(CORRIDOR_WIDTH_SCENE_KEY, 0.0))
    delta = CORRIDOR_WING_EXTRA_WIDTH - previous_width
    if abs(delta) < 0.001:
        return

    shift_objects_by_prefix(LEFT_CORRIDOR_PREFIXES, -delta)
    shift_objects_by_prefix(RIGHT_CORRIDOR_PREFIXES, delta)

    for name in ("Floor", "Ceiling"):
        target = bpy.data.objects.get(name)
        if target:
            target.dimensions.x += delta * 2

    bpy.context.scene[CORRIDOR_WIDTH_SCENE_KEY] = CORRIDOR_WING_EXTRA_WIDTH
    bpy.context.scene[CORRIDOR_DOOR_COMPONENTS_SCENE_KEY] = CORRIDOR_WING_EXTRA_WIDTH
    bpy.context.view_layer.update()


def setback_corridor_doors() -> None:
    previous_setback = float(bpy.context.scene.get(CORRIDOR_DOOR_SETBACK_SCENE_KEY, 0.0))
    delta = CORRIDOR_DOOR_SETBACK_Y - previous_setback
    if abs(delta) < 0.001:
        return

    shift_objects_depth_by_prefix(CORRIDOR_DOOR_SETBACK_PREFIXES, delta)
    bpy.context.scene[CORRIDOR_DOOR_SETBACK_SCENE_KEY] = CORRIDOR_DOOR_SETBACK_Y
    bpy.context.view_layer.update()


def extend_corridor_rear() -> None:
    previous_extension = float(bpy.context.scene.get(CORRIDOR_REAR_EXTENSION_SCENE_KEY, 0.0))
    delta = CORRIDOR_REAR_EXTENSION_Y - previous_extension
    if abs(delta) < 0.001:
        return

    for side in ("Left", "Right"):
        for prefix in ("Corridor_Inner_Wall_", "Corridor_Rail_", "Corridor_Base_Trim_"):
            target = bpy.data.objects.get(f"{prefix}{side}")
            assert target is not None, f"missing corridor rear extension target: {prefix}{side}"
            target.location.y += delta / 2
            target.dimensions.y += delta

    bpy.context.scene[CORRIDOR_REAR_EXTENSION_SCENE_KEY] = CORRIDOR_REAR_EXTENSION_Y
    bpy.context.view_layer.update()


def remove_corridor_rail_details() -> None:
    for target in list(bpy.data.objects):
        if target.name.startswith(("Corridor_Rail", "Corridor_Base_Trim")):
            bpy.data.objects.remove(target, do_unlink=True)
    bpy.context.view_layer.update()


def repair_wayfinding_sign_text() -> None:
    font_path = Path("/System/Library/Fonts/STHeiti Medium.ttc")
    assert font_path.is_file(), f"missing Chinese wayfinding font: {font_path}"
    font = bpy.data.fonts.get("STHeiti Medium") or bpy.data.fonts.load(str(font_path))
    text_content = {
        "Wayfinding_Sign_Left_Title": "病房区",
        "Wayfinding_Sign_Left_Subtitle": "WARD AREA",
        "Wayfinding_Sign_Right_Title": "请保持安静",
        "Wayfinding_Sign_Right_Subtitle": "QUIET ZONE",
    }
    for name, body in text_content.items():
        target = bpy.data.objects.get(name)
        assert target is not None and target.type == "FONT", f"missing editable wayfinding text: {name}"
        target.data.font = font
        target.data.body = body
        target.data.align_x = "CENTER"
        target.data.align_y = "CENTER"
        target.scale = (1.0, 1.0, 1.0)

    bpy.context.view_layer.update()


def normalize_wayfinding_sign_mount() -> None:
    for side in ("Left", "Right"):
        direction = -1 if side == "Left" else 1
        target_x = direction * WAYFINDING_SIGN_MOUNT_X
        frame = bpy.data.objects.get(f"Wayfinding_Sign_{side}_Frame")
        assert frame is not None, f"missing wayfinding sign frame: {side}"
        delta_x = target_x - frame.location.x
        for target in bpy.data.objects:
            if target.name.startswith(f"Wayfinding_Sign_{side}"):
                target.location.x += delta_x

    bpy.context.view_layer.update()


def optimize_information_visibility() -> None:
    board_groups = {
        "Board_Nursing": (
            (-3.13, 5.545, 2.22),
            ("Board_Nursing", "Nursing_"),
        ),
        "Screen_Main": (
            (0.0, 5.545, 2.28),
            ("Screen_Main", "Main_Board_"),
        ),
        "Board_Patient_Status": (
            (3.13, 5.545, 2.22),
            ("Board_Patient_Status", "Patient_"),
        ),
    }
    for anchor_name, (target_location, prefixes) in board_groups.items():
        anchor = bpy.data.objects.get(anchor_name)
        assert anchor is not None, f"missing information board anchor: {anchor_name}"
        delta = Vector(target_location) - anchor.location
        for target in bpy.data.objects:
            if target.name.startswith(prefixes):
                target.location += delta

    target_sign_z = 2.55
    for side in ("Left", "Right"):
        anchor = bpy.data.objects.get(f"Wayfinding_Sign_{side}_Frame")
        assert anchor is not None, f"missing small wayfinding sign: {side}"
        delta_z = target_sign_z - anchor.location.z
        for target in bpy.data.objects:
            if target.name.startswith(f"Wayfinding_Sign_{side}"):
                target.location.z += delta_z

    clock_frame = bpy.data.objects.get("Clock_Frame")
    clock = bpy.data.objects.get("Clock_Display")
    assert clock_frame is not None and clock is not None, "missing clock mount"
    clock_frame.location = (4.85, -0.04, 3.10)
    clock_frame.rotation_euler = (0.0, 0.0, 0.0)
    clock_frame.dimensions = (1.34, 0.10, 0.42)
    clock.location = (4.85, -0.105, 3.10)
    clock.rotation_euler = (0.0, 0.0, 0.0)
    clock.dimensions = (1.20, 0.05, 0.32)
    bpy.context.view_layer.update()


def fold_corridor_presentation_object(target: bpy.types.Object, pivot_x: float, angle: float) -> None:
    if target.get("nurse_station_presentation_folded"):
        return
    pivot = Vector((pivot_x, 0.0, 0.0))
    rotation = Matrix.Rotation(angle, 4, "Z")
    target.matrix_world = (
        Matrix.Translation(pivot)
        @ rotation
        @ Matrix.Translation(-pivot)
        @ target.matrix_world
    )
    target["nurse_station_presentation_folded"] = True


def reset_bright_modern_presentation() -> None:
    fold_radians = math.radians(CORRIDOR_PRESENTATION_FOLD_DEGREES)
    for target in bpy.data.objects:
        if not target.get("nurse_station_presentation_folded"):
            continue
        is_left = "_Left" in target.name or target.name.startswith("Left_")
        pivot_x = -4.85 if is_left else 4.85
        applied_angle = -fold_radians if is_left else fold_radians
        pivot = Vector((pivot_x, 0.0, 0.0))
        target.matrix_world = (
            Matrix.Translation(pivot)
            @ Matrix.Rotation(-applied_angle, 4, "Z")
            @ Matrix.Translation(-pivot)
            @ target.matrix_world
        )
        del target["nurse_station_presentation_folded"]
    bpy.context.view_layer.update()


def apply_bright_modern_architecture() -> None:
    fold_radians = math.radians(CORRIDOR_PRESENTATION_FOLD_DEGREES)
    left_prefixes = (
        "Corridor_Rail_Segment_Left_",
        "Corridor_Base_Trim_Segment_Left_",
        "Door_Frame_Left_",
        "Door_Frame_Side_Left_",
        "Door_Handle_Left_",
        "Door_Sign_Left_",
        "Door_Window_Left_",
        "Ward_Door_Left_",
        "Wayfinding_Sign_Left",
        "Left_Corridor_Fill",
    )
    right_prefixes = (
        "Corridor_Rail_Segment_Right_",
        "Corridor_Base_Trim_Segment_Right_",
        "Door_Frame_Right_",
        "Door_Frame_Side_Right_",
        "Door_Handle_Right_",
        "Door_Sign_Right_",
        "Door_Window_Right_",
        "Ward_Door_Right_",
        "Wayfinding_Sign_Right",
        "Right_Corridor_Fill",
    )
    for target in bpy.data.objects:
        if target.name.startswith(left_prefixes):
            fold_corridor_presentation_object(target, -4.85, -fold_radians)
        elif target.name.startswith(right_prefixes):
            fold_corridor_presentation_object(target, 4.85, fold_radians)

    for side, target_x in (("Left", -5.10), ("Right", 5.10)):
        frame = bpy.data.objects.get(f"Wayfinding_Sign_{side}_Frame")
        if frame:
            delta_x = target_x - frame.location.x
            for target in bpy.data.objects:
                if target.name.startswith(f"Wayfinding_Sign_{side}"):
                    target.location.x += delta_x

    for target in list(bpy.data.objects):
        if target.name == "Ceiling" or target.name.startswith("Ceiling_Panel_") or (
            target.name.startswith("Wayfinding_Sign_") and "_Rod_" in target.name
        ):
            bpy.data.objects.remove(target, do_unlink=True)

    ceiling = make_material("Detail bright clinical ceiling", (0.88, 0.91, 0.91, 1.0), roughness=0.66)
    ceiling_recess = make_material("Detail ceiling recess", (0.12, 0.18, 0.19, 1.0), roughness=0.55)
    white = make_material("Detail canopy white", (0.82, 0.86, 0.87, 1.0), roughness=0.52)
    secondary = make_material("Detail secondary wayfinding", (0.72, 0.78, 0.79, 1.0), roughness=0.58)
    navy = make_material("Detail canopy navy", (0.025, 0.16, 0.20, 1.0), roughness=0.42)
    cyan = make_material(
        "Detail canopy cyan",
        (0.04, 0.62, 0.73, 1.0),
        roughness=0.24,
        emission=(0.03, 0.42, 0.56, 1.0),
        emission_strength=0.9,
    )
    neutral_light = make_material(
        "Detail neutral ceiling light",
        (0.94, 0.98, 0.97, 1.0),
        roughness=0.20,
        emission=(0.82, 0.96, 0.94, 1.0),
        emission_strength=1.8,
    )
    text_white = make_material(
        "Detail canopy text",
        (0.92, 0.97, 0.98, 1.0),
        roughness=0.30,
        emission=(0.35, 0.54, 0.58, 1.0),
        emission_strength=0.25,
    )

    add_cube("Detail_Full_Ceiling", (0.0, -0.35, 4.55), (20.0, 12.0, 0.20), ceiling, bevel=0.025)
    for index, x in enumerate((-6.4, -2.15, 2.15, 6.4), start=1):
        add_cube(f"Detail_Ceiling_Seam_{index}", (x, -0.95, 4.435), (0.045, 7.8, 0.025), ceiling_recess, bevel=0.008)
    for index, x in enumerate((-4.25, 0.0, 4.25), start=1):
        add_cube(f"Detail_Ceiling_Slot_{index}", (x, -1.85, 4.425), (2.55, 0.15, 0.035), neutral_light, bevel=0.025)

    add_cube("Detail_Canopy", (0.0, 0.55, 3.79), (13.4, 1.25, 0.16), white, bevel=0.035)
    for index, x in enumerate((-4.5, 0.0, 4.5), start=1):
        add_cube(f"Detail_Canopy_Light_{index}", (x, -0.08, 3.70), (3.25, 0.035, 0.055), cyan, bevel=0.015)

    add_cube("Detail_Header_Shadow", (0.0, 0.11, 3.38), (11.7, 0.24, 0.57), navy, bevel=0.07)
    add_cube("Detail_Header_Center", (0.0, -0.035, 3.40), (5.0, 0.09, 0.49), navy, bevel=0.055)
    add_cube("Detail_Header_Left", (-4.28, -0.025, 3.40), (3.15, 0.075, 0.40), secondary, bevel=0.045)
    add_cube("Detail_Header_Right", (4.28, -0.025, 3.40), (3.15, 0.075, 0.40), secondary, bevel=0.045)
    add_cube("Detail_Header_Accent", (0.0, -0.09, 3.13), (11.15, 0.04, 0.045), cyan, bevel=0.012)

    add_text("Detail_Header_Title", "普通外科护理单元", (0.0, -0.095, 3.45), 0.32, text_white, max_width=4.45)
    add_text("Detail_Header_Subtitle", "GENERAL SURGERY NURSING UNIT", (0.0, -0.097, 3.245), 0.115, text_white, max_width=3.9)
    add_text("Detail_Header_Left_Text", "←  病房 01-08", (-4.28, -0.075, 3.40), 0.21, navy, max_width=2.7)
    add_text("Detail_Header_Right_Text", "病房 09-16  →", (4.28, -0.075, 3.40), 0.21, navy, max_width=2.7)

    bpy.context.scene[BRIGHT_MODERN_SCENE_KEY] = BRIGHT_MODERN_SCENE_VERSION
    bpy.context.view_layer.update()
    for side in ("Left", "Right"):
        panel = bpy.data.objects[f"Wayfinding_Sign_{side}"]
        max_width = panel.dimensions.x - 0.18
        for suffix in ("Title", "Subtitle"):
            target = bpy.data.objects[f"Wayfinding_Sign_{side}_{suffix}"]
            target.location.y = panel.location.y - panel.dimensions.y / 2 - target.dimensions.y / 2 - 0.01
            if target.dimensions.x > max_width:
                scale = max_width / target.dimensions.x
                target.scale.x *= scale
                target.scale.z *= scale

    bpy.context.view_layer.update()


def repair_legacy_corridor_door_components() -> None:
    current_width = float(bpy.context.scene.get(CORRIDOR_WIDTH_SCENE_KEY, 0.0))
    if current_width < CORRIDOR_WING_EXTRA_WIDTH - 0.001:
        return

    previous_width = float(bpy.context.scene.get(CORRIDOR_DOOR_COMPONENTS_SCENE_KEY, 0.0))
    delta = CORRIDOR_WING_EXTRA_WIDTH - previous_width
    if abs(delta) < 0.001:
        return

    shift_objects_by_prefix(LEFT_DOOR_COMPONENT_PREFIXES, -delta)
    shift_objects_by_prefix(RIGHT_DOOR_COMPONENT_PREFIXES, delta)
    bpy.context.scene[CORRIDOR_DOOR_COMPONENTS_SCENE_KEY] = CORRIDOR_WING_EXTRA_WIDTH
    bpy.context.view_layer.update()


def apply_source_detail_enhancements() -> None:
    remove_existing_enhancements()

    trim_mat = make_material("Detail brushed champagne trim", (0.72, 0.82, 0.84, 1), metallic=0.32, roughness=0.22)
    cyan_glow = make_material(
        "Detail calm cyan luminous accent",
        (0.28, 0.82, 1.0, 1),
        roughness=0.18,
        emission=(0.18, 0.78, 1.0, 1),
        emission_strength=1.8,
    )
    warm_glow = make_material(
        "Detail warm nurse station sign glow",
        (1.0, 0.88, 0.58, 1),
        roughness=0.26,
        emission=(1.0, 0.72, 0.28, 1),
        emission_strength=1.15,
    )
    dark_mat = make_material("Detail soft graphite device", (0.035, 0.052, 0.064, 1), roughness=0.38)
    paper_mat = make_material("Detail clean clinical paper", (0.88, 0.94, 0.93, 1), roughness=0.7)
    guideline_mat = make_material(
        "Detail floor muted teal guidance",
        (0.18, 0.72, 0.78, 1),
        roughness=0.62,
        emission=(0.05, 0.36, 0.42, 1),
        emission_strength=0.25,
    )

    for name, width in {
        "Nurse_Counter": 0.035,
        "Nurse_Counter_Top": 0.03,
        "Nurse_Station_Sign": 0.02,
        "Screen_Main_Frame": 0.025,
        "Board_Nursing_Frame": 0.022,
        "Board_Patient_Status_Frame": 0.022,
        "Clock_Frame": 0.018,
        "Monitor_Frame_01": 0.018,
        "Monitor_Frame_02": 0.018,
        "Monitor_Frame_03": 0.018,
        "Monitor_Frame_04": 0.018,
    }.items():
        add_or_refresh_bevel(name, width)

    add_cube("Detail_Counter_Edge_Light_Front", (0, -1.225, 0.84), (5.7, 0.035, 0.045), cyan_glow, bevel=0.012)
    add_cube("Detail_Backlit_Station_Sign", (0, -1.412, 0.88), (2.95, 0.028, 0.055), warm_glow, bevel=0.012)

    for index, x in enumerate([-3.0, -1.0, 1.0, 3.0], start=1):
        add_cube(f"Detail_Keyboard_{index:02d}_Base_Shadow", (x, -0.43, 1.054), (0.9, 0.34, 0.018), dark_mat, bevel=0.012)
        for key_index in range(8):
            key_x = x - 0.315 + key_index * 0.09
            add_cube(f"Detail_Keyboard_{index:02d}_Key_{key_index:02d}", (key_x, -0.55, 1.084), (0.052, 0.052, 0.012), trim_mat, bevel=0.004)
        add_cube(f"Detail_Mouse_{index:02d}", (x + 0.58, -0.4, 1.072), (0.16, 0.24, 0.045), dark_mat, bevel=0.025)

    for index, (x, y, rz) in enumerate([(-4.15, -0.5, -0.14), (-2.1, -0.62, 0.1), (2.15, -0.58, -0.08), (4.15, -0.5, 0.16)], start=1):
        paper = add_cube(f"Detail_Clipboard_{index:02d}_Paper", (x, y, 1.055), (0.48, 0.34, 0.012), paper_mat, bevel=0.01)
        paper.rotation_euler.z = rz
        clip = add_cube(f"Detail_Clipboard_{index:02d}_Clip", (x, y + 0.13, 1.068), (0.24, 0.035, 0.015), trim_mat, bevel=0.004)
        clip.rotation_euler.z = rz

    for index, x in enumerate([-2.65, 0, 2.65], start=1):
        add_cube(f"Detail_Floor_Guideline_{index:02d}", (x, -2.08, 0.012), (1.35, 0.055, 0.01), guideline_mat, bevel=0.01)
    for index, x in enumerate([-3.5, -1.75, 1.75, 3.5], start=1):
        puck = add_cylinder(f"Detail_Floor_Position_Puck_{index:02d}", (x, -1.58, 0.018), 0.1, 0.012, guideline_mat, vertices=40, bevel=0.002)
        puck.rotation_euler.x = 0

    add_cube("Detail_Wall_Header_Rail", (0, 5.485, 3.32), (7.45, 0.03, 0.045), cyan_glow, bevel=0.008)
    add_cube("Detail_Wall_Base_Rail", (0, 5.485, 1.48), (7.45, 0.028, 0.035), trim_mat, bevel=0.006)
    for index, x in enumerate([-3.95, -1.98, 1.98, 3.95], start=1):
        add_cube(f"Detail_Screen_Service_Tab_{index:02d}", (x, 5.47, 1.38), (0.34, 0.018, 0.055), cyan_glow, bevel=0.006)


def trim_runtime_bounds() -> None:
    runtime_depth = 9.18 + CORRIDOR_REAR_EXTENSION_Y
    runtime_center_y = 1.56 + CORRIDOR_REAR_EXTENSION_Y / 2
    runtime_bound_names = (
        "Floor",
        "Ceiling",
        "Detail_Full_Ceiling",
        "Side_Wall_Left",
        "Side_Wall_Right",
        "Corridor_Inner_Wall_Left",
        "Corridor_Inner_Wall_Right",
        "Wall_Trim_L",
        "Wall_Trim_R",
        "Handrail_L",
        "Handrail_R",
    )

    for name in runtime_bound_names:
        target = bpy.data.objects.get(name)
        if target is None:
            continue
        target.location.y = runtime_center_y
        target.dimensions.y = min(target.dimensions.y, runtime_depth)

    assert bpy.data.objects.get("Floor") is not None, "missing runtime-bound object: Floor"
    assert bpy.data.objects.get("Detail_Full_Ceiling") is not None, "missing runtime-bound object: Detail_Full_Ceiling"
    bpy.context.view_layer.update()


def rename_dynamic_screens() -> None:
    for source_name, target_name in SCREEN_RENAMES.items():
        source = bpy.data.objects.get(source_name)
        if source is None and bpy.data.objects.get(target_name):
            continue
        assert source is not None, f"missing dynamic screen source: {source_name}"
        existing = bpy.data.objects.get(target_name)
        assert existing is None or existing == source, (
            f"dynamic screen target already exists: {target_name}"
        )
        source.name = target_name


def hide_dynamic_screen_placeholders() -> None:
    for target in bpy.data.objects:
        if target.name in STATIC_PLACEHOLDERS or target.name.startswith(
            STATIC_PLACEHOLDER_PREFIXES
        ):
            target.hide_viewport = True
            target.hide_render = True
            target.hide_set(True)


def convert_visible_fonts_to_mesh() -> None:
    font_objects = [
        target
        for target in bpy.data.objects
        if target.type == "FONT" and target.visible_get()
    ]
    for target in font_objects:
        object_name = target.name
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = target
        target.select_set(True)
        bpy.ops.object.convert(target="MESH")
        bpy.context.object.name = object_name


def optimize_runtime_meshes() -> None:
    for target in bpy.data.objects:
        if target.type != "MESH" or target.name in DYNAMIC_SCREENS:
            continue
        vertex_count = len(target.data.vertices)
        if vertex_count < 1800:
            continue
        ratio = 0.42 if vertex_count >= 4000 else 0.58
        modifier = target.modifiers.new("Runtime mesh reduction", "DECIMATE")
        modifier.ratio = ratio
        modifier.use_collapse_triangulate = True


def export_glb(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_visible=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
    )


def main() -> None:
    args = parse_args()
    assert BLEND_PATH.is_file(), f"missing high-fidelity Blender source: {BLEND_PATH}"
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    if bpy.context.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    if not args.preserve_source:
        reset_bright_modern_presentation()
        apply_source_detail_enhancements()
        hide_plant_objects()
        widen_corridor_wings()
        repair_legacy_corridor_door_components()
        setback_corridor_doors()
        extend_corridor_rear()
        remove_corridor_rail_details()
        repair_wayfinding_sign_text()
        normalize_wayfinding_sign_mount()
        optimize_information_visibility()
        apply_bright_modern_architecture()
        bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
        trim_runtime_bounds()
    rename_dynamic_screens()
    hide_dynamic_screen_placeholders()
    convert_visible_fonts_to_mesh()
    optimize_runtime_meshes()
    export_glb(args.output)
    print(f"Exported high-fidelity nurse station GLB: {args.output}")


if __name__ == "__main__":
    main()
