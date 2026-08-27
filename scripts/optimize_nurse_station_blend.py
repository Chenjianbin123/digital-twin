from __future__ import annotations

import math
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "models" / "smart-ward-nurse-station"
BLEND_PATH = MODEL_DIR / "smart_ward_nurse_station.blend"
GLB_PATH = MODEL_DIR / "smart_ward_nurse_station.glb"
FONT_PATH = Path("/System/Library/Fonts/STHeiti Light.ttc")


def obj(name: str) -> bpy.types.Object | None:
    return bpy.data.objects.get(name)


def set_visible(name: str, visible: bool) -> None:
    target = obj(name)
    if not target:
        return
    target.hide_viewport = not visible
    target.hide_render = not visible


def shift_prefixed(prefix: str, dx: float = 0, dy: float = 0, dz: float = 0) -> None:
    for target in bpy.context.scene.objects:
        if target.name.startswith(prefix):
            target.location.x += dx
            target.location.y += dy
            target.location.z += dz


def shift_named(names: list[str], dx: float = 0, dy: float = 0, dz: float = 0) -> None:
    for name in names:
        target = obj(name)
        if target:
            target.location.x += dx
            target.location.y += dy
            target.location.z += dz


def apply_font_fix() -> None:
    if not FONT_PATH.exists():
        return
    font = bpy.data.fonts.load(str(FONT_PATH), check_existing=True)
    for target in bpy.context.scene.objects:
        if target.type == "FONT":
            target.data.font = font


def soften_glass_materials() -> None:
    for mat in bpy.data.materials:
        name = mat.name.lower()
        if "glass" not in name and "window" not in name:
            continue
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Alpha"].default_value = 0.22
            bsdf.inputs["Roughness"].default_value = 0.18
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True


def create_open_sightline() -> None:
    # These large architectural shells looked correct in Blender, but they sit
    # directly between the web camera and the counter after GLB import. Hide
    # them from the exported asset and keep the back wall/dashboard as context.
    hidden_names = [
        "left glass partition",
        "right glass partition",
        "daylight window frame",
        "window glass pane",
        "window glass pane.001",
        "window glass pane.002",
        "window mullion vertical",
        "window mullion vertical.001",
        "window mullion vertical.002",
        "window mullion vertical.003",
        "window mullion horizontal",
        "window mullion horizontal.001",
        "window mullion horizontal.002",
        "window sill with rounded solid surface",
        "ceiling soffit",
        "recessed ceiling field",
        "ceiling tile seam x",
        "ceiling tile seam x.001",
        "ceiling tile seam x.002",
        "ceiling tile seam y",
        "ceiling tile seam y.001",
        "ceiling tile seam y.002",
        "ceiling tile seam y.003",
        "acoustic ceiling vent",
        "acoustic ceiling vent.001",
        "ceiling camera dome",
        "linear ceiling panel",
        "linear ceiling panel.001",
        "linear ceiling panel.002",
        "linear ceiling panel.003",
    ]
    for name in hidden_names:
        set_visible(name, False)

    # Keep the rear clinical wall visible, but push it slightly back so the
    # counter, wall display, and ward bays read as one clean command area.
    for name in [
        "back wall",
        "wall lower hygienic kick panel",
        "horizontal wall protection rail",
    ]:
        target = obj(name)
        if target:
            target.location.y += 0.22


def arrange_staff_and_props() -> None:
    # Pull people and loose props out of the direct foreground. This gives the
    # web camera a clear path to the nurse station body and command dashboard.
    shift_prefixed("standing nurse with tablet", dx=0.38, dy=1.58)
    shift_prefixed("doctor discussing dashboard", dx=0.42, dy=1.72)
    shift_named(["standing nurse tablet prop"], dx=0.38, dy=1.58)
    shift_named(["doctor clipboard"], dx=0.42, dy=1.72)

    # The tablet trio was floating in front of the counter; align it with the
    # worktop as docked tablets.
    for i, x in enumerate([-0.62, 0.0, 0.62]):
        name = f"mobile nurse tablet {i}"
        target = obj(name)
        if not target:
            continue
        target.location.x = x
        target.location.y = -1.16
        target.location.z = 1.13
        target.rotation_euler.z = 0

    # Move the kiosk to the left rear aisle so it no longer blocks the counter.
    shift_named(
        ["rounded information kiosk", "kiosk screen glow", "kiosk label"],
        dx=-0.1,
        dy=1.35,
    )


def refine_camera_and_lighting() -> None:
    camera = obj("animated push camera")
    if camera:
        camera.location = (3.25, -5.35, 2.35)
        camera.rotation_euler = (math.radians(76), 0, math.radians(34))
        camera.data.lens = 26
        camera.data.clip_end = 100
        bpy.context.scene.camera = camera

    # Bring clinical light down a little after removing the visible ceiling.
    light = obj("large soft clinical ceiling light")
    if light:
        light.location.z = 3.7
        light.data.energy = 520

    daylight = obj("large daylight from window")
    if daylight:
        daylight.data.energy = 110


def export_glb() -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
        export_format="GLB",
        use_visible=True,
        export_apply=True,
    )


def main() -> None:
    bpy.ops.wm.open_mainfile(filepath=str(BLEND_PATH))
    apply_font_fix()
    soften_glass_materials()
    create_open_sightline()
    arrange_staff_and_props()
    refine_camera_and_lighting()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    export_glb()


if __name__ == "__main__":
    main()
