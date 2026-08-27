from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
GLB_PATH = (
    ROOT
    / "public"
    / "models"
    / "smart-ward-nurse-station"
    / "high_fidelity_nurse_station_v3.glb"
)

DYNAMIC_SCREENS = {
    "Screen_Main",
    "Screen_Work_01",
    "Screen_Work_02",
    "Screen_Work_03",
    "Screen_Work_04",
    "Clock_Display",
}

REQUIRED_SCENE_OBJECTS = {
    "Nurse_Counter",
    "Corridor_Left",
    "Corridor_Right",
    "Wayfinding_Sign_Left",
    "Wayfinding_Sign_Right",
    "Detail_Counter_Edge_Light_Front",
    "Detail_Backlit_Station_Sign",
    "Detail_Wall_Header_Rail",
    "Detail_Full_Ceiling",
    "Detail_Header_Title",
    "Detail_Header_Left_Text",
    "Detail_Header_Right_Text",
}

WAYFINDING_TEXT = {
    "Wayfinding_Sign_Left_Title",
    "Wayfinding_Sign_Left_Subtitle",
    "Wayfinding_Sign_Right_Title",
    "Wayfinding_Sign_Right_Subtitle",
}

STATIC_PLACEHOLDERS = {
    "Main_Board_Title",
    "Main_Board_Beds",
    "Main_Board_Tasks",
    "Clock_Preview_Text",
}

STATIC_PLACEHOLDER_PREFIXES = ("Monitor_UI_", "Main_Board_Bar_")
FORBIDDEN_FLOATING_DETAILS = {
    "Detail_Counter_Edge_Light_Left",
    "Detail_Counter_Edge_Light_Right",
}
MAX_RUNTIME_DEPTH = 13.00


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=GLB_PATH)
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_glb(path: Path) -> None:
    assert path.is_file(), f"missing high-fidelity GLB: {path}"
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))


def validate_required_objects() -> None:
    object_names = set(bpy.data.objects.keys())
    required = DYNAMIC_SCREENS | REQUIRED_SCENE_OBJECTS | WAYFINDING_TEXT
    missing = sorted(required - object_names)
    assert not missing, f"missing required GLB objects: {missing}"


def validate_dynamic_surfaces() -> None:
    for name in sorted(DYNAMIC_SCREENS):
        screen = bpy.data.objects[name]
        assert screen.type == "MESH", f"{name} must be a mesh"
        assert len(screen.data.uv_layers) > 0, f"{name} must have a UV layer"

    clock = bpy.data.objects["Clock_Display"]
    assert (clock.location - Vector((4.85, -0.105, 3.10))).length <= 0.001, (
        f"clock must remain aligned with the header in GLB: {tuple(round(value, 3) for value in clock.location)}"
    )
    assert abs(clock.dimensions.x - 1.20) <= 0.01
    assert abs(clock.dimensions.y - 0.05) <= 0.01
    assert abs(clock.dimensions.z - 0.32) <= 0.01
    for board_name, expected in {
        "Board_Nursing": Vector((-3.13, 5.545, 2.22)),
        "Screen_Main": Vector((0.0, 5.545, 2.28)),
        "Board_Patient_Status": Vector((3.13, 5.545, 2.22)),
    }.items():
        board = bpy.data.objects[board_name]
        assert (board.location - expected).length <= 0.001, (
            f"information board must remain fully visible in GLB: {board_name}, "
            f"{tuple(round(value, 3) for value in board.location)}"
        )
    for side in ("Left", "Right"):
        frame = bpy.data.objects[f"Wayfinding_Sign_{side}_Frame"]
        assert abs(frame.location.z - 2.55) <= 0.001, f"small sign must clear clock and header in GLB: {side}"


def validate_wayfinding_text() -> None:
    for name in sorted(WAYFINDING_TEXT):
        assert bpy.data.objects[name].type == "MESH", f"{name} must be converted to a mesh"


def validate_export_filtering() -> None:
    forbidden_types = sorted(
        obj.name for obj in bpy.data.objects if obj.type in {"CAMERA", "LIGHT"}
    )
    assert not forbidden_types, f"cameras or lights were exported: {forbidden_types}"

    object_names = set(bpy.data.objects.keys())
    exact_matches = sorted(STATIC_PLACEHOLDERS & object_names)
    prefix_matches = sorted(
        name
        for name in object_names
        if name.startswith(STATIC_PLACEHOLDER_PREFIXES)
    )
    placeholders = exact_matches + prefix_matches
    assert not placeholders, f"static screen placeholders were exported: {placeholders}"
    floating_details = sorted(FORBIDDEN_FLOATING_DETAILS & object_names)
    assert not floating_details, f"floating counter details were exported: {floating_details}"
    corridor_rail_details = sorted(
        name
        for name in object_names
        if name.startswith(("Corridor_Rail", "Corridor_Base_Trim"))
    )
    assert not corridor_rail_details, f"corridor rail details clutter nurse-station close view: {corridor_rail_details}"
    plant_objects = sorted(
        name
        for name in object_names
        if any(keyword in name.lower() for keyword in ("plant", "potted", "pot", "foliage", "leaf", "stem"))
    )
    assert not plant_objects, f"plant objects were exported: {plant_objects}"


def validate_runtime_bounds() -> None:
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH"]
    assert mesh_objects, "GLB contains no mesh objects"

    minimum = Vector((float("inf"), float("inf"), float("inf")))
    maximum = Vector((float("-inf"), float("-inf"), float("-inf")))
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world_corner = obj.matrix_world @ Vector(corner)
            minimum.x = min(minimum.x, world_corner.x)
            minimum.y = min(minimum.y, world_corner.y)
            minimum.z = min(minimum.z, world_corner.z)
            maximum.x = max(maximum.x, world_corner.x)
            maximum.y = max(maximum.y, world_corner.y)
            maximum.z = max(maximum.z, world_corner.z)

    depth = maximum.y - minimum.y
    assert depth <= MAX_RUNTIME_DEPTH, (
        f"runtime model depth exceeds {MAX_RUNTIME_DEPTH:.2f}m: {depth:.3f}m"
    )


def main() -> None:
    args = parse_args()
    import_glb(args.input)
    validate_required_objects()
    validate_dynamic_surfaces()
    validate_wayfinding_text()
    validate_export_filtering()
    validate_runtime_bounds()
    print("High-fidelity nurse station GLB contract passed.")


if __name__ == "__main__":
    main()
