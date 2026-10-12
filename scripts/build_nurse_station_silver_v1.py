"""Editable silver/cyan nurse station from the 2026-09-29 wall-TV concept.

Blender 4.5 LTS: --background --python scripts/build_nurse_station_silver_v1.py
-- --width 1920 --samples 64
Dimensions are design assumptions, not surveyed hospital geometry.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import design_nurse_station_reference as base
from render_high_fidelity_nurse_station import cube, cylinder, sphere, pbr_material, add_area_light, point_at
from refine_nurse_station_reference import joined_keys, surface_maps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/nurse-station-silver-v1"
ASSET = ROOT / "public/models/smart-ward-nurse-station/nurse-station-silver-v1.glb"
PRESERVE = {"Screen_Main_Frame", "Clock_Frame", "Clock_Display", "TV_Wall_Mount", "TV_Frame", "地板", "Ceiling"}
M = {}


def box(name, pos, size, material, bevel=.006):
    obj = cube(name, pos, size, M[material], bevel)
    if bevel:
        mod = obj.modifiers.new("Weighted manufactured normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
    return obj


def label(name, body, pos, size, material="white", preview=False, align="CENTER"):
    return base.text(name, body, pos, size, M[material], align, preview)


def materials():
    definitions = {
        "white": ((.79, .79, .76), .3, 0), "wall": ((.70, .70, .67), .65, 0),
        "silver": ((.58, .60, .61), .34, .78), "steel": ((.25, .28, .30), .26, .86),
        "teal": ((.015, .27, .35), .27, .60), "dark": ((.018, .024, .03), .37, .12),
        "fabric": ((.045, .055, .065), .90, 0), "floor": ((.49, .50, .49), .29, 0),
        "oak": ((.48, .37, .24), .47, 0), "glass": ((.18, .29, .34), .15, .36),
        "paper": ((.85, .87, .87), .68, 0), "blue": ((.019, .071, .12), .6, 0),
        "screen": ((.008, .025, .044), .43, 0), "ui": ((.021, .078, .13), .6, 0),
    }
    for name, (rgb, roughness, metal) in definitions.items():
        M[name] = pbr_material("SilverV1_"+name, rgb, roughness, metal)
        M[name].diffuse_color = (*rgb, 1)
    for name, rgb, strength in (("cyan", (.06, .71, 1), 3.5),
                                ("lamp", (1, .93, .79), 3.0), ("sky", (.72, .84, 1), .7)):
        M[name] = pbr_material("SilverV1_"+name, rgb, .36, emission=rgb, emission_strength=strength)
    size = 512
    u, v = np.meshgrid(np.linspace(0, 1, size), np.linspace(0, 1, size))
    rng = np.random.default_rng(929)
    noise = rng.normal(0, 1, (size, size))
    # Image-based PBR maps travel inside the GLB; no Blender-only Noise nodes.
    for name, rgb, height, rough, strength in (
        ("silver", (.63, .65, .66), .16*np.sin(v*1600)+.06*noise, .28, .15),
        ("floor", (.69, .70, .69), .09*noise+.07*np.sin(u*137+1.7*np.sin(v*133)), .23, 1.5),
        ("white", (.88, .88, .85), .04*noise, .30, .7),
        ("oak", (.66, .54, .39), .07*np.sin(u*650+.45*np.sin(v*12))+.02*noise, .46, 5),
        ("fabric", (.16, .19, .22), .2*np.sin(u*550)*np.sin(v*550), .86, 3),
    ):
        color = np.asarray(rgb)[None, None, :]+height[:, :, None]*.12
        surface_maps(M[name], "silver-v1-"+name, color, height, rough+height*.08, OUT, strength)


def ribbon(name, path, bottom, top, mat, thickness=.035):
    # Unlike the old closed apron, this leaves the entire staff side accessible.
    n = len(path)
    vertices = [(x, y, bottom) for x, y in path]+[(x, y, top) for x, y in path]
    obj = base.mesh(name, vertices, [(i, i+1, i+1+n, i+n) for i in range(n-1)], M[mat])
    uv = obj.data.uv_layers.new(name="UVMap")
    distance = 0
    for i, face in enumerate(obj.data.polygons):
        length = (Vector(path[i+1])-Vector(path[i])).length
        for li, coord in zip(face.loop_indices, [(distance, bottom), (distance+length, bottom),
                                                (distance+length, top), (distance, top)]):
            uv.data[li].uv = coord
        distance += length
        face.use_smooth = True
    solid = obj.modifiers.new("Panel thickness", "SOLIDIFY")
    solid.thickness = thickness
    bevel = obj.modifiers.new("Small edge radius", "BEVEL")
    bevel.width, bevel.segments = .004, 3
    return obj


def main_path(inset=0):
    r = .78-inset
    points = [(-4.52+inset, 2.80), (-4.52+inset, .40)]
    points += [(-3.74+r*math.cos(a), .40+r*math.sin(a)) for a in np.linspace(math.pi, math.pi*1.5, 49)]
    points += [(2.85, -.38+inset)]
    return points


def counter():
    path = main_path()
    ribbon("Counter_Silver_Front", path, .115, .704, "silver")
    ribbon("Counter_Cyan_Inlay", path, .704, .794, "teal")
    ribbon("Nurse_Counter", path, .794, 1.17, "white", .10)
    ribbon("Counter_Steel_Plinth", main_path(.025), .018, .115, "steel")
    for z in (.704, .794):
        base.tube("Counter_Reveal_LED", [(x, y-.003, z) for x, y in path], .005, M["cyan"])
    base.slab("Nurse_Counter_Top", path+list(reversed(main_path(.30))), 1.17, .032, M["white"])
    box("Staff_Worktop", (-.53, .52, .79), (6.74, .73, .038), "white", .012)
    box("Staff_Modesty_Panel", (-.52, .13, .45), (6.72, .032, .65), "wall")
    for x in (-3.6, -2.0, -.1, 1.75, 2.75):
        box("Desk_Under_Support", (x, .53, .40), (.035, .66, .75), "wall")
    for x in (-2.5, -.5, 1.6):
        box("Front_Panel_Seam", (x, -.399, .405), (.0025, .003, .58), "steel", 0)
    # Knee space is open on the visitor side of the lowered service position.
    box("Accessible_Service_Top", (3.39, .17, .775), (1.08, 1.10, .04), "white", .012)
    box("Accessible_Rear_Support", (3.39, .705, .40), (1.08, .04, .71), "silver")
    box("Accessible_Right_Support", (3.93, .2, .395), (.05, 1.04, .72), "white")
    small = [(x+4.4, y) for x, y in base.rounded_path(1.08, 1.55, .29, -.16)]
    for name, bottom, top, mat in (("Service_Endcap", .11, 1.045, "silver"),
                                   ("Service_Plinth", .025, .11, "steel"),
                                   ("Service_Band", .73, .755, "cyan")):
        base.apron(name, small, lambda x, z=bottom: z, lambda x, z=top: z, M[mat])
    base.slab("Service_Endcap_Top", small, 1.045, .035, M["white"])


def workstations():
    for i, (x, y) in enumerate(((-3.32, .57), (-1.68, .57), (.12, .57), (1.92, .57), (4.35, .70)), 1):
        z = 1.27 if i < 5 else 1.32
        box(f"Monitor_Frame_{i:02d}", (x, y, z), (.67, .044, .41), "dark", .012)
        name = f"Screen_Work_{i:02d}" if i < 5 else "Screen_Service"
        base.screen(name, x, y+.024, z, .626, .352125, M["screen"], True)
        # Two-link monitor arm, VESA plate and visible hinge collars.
        box("Monitor_VESA", (x, y-.04, z), (.095, .034, .095), "steel")
        for a, b in (((x, y-.07, z), (x+.24, y-.10, z-.19)),
                     ((x+.24, y-.10, z-.19), (x+.27, y-.05, .83 if i < 5 else 1.09))):
            base.tube("Monitor_Articulated_Arm", [a, b], .019, M["silver"])
            cylinder("Monitor_Arm_Hinge", a, .037, .052, M["steel"], 24, (math.pi/2, 0, 0))
        for j in range(16):
            box("Monitor_Back_Vent", (x-.20+j*.025, y-.023, z-.11), (.012, .002, .038), "fabric", 0)
        if i < 5:
            box("Keyboard_Base", (x, 1.02, .825), (.455, .157, .021), "dark")
            joined_keys("Keyboard_Keycaps", x, 1.02, .835, M["fabric"])
            sphere("Mouse", (x+.34, 1.0, .83), (.033, .054, .023), M["dark"])
            base.tube("Monitor_Cable", [(x, y-.025, 1.16), (x+.04, y-.03, .98),
                                        (x+.31, y+.06, .80)], .003, M["dark"])
        cy = 1.62 if i < 5 else 1.77
        box("Chair_Seat", (x, cy, .48), (.49, .48, .08), "fabric", .037)
        box("Chair_Back_Frame", (x, cy+.21, .91), (.51, .065, .59), "dark", .04)
        box("Chair_Back_Mesh", (x, cy+.169, .93), (.435, .025, .49), "fabric", .03)
        cylinder("Chair_Gas_Lift", (x, cy, .26), .027, .35, M["steel"], 24)
        for j in range(5):
            a = j*math.tau/5
            end = (x+.30*math.cos(a), cy+.30*math.sin(a), .07)
            base.tube("Chair_Star_Base", [(x, cy, .16), end], .016, M["steel"])
            cylinder("Chair_Caster", end, .033, .047, M["dark"], 16, (math.pi/2, 0, a))
        for side in (-1, 1):
            base.tube("Chair_Arm", [(x+side*.21, cy+.1, .50), (x+side*.27, cy+.12, .73),
                                    (x+side*.27, cy-.12, .73)], .015, M["dark"])


def backwall():
    box("Back_Wall", (0, 3.60, 1.72), (10.2, .18, 3.44), "wall")
    box("Back_Cabinet", (-.65, 3.16, .45), (8.65, .56, .81), "wall")
    box("Back_Cabinet_Top", (-.65, 3.11, .875), (8.71, .65, .035), "white")
    for i in range(12):
        x = -4.59+i*.713
        for row, (z, h) in enumerate(((.25, .30), (.60, .37))):
            box(f"Rear_Drawer_{i}_{row}", (x, 2.867, z), (.704, .027, h), "white", .003)
            base.tube("Drawer_Pull", [(x-.09, 2.84, z+.08), (x-.08, 2.816, z+.08),
                                      (x+.08, 2.816, z+.08), (x+.09, 2.84, z+.08)], .005, M["silver"])
    for i in range(5):
        x = -4.49+i*.60
        box("Upper_Cabinet_Case", (x, 3.28, 2.30), (.598, .42, 1.12), "wall", .003)
        box("Upper_Cabinet_Door", (x, 3.056, 2.30), (.588, .025, 1.105), "white", .003)
        box("Upper_Cabinet_Handle", (x+.19, 3.025, 1.98), (.01, .026, .14), "silver", .004)
    box("Under_Cabinet_LED", (-3.29, 3.14, 1.735), (2.97, .03, .009), "lamp", .002)
    for x in (-4.30, -3.18, 2.78):
        for j in range(4):
            xx = x+j*.092
            box("Clinical_File_Binder", (xx, 3.17, 1.12), (.076, .24, .42), "blue", .004)
            box("Binder_Label", (xx, 3.047, 1.04), (.05, .002, .11), "paper", 0)
            cylinder("Binder_Ring", (xx, 3.039, 1.22), .009, .004, M["silver"], 16, (math.pi/2, 0, 0))
    for x in (-3.65, -1.96, 2.3):
        box("Document_Tray_Shell", (x, 3.15, 1.065), (.35, .29, .34), "silver")
        for j in range(4):
            box("Document_Tray_Gap", (x, 2.997, .96+j*.071), (.29, .012, .046), "dark", .003)
            box("Document_Stack", (x, 2.987, .964+j*.071), (.27, .022, .016), "paper", .001)
    for x in (-2.75, -2.51):
        box("Wall_Power_Plate", (x, 3.495, 1.16), (.115, .013, .12), "white", .004)
        for dx in (-.022, .022):
            box("Socket_Aperture", (x+dx, 3.485, 1.165), (.006, .004, .027), "dark", .001)
    box("Screen_Main_Trim", (-.12, 3.44, 2.18), (3.21, .06, 1.49), "silver", .009)
    box("Screen_Main_Frame", (-.12, 3.383, 2.18), (3.13, .09, 1.41), "dark", .018)
    base.screen("Screen_Main", -.12, 3.335, 2.18, 3.024, 1.344, M["screen"])
    cylinder("Clock_Frame", (1.92, 3.456, 2.35), .245, .055, M["silver"], 96, (math.pi/2, 0, 0))
    clock = cylinder("Clock_Display", (1.92, 3.422, 2.35), .222, .008, M["paper"], 96, (math.pi/2, 0, 0))
    clock["displayRole"] = "analog-clock"
    # Separate physical wall mount, housing and 16:9 video surface.
    box("TV_Wall_Mount", (3.63, 3.475, 2.25), (.53, .06, .35), "steel")
    box("TV_Frame", (3.63, 3.405, 2.25), (1.50, .07, .86625), "dark", .008)
    tv = base.screen("Screen_Video", 3.63, 3.367, 2.25, 1.44, .81, M["screen"])
    tv["displayRole"], tv["mounting"] = "education-video", "wall"
    box("TV_Power_Indicator", (4.28, 3.365, 1.84), (.012, .003, .004), "cyan", .001)


def architecture():
    box("地板", (0, 4, -.07), (15, 28, .14), "floor", 0)
    box("Ceiling", (0, 4, 3.49), (15, 28, .10), "white", 0)
    canopy = base.rounded_path(10.4, 4.25, .63, -.77)
    base.slab("Station_Canopy", canopy, 2.99, .41, M["silver"])
    inset = base.rounded_path(10.27, 4.12, .59, -.705)
    base.slab("Canopy_Soffit", inset, 2.965, .028, M["white"])
    base.tube("Canopy_Lower_LED", [(x, y, 2.972) for x, y in inset]+[(*inset[0], 2.972)], .008, M["cyan"])
    label("Station_Header", "护  士  站", (.50, -.778, 3.20), .41)
    for x in (-1.54, 2.54):
        box("Canopy_Vertical_Accent", (x, -.778, 3.20), (.012, .012, .37), "cyan", .002)
    for x in (-4.3, -2.9, -1.5, -.1, 1.3, 2.7, 4.1):
        for y in (-.38, 2.75):
            cylinder("Recessed_Lamp_Bezel", (x, y, 2.957), .043, .013, M["silver"], 32)
            cylinder("Recessed_Lamp_Diffuser", (x, y, 2.947), .032, .009, M["lamp"], 32)
    for x in np.arange(-7.2, 7.3, 1.2):
        box("Ceiling_Grid_X", (float(x), 3.5, 3.434), (.007, 27, .005), "silver", 0)
    for y in np.arange(-9, 18, 1.2):
        box("Ceiling_Grid_Y", (0, float(y), 3.434), (15, .007, .005), "silver", 0)
    for x in (-6.1, 0, 6.1):
        for y in (-4.8, -1.8, 4.8, 8.4, 12.0, 15.6):
            box("Ceiling_Light_Frame", (x, y, 3.416), (.64, 1.23, .026), "silver")
            box("Ceiling_Light_Panel", (x, y, 3.398), (.59, 1.18, .014), "lamp", .002)
    for side in (-1, 1):
        box("Corridor_Outer_Wall", (side*7.25, 7, 1.72), (.18, 22, 3.44), "wall", 0)
        box("Corridor_Inner_Wall", (side*5.05, 10.8, 1.72), (.18, 14.4, 3.44), "wall", 0)
        box("Corridor_Skirting", (side*7.15, 7, .07), (.025, 22, .14), "steel", .002)
        # End windows and side-wall doors give the reference its corridor depth.
        box("Corridor_End_Window", (side*6.1, 17.9, 1.72), (2.12, .04, 3.38), "sky", 0)
        for xx in (-.96, 0, .96):
            box("Window_Mullion", (side*6.1+xx, 17.86, 1.72), (.045, .06, 3.40), "silver")
        box("Window_Transom", (side*6.1, 17.85, 1.1), (2.0, .06, .045), "silver")
        for k, y in enumerate((3.8, 7.4, 11, 14.6)):
            dx = side*7.105
            box("Corridor_Door_Frame", (dx, y, 1.21), (.08, 1.16, 2.42), "silver")
            box("Corridor_Door", (dx-side*.044, y, 1.175), (.04, 1.07, 2.34), "oak")
            box("Door_Vision_Frame", (dx-side*.074, y, 1.59), (.018, .27, .67), "steel")
            box("Door_Glass", (dx-side*.087, y, 1.59), (.009, .23, .63), "glass")
            base.tube("Door_Lever", [(dx-side*.12, y-.40, .94), (dx-side*.12, y-.23, .94)], .011, M["silver"])
            for end in (-1, 1):
                a, b = y+end*.66, y+end*1.7
                base.tube("Corridor_Handrail", [(side*7.03, a, .85), (side*7.03, b, .85)], .028, M["white"])
                base.tube("Handrail_Inlay", [(side*6.999, a, .86), (side*6.999, b, .86)], .006, M["teal"])
        # The left corridor remains open in the reference, not sealed by a door.
        if side < 0:
            continue
        # Frontal utility doorway at the right side of the cabinet wall.
        x = side*5.91
        box("Return_Wall", (x, 3.62, 1.72), (1.69, .16, 3.44), "wall", 0)
        box("Return_Door_Frame", (x, 3.51, 1.21), (1.16, .10, 2.42), "silver")
        box("Return_Door", (x, 3.45, 1.17), (1.05, .035, 2.33), "oak")
        box("Return_Vision_Frame", (x, 3.427, 1.63), (.25, .018, .72), "silver")
        box("Return_Vision_Glass", (x, 3.416, 1.63), (.21, .009, .68), "glass")
        base.tube("Return_Door_Handle", [(x+.31, 3.386, .95), (x+.45, 3.386, .95)], .011, M["silver"])
        box("Return_Door_Terminal", (x+side*.69, 3.49, 1.45), (.17, .046, .28), "white")
        box("Return_Door_Terminal_Face", (x+side*.69, 3.463, 1.47), (.134, .006, .21), "teal", .003)


def preview_content():
    # These are visual samples only; the exported GLB contains empty screen faces.
    for j, title in enumerate(("病区概览", "患者呼叫", "设备状态")):
        x = -1.13+j*1.01
        obj = box("Preview_Dashboard_Card", (x, 3.329, 2.20), (.946, .004, 1.19), "ui", .022)
        base.PREVIEW.append(obj)
        label("Preview_Dashboard_Title", title, (x, 3.318, 2.60), .107, preview=True)
        for row, word in enumerate(("— —", "— —", "— —")):
            label("Preview_Dashboard_Row", word, (x, 3.316, 2.29-row*.24), .12, "cyan", True)
    label("Preview_Disclaimer", "界面示意 · 非实时数据", (-.12, 3.319, 1.57), .043, preview=True)
    for h in range(1, 13):
        angle = h*math.tau/12
        label("Preview_Clock_Number", str(h), (1.92+.176*math.sin(angle), 3.414, 2.35+.176*math.cos(angle)), .034, "dark", True)
    for endpoint in ((1.83, 3.408, 2.435), (2.06, 3.408, 2.44)):
        base.PREVIEW.append(base.tube("Preview_Clock_Hand", [(1.92, 3.408, 2.35), endpoint], .006, M["dark"]))
    label("Preview_Video_Title", "护理宣教", (3.06, 3.360, 2.56), .082, preview=True, align="LEFT")
    label("Preview_Video_Message", "正确洗手\n守护健康", (3.63, 3.358, 2.27), .125, preview=True)
    label("Preview_Video_Disclaimer", "视频画面示意", (3.63, 3.358, 2.03), .039, preview=True)
    for name, pos, size, mat in (("Track", (3.64, 3.356, 1.91), (1.19, .003, .008), "white"),
                                 ("Progress", (3.29, 3.352, 1.91), (.49, .003, .009), "cyan")):
        base.PREVIEW.append(box("Preview_Video_"+name, pos, size, mat, 0))


VIEWS = {
    "front": ((-7.6, -9.5, 2.15), (-.50, 1.20, 1.65), 38),
    "detail": ((-4.7, -4.6, 1.72), (-.25, .2, .94), 38),
    "wall": ((3.10, .70, 2.30), (2.9, 3.42, 2.24), 24),
    "staff": ((-3.7, 2.10, 1.82), (-.8, -.15, 1.02), 26),
}


def setup_render(width, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples, scene.cycles.use_denoising = samples, True
    scene.cycles.max_bounces, scene.cycles.diffuse_bounces = 8, 4
    scene.render.resolution_x, scene.render.resolution_y = width, round(width*941/1672)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world = bpy.data.worlds.new("Neutral hospital daylight")
    scene.world.use_nodes = True
    world = scene.world.node_tree.nodes["Background"]
    world.inputs["Color"].default_value, world.inputs["Strength"].default_value = (.82, .9, 1, 1), .28
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.30
    add_area_light("Front_Softbox", (-3.2, -4.4, 3.25), 420, (7, 3), (1, .95, .87), (0, 1.5, 1))
    add_area_light("Left_Daylight", (-6.8, -.4, 2.65), 430, (2, 2.7), (.85, .93, 1), (0, 1, .8))
    add_area_light("Right_Fill", (6.7, -.4, 2.85), 240, (2, 2.5), (1, .96, .90), (0, 1, .8))
    for x in (-5.7, -.8, 4.5):
        add_area_light("Lobby_Window_Reflection", (x, -7.5, 1.8), 140, (1.2, 2.8), (.93, .97, 1), (x, 1, 1.4))
    add_area_light("Cabinet_Wash", (-2.7, 2.95, 1.72), 25, (2.8, .18), (1, .92, .80), (-2.7, 3.4, .9))
    for x in (-3.4, 0, 3.4):
        add_area_light("Canopy_Softbox", (x, 1.4, 2.90), 75, (2, 1.6), (1, .95, .88), (x, 1.5, .2))
    for side in (-1, 1):
        for y in (2, 6, 10, 14):
            add_area_light("Corridor_Daylight", (side*6.1, y, 3.34), 65, (1.4, 2), (1, .96, .91), (side*6.1, y, 0))
    camera = bpy.data.objects.new("Camera_reference", bpy.data.cameras.new("Reference camera"))
    bpy.context.collection.objects.link(camera)
    camera.data.clip_end = 100
    scene.camera = camera


def set_view(name):
    location, target, lens = VIEWS[name]
    camera = bpy.context.scene.camera
    camera.location, camera.data.lens = location, lens
    point_at(camera, target)
    bpy.context.scene.render.filepath = str(OUT/f"{name}.png")


def export_runtime():
    # Save the editable source first. Consolidation only affects this transient
    # export scene, never the named furniture parts in the .blend deliverable.
    # Base colours tolerate JPEG; keep normal and roughness maps lossless.
    # This export-only conversion does not alter the packed PNG source materials.
    bpy.context.scene.render.image_settings.quality = 92
    for image in bpy.data.images:
        if image.name.endswith("-color"):
            image.file_format = "JPEG"
            image.filepath_raw = str(OUT/"textures"/(image.name+"-runtime.jpg"))
            image.save()
            image.pack()
    preview_names = {o.name for o in base.PREVIEW}
    runtime = [o for o in bpy.context.scene.objects if o.type in {"MESH", "CURVE", "FONT"} and o.name not in preview_names]
    bpy.ops.object.select_all(action="DESELECT")
    for obj in runtime:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = runtime[0]
    bpy.ops.object.convert(target="MESH")
    grouped = {}
    for obj in list(bpy.context.selected_objects):
        if obj.name in PRESERVE or obj.name.startswith("Screen_"):
            continue
        # Retain editable screen chassis identities and keep shell shadows
        # separately controllable from the counter and cabinetry.
        category = "Architecture" if any(s in obj.name for s in ("Ceiling", "Corridor", "Window", "Wall", "Canopy")) else "Furniture"
        grouped.setdefault((category, obj.data.materials[0].name), []).append(obj)
    for (category, material), objects in grouped.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        bpy.context.object.name = category+"_"+material
    runtime = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name not in preview_names]
    root = bpy.data.objects.new("NurseStationSilverV1", None)
    bpy.context.collection.objects.link(root)
    root["units"], root["surveyed"] = "metres", False
    root["reference"] = "nurse-station-wall-tv-20260929.png"
    root["layout"] = "silver-v1; authored dimensions; do not apply v2 wall-display scaling"
    bpy.ops.object.select_all(action="DESELECT")
    for obj in runtime:
        obj.parent = root
        obj.select_set(True)
    root.select_set(True)
    ASSET.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(ASSET), export_format="GLB", use_selection=True,
        export_apply=True, export_extras=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False)
    triangles = 0
    for obj in runtime:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    report = {"source": str((OUT/"nurse-station-silver-v1.blend").relative_to(ROOT)),
        "asset": str(ASSET.relative_to(ROOT)), "surveyed": False,
        "triangles": triangles, "meshObjects": len(runtime), "bytes": ASSET.stat().st_size,
        "screenNodes": [s.name for s in base.SCREENS], "videoAspect": "16:9",
        "previewObjectsExcluded": len(preview_names), "liveDataConnected": False,
        "dimensionsMetres": {"canopyWidth": 10.4, "canopyDepth": 4.25, "ceiling": 3.44,
                              "counterHeight": 1.202, "serviceHeight": .795},
        "camerasBlender": VIEWS, "blenderVersion": bpy.app.version_string}
    (OUT/"manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("NURSE_SILVER_EXPORT " + json.dumps(report, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--samples", type=int, default=64)
    parser.add_argument("--skip-render", action="store_true")
    parser.add_argument("--views", nargs="+", choices=VIEWS, default=["front"])
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    (OUT/"textures").mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    base.FONT = bpy.data.fonts.load("C:/Windows/Fonts/msyh.ttc")
    materials()
    architecture()
    architecture_names = set(bpy.data.objects.keys())
    counter()
    workstations()
    # The visitor counter projects slightly beyond the soffit, as in the concept.
    for obj in bpy.context.scene.objects:
        if obj.name not in architecture_names:
            obj.location.y -= .70
    backwall()
    # Metre-based planar UVs keep baked microstructure at plausible scale.
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.name.startswith("Screen_") or "Counter" in obj.name:
            continue
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            for li in face.loop_indices:
                p = obj.data.vertices[obj.data.loops[li].vertex_index].co
                uv.data[li].uv = (p.y if axis == 0 else p.x, p.y if axis == 2 else p.z)
    preview_content()
    preview = bpy.data.collections.new("PREVIEW_ONLY — illustrative screens, not exported")
    bpy.context.scene.collection.children.link(preview)
    for obj in base.PREVIEW:
        for collection in list(obj.users_collection):
            collection.objects.unlink(obj)
        preview.objects.link(obj)
    setup_render(args.width, args.samples)
    set_view("front")
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"nurse-station-silver-v1.blend"))
    export_runtime()
    if not args.skip_render:
        # Restore the editable source after export-only mesh consolidation/JPEG
        # encoding, so review renders always use the full source materials.
        bpy.ops.wm.open_mainfile(filepath=str(OUT/"nurse-station-silver-v1.blend"))
        for name in args.views:
            set_view(name)
            bpy.context.scene.cycles.samples = args.samples if name == "front" else min(args.samples, 32)
            bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
