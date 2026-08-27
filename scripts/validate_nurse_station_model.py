from __future__ import annotations

import bpy


REQUIRED_OBJECTS = {
    "Screen_Main",
    "Screen_Work_01",
    "Screen_Work_02",
    "Screen_Work_03",
    "Screen_Work_04",
    "Clock_Display",
    "Reference_Camera",
    "Nurse_Counter",
    "Corridor_Left",
    "Corridor_Right",
}


def validate_required_objects() -> None:
    missing = sorted(REQUIRED_OBJECTS - set(bpy.data.objects.keys()))
    assert not missing, f"missing required objects: {missing}"


def validate_reference_composition() -> None:
    counter = bpy.data.objects["Nurse_Counter"]
    assert counter.dimensions.x >= 6.0, "nurse counter must dominate the foreground"

    left = bpy.data.objects["Corridor_Left"]
    right = bpy.data.objects["Corridor_Right"]
    assert left.location.x < -3.0, "left corridor must stay left of the station"
    assert right.location.x > 3.0, "right corridor must stay right of the station"


def validate_dynamic_surfaces() -> None:
    names = [
        "Screen_Main",
        "Screen_Work_01",
        "Screen_Work_02",
        "Screen_Work_03",
        "Screen_Work_04",
        "Clock_Display",
    ]
    for name in names:
        screen = bpy.data.objects[name]
        assert screen.type == "MESH", f"{name} must be a mesh"
        assert len(screen.data.uv_layers) > 0, f"{name} must have a UV layer"


def main() -> None:
    validate_required_objects()
    validate_reference_composition()
    validate_dynamic_surfaces()
    print("nurse station model contract passed")


if __name__ == "__main__":
    main()
