from __future__ import annotations

import math

import bpy
from mathutils import Vector


VERTICAL_SCALE = 1.12
ROOT_NAME = "SmartWardVerticalScale"
GROUND_PREFIXES = ("Monitor_1_", "Monitor_2_", "SharedCare")


def world_min_z(objects: list[bpy.types.Object]) -> float:
    return min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )


def world_max_z(objects: list[bpy.types.Object]) -> float:
    return max(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )


def assert_close(
    actual: float,
    expected: float,
    tolerance: float,
    label: str,
) -> None:
    assert math.isclose(actual, expected, rel_tol=0.0, abs_tol=tolerance), (
        f"{label}: expected {expected:.6f}, got {actual:.6f}"
    )


scene = bpy.context.scene
root = bpy.data.objects.get(ROOT_NAME)

assert_close(
    float(scene.get("smart_ward_vertical_scale", 0.0)),
    VERTICAL_SCALE,
    1e-6,
    "vertical scale marker",
)
assert root is not None, f"missing root object: {ROOT_NAME}"
assert_close(root.scale.x, 1.0, 1e-6, "root X scale")
assert_close(root.scale.y, 1.0, 1e-6, "root Y scale")
assert_close(root.scale.z, VERTICAL_SCALE, 1e-6, "root Z scale")

camera = scene.camera
assert camera is not None, "missing active camera"
assert camera.parent is None, "camera must remain outside the scale root"

expected_children = [
    obj for obj in scene.objects if obj not in {root, camera}
]
wrong_parents = [
    obj.name for obj in expected_children if obj.parent != root
]
assert not wrong_parents, f"objects outside the scale root: {wrong_parents}"

bpy.context.view_layer.update()
assert_close(bpy.data.objects["BackWall"].dimensions.z, 3.92, 0.001, "wall height")
assert_close(bpy.data.objects["Bed_1_Base"].dimensions.x, 2.3, 0.001, "bed width")
assert_close(camera.location.z, 2.744, 0.001, "camera height")
assert_close(world_max_z([bpy.data.objects["Floor"]]), 0.0, 0.001, "floor top")

for prefix in GROUND_PREFIXES:
    objects = [obj for obj in scene.objects if obj.name.startswith(prefix)]
    assert objects, f"missing device group: {prefix}"
    minimum = world_min_z(objects)
    assert abs(minimum) <= 0.001, (
        f"device group is not grounded: {prefix} min_z={minimum:.6f}"
    )

assert bpy.data.filepath.endswith("smart_ward_scene_highres_optimized.blend"), (
    f"unexpected output path: {bpy.data.filepath}"
)
assert scene.get("smart_ward_source_file") == "smart_ward_scene_highres.blend"

print("Smart ward vertical optimization contract passed.")
