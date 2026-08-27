from __future__ import annotations

import bpy
from mathutils import Vector


REQUIRED_GROUPS = {"WardArchitecture", "WardProps", "BedPrototype"}
REQUIRED_BED_NODES = {
    "BedTerminalSurface",
    "BedTerminalControlPanel",
    "BedTerminalAccent",
    "Bed_1_Mattress",
    "SmartBedhead_1_Status",
    "Monitor_1_Screen",
}
FORBIDDEN_PREVIEW_NODES = {
    "CareText",
    "SmartBedhead_1_Screen",
    "SmartBedhead_1_ScreenGlass",
    "Monitor_1_Trace1",
    "Monitor_1_Trace2",
    "Monitor_1_Waveform",
    "Monitor_1_Label",
}
FORBIDDEN_PLANT_NODES = {
    "PlantPot",
    "Leaf_0",
    "Leaf_1",
    "Leaf_2",
    "Leaf_3",
}


missing_groups = REQUIRED_GROUPS - set(bpy.data.objects.keys())
assert not missing_groups, f"missing model groups: {sorted(missing_groups)}"

remaining_preview_nodes = FORBIDDEN_PREVIEW_NODES & set(bpy.data.objects.keys())
assert not remaining_preview_nodes, (
    f"static preview nodes must not remain: {sorted(remaining_preview_nodes)}"
)
remaining_plant_nodes = FORBIDDEN_PLANT_NODES & set(bpy.data.objects.keys())
assert not remaining_plant_nodes, (
    f"plant nodes must not remain: {sorted(remaining_plant_nodes)}"
)
assert "DoubleLabel" in bpy.data.objects, "the single room title must remain"

for group_name in REQUIRED_GROUPS:
    group = bpy.data.objects[group_name]
    assert group.type == "EMPTY", f"{group_name} must be an empty object"
    assert group.children, f"{group_name} must contain exported nodes"

bed_prototype = bpy.data.objects["BedPrototype"]
bed_nodes = {child.name for child in bed_prototype.children_recursive}
missing_bed_nodes = REQUIRED_BED_NODES - bed_nodes
assert not missing_bed_nodes, f"missing bed prototype nodes: {sorted(missing_bed_nodes)}"
assert not any(
    name.startswith(("Bed_2_", "Bedside_2_", "Monitor_2_", "SmartBedhead_2_"))
    for name in bpy.data.objects.keys()
), "second bed module must not remain in the web asset"

prototype_inverse = bed_prototype.matrix_world.inverted()
prototype_points = []
for child in bed_prototype.children_recursive:
    if child.type != "MESH":
        continue
    prototype_points.extend(
        prototype_inverse @ child.matrix_world @ Vector(corner)
        for corner in child.bound_box
    )
assert prototype_points, "BedPrototype must contain mesh bounds"
min_x = min(point.x for point in prototype_points)
max_x = max(point.x for point in prototype_points)
min_y = min(point.y for point in prototype_points)
max_y = max(point.y for point in prototype_points)
min_z = min(point.z for point in prototype_points)
assert min_x < 0 < max_x, "BedPrototype must straddle its local X origin"
assert min_y < 0 < max_y, "BedPrototype must straddle its local Y origin"
assert abs((min_x + max_x) / 2) < 0.6, "BedPrototype must be centered on local X"
assert abs((min_y + max_y) / 2) < 0.6, "BedPrototype must be centered on local Y"
assert -0.15 <= min_z <= 0.05, "BedPrototype must rest on the local floor plane"

screen = bpy.data.objects["BedTerminalSurface"]
assert screen.type == "MESH", "BedTerminalSurface must be a mesh"
assert len(screen.data.uv_layers) > 0, "BedTerminalSurface must have UV coordinates"
screen_axes = sorted((dimension for dimension in screen.dimensions if dimension > 0.001), reverse=True)
assert len(screen_axes) == 2, "BedTerminalSurface must remain planar"
assert abs(screen_axes[0] - 0.66) < 0.03, "BedTerminalSurface must use the compact terminal width"
assert abs(screen_axes[1] - 0.42) < 0.03, "BedTerminalSurface must use the compact terminal height"

screen_bezel = bpy.data.objects["SmartBedhead_1_ScreenBezel"]
assert abs(screen.matrix_world.translation.z - screen_bezel.matrix_world.translation.z) < 0.02, (
    "BedTerminalSurface must be vertically centered inside the terminal bezel"
)

control_panel = bpy.data.objects["BedTerminalControlPanel"]
screen_right = screen.matrix_world.translation.x + screen_axes[0] / 2
panel_left = control_panel.matrix_world.translation.x - control_panel.dimensions.x / 2
assert panel_left - screen_right >= 0.05, "screen and control panel must have a visible gap"

accent = bpy.data.objects["BedTerminalAccent"]
assert accent.matrix_world.translation.z < screen.matrix_world.translation.z - screen_axes[1] / 2, (
    "terminal accent must sit below the dynamic screen"
)

print("Smart ward interior GLB contract passed.")
