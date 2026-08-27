from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
BLEND_PATH = ROOT / "public" / "models" / "smart-ward-nurse-station" / "high_fidelity_nurse_station.blend"

REQUIRED_OBJECTS = {
    "Reference_Camera",
    "Nurse_Counter",
    "Screen_Main",
    "Clock_Display",
    "Corridor_Left",
    "Corridor_Right",
    "Detail_Full_Ceiling",
    "Detail_Header_Title",
}

if not REQUIRED_OBJECTS.issubset(set(bpy.data.objects.keys())):
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))

REQUIRED_MATERIALS = {
    "White_Stone",
    "Blue_Floor",
    "Wood_Door",
    "Wall_Paint",
    "Screen_Glass",
}


missing_objects = REQUIRED_OBJECTS - set(bpy.data.objects.keys())
missing_materials = REQUIRED_MATERIALS - set(bpy.data.materials.keys())

assert not missing_objects, f"missing objects: {sorted(missing_objects)}"
assert not missing_materials, f"missing materials: {sorted(missing_materials)}"
assert bpy.context.scene.camera is not None
assert bpy.context.scene.camera.name == "Reference_Camera"
assert bpy.context.scene.render.engine in {"BLENDER_EEVEE_NEXT", "CYCLES"}
assert bpy.context.scene.render.resolution_x == 3840
assert bpy.context.scene.render.resolution_y == 2160
assert bpy.data.objects["Corridor_Left"].location.x < -3.0
assert bpy.data.objects["Corridor_Right"].location.x > 3.0
left = bpy.data.objects["Corridor_Left"]
right = bpy.data.objects["Corridor_Right"]
corridor_wing_width = abs(right.location.x - left.location.x)
assert corridor_wing_width >= 13.5, (
    f"corridor wings should be widened around nurse station: {corridor_wing_width:.2f}m"
)
assert bpy.data.objects["Nurse_Counter"].dimensions.x >= 6.0
header_title = bpy.data.objects["Detail_Header_Title"]
header_subtitle = bpy.data.objects["Detail_Header_Subtitle"]
assert header_title.dimensions.y >= 0.28, "header title must remain readable at PC distance"
assert header_subtitle.dimensions.y >= 0.085, "header subtitle must remain readable at PC distance"
clock = bpy.data.objects["Clock_Display"]
assert (clock.location - Vector((4.85, -0.105, 3.10))).length <= 0.001, (
    f"clock must be integrated with the header: {tuple(round(value, 3) for value in clock.location)}"
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
        f"information board must remain fully visible: {board_name}, {tuple(round(value, 3) for value in board.location)}"
    )
header_rail = bpy.data.objects["Detail_Wall_Header_Rail"]
assert abs(header_rail.location.z - 3.32) <= 0.001, (
    f"rear information wall header rail must align with the raised backdrop: {header_rail.location.z:.3f}"
)
for side in ("Left", "Right"):
    frame = bpy.data.objects[f"Wayfinding_Sign_{side}_Frame"]
    assert abs(frame.location.z - 2.55) <= 0.001, f"small sign must clear clock and header: {side}"
counter = bpy.data.objects["Nurse_Counter_Top"]
counter_back_y = max((counter.matrix_world @ Vector(corner)).y for corner in counter.bound_box)
counter_min_x = min((counter.matrix_world @ Vector(corner)).x for corner in counter.bound_box)
counter_max_x = max((counter.matrix_world @ Vector(corner)).x for corner in counter.bound_box)

for detail_name in [
    "Workstation_01",
    "Workstation_02",
    "Workstation_03",
    "Workstation_04",
    "Cabinet_Wall",
    "Printer_Left",
    "Printer_Right",
    "Nurse_Station_Sign",
]:
    assert detail_name in bpy.data.objects, f"missing detail: {detail_name}"

assert sum(obj.type == "LIGHT" for obj in bpy.data.objects) >= 8
assert len([obj for obj in bpy.data.objects if obj.name.startswith("Ward_Door_")]) >= 6

for board_name in ("Screen_Main", "Board_Nursing", "Board_Patient_Status"):
    board = bpy.data.objects.get(board_name)
    assert board is not None, f"missing information surface: {board_name}"
    assert board.type == "MESH", f"information surface must be mesh: {board_name}"

for side in ("Left", "Right"):
    direction = -1 if side == "Left" else 1
    corridor_wall = bpy.data.objects.get(f"Corridor_Inner_Wall_{side}")
    assert corridor_wall is not None, f"missing corridor wall on {side}"
    assert direction * corridor_wall.location.x >= 5.00, (
        f"corridor wing must leave the information wall visually open on {side}: "
        f"x={corridor_wall.location.x:.2f}"
    )

    doors = [obj for obj in bpy.data.objects if obj.name.startswith(f"Ward_Door_{side}_")]
    assert len(doors) >= 3, f"missing corridor doors on {side}: {len(doors)}"
    doors.sort(key=lambda door: door.location.y)
    door_positions = [door.location.y for door in doors]
    first_door = doors[0]
    door_front_y = min((first_door.matrix_world @ Vector(corner)).y for corner in first_door.bound_box)
    assert door_front_y >= counter_back_y + 0.80, (
        f"first corridor door must sit fully behind the nurse counter on {side}: "
        f"door_front_y={door_front_y:.3f}, counter_back_y={counter_back_y:.3f}"
    )
    first_door_frames = [
        obj
        for obj in bpy.data.objects
        if obj.name.startswith((f"Door_Frame_{side}_01", f"Door_Frame_Side_{side}_01"))
    ]
    frame_x_values = [
        (frame.matrix_world @ Vector(corner)).x
        for frame in first_door_frames
        for corner in frame.bound_box
    ]
    horizontal_clearance = (
        counter_min_x - max(frame_x_values)
        if side == "Left"
        else min(frame_x_values) - counter_max_x
    )
    assert horizontal_clearance >= 0.10, (
        f"corridor door frame must be visibly separated from the nurse counter on {side}: "
        f"horizontal_clearance={horizontal_clearance:.3f}"
    )
    corridor_rails = [
        obj.name
        for obj in bpy.data.objects
        if obj.name.startswith((f"Corridor_Rail_Segment_{side}_", f"Corridor_Base_Trim_Segment_{side}_"))
    ]
    assert not corridor_rails, f"corridor rail segments clutter the nurse-station close view: {corridor_rails}"

    continuous_rails = [
        name
        for name in (f"Corridor_Rail_{side}", f"Corridor_Base_Trim_{side}")
        if name in bpy.data.objects
    ]
    assert not continuous_rails, f"continuous rails still cross corridor doors: {continuous_rails}"

    assert door_positions[1] - door_positions[0] >= 1.9, (
        f"corridor door spacing should remain readable on {side}: "
        f"spacing={door_positions[1] - door_positions[0]:.3f}"
    )
    assert door_positions[2] - door_positions[1] >= 1.85, (
        f"corridor door spacing should remain readable on {side}: "
        f"spacing={door_positions[2] - door_positions[1]:.3f}"
    )
    last_door = doors[-1]
    last_door_back_y = max((last_door.matrix_world @ Vector(corner)).y for corner in last_door.bound_box)
    wall_back_y = max((corridor_wall.matrix_world @ Vector(corner)).y for corner in corridor_wall.bound_box)
    assert wall_back_y >= last_door_back_y, (
        f"corridor wall must extend behind the last door on {side}: "
        f"wall_back_y={wall_back_y:.3f}, last_door_back_y={last_door_back_y:.3f}"
    )
    for door in doors:
        door_axis = (door.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
        assert 0.96 <= abs(door_axis.y) <= 0.99, (
            f"corridor presentation fold must remain near 11 degrees: {door.name}, "
            f"axis={tuple(round(value, 3) for value in door_axis)}"
        )

    for prefix in (
        f"Door_Frame_{side}_",
        f"Door_Frame_Side_{side}_",
        f"Door_Handle_{side}_",
        f"Door_Window_{side}_",
    ):
        components = [obj for obj in bpy.data.objects if obj.name.startswith(prefix)]
        assert components, f"missing corridor door component group on {side}: {prefix}"
        first_group = [component for component in components if "_01" in component.name]
        component_front_y = min(
            (component.matrix_world @ Vector(corner)).y
            for component in first_group
            for corner in component.bound_box
        )
        assert component_front_y >= counter_back_y + 0.80, (
            f"first corridor door component must sit behind the nurse counter on {side}: {prefix}, "
            f"component_front_y={component_front_y:.3f}, counter_back_y={counter_back_y:.3f}"
        )
        for component in components:
            assert component.get("nurse_station_presentation_folded") is True, (
                f"corridor door component must share the presentation fold: {component.name}"
            )

for sign_name in ("Wayfinding_Sign_Left", "Wayfinding_Sign_Right"):
    sign = bpy.data.objects.get(sign_name)
    assert sign is not None, f"missing wayfinding sign: {sign_name}"
    assert sign.type == "MESH", f"wayfinding sign must be mesh: {sign_name}"

for text_name in (
    "Wayfinding_Sign_Left_Title",
    "Wayfinding_Sign_Left_Subtitle",
    "Wayfinding_Sign_Right_Title",
    "Wayfinding_Sign_Right_Subtitle",
):
    assert text_name in bpy.data.objects, f"missing wayfinding text: {text_name}"

for side in ("Left", "Right"):
    panel = bpy.data.objects[f"Wayfinding_Sign_{side}"]
    frame = bpy.data.objects[f"Wayfinding_Sign_{side}_Frame"]
    title = bpy.data.objects[f"Wayfinding_Sign_{side}_Title"]
    panel_x = [(panel.matrix_world @ Vector(corner)).x for corner in panel.bound_box]
    title_x = [(title.matrix_world @ Vector(corner)).x for corner in title.bound_box]
    assert min(title_x) >= min(panel_x) + 0.08 and max(title_x) <= max(panel_x) - 0.08, (
        f"wayfinding title must stay inside panel on {side}: "
        f"panel=({min(panel_x):.3f}, {max(panel_x):.3f}), "
        f"title=({min(title_x):.3f}, {max(title_x):.3f})"
    )
    panel_normal = (panel.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
    panel_front = min(
        (panel.matrix_world @ Vector(corner)).dot(panel_normal)
        for corner in panel.bound_box
    )
    for suffix in ("Title", "Subtitle"):
        text = bpy.data.objects[f"Wayfinding_Sign_{side}_{suffix}"]
        text_back = max(
            (text.matrix_world @ Vector(corner)).dot(panel_normal)
            for corner in text.bound_box
        )
        assert text_back <= panel_front - 0.009, (
            f"wayfinding text must sit in front of panel on {side}: {suffix}, "
            f"text_back={text_back:.4f}, panel_front={panel_front:.4f}"
        )
    sign_x = [(frame.matrix_world @ Vector(corner)).x for corner in frame.bound_box]
    corridor_wall = bpy.data.objects[f"Corridor_Inner_Wall_{side}"]
    wall_x = [(corridor_wall.matrix_world @ Vector(corner)).x for corner in corridor_wall.bound_box]
    if side == "Left":
        assert min(sign_x) >= max(wall_x) + 0.10, (
            f"wayfinding sign intersects corridor wall on {side}: "
            f"sign_min_x={min(sign_x):.3f}, wall_max_x={max(wall_x):.3f}"
        )
    else:
        assert max(sign_x) <= min(wall_x) - 0.10, (
            f"wayfinding sign intersects corridor wall on {side}: "
            f"sign_max_x={max(sign_x):.3f}, wall_min_x={min(wall_x):.3f}"
        )

flat_doors = [obj.name for obj in bpy.data.objects if obj.name.startswith("Corridor_Front_Door_")]
assert not flat_doors, f"flat rear-wall doors remain: {flat_doors}"

print("High-fidelity nurse station contract passed.")
