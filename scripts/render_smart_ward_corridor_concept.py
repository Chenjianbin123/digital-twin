import math
import os

import bpy
from mathutils import Vector


ROOT = "/Users/chenjianbin/Projects/3D/digital-twin"
PREVIEW_DIR = os.path.join(ROOT, "docs", "superpowers", "previews")
OUTPUT_IMAGE = os.path.join(PREVIEW_DIR, "smart-ward-corridor-blender-concept.png")
OUTPUT_BLEND = os.path.join(PREVIEW_DIR, "smart-ward-corridor-blender-concept.blend")
OUTPUT_GLB = os.path.join(ROOT, "public", "models", "smart-ward-corridor", "smart_ward_corridor.glb")
FONT_PATH = "/System/Library/Fonts/STHeiti Medium.ttc"
INTERACTION_COLLECTION_ROLES = {
    "WardDoors": "ward-door",
    "DoorScreens": "door-screen",
    "RoomNumbers": "room-number",
    "Seating": "seating",
    "SafetySigns": "safety-sign",
    "CeilingEquipment": "ceiling-equipment",
}
CORRIDOR_WIDTH = 5.2
CORRIDOR_HALF_WIDTH = CORRIDOR_WIDTH / 2
WALL_OFFSET = CORRIDOR_HALF_WIDTH - 2.0
WALL_X = CORRIDOR_HALF_WIDTH + 0.045
DOOR_X = WALL_X - 0.105
PANEL_X = WALL_X - 0.205
HANDRAIL_X = 1.815 + WALL_OFFSET


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.materials, bpy.data.curves, bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for datablock in list(datablocks):
            if datablock.users == 0:
                datablocks.remove(datablock)
    for collection_name in INTERACTION_COLLECTION_ROLES:
        collection = bpy.data.collections.get(collection_name)
        if collection:
            bpy.data.collections.remove(collection)


def material(name, color, roughness=0.55, metallic=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        strength_input = bsdf.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = (*emission, 1.0)
        if strength_input:
            strength_input.default_value = emission_strength
    return mat


def box(name, location, dimensions, mat, bevel=0.02):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = obj.modifiers.new("Soft edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    obj.data.materials.append(mat)
    return obj


def cylinder(name, location, radius, depth, mat, rotation=(0, 0, 0), vertices=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def sphere(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def plane(name, location, width, height, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=2, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (width / 2, height / 2, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_text(name, text, location, size, mat, extrude=0.005):
    bpy.ops.object.text_add(location=location, rotation=(math.radians(90), 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = 0.002
    if os.path.exists(FONT_PATH):
        obj.data.font = bpy.data.fonts.load(FONT_PATH, check_existing=True)
    obj.data.materials.append(mat)
    return obj


def add_wall_text(name, text, side, y, z, size, mat, extrude=0.004):
    inward_x = side * (1.872 + WALL_OFFSET)
    bpy.ops.object.text_add(
        location=(inward_x, y, z),
        rotation=(math.radians(90), 0, math.radians(-side * 90)),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = extrude
    obj.data.bevel_depth = 0.0015
    if os.path.exists(FONT_PATH):
        obj.data.font = bpy.data.fonts.load(FONT_PATH, check_existing=True)
    obj.data.materials.append(mat)
    return obj


def add_waiting_bench(name, side, y, mats):
    seat_x = side * (1.64 + WALL_OFFSET)
    back_x = side * (1.865 + WALL_OFFSET)

    cylinder(f"{name} frame beam", (seat_x, y, 0.43), 0.035, 1.48, mats["metal"], rotation=(math.radians(90), 0, 0))
    for leg_y in (y - 0.58, y + 0.58):
        for leg_x in (side * (1.48 + WALL_OFFSET), side * (1.79 + WALL_OFFSET)):
            cylinder(f"{name} support", (leg_x, leg_y, 0.23), 0.028, 0.46, mats["metal"])

    for index, offset_y in enumerate((-0.55, 0, 0.55), start=1):
        box(
            f"{name} seat pad {index}",
            (seat_x, y + offset_y, 0.56),
            (0.50, 0.50, 0.12),
            mats["seat_pad"],
            0.055,
        )
        box(
            f"{name} seat seam {index}",
            (seat_x, y + offset_y + 0.14, 0.624),
            (0.38, 0.018, 0.008),
            mats["seat_stitch"],
            0.004,
        )
        box(
            f"{name} back pad {index}",
            (back_x, y + offset_y, 0.88),
            (0.11, 0.50, 0.52),
            mats["seat_pad"],
            0.055,
        )
        box(
            f"{name} back seam {index}",
            (back_x - side * 0.059, y + offset_y, 0.95),
            (0.008, 0.38, 0.012),
            mats["seat_stitch"],
            0.004,
        )

    for arm_y in (y - 0.84, y + 0.84):
        box(f"{name} arm", (side * (1.55 + WALL_OFFSET), arm_y, 0.76), (0.36, 0.055, 0.055), mats["metal"], 0.025)
        cylinder(f"{name} arm support", (side * (1.72 + WALL_OFFSET), arm_y, 0.61), 0.025, 0.30, mats["metal"])


def add_wall_safety_sign(name, text, side, y, accent_mat, mats):
    sign_x = side * (1.91 + WALL_OFFSET)
    box(f"{name} backing", (sign_x, y, 2.14), (0.035, 0.92, 0.32), mats["safety_back"], 0.022)
    box(f"{name} accent", (sign_x - side * 0.012, y - 0.405, 2.14), (0.045, 0.07, 0.26), accent_mat, 0.01)
    add_wall_text(f"Safety text {text}", text, side, y + 0.025, 2.14, 0.145, mats["safety_text"])


def add_door_module(side, y, index, mats):
    x = side * DOOR_X
    inward = -side
    door_w = 1.5
    door_h = 2.38
    frame_depth = 0.13

    door = box(
        f"Room {index:02d} door",
        (x, y, door_h / 2),
        (0.08, door_w, door_h),
        mats["door"],
        0.025,
    )
    door.data.materials.clear()
    door.data.materials.append(mats["door"])

    for edge_y in (y - door_w / 2 - 0.055, y + door_w / 2 + 0.055):
        box(
            f"Room {index:02d} vertical frame",
            (x + inward * 0.018, edge_y, door_h / 2 + 0.02),
            (frame_depth, 0.11, door_h + 0.16),
            mats["frame"],
            0.012,
        )
    box(
        f"Room {index:02d} lintel",
        (x + inward * 0.018, y, door_h + 0.075),
        (frame_depth, door_w + 0.22, 0.15),
        mats["frame"],
        0.012,
    )

    room_number = 300 + index
    box(
        f"Room number {room_number} backing",
        (side * (1.91 + WALL_OFFSET), y, 2.64),
        (0.045, 0.44, 0.20),
        mats["room_number_back"],
        0.015,
    )
    add_wall_text(
        f"Room number {room_number} text",
        str(room_number),
        side,
        y,
        2.64,
        0.125,
        mats["room_number_text"],
        extrude=0.002,
    )
    plane(
        f"Room {index:02d} live room label surface",
        (side * (1.878 + WALL_OFFSET), y, 2.64),
        0.38,
        0.15,
        mats["room_label_live"],
        rotation=(math.radians(90), 0, math.radians(-side * 90)),
    )

    # Closed door with a narrow frosted observation strip.
    box(
        f"Room {index:02d} frosted glass",
        (x + inward * 0.048, y, 1.44),
        (0.025, 0.46, 1.42),
        mats["glass"],
        0.008,
    )
    box(
        f"Room {index:02d} handle",
        (x + inward * 0.078, y + side * 0.44, 1.03),
        (0.035, 0.045, 0.42),
        mats["metal"],
        0.01,
    )

    # Screen stays an independent surface for the existing interface/template renderer.
    screen_y = y + 1.18
    screen_x = x + inward * 0.09
    box(
        f"Room {index:02d} dynamic door screen",
        (screen_x, screen_y, 1.56),
        (0.10, 0.62, 0.82),
        mats["screen"],
        0.045,
    )
    # Keep the dynamic plane just outside the screen shell toward the corridor.
    face_x = screen_x + inward * 0.066
    plane(
        f"Room {index:02d} live screen surface",
        (face_x + inward * 0.006, screen_y, 1.56),
        0.51,
        0.68,
        mats["screen_live"],
        rotation=(math.radians(90), 0, math.radians(-side * 90)),
    )
    box(
        f"Room {index:02d} screen header",
        (face_x, screen_y, 1.82),
        (0.012, 0.47, 0.07),
        mats["cyan"],
        0.008,
    )
    for row, width in enumerate((0.38, 0.29, 0.34)):
        box(
            f"Room {index:02d} screen row {row}",
            (face_x, screen_y, 1.63 - row * 0.14),
            (0.012, width, 0.035),
            mats["screen_text"],
            0.005,
        )
    box(
        f"Room {index:02d} status light",
        (x + inward * 0.085, y + 0.98, 2.28),
        (0.09, 0.18, 0.08),
        mats["green_light"],
        0.025,
    )


def validate_safety_seating_layout():
    object_names = {obj.name for obj in bpy.context.scene.objects}
    seat_pads = [name for name in object_names if name.startswith("Waiting bench") and "seat pad" in name]
    seat_seams = [name for name in object_names if name.startswith("Waiting bench") and "seat seam" in name]
    back_seams = [name for name in object_names if name.startswith("Waiting bench") and "back seam" in name]
    room_numbers = [name for name in object_names if name.startswith("Room number ") and name.endswith(" text")]
    floor_seams = [name for name in object_names if name.startswith("Medical vinyl seam ")]
    window_shades = [name for name in object_names if name.startswith("Window shade slat ")]
    live_screen_surfaces = [name for name in object_names if name.startswith("Room ") and name.endswith(" live screen surface")]
    live_label_surfaces = [name for name in object_names if name.startswith("Room ") and name.endswith(" live room label surface")]
    static_screen_placeholders = [
        name for name in object_names
        if name.startswith("Room ") and (" screen header" in name or " screen row " in name)
    ]

    assert len(seat_pads) == 6, f"Expected 6 waiting-bench seat pads, found {len(seat_pads)}"
    assert len(seat_seams) == 6, f"Expected 6 waiting-seat seams, found {len(seat_seams)}"
    assert len(back_seams) == 6, f"Expected 6 waiting-back seams, found {len(back_seams)}"
    assert len(room_numbers) == 10, f"Expected 10 room-number texts, found {len(room_numbers)}"
    assert len(floor_seams) >= 10, f"Expected at least 10 vinyl-floor seams, found {len(floor_seams)}"
    assert len(window_shades) == 5, f"Expected 5 window shade slats, found {len(window_shades)}"
    assert len(live_screen_surfaces) == 10, f"Expected 10 live screen surfaces, found {len(live_screen_surfaces)}"
    assert len(live_label_surfaces) == 10, f"Expected 10 live room-label surfaces, found {len(live_label_surfaces)}"
    assert not static_screen_placeholders, f"Static screen placeholders remain: {static_screen_placeholders[:3]}"
    for required_name in (
        "Safety text 保持安静",
        "Safety text 禁止吸烟",
        "Safety text 小心地滑",
        "Exit guide 安全出口",
    ):
        assert required_name in object_names, f"Missing required corridor sign: {required_name}"

    assert "Handrail -1 -3.75" not in object_names, "Left waiting bench overlaps its handrail segment"
    assert "Handrail 1 5.25" not in object_names, "Right waiting bench overlaps its handrail segment"
    quiet_sign = bpy.data.objects["Safety text 保持安静"]
    assert abs(quiet_sign.location.y - 0.125) < 0.001, "Quiet sign is outside the visible wall bay"
    quiet_backing = bpy.data.objects["Quiet safety sign backing"]
    assert quiet_backing.dimensions.y <= 0.93, "Safety signs were not reduced by approximately 15 percent"
    nearest_room_backing = bpy.data.objects["Room number 302 backing"]
    nearest_room_text = bpy.data.objects["Room number 302 text"]
    assert nearest_room_backing.dimensions.y <= 0.45 and nearest_room_backing.dimensions.z <= 0.22, "Near room-number plate is oversized"
    assert nearest_room_text.data.size <= 0.13, "Near room-number text is oversized"

    wall_inner_x = WALL_X - 0.09
    for object_name, max_gap in (
        ("Room number 302 backing", 0.12),
        ("Room number 302 text", 0.12),
        ("Quiet safety sign backing", 0.12),
        ("Safety text 保持安静", 0.12),
        ("Handrail -1 -9.1", 0.26),
        ("Waiting bench left back pad 1", 0.20),
    ):
        obj = bpy.data.objects[object_name]
        gap = wall_inner_x - abs(obj.location.x)
        assert 0 <= gap <= max_gap, f"{object_name} is floating {gap:.3f}m away from the wall"

    first_floor_seam = bpy.data.objects["Medical vinyl seam 1"]
    floor_seam_color = first_floor_seam.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value
    assert first_floor_seam.dimensions.y <= 0.009, "Medical vinyl seam is too wide"
    assert floor_seam_color[0] >= 0.38, "Medical vinyl seam contrast is too strong"

    for required_name in ("Ceiling smoke detector 1", "Ceiling smoke detector 2", "Ceiling dome camera", "Ceiling access panel"):
        assert required_name in object_names, f"Missing refined ceiling equipment: {required_name}"
    dome_camera = bpy.data.objects["Ceiling dome camera"]
    assert dome_camera.dimensions.x <= 0.16, "Ceiling dome camera is visually oversized"

    for collection_name in ("WardDoors", "DoorScreens", "RoomNumbers", "Seating", "SafetySigns", "CeilingEquipment"):
        assert collection_name in bpy.data.collections, f"Missing interaction collection: {collection_name}"
        collection = bpy.data.collections[collection_name]
        assert collection.objects, f"Interaction collection is empty: {collection_name}"
        assert all("interaction_role" in obj for obj in collection.objects), f"Collection lacks interaction roles: {collection_name}"


def validate_warm_medical_palette():
    def base_color(material_name):
        shader = bpy.data.materials[material_name].node_tree.nodes["Principled BSDF"]
        return shader.inputs["Base Color"].default_value

    wall_color = base_color("Upper warm wall")
    floor_color = base_color("Matte medical vinyl")
    window_color = base_color("Daylight window")
    primary_light = bpy.data.objects["Neutral clinical ceiling light"].data.color

    assert wall_color[0] >= wall_color[2] + 0.06, "Wall palette is still visually cool"
    assert floor_color[0] >= floor_color[2] + 0.03, "Floor palette is still visually cool"
    assert window_color[2] >= window_color[0] + 0.15, "End window must retain a cool visual layer"
    assert primary_light[0] >= 0.98 and 0.82 <= primary_light[1] <= 0.90 and 0.68 <= primary_light[2] <= 0.78, "Ceiling light is outside the restrained 4000K palette"


def prune_static_screen_placeholders():
    """GLB 中只保留动态屏幕面，避免旧示意横线遮挡接口模板纹理。"""
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith("Room ") and (" screen header" in obj.name or " screen row " in obj.name):
            bpy.data.objects.remove(obj, do_unlink=True)


def organize_interaction_collections():
    scene = bpy.context.scene
    rules = (
        ("RoomNumbers", lambda name: name.startswith("Room number ") or name.endswith("live room label surface")),
        (
            "DoorScreens",
            lambda name: name.startswith("Room ")
            and any(token in name for token in ("dynamic door screen", "screen header", "screen row", "status light", "live screen surface")),
        ),
        ("WardDoors", lambda name: name.startswith("Room ")),
        ("Seating", lambda name: name.startswith("Waiting bench")),
        (
            "SafetySigns",
            lambda name: name.startswith("Safety text ")
            or "safety sign" in name.lower()
            or name.startswith("Exit guide"),
        ),
        (
            "CeilingEquipment",
            lambda name: name.startswith("Ceiling ")
            or name.startswith("Sprinkler")
            or name.startswith("Linear ceiling panel")
            or name.startswith("Neutral clinical ceiling light"),
        ),
    )

    collections = {}
    for collection_name in INTERACTION_COLLECTION_ROLES:
        collection = bpy.data.collections.new(collection_name)
        scene.collection.children.link(collection)
        collections[collection_name] = collection

    for obj in list(scene.objects):
        for collection_name, matches in rules:
            if not matches(obj.name):
                continue
            target = collections[collection_name]
            target.objects.link(obj)
            for source in list(obj.users_collection):
                if source != target:
                    source.objects.unlink(obj)
            obj["interaction_role"] = INTERACTION_COLLECTION_ROLES[collection_name]
            break


def build_scene():
    clear_scene()
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)

    mats = {
        "ceiling": material(
            "Ceiling warm white",
            (0.94, 0.92, 0.86),
            0.82,
            emission=(0.88, 0.82, 0.68),
            emission_strength=0.36,
        ),
        "wall": material("Upper warm wall", (0.90, 0.87, 0.82), 0.78),
        "panel": material("Medical green wall panel", (0.45, 0.59, 0.48), 0.72),
        "panel_trim": material("Wall panel trim", (0.25, 0.45, 0.39), 0.48, 0.08),
        "floor": material("Matte medical vinyl", (0.50, 0.49, 0.45), 0.88),
        "guide": material("Quiet wayfinding strip", (0.18, 0.45, 0.33), 0.66),
        "door": material("Closed ward door", (0.79, 0.77, 0.72), 0.6),
        "frame": material("Door frame", (0.19, 0.27, 0.28), 0.34, 0.42),
        "metal": material("Brushed metal", (0.47, 0.54, 0.54), 0.26, 0.72),
        "glass": material("Frosted glass", (0.48, 0.72, 0.72), 0.24, 0.05),
        "screen": material("Door screen shell", (0.025, 0.09, 0.11), 0.22, 0.28),
        "screen_live": material("Dynamic door screen surface", (0.025, 0.12, 0.13), 0.28, emission=(0.025, 0.12, 0.13), emission_strength=0.6),
        "cyan": material("Door screen accent", (0.05, 0.58, 0.66), 0.28, emission=(0.05, 0.58, 0.66), emission_strength=3.5),
        "screen_text": material("Door screen content", (0.62, 0.91, 0.91), 0.35, emission=(0.45, 0.9, 0.9), emission_strength=1.8),
        "green_light": material("Normal status light", (0.12, 0.72, 0.38), 0.24, emission=(0.08, 0.75, 0.32), emission_strength=4.0),
        "light": material("Linear ceiling light", (1.0, 0.91, 0.76), 0.22, emission=(1.0, 0.86, 0.70), emission_strength=4.8),
        "sign": material("Sign background", (0.035, 0.18, 0.21), 0.32, 0.18),
        "white": material("Sign lettering", (0.92, 0.98, 0.96), 0.42, emission=(0.82, 1.0, 0.95), emission_strength=1.2),
        "window": material("Daylight window", (0.42, 0.64, 0.67), 0.42, emission=(0.42, 0.64, 0.67), emission_strength=0.65),
        "window_shade": material("Frosted window shade", (0.70, 0.79, 0.76), 0.66),
        "plant": material("Plant leaves", (0.12, 0.36, 0.23), 0.72),
        "pot": material("Plant pot", (0.34, 0.40, 0.38), 0.82),
        "seat_pad": material("Waiting seat sage", (0.20, 0.35, 0.28), 0.74),
        "seat_stitch": material("Waiting seat stitching", (0.09, 0.16, 0.12), 0.66),
        "safety_back": material("Safety sign background", (0.92, 0.91, 0.86), 0.74),
        "safety_text": material("Safety sign text", (0.08, 0.16, 0.16), 0.54),
        "safety_green": material("Safety green", (0.05, 0.42, 0.23), 0.58),
        "safety_red": material("Safety red", (0.62, 0.08, 0.06), 0.58),
        "safety_yellow": material("Safety yellow", (0.92, 0.62, 0.08), 0.58),
        "room_number_back": material("Room number plate", (0.16, 0.34, 0.31), 0.62),
        "room_number_text": material("Room number lettering", (0.90, 0.95, 0.92), 0.52),
        "room_label_live": material("Dynamic room label surface", (0.16, 0.34, 0.31), 0.62),
        "floor_seam": material("Medical vinyl joint", (0.45, 0.44, 0.41), 0.90),
        "ceiling_device": material("Ceiling device white", (0.70, 0.76, 0.73), 0.64),
        "camera_lens": material("Ceiling camera lens", (0.075, 0.105, 0.11), 0.22, 0.18),
    }

    corridor_length = 27.0
    corridor_center_y = 3.5
    corridor_width = CORRIDOR_WIDTH
    ceiling_height = 3.8

    box("Medical vinyl floor", (0, corridor_center_y, -0.07), (corridor_width, corridor_length, 0.14), mats["floor"], 0.03)
    box("Raised complete ceiling", (0, corridor_center_y, ceiling_height + 0.06), (corridor_width, corridor_length, 0.12), mats["ceiling"], 0.02)
    box("Left upper wall", (-WALL_X, corridor_center_y, 2.5), (0.18, corridor_length, 2.6), mats["wall"], 0.02)
    box("Right upper wall", (WALL_X, corridor_center_y, 2.5), (0.18, corridor_length, 2.6), mats["wall"], 0.02)
    box("Left medical panel", (-PANEL_X, corridor_center_y, 0.62), (0.045, corridor_length, 1.24), mats["panel"], 0.01)
    box("Right medical panel", (PANEL_X, corridor_center_y, 0.62), (0.045, corridor_length, 1.24), mats["panel"], 0.01)
    box("Central wayfinding strip", (0, corridor_center_y, 0.006), (0.22, corridor_length - 0.7, 0.018), mats["guide"], 0.005)
    for seam_index, seam_y in enumerate(range(-8, 17, 2), start=1):
        box(
            f"Medical vinyl seam {seam_index}",
            (0, seam_y, 0.004),
            (corridor_width - 0.12, 0.008, 0.004),
            mats["floor_seam"],
            0.002,
        )

    # Wall trim and interrupted handrails keep the corridor realistic without blocking doors.
    for side in (-1, 1):
        box(f"Wall trim {side}", (side * (1.905 + WALL_OFFSET), corridor_center_y, 1.23), (0.06, corridor_length, 0.07), mats["panel_trim"], 0.012)
        for center, length in ((-9.1, 1.0), (-3.75, 1.8), (0.75, 1.8), (5.25, 1.8), (9.75, 1.8), (14.2, 1.3)):
            if (side, center) in ((-1, -3.75), (1, 5.25)):
                continue
            cylinder(
                f"Handrail {side} {center}",
                (side * HANDRAIL_X, center, 0.92),
                0.045,
                length,
                mats["frame"],
                rotation=(math.radians(90), 0, 0),
            )

    for index, y in enumerate((-6.7, -2.2, 2.3, 6.8, 11.3), start=1):
        add_door_module(-1, y, index * 2 - 1, mats)
        add_door_module(1, y + 0.45, index * 2, mats)

    for y in (-6.0, -1.5, 3.0, 7.5, 12.0):
        box("Linear ceiling panel", (0, y, ceiling_height - 0.08), (1.35, 1.0, 0.035), mats["light"], 0.018)
        bpy.ops.object.light_add(type="AREA", location=(0, y, ceiling_height - 0.16))
        light = bpy.context.object
        light.name = "Neutral clinical ceiling light"
        light.data.energy = 360
        light.data.color = (1.0, 0.88, 0.74)
        light.data.shape = "RECTANGLE"
        light.data.size = 1.4
        light.data.size_y = 0.85
        light.rotation_euler = (0, 0, 0)

    # Sparse ceiling equipment replaces the previous exposed grid.
    for y in (-3.8, 5.0, 13.2):
        box("Ceiling air return", (0.9, y, ceiling_height - 0.055), (0.55, 0.28, 0.025), mats["metal"], 0.012)
        cylinder("Sprinkler", (-0.9, y + 0.8, ceiling_height - 0.08), 0.035, 0.06, mats["metal"])

    cylinder("Ceiling smoke detector 1", (0.65, 1.85, ceiling_height - 0.07), 0.09, 0.04, mats["ceiling_device"])
    cylinder("Ceiling smoke detector 2", (-0.58, 10.55, ceiling_height - 0.07), 0.09, 0.04, mats["ceiling_device"])
    cylinder("Ceiling dome camera base", (-0.72, -1.5, ceiling_height - 0.075), 0.075, 0.04, mats["ceiling_device"])
    sphere("Ceiling dome camera", (-0.72, -1.5, ceiling_height - 0.125), (0.075, 0.075, 0.045), mats["camera_lens"])
    box("Ceiling access panel", (-0.72, 9.15, ceiling_height - 0.055), (0.62, 0.50, 0.025), mats["ceiling_device"], 0.01)

    # Daylight end wall and landscape focal point; no nurse station appears in this scene.
    box("End wall", (0, 17.02, 1.9), (corridor_width, 0.16, 3.8), mats["wall"], 0.02)
    box("End daylight window", (0, 16.91, 1.78), (2.45, 0.035, 1.75), mats["window"], 0.025)
    box("Window vertical mullion", (0, 16.84, 1.78), (0.055, 0.055, 1.78), mats["frame"], 0.01)
    box("Window horizontal mullion", (0, 16.84, 1.78), (2.48, 0.055, 0.055), mats["frame"], 0.01)
    for shade_index, shade_z in enumerate((1.05, 1.38, 1.72, 2.06, 2.39), start=1):
        box(
            f"Window shade slat {shade_index}",
            (0, 16.79, shade_z),
            (2.28, 0.028, 0.045),
            mats["window_shade"],
            0.012,
        )

    for x in (-1.15, 1.15):
        cylinder("Plant pot", (x, 16.4, 0.28), 0.25, 0.52, mats["pot"])
        for offset, angle in ((-0.12, -0.45), (0.02, 0.1), (0.16, 0.5)):
            leaf = box("Plant leaf", (x + offset, 16.35, 0.78), (0.10, 0.34, 0.72), mats["plant"], 0.06)
            leaf.rotation_euler = (angle, 0.1, angle * 0.5)

    box("Suspended guide sign", (0, 1.1, 2.63), (2.7, 0.10, 0.62), mats["sign"], 0.045)
    box("Guide sign hanger left", (-0.92, 1.1, 2.95), (0.045, 0.045, 0.6), mats["frame"], 0.01)
    box("Guide sign hanger right", (0.92, 1.1, 2.95), (0.045, 0.045, 0.6), mats["frame"], 0.01)
    add_text("Chinese corridor guide", "病房区  ·  前方", (0, 1.035, 2.62), 0.34, mats["white"])

    # Staggered waiting benches preserve a clear central route for beds and wheelchairs.
    add_waiting_bench("Waiting bench left", -1, -4.25, mats)
    add_waiting_bench("Waiting bench right", 1, 5.2, mats)

    add_wall_safety_sign("Quiet safety sign", "保持安静", -1, 0.1, mats["safety_green"], mats)
    add_wall_safety_sign("No smoking sign", "禁止吸烟", 1, -3.75, mats["safety_red"], mats)
    add_wall_safety_sign("Wet floor sign", "小心地滑", -1, 5.15, mats["safety_yellow"], mats)

    box("Exit guide board", (0, 16.80, 2.92), (1.65, 0.035, 0.36), mats["safety_green"], 0.025)
    add_text("Exit guide 安全出口", "安全出口  →", (0, 16.765, 2.92), 0.21, mats["white"])

    # Lighting and world.
    bpy.ops.object.light_add(type="AREA", location=(0, 15.8, 2.0))
    daylight = bpy.context.object
    daylight.name = "Daylight from end window"
    daylight.data.energy = 520
    daylight.data.color = (0.68, 0.84, 0.9)
    daylight.data.shape = "RECTANGLE"
    daylight.data.size = 2.6
    daylight.data.size_y = 1.8
    daylight.rotation_euler = (math.radians(90), 0, 0)

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 8))
    sun = bpy.context.object
    sun.name = "Soft architectural daylight"
    sun.data.energy = 0.75
    sun.data.color = (1.0, 0.88, 0.72)
    sun.data.angle = math.radians(18)
    sun.rotation_euler = (math.radians(28), math.radians(-18), math.radians(-24))

    world = bpy.context.scene.world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.078, 0.068, 0.056, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.34

    bpy.ops.object.camera_add(location=(0.35, -9.3, 1.78))
    camera = bpy.context.object
    camera.name = "Human-height corridor camera"
    camera.data.lens = 28
    camera.data.sensor_width = 36
    camera.data.dof.use_dof = True
    camera.data.dof.focus_distance = 17.0
    camera.data.dof.aperture_fstop = 8.0
    look_at(camera, (0, 7.2, 1.5))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUTPUT_IMAGE
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.resolution_percentage = 100
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUTPUT_IMAGE

    scene.view_settings.look = "AgX - Medium High Contrast"

    prune_static_screen_placeholders()
    organize_interaction_collections()
    validate_safety_seating_layout()
    validate_warm_medical_palette()
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.render.render(write_still=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_yup=True,
    )


if __name__ == "__main__":
    build_scene()
