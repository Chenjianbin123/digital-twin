from __future__ import annotations

import argparse
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


VERTICAL_SCALE = 1.12
ROOT_NAME = "SmartWardVerticalScale"
GROUND_PREFIXES = ("Monitor_1_", "Monitor_2_", "SharedCare")
CAMERA_TARGET = Vector((-0.45, 1.05, 1.25 * VERTICAL_SCALE))


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(script_args)


def world_min_z(objects: list[bpy.types.Object]) -> float:
    return min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )


def create_vertical_root(scene: bpy.types.Scene) -> bpy.types.Object:
    assert bpy.data.objects.get(ROOT_NAME) is None, f"root already exists: {ROOT_NAME}"

    root = bpy.data.objects.new(ROOT_NAME, None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.5
    scene.collection.objects.link(root)

    for obj in list(scene.objects):
        if obj == root or obj.type == "CAMERA":
            continue
        assert obj.parent is None, f"unexpected existing parent: {obj.name}"
        obj.parent = root

    root.scale.z = VERTICAL_SCALE
    bpy.context.view_layer.update()
    return root


def ground_group(
    scene: bpy.types.Scene,
    root: bpy.types.Object,
    prefix: str,
) -> tuple[float, float]:
    objects = [obj for obj in scene.objects if obj.name.startswith(prefix)]
    assert objects, f"missing device group: {prefix}"

    before = world_min_z(objects)
    local_shift = -before / root.scale.z
    for obj in objects:
        obj.location.z += local_shift

    bpy.context.view_layer.update()
    after = world_min_z(objects)
    assert math.isclose(after, 0.0, rel_tol=0.0, abs_tol=0.001), (
        f"failed to ground {prefix}: min_z={after:.6f}"
    )
    return before, after


def update_camera(scene: bpy.types.Scene) -> None:
    camera = scene.camera
    assert camera is not None, "missing active camera"
    assert camera.parent is None, "camera must remain outside the scale root"

    camera.location.z *= VERTICAL_SCALE
    direction = CAMERA_TARGET - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    args = parse_args()
    source = Path(bpy.data.filepath).resolve()
    output = args.output.expanduser().resolve()

    assert source.exists(), f"source file does not exist: {source}"
    assert output != source, "output path must not overwrite the source file"
    assert not output.exists(), f"output file already exists: {output}"
    assert output.name == "smart_ward_scene_highres_optimized.blend", (
        f"unexpected output filename: {output.name}"
    )

    scene = bpy.context.scene
    root = create_vertical_root(scene)
    grounding = {
        prefix: ground_group(scene, root, prefix)
        for prefix in GROUND_PREFIXES
    }
    update_camera(scene)

    scene["smart_ward_vertical_scale"] = VERTICAL_SCALE
    scene["smart_ward_source_file"] = source.name
    scene["smart_ward_grounded_groups"] = ",".join(GROUND_PREFIXES)

    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)
    print(f"Saved optimized scene: {output}")
    for prefix, (before, after) in grounding.items():
        print(f"Grounded {prefix}: {before:.6f} -> {after:.6f}")


if __name__ == "__main__":
    main()
