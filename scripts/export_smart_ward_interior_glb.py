from __future__ import annotations

import argparse
import math
from pathlib import Path
import re
import sys

import bpy
from mathutils import Matrix, Vector


BED_ORIGIN = (-2.55, 0.9, 0.0)
ARCHITECTURE_PREFIXES = (
    "Floor",
    "BackWall",
    "LeftWall",
    "RightWall",
    "Ceiling",
    "Baseboard",
    "Window",
    "Curtain",
    "DistantGarden",
)
STATIC_PREVIEW_OBJECTS = {
    "CareText",
    "SmartBedhead_1_Screen",
    "SmartBedhead_1_ScreenGlass",
    "SmartBedhead_1_Header",
    "SmartBedhead_1_ControlLight",
    "SmartBedhead_1_ControlCurtain",
    "SmartBedhead_1_Label",
    "Monitor_1_Trace1",
    "Monitor_1_Trace2",
    "Monitor_1_Waveform",
    "Monitor_1_Label",
}
PLANT_OBJECTS = {
    "PlantPot",
    "Leaf_0",
    "Leaf_1",
    "Leaf_2",
    "Leaf_3",
}
MONITOR_ANCHOR = Vector((-4.0, 2.18, 0.0))
MONITOR_SCALE = 0.85
MONITOR_OFFSET = Vector((-0.16, 0.22, 0.0))
TERMINAL_SCREEN_CENTER = Vector((-3.22, 3.235, 2.64))
TERMINAL_SCREEN_SIZE = (0.66, 0.42)
TERMINAL_BEZEL_SIZE = (0.72, 0.48)
TERMINAL_CONTROL_CENTER = Vector((-2.65, 3.235, 2.58))
TERMINAL_CONTROL_SIZE = (0.22, 0.035, 0.62)


def parse_args() -> argparse.Namespace:
    script_args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args(script_args)


def bed_module_index(name: str) -> int | None:
    patterns = (
        r"^Bed_(\d+)_",
        r"^Bedside_(\d+)_",
        r"^Monitor_(\d+)_",
        r"^SmartBedhead_(\d+)_",
        r"^Bedhead(?:Backdrop|Inset|Rail|Utility|Oxygen|Power|Warm)_(\d+)",
        r"^WarmIndirect_(\d+)",
    )
    for pattern in patterns:
        match = re.match(pattern, name)
        if match:
            return int(match.group(1))
    return None


def create_group(name: str, location=(0.0, 0.0, 0.0)) -> bpy.types.Object:
    group = bpy.data.objects.new(name, None)
    group.location = location
    bpy.context.scene.collection.objects.link(group)
    return group


def reparent_preserving_world(obj: bpy.types.Object, parent: bpy.types.Object) -> None:
    bpy.context.view_layer.update()
    world = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_parent_inverse.identity()
    obj.matrix_basis = parent.matrix_world.inverted_safe() @ world


def create_terminal_surface(parent: bpy.types.Object) -> bpy.types.Object:
    old_surface = bpy.data.objects.get("SmartBedhead_1_ScreenGlass")
    if old_surface:
        bpy.data.objects.remove(old_surface, do_unlink=True)

    bezel = bpy.data.objects.get("SmartBedhead_1_ScreenBezel")
    if not bezel:
        raise RuntimeError("SmartBedhead_1_ScreenBezel is required for dynamic screen alignment")
    bpy.context.view_layer.update()
    bezel_center = bezel.matrix_world.translation.copy()
    screen_width, screen_height = TERMINAL_SCREEN_SIZE

    bpy.ops.mesh.primitive_plane_add(
        size=2,
        location=(bezel_center.x, bezel_center.y - 0.029, bezel_center.z),
        rotation=(math.pi / 2, 0.0, 0.0),
    )
    surface = bpy.context.object
    surface.name = "BedTerminalSurface"
    surface.scale = (screen_width / 2, screen_height / 2, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    material = bpy.data.materials.new("BedTerminalDynamic")
    material.diffuse_color = (0.02, 0.12, 0.14, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = material.diffuse_color
        bsdf.inputs["Roughness"].default_value = 0.22
    surface.data.materials.append(material)
    surface["wardRole"] = "bedTerminalSurface"
    reparent_preserving_world(surface, parent)
    return surface


def create_terminal_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return material


def create_terminal_box(
    name: str,
    location: Vector,
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    parent: bpy.types.Object,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    reparent_preserving_world(obj, parent)
    return obj


def refine_terminal_layout(parent: bpy.types.Object) -> None:
    bezel = bpy.data.objects.get("SmartBedhead_1_ScreenBezel")
    if not bezel:
        raise RuntimeError("SmartBedhead_1_ScreenBezel is required for terminal layout")
    bezel.matrix_world.translation = TERMINAL_SCREEN_CENTER.copy()
    bpy.context.view_layer.update()
    bezel.dimensions.x = TERMINAL_BEZEL_SIZE[0]
    bezel.dimensions.z = TERMINAL_BEZEL_SIZE[1]

    control_material = create_terminal_material(
        "BedTerminalControlPanelMaterial",
        (0.055, 0.085, 0.095, 1.0),
        0.38,
        0.08,
    )
    create_terminal_box(
        "BedTerminalControlPanel",
        TERMINAL_CONTROL_CENTER,
        TERMINAL_CONTROL_SIZE,
        control_material,
        parent,
    )

    accent_material = create_terminal_material(
        "BedTerminalAccentMaterial",
        (0.20, 0.78, 0.78, 1.0),
        0.32,
        0.05,
    )
    create_terminal_box(
        "BedTerminalAccent",
        Vector((TERMINAL_SCREEN_CENTER.x, 3.21, 2.38)),
        (0.36, 0.025, 0.035),
        accent_material,
        parent,
    )

    status = bpy.data.objects.get("SmartBedhead_1_Status")
    call_button = bpy.data.objects.get("SmartBedhead_1_CallButton")
    if status:
        status.matrix_world.translation = Vector((-2.65, 3.205, 2.82))
    if call_button:
        call_button.matrix_world.translation = Vector((-2.65, 3.205, 2.64))
    for index in range(5):
        speaker = bpy.data.objects.get(f"SmartBedhead_1_Speaker_{index}")
        if speaker:
            speaker.matrix_world.translation = Vector((-2.65, 3.205, 2.51 - index * 0.055))


def soften_bedhead_reflection() -> None:
    backdrop = bpy.data.objects.get("BedheadBackdrop_1")
    if not backdrop or not backdrop.data.materials:
        return

    material = backdrop.data.materials[0].copy()
    material.name = "BedheadBackdropLowReflection"
    backdrop.data.materials[0] = material
    if not material.use_nodes:
        return

    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if not bsdf:
        return
    bsdf.inputs["Roughness"].default_value = 0.78
    if "IOR Level" in bsdf.inputs:
        bsdf.inputs["IOR Level"].default_value = 0.18


def refine_monitor_layout(objects: list[bpy.types.Object]) -> None:
    transform = (
        Matrix.Translation(MONITOR_ANCHOR + MONITOR_OFFSET)
        @ Matrix.Scale(MONITOR_SCALE, 4)
        @ Matrix.Translation(-MONITOR_ANCHOR)
    )
    for obj in objects:
        if obj.name.startswith("Monitor_1_"):
            obj.matrix_world = transform @ obj.matrix_world


def organize_scene() -> tuple[bpy.types.Object, bpy.types.Object, bpy.types.Object]:
    original_objects = list(bpy.context.scene.objects)
    bpy.context.view_layer.update()
    world_matrices = {
        obj: obj.matrix_world.copy()
        for obj in original_objects
        if obj.type not in {"CAMERA", "LIGHT", "EMPTY"}
    }
    for obj, world in world_matrices.items():
        obj.parent = None
        obj.matrix_world = world
    for obj in original_objects:
        if obj.type in {"CAMERA", "LIGHT", "EMPTY"}:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.view_layer.update()

    refine_monitor_layout(list(bpy.context.scene.objects))
    soften_bedhead_reflection()

    architecture = create_group("WardArchitecture")
    props = create_group("WardProps")
    bed_prototype = create_group("BedPrototype", BED_ORIGIN)

    refine_terminal_layout(bed_prototype)

    for obj in list(bpy.context.scene.objects):
        if obj in {architecture, props, bed_prototype}:
            continue
        if obj.parent is bed_prototype:
            continue
        if obj.name in STATIC_PREVIEW_OBJECTS or obj.name in PLANT_OBJECTS:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        module_index = bed_module_index(obj.name)
        if module_index == 2:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if module_index == 1:
            reparent_preserving_world(obj, bed_prototype)
            continue
        target = architecture if obj.name.startswith(ARCHITECTURE_PREFIXES) else props
        reparent_preserving_world(obj, target)

    create_terminal_surface(bed_prototype)
    return architecture, props, bed_prototype


def main() -> None:
    args = parse_args()
    output = args.output.expanduser().resolve()
    assert output.suffix.lower() == ".glb", f"output must be .glb: {output}"
    assert not output.exists(), f"output already exists: {output}"
    output.parent.mkdir(parents=True, exist_ok=True)

    groups = organize_scene()
    bpy.ops.object.select_all(action="DESELECT")
    for group in groups:
        group.select_set(True)
        for child in group.children_recursive:
            child.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )
    print(f"Exported smart ward interior GLB: {output}")


if __name__ == "__main__":
    main()
