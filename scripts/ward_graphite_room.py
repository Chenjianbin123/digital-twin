"""Editable graphite ward architecture, glazing, textiles and visitor furniture.

All coordinates are metres.  The head wall is Y=0 and the main entrance is
Y=4.6; the room is deliberately open at the entrance for the inspection camera.
The bedside equipment and beds are authored by the adjoining build modules.
"""

import math

from mathutils import Vector

import ward_graphite_common as h


def _rod(name, start, end, radius, material, parent):
    a, b = Vector(start), Vector(end)
    direction = b - a
    return h.cylinder(
        name,
        tuple((a + b) * 0.5),
        radius,
        direction.length,
        material,
        rotation=tuple(direction.to_track_quat("Z", "Y").to_euler()),
        vertices=24,
        parent=parent,
    )


def _curtain(name, x, y_start, y_end, z_bottom, z_top, material, parent,
             folds=10, amplitude=0.038, vertical_segments=24, top_pinches=True):
    """Real pleated cloth surface: soft weighted folds, not flat alpha planes."""
    horizontal_segments = folds * 10
    width = y_end - y_start
    vertices = []
    uvs = []
    faces = []
    for j in range(vertical_segments + 1):
        t = j / vertical_segments
        z = z_bottom + (z_top - z_bottom) * t
        for i in range(horizontal_segments + 1):
            s = i / horizontal_segments
            phase = math.tau * folds * s
            # Pinched pleats at the hooks relax gently towards the weighted hem.
            spread = 0.71 + 0.29 * (1.0 - t) if top_pinches else 1.0
            wave = math.sin(phase + 0.055 * math.sin(t * 4.0 + s * 5.0))
            secondary = 0.09 * math.sin(phase * 2.0 + 0.7)
            xx = x + amplitude * spread * (wave + secondary)
            xx += 0.012 * math.sin(t * 3.8 + s * 6.4) * (1.0 - t)
            yy = y_start + width * s + 0.003 * math.sin(t * 8.0 + phase) * (1.0 - t)
            zz = z + 0.005 * math.cos(phase + 0.4) * (1.0 - t) ** 6
            vertices.append((xx, yy, zz))
            uvs.append((s * (width + folds * amplitude * 2) / 0.42,
                        (z - z_bottom) / 0.42))
    row = horizontal_segments + 1
    for j in range(vertical_segments):
        for i in range(horizontal_segments):
            a = j * row + i
            faces.append((a, a + 1, a + row + 1, a + row))
    cloth = h.mesh(name, vertices, faces, material, parent=parent, uvs=uvs, smooth=True)
    # A very thin solid edge survives close-up glTF inspection without the cost
    # of a subdivision stack or runtime cloth simulation.
    solidify = cloth.modifiers.new("Woven thickness", "SOLIDIFY")
    solidify.thickness = 0.0012 if material == "sheer" else 0.0022
    solidify.offset = 0.0
    for label, indices in (
        ("weighted_hem", range(row)),
        ("left_seam", (j * row for j in range(vertical_segments + 1))),
        ("right_seam", (j * row + horizontal_segments for j in range(vertical_segments + 1))),
    ):
        points = [vertices[k] for k in indices]
        seam = h.tube(f"{name}_{label}", points, 0.0028 if material == "sheer" else 0.0045,
                      material, parent=parent)
        seam.data.bevel_resolution = 1
    return cloth


def _window(parent):
    root = h.empty("Window_Assembly", parent=parent)
    # The masonry surrounds a real opening rather than a black painted recess.
    h.box("Window_SillWall", (3.265, 2.3, 0.385), (0.19, 4.6, 0.77), "wall", parent=root)
    h.box("Window_HeaderWall", (3.265, 2.3, 2.995), (0.19, 4.6, 0.21), "wall", parent=root)
    h.box("Window_RearPier", (3.265, 0.20, 1.82), (0.19, 0.40, 2.20), "wall", parent=root)
    h.box("Window_EntryPier", (3.265, 4.35, 1.82), (0.19, 0.50, 2.20), "wall", parent=root)
    h.box("Window_StoneSill", (3.145, 2.25, 0.795), (0.37, 3.86, 0.065), "porcelain" if "porcelain" in h.M else "white", bevel=0.012, parent=root)
    # Two glazing units with slim aluminium thermal-break profiles and gaskets.
    for name, loc, size in (
        ("Top", (3.245, 2.25, 2.845), (0.13, 3.67, 0.073)),
        ("Bottom", (3.245, 2.25, 0.849), (0.13, 3.67, 0.075)),
        ("Rear", (3.245, 0.448, 1.847), (0.13, 0.067, 2.06)),
        ("Entry", (3.245, 4.052, 1.847), (0.13, 0.067, 2.06)),
        ("Centre", (3.245, 2.30, 1.847), (0.13, 0.062, 2.06)),
    ):
        h.box(f"Window_Aluminium_{name}", loc, size, "steel", bevel=0.006, parent=root)
    for i, (ya, yb) in enumerate(((0.491, 2.260), (2.340, 4.009)), 1):
        h.box(f"Window_Glass_{i}", (3.279, (ya + yb) / 2, 1.846),
              (0.008, yb - ya, 1.91), "glass", bevel=0.0, parent=root)
        for z in (0.891, 2.801):
            h.box(f"Window_Gasket_{i}_{z}", (3.173, (ya + yb) / 2, z),
                  (0.008, yb - ya, 0.009), "rubber", bevel=0.002, parent=root)
    for y in (2.213, 2.387):
        h.box("Window_HandleEscutcheon", (3.159, y, 1.635), (0.014, 0.029, 0.11), "silver", parent=root)
        h.box("Window_Handle", (3.133, y, 1.613), (0.021, 0.019, 0.083), "steel", parent=root)

    # Both layers are gathered at the jambs, keeping most of the glazing clear.
    h.box("Window_Curtain_Recess", (3.025, 2.25, 3.065), (0.40, 4.16, 0.064), "graphite", parent=root)
    for x in (2.929, 3.073):
        h.box("Window_Curtain_Track", (x, 2.25, 3.027), (0.027, 4.05, 0.022), "silver", parent=root)
    for index, (ya, yb) in enumerate(((0.295, 0.87), (3.48, 4.17)), 1):
        _curtain(f"Window_BlueDrape_{index}", 2.928, ya, yb, 0.075, 2.995,
                 "curtain", root, folds=11, amplitude=0.037)
        for k in range(12):
            y = ya + (yb - ya) * k / 11
            _rod(f"Window_DrapeHook_{index}_{k:02d}", (2.928, y, 3.02),
                 (2.928, y, 2.983), 0.0042, "silver", root)
    for index, (ya, yb) in enumerate(((0.74, 1.10), (3.14, 3.64)), 1):
        _curtain(f"Window_Sheer_{index}", 3.067, ya, yb, 0.11, 3.001,
                 "sheer", root, folds=9, amplitude=0.019, vertical_segments=22)
    h.box("Window_Cove_Trim", (2.878, 2.25, 3.052), (0.043, 4.14, 0.044), "white", parent=root)
    h.box("Window_Cove_Diffuser", (2.900, 2.25, 3.027), (0.024, 4.04, 0.010), "lamp", bevel=0.003, parent=root)
    return root


def _privacy_curtain(parent):
    root = h.empty("Privacy_Curtain_Assembly", parent=parent)
    # A return at the foot end removes a visually abrupt unsupported rail end.
    points = [(0.0, 0.13, 3.035), (0.0, 2.46, 3.035)]
    radius = 0.17
    for i in range(1, 13):
        a = math.pi - (math.pi / 2) * i / 12
        points.append((radius + radius * math.cos(a), 2.46 + radius * math.sin(a), 3.035))
    points.extend(((0.60, 2.63, 3.035), (0.78, 2.63, 3.035)))
    h.tube("Privacy_Ceiling_Track", points, 0.014, "silver", parent=root)
    for y in (0.17, 1.28, 2.38):
        h.box("Privacy_Track_CeilingBracket", (0.0, y, 3.073), (0.082, 0.044, 0.048), "steel", parent=root)
    h.sphere("Privacy_Track_EndCap", (0.78, 2.63, 3.035), (0.019, 0.019, 0.019), "rubber", parent=root)
    bottom = _curtain("Privacy_Blue_PleatedFabric", 0.0, 0.42, 1.02, 0.12, 2.28,
                      "curtain", root, folds=12, amplitude=0.044, vertical_segments=24)
    _curtain("Privacy_Upper_BreathableMesh", 0.0, 0.42, 1.02, 2.278, 2.981,
             "sheer", root, folds=12, amplitude=0.035, vertical_segments=12)
    for index in range(13):
        y = 0.42 + 0.6 * index / 12
        h.sphere(f"Privacy_Track_Runner_{index:02d}", (0.0, y, 3.023), (0.016, 0.016, 0.011), "plastic", parent=root)
        _rod(f"Privacy_SuspensionHook_{index:02d}", (0.0, y, 3.014),
             (0.0, y, 2.972), 0.0035, "silver", root)
        h.cylinder(f"Privacy_ClothEyelet_{index:02d}", (0.0, y, 2.967),
                   0.009, 0.004, "steel", rotation=(0, math.pi / 2, 0), vertices=16, parent=root)
    return root, bottom


def _visitor_chair(name, x, y, parent):
    root = h.empty(name, parent=parent)
    # Chairs face into the room (-X); warm timber softens the medical finishes.
    h.box(f"{name}_SeatBase", (x, y, 0.416), (0.50, 0.53, 0.058), "oak", bevel=0.022, parent=root)
    h.box(f"{name}_SeatCushion", (x - 0.012, y, 0.469), (0.49, 0.50, 0.096), "curtain", bevel=0.040, parent=root)
    back = h.box(f"{name}_BackCushion", (x + 0.244, y, 0.758), (0.095, 0.51, 0.48), "curtain", bevel=0.036, parent=root)
    back.rotation_euler.y = math.radians(-8)
    for s in (-1, 1):
        yy = y + s * 0.284
        _rod(f"{name}_RearLeg_{s}", (x + 0.275, yy, 0.026),
             (x + 0.235, yy, 0.877), 0.019, "oak", root)
        _rod(f"{name}_FrontLeg_{s}", (x - 0.236, yy, 0.026),
             (x - 0.187, yy, 0.68), 0.019, "oak", root)
        arm = [(x - 0.205, yy, 0.655), (x - 0.205, yy, 0.678),
               (x - 0.186, yy, 0.696), (x + 0.245, yy, 0.696)]
        h.tube(f"{name}_RoundedArm_{s}", arm, 0.020, "oak", parent=root)
        for xx in (x - 0.236, x + 0.275):
            h.cylinder(f"{name}_FloorGlide", (xx, yy, 0.018), 0.024, 0.024,
                       "rubber", vertices=20, parent=root)
    # Visible upholstery welt is geometry, making the close edge read as sewn.
    for yy in (y - 0.246, y + 0.246):
        h.tube(f"{name}_CushionWelt", [(x - 0.211, yy, 0.502), (x + 0.181, yy, 0.502)],
               0.0025, "linen", parent=root)
    return root


def build_room(parent):
    shell = h.empty("外壳", parent=parent)
    shell["description"] = "Editable graphite ward shell; metre units; entrance open for inspection"
    h.box("Ward_Seamless_ClinicalFloor", (0.0, 2.3, -0.06), (6.65, 4.84, 0.12),
          "floor", bevel=0.005, parent=shell)
    h.box("Headwall_ShadowJointBacking", (0.0, -0.111, 1.55), (6.60, 0.11, 3.1),
          "dark", bevel=0.0, parent=shell)
    # Flush panels leave actual 4 mm vertical joints and a quiet upper datum.
    for i in range(8):
        x = -2.8 + i * 0.8
        for label, z, height in (("Lower", 0.940, 1.864), ("Upper", 2.488, 1.212)):
            h.box(f"Headwall_GraphitePanel_{i + 1:02d}_{label}", (x, -0.043, z),
                  (0.796, 0.055, height), "graphite", bevel=0.0018, parent=shell)
    h.box("TVwall_ShadowJointBacking", (-3.269, 2.3, 1.55), (0.138, 4.60, 3.10), "dark", parent=shell)
    for i in range(6):
        h.box(f"TVwall_GraphitePanel_{i + 1:02d}", (-3.193, (i + 0.5) * 4.6 / 6, 1.56),
              (0.035, 4.6 / 6 - 0.005, 3.075), "graphite", bevel=0.002, parent=shell)
    h.box("Headwall_ClinicalCovedSkirting", (0.0, 0.003, 0.063), (6.4, 0.052, 0.126),
          "steel", bevel=0.015, parent=shell)
    h.box("TVwall_ClinicalCovedSkirting", (-3.164, 2.3, 0.063), (0.052, 4.6, 0.126),
          "steel", bevel=0.015, parent=shell)
    h.box("Window_ClinicalCovedSkirting", (3.157, 2.3, 0.063), (0.052, 4.6, 0.126),
          "steel", bevel=0.015, parent=shell)
    for x in (-3.1, 3.1):
        h.box("Headwall_Anodized_Edge", (x, -0.010, 2.295), (0.026, 0.029, 1.46),
              "steel", bevel=0.005, parent=shell)

    ceiling = h.empty("Ceiling_Assembly", parent=shell)
    h.box("Ceiling_ShadowJointBacking", (0.0, 2.3, 3.142), (6.6, 4.7, 0.084), "dark", bevel=0.0, parent=ceiling)
    for ix in range(6):
        for iy in range(4):
            h.box(f"Ceiling_HygienicPanel_{ix + 1}_{iy + 1}",
                  (-3.2 + (ix + 0.5) * 6.4 / 6, (iy + 0.5) * 4.6 / 4, 3.087),
                  (6.4 / 6 - 0.006, 4.6 / 4 - 0.006, 0.029), "white", bevel=0.002, parent=ceiling)
    lamps = h.empty("灯", parent=ceiling)
    for index, x in enumerate((-1.65, 1.65), 1):
        h.box(f"Ceiling_Light_{index}_Recess", (x, 2.23, 3.069), (1.075, 0.665, 0.019), "dark", parent=lamps)
        h.box(f"Ceiling_Light_{index}_Frame", (x, 2.23, 3.058), (1.055, 0.645, 0.027), "silver", bevel=0.006, parent=lamps)
        h.box(f"Ceiling_Light_{index}_Diffuser", (x, 2.23, 3.043), (0.995, 0.585, 0.012), "lamp", bevel=0.007, parent=lamps)
    # Small service grilles and smoke detector give the ceiling credible scale.
    for index, x in enumerate((-2.6, 2.6), 1):
        h.box(f"Ceiling_ReturnVent_{index}_Frame", (x, 0.71, 3.061), (0.47, 0.26, 0.025), "silver", parent=ceiling)
        h.box(f"Ceiling_ReturnVent_{index}_DarkInset", (x, 0.71, 3.046), (0.433, 0.218, 0.009), "dark", parent=ceiling)
        for k in range(7):
            h.box(f"Ceiling_ReturnVent_{index}_Blade_{k}", (x, 0.621 + k * 0.029, 3.038),
                  (0.43, 0.014, 0.016), "white", bevel=0.002, parent=ceiling)
    h.cylinder("Ceiling_SmokeDetector_Base", (-0.55, 1.26, 3.045), 0.066, 0.033, "white", parent=ceiling)
    h.cylinder("Ceiling_SmokeDetector_Cap", (-0.55, 1.26, 3.021), 0.055, 0.020, "plastic", parent=ceiling)
    h.sphere("Ceiling_SmokeDetector_Indicator", (-0.523, 1.26, 3.008), (0.003, 0.003, 0.0018), "cyan", parent=ceiling)

    window = _window(shell)
    privacy, privacy_cloth = _privacy_curtain(shell)
    entrance = h.empty("Entrance_Oak_Frame", parent=shell)
    for side, x in (("Left", -3.102), ("Right", 3.102)):
        h.box(f"Entrance_{side}_OakJamb", (x, 4.555, 1.53), (0.139, 0.17, 3.06), "oak", bevel=0.008, parent=entrance)
        h.box(f"Entrance_{side}_RebatedShadowLine", (x + (0.075 if x < 0 else -0.075), 4.55, 1.53),
              (0.008, 0.08, 3.03), "dark", bevel=0.001, parent=entrance)
    h.box("Entrance_Oak_Lintel", (0.0, 4.555, 3.063), (6.30, 0.17, 0.11), "oak", parent=entrance)

    tv = h.empty("Wall_Mounted_Education_TV", parent=shell)
    h.box("WardTV_WallBracket", (-3.140, 2.31, 1.95), (0.063, 0.42, 0.29), "steel", parent=tv)
    h.box("WardTV_ThinChassis", (-3.079, 2.31, 1.95), (0.064, 1.335, 0.787), "dark", bevel=0.019, parent=tv)
    h.box("WardTV_Bezel", (-3.043, 2.31, 1.95), (0.014, 1.323, 0.775), "steel", bevel=0.012, parent=tv)
    screen_x, screen_y, screen_z = -3.0335, 2.31, 1.952
    width, height = 1.280, 0.720
    tv_surface = h.mesh("WardTVSurface", [
        (screen_x, screen_y - width / 2, screen_z - height / 2),
        (screen_x, screen_y + width / 2, screen_z - height / 2),
        (screen_x, screen_y + width / 2, screen_z + height / 2),
        (screen_x, screen_y - width / 2, screen_z + height / 2),
    ], [(0, 1, 2, 3)], "screen", parent=tv,
       uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    tv_surface["displayRole"] = "education-video"
    tv_surface["aspectRatio"] = "16:9"
    h.sphere("WardTV_StandbyIndicator", (-3.029, 2.849, 1.569), (0.002, 0.005, 0.002), "cyan", parent=tv)

    furniture = h.empty("Visitor_Furniture", parent=parent)
    chairs = [_visitor_chair(f"Visitor_Chair_{i + 1}", 2.69, y, furniture)
              for i, y in enumerate((3.26, 4.02))]
    # A shallow entry storage cabinet stays out of the bed movement envelope.
    h.box("Entry_Cabinet_Carcass", (-2.977, 3.57, 0.45), (0.35, 1.06, 0.79), "white", bevel=0.025, parent=furniture)
    h.box("Entry_Cabinet_OakFront", (-2.79, 3.57, 0.451), (0.029, 1.025, 0.736), "oak", bevel=0.012, parent=furniture)
    h.box("Entry_Cabinet_ShadowPlinth", (-2.99, 3.57, 0.066), (0.29, 0.99, 0.084), "dark", parent=furniture)
    h.box("Entry_Cabinet_ClinicalTop", (-2.964, 3.57, 0.87), (0.403, 1.112, 0.050), "white", bevel=0.015, parent=furniture)
    h.box("Entry_Cabinet_Handle", (-2.765, 3.57, 0.739), (0.028, 0.295, 0.019), "steel", bevel=0.006, parent=furniture)
    h.box("Entry_Cabinet_DoorJoint", (-2.771, 3.57, 0.441), (0.002, 0.003, 0.667), "dark", bevel=0.0, parent=furniture)
    return {
        "shell": shell,
        "ceiling": ceiling,
        "lamps": lamps,
        "window": window,
        "privacy_curtain": privacy,
        "privacy_cloth": privacy_cloth,
        "tv_surface": tv_surface,
        "visitor_chairs": chairs,
    }
