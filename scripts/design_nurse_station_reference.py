"""Build the reference-led nurse station as an isolated, editable Blender scene.

Run with Blender 4.5: blender -b --python scripts/design_nurse_station_reference.py
-- --output output/nurse-station-reference-v1 --samples 48 --width 1920
The preview data is illustrative and is deliberately excluded from the GLB.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_high_fidelity_nurse_station import (
    add_area_light, cube, cylinder, pbr_material, point_at, sphere,
)

ROOT = Path(__file__).resolve().parents[1]
RNG = random.Random(31)
PREVIEW = []
SCREENS = []
FONT = None


def text(name, body, position, size, material, align="LEFT", preview=False):
    data = bpy.data.curves.new(name, "FONT")
    data.body = body
    data.size = size
    data.align_x = align
    data.align_y = "CENTER"
    data.extrude = 0.0008 if preview else 0.002
    data.bevel_depth = 0 if preview else 0.0004
    data.font = FONT
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler.x = math.pi / 2
    obj.data.materials.append(material)
    if preview:
        PREVIEW.append(obj)
    return obj


def tube(name, points, radius, material):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for target, point in zip(spline.points, points):
        target.co = (*point, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def mesh(name, vertices, faces, material, uv=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if uv:
        layer = data.uv_layers.new(name="UVMap")
        for face in data.polygons:
            for loop, coord in zip(face.loop_indices, ((0, 0), (1, 0), (1, 1), (0, 1))):
                layer.data[loop].uv = coord
    return obj


def screen(name, x, y, z, width, height, material, face_staff=False):
    # Front normal is -Y; work screens rotate to +Y without reversing their UVs.
    obj = mesh(name, [(-width/2, 0, -height/2), (width/2, 0, -height/2),
                      (width/2, 0, height/2), (-width/2, 0, height/2)],
               [(0, 1, 2, 3)], material, uv=True)
    obj.location = (x, y, z)
    if face_staff:
        obj.rotation_euler.z = math.pi
    obj["displayRole"] = name
    obj["displayAspect"] = width / height
    SCREENS.append(obj)
    return obj


def rounded_path(width, depth, radius, center_y):
    points = []
    for cx, cy, start in ((width/2-radius, radius, -90),
                           (width/2-radius, depth-radius, 0),
                           (-width/2+radius, depth-radius, 90),
                           (-width/2+radius, radius, 180)):
        for i in range(25):
            angle = math.radians(start + i * 90 / 24)
            points.append((cx + radius*math.cos(angle), cy + radius*math.sin(angle) + center_y))
    sampled = []
    for i, point in enumerate(points):
        end = points[(i+1) % len(points)]
        steps = max(1, math.ceil((Vector(end)-Vector(point)).length/.08))
        sampled.extend((point[0]+(end[0]-point[0])*j/steps,
                        point[1]+(end[1]-point[1])*j/steps) for j in range(steps))
    return sampled


def apron(name, path, bottom, top, material, thickness=0.024):
    count = len(path)
    vertices = [(x, y, bottom(x)) for x, y in path] + [(x, y, top(x)) for x, y in path]
    faces = [(i, (i+1) % count, (i+1) % count + count, i+count) for i in range(count)]
    obj = mesh(name, vertices, faces, material)
    # A continuous surface gives the reference's flowing white/oak junction.
    layer = obj.data.uv_layers.new(name="UVMap")
    distance = 0.0
    for i, face in enumerate(obj.data.polygons):
        edge_length = (Vector(path[(i+1) % count])-Vector(path[i])).length
        for loop, coord in zip(face.loop_indices, ((distance, bottom(path[i][0])),
                (distance+edge_length, bottom(path[(i+1) % count][0])),
                (distance+edge_length, top(path[(i+1) % count][0])), (distance, top(path[i][0])))):
            layer.data[loop].uv = coord
        distance += edge_length
        face.use_smooth = True
    solidify = obj.modifiers.new("Panel thickness", "SOLIDIFY")
    solidify.thickness = thickness
    bevel = obj.modifiers.new("Manufactured edge", "BEVEL")
    bevel.width = 0.006
    bevel.segments = 3
    return obj


def slab(name, path, z, height, material):
    count = len(path)
    vertices = [(x, y, z) for x, y in path] + [(x, y, z+height) for x, y in path]
    faces = [tuple(reversed(range(count))), tuple(range(count, count*2))]
    faces += [(i, (i+1) % count, (i+1) % count+count, i+count) for i in range(count)]
    obj = mesh(name, vertices, faces, material)
    bevel = obj.modifiers.new("Stone edge radius", "BEVEL")
    bevel.width = 0.009
    bevel.segments = 3
    return obj


def materials(output):
    m = {
        "stone": pbr_material("Warm_White_Solid_Surface", (.78, .77, .735), .31),
        "wall": pbr_material("Warm_White_Paint", (.72, .72, .685), .65),
        "oak": pbr_material("Natural_Oak", (.58, .43, .26), .48),
        "metal": pbr_material("Brushed_Stainless", (.49, .51, .52), .29, .9),
        "dark": pbr_material("Monitor_Bezel", (.021, .027, .03), .38),
        "fabric": pbr_material("Charcoal_Mesh_Fabric", (.075, .083, .086), .83),
        "floor": pbr_material("Warm_Grey_Vinyl", (.46, .45, .425), .31),
        "inlay": pbr_material("Floor_Border", (.25, .275, .28), .36),
        "teal": pbr_material("Sign_Teal", (.018, .06, .065), .48),
        "leaf": pbr_material("Leaf_Green", (.058, .155, .027), .46),
        "stem": pbr_material("Plant_Stem", (.08, .10, .025), .7),
        "soil": pbr_material("Pot_Soil", (.027, .016, .008), 1),
        "led": pbr_material("Warm_LED", (.95, .8, .55), .35, emission=(1, .75, .42), emission_strength=3),
        "screen": pbr_material("Screen_Glass", (.02, .085, .14), .45, emission=(.025, .07, .11), emission_strength=.8),
        "ui": pbr_material("Preview_UI_Paper", (.7, .83, .88), .8, emission=(.5, .69, .78), emission_strength=.45),
        "blue": pbr_material("Preview_UI_Blue", (.009, .028, .05), .7),
        "white": pbr_material("Sign_Letter_White", (.9, .9, .85), .5),
    }
    # Exportable image maps, rather than Blender-only shader textures.
    texture_dir = output / "textures"
    texture_dir.mkdir(exist_ok=True)
    size = 1024
    u, v = np.meshgrid(np.linspace(0, 1, size), np.linspace(0, 1, size))
    rng = np.random.default_rng(25)
    warp = u + .0009*np.sin(v*13 + u*16) + .0005*np.sin(v*31 + u*44)
    grain = .012*np.sin(warp*1450) + .008*np.sin(warp*5010) + .006*rng.normal(size=(size, size))
    for key, base, modulation in (("oak", (.62, .51, .37), grain),
                                   ("floor", (.46, .45, .43), .015*rng.normal(size=(size, size)))):
        pixels = np.ones((size, size, 4), dtype=np.float32)
        pixels[:, :, :3] = np.clip(np.array(base)[None, None, :] + modulation[:, :, None], 0, 1)
        image = bpy.data.images.new(f"{key}_color", width=size, height=size)
        image.pixels.foreach_set(pixels.ravel())
        image.filepath_raw = str(texture_dir / f"{key}-color.png")
        image.file_format = "PNG"
        image.save()
        image.pack()
        nodes = m[key].node_tree.nodes
        texture = nodes.new("ShaderNodeTexImage")
        texture.image = image
        m[key].node_tree.links.new(texture.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])
    return m


def build_counter(m):
    path = rounded_path(9.2, 1.05, .42, 0)
    def junction(x):
        t = max(0, min(1, (x+2.4)/2.0))
        return .18 + .49*t*t*(3-2*t)
    apron("Nurse_Counter_Oak", rounded_path(9.15, 1.0, .395, .025), lambda x: .105, lambda x: 1.045, m["oak"])
    apron("Nurse_Counter", path, junction, lambda x: 1.065, m["stone"], .04)
    slab("Nurse_Counter_Top", rounded_path(9.23, 1.08, .435, -.015), 1.065, .032, m["stone"])
    apron("Counter_Steel_Plinth", rounded_path(9.16, 1.01, .4, .02), lambda x: .025, lambda x: .12, m["metal"])
    # Follow the curved reveal exactly, inset to hide the luminous strip.
    tube("Counter_Reveal_LED", [(x, y+.012, junction(x)-.012) for x, y in path], .004, m["led"])
    text("Counter_Lettering", "关爱  专业  协作  责任", (-3.5, -.027, .62), .105, m["teal"])
    cube("Counter_Lettering_Rule", (-2.82, -.029, .515), (1.36, .006, .006), m["teal"])
    for x in (-3, -1, 1, 3):
        add_area_light(f"Reveal_Bounce_{x}", (x, -.05, .62), 2.5, (1.6, .08), (1, .76, .48), (x, -.15, .15))


def plant(name, x, y, z, scale, m):
    cylinder(f"{name}_Pot", (x, y, z+.14*scale), .16*scale, .28*scale, m["stone"])
    cylinder(f"{name}_Soil", (x, y, z+.28*scale), .14*scale, .008, m["soil"])
    for i in range(24):
        angle = i*2.4
        h = scale*(.42 + .45*RNG.random())
        reach = scale*(.12 + .2*RNG.random())
        end = (x+math.cos(angle)*reach, y+math.sin(angle)*reach, z+h)
        tube(f"{name}_Stem_{i}", [(x, y, z+.23*scale), (x, y, z+h*.72), end], .003*scale, m["stem"])
        # Pointed, folded leaf surfaces retain a convincing silhouette in close views.
        along = Vector((math.cos(angle), math.sin(angle), .2)) * .27*scale
        across = Vector((-math.sin(angle), math.cos(angle), 0)) * .09*scale
        p = Vector(end)
        leaf = mesh(f"{name}_Leaf_{i}", [p, p+along*.5+across, p+along,
                  p+along*.5-across, p+along*.5+Vector((0, 0, .023*scale))],
                  [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], m["leaf"])
        for polygon in leaf.data.polygons:
            polygon.use_smooth = True


def build_workstations(m):
    for i, x in enumerate((-2.7, -.9, .9, 2.7), 1):
        root = bpy.data.objects.new(f"Workstation_{i:02d}", None)
        bpy.context.collection.objects.link(root)
        root.location = (x, .73, 0)
        parts = [cube(f"Monitor_Frame_{i:02d}", (x, .77, 1.365), (.61, .043, .365), m["dark"], .013),
                 cube(f"Monitor_Stand_{i:02d}", (x, .8, 1.17), (.06, .065, .16), m["metal"], .007),
                 cube(f"Monitor_Base_{i:02d}", (x, .79, 1.113), (.24, .17, .014), m["dark"], .008),
                 cube(f"Keyboard_{i:02d}", (x, .94, 1.112), (.43, .13, .02), m["dark"], .006)]
        display = screen(f"Screen_Work_{i:02d}", x, .795, 1.365, .578, .325, m["screen"], True)
        parts.append(display)
        bpy.context.view_layer.update()
        for part in parts:
            world = part.matrix_world.copy()
            part.parent = root
            part.matrix_world = world
        for j in range(14):
            cube(f"Monitor_Vent_{i}_{j}", (x-.15+j*.023, .746, 1.29), (.011, .003, .036), m["fabric"], .001)
        tube(f"Cable_{i}", [(x, .746, 1.27), (x+.06, .74, 1.17), (x+.07, .74, 1.1)], .005, m["dark"])
        # Real chair proportions; the front apron conceals their lower structure.
        cy = 1.62
        cube(f"Chair_Seat_{i}", (x, cy, .48), (.49, .47, .085), m["fabric"], .035)
        cube(f"Chair_Back_Frame_{i}", (x, cy+.21, .91), (.51, .065, .58), m["dark"], .045)
        cube(f"Chair_Back_Mesh_{i}", (x, cy+.172, .93), (.443, .018, .49), m["fabric"], .032)
        cylinder(f"Chair_Column_{i}", (x, cy, .27), .035, .33, m["metal"])
        for leg in range(5):
            angle = leg*math.tau/5
            end = (x+.31*math.cos(angle), cy+.31*math.sin(angle), .08)
            tube(f"Chair_Base_{i}_{leg}", [(x, cy, .14), end], .019, m["metal"])
            sphere(f"Chair_Caster_{i}_{leg}", (end[0], end[1], .045), (.035, .035, .04), m["dark"])
        for side in (-1, 1):
            tube(f"Chair_Arm_{i}_{side}", [(x+side*.22, cy+.12, .48),
                 (x+side*.29, cy+.1, .73), (x+side*.29, cy-.16, .73)], .019, m["dark"])
    plant("Counter_Plant", -3.95, .44, 1.1, .9, m)
    for x in (-3.32, 3.85):
        cube(f"Desk_Sign_{x}", (x, .23, 1.25), (.3, .025, .26), m["stone"], .008)
        text(f"Desk_Sign_Text_{x}", "请主动出示\n就诊凭证" if x < 0 else "用心护理\n关爱健康", (x, .214, 1.25), .046, m["teal"], "CENTER")


def build_backwall(m):
    cube("Back_Wall", (0, 3.2, 1.58), (9.15, .2, 3.16), m["wall"])
    for i in range(16):
        x = -4.265+i*.569
        cube(f"Oak_Wall_Panel_{i:02d}", (x, 3.079, 1.64), (.565, .045, 3.04), m["oak"], .002)
    cube("Back_Cabinet", (0, 2.84, .45), (8.9, .5, .8), m["oak"], .009)
    cube("Back_Cabinet_Top", (0, 2.81, .872), (8.96, .58, .035), m["stone"], .008)
    for i in range(12):
        x = -4.065+i*.739
        cube(f"Cabinet_Door_{i:02d}", (x, 2.576, .47), (.733, .025, .71), m["oak"], .002)
        cube(f"Cabinet_Handle_{i:02d}", (x+.25, 2.548, .62), (.008, .022, .13), m["metal"], .003)
    for side in (-1, 1):
        x = side*3.69
        for j in (-1, 1):
            cube(f"Upper_Cabinet_{side}_{j}", (x+j*.39, 2.93, 2.14), (.775, .32, .97), m["oak"], .003)
            cube(f"Upper_Handle_{side}_{j}", (x+j*.08, 2.756, 1.95), (.009, .022, .16), m["metal"], .003)
        cube(f"Under_Cabinet_LED_{side}", (x, 2.87, 1.647), (1.49, .025, .008), m["led"])
        add_area_light(f"Under_Cabinet_Bounce_{side}", (x, 2.82, 1.63), 20, (1.4, .13), (1, .8, .57), (x, 2.72, .9))
        cube(f"Printer_{side}", (side*3.15, 2.7, 1.075), (.43, .33, .36), m["stone"], .023)
        cube(f"Printer_Top_{side}", (side*3.15, 2.69, 1.263), (.41, .31, .025), m["dark"], .009)
        cube(f"Printer_Slot_{side}", (side*3.15, 2.527, 1.05), (.28, .01, .043), m["dark"], .004)
        plant(f"Rear_Plant_{side}", side*4.05, 2.7, .9, .63, m)
    cube("Screen_Main_Frame", (-.35, 2.977, 2.0), (3.33, .09, 1.53), m["dark"], .025)
    screen("Screen_Main", -.35, 2.929, 2.0, 3.24, 1.44, m["screen"])
    # A round clock is retained visually, with an independent display surface.
    cylinder("Clock_Frame", (2.13, 3.014, 2.28), .245, .05, m["metal"], 96, (math.pi/2, 0, 0))
    clock = cylinder("Clock_Display", (2.13, 2.983, 2.28), .224, .008, m["stone"], 96, (math.pi/2, 0, 0))
    clock["displayRole"] = "analog-clock"
    for i in range(12):
        angle = i*math.tau/12
        mark = cube(f"Preview_Clock_Tick_{i}", (2.13+.185*math.sin(angle), 2.974, 2.28+.185*math.cos(angle)), (.009, .006, .025), m["teal"], .001)
        mark.rotation_euler.y = angle
        PREVIEW.append(mark)
    for name, end in (("Hour", (2.045, 2.966, 2.365)), ("Minute", (2.245, 2.966, 2.215))):
        PREVIEW.append(tube(f"Preview_Clock_{name}", [(2.13, 2.966, 2.28), end], .008, m["teal"]))
    text("Wall_Motto", "精心  用心\n耐心  细心", (2.13, 3.048, 1.68), .105, m["teal"], "CENTER")


def dashboard_preview(m):
    x0, y = -1.85, 2.919
    text("Preview_Dashboard_Title", "病区动态", (x0, y, 2.59), .13, m["white"], preview=True)
    text("Preview_Dashboard_Status", "演示数据 · 待接入实时信息", (1.12, y, 2.6), .039, m["white"], "RIGHT", True)
    rows = (("住院患者", "32", "今日入院    3", "今日出院    2"),
            ("护理工作", "12", "待执行      2", "已完成     10"),
            ("重点关注", "5", "一级护理    2", "特别观察    3"))
    for i, (title, value, row1, row2) in enumerate(rows):
        x = -1.407 + i*1.058
        panel = cube(f"Preview_Dashboard_Card_{i}", (x, 2.916, 1.97), (1.008, .005, 1.0), m["ui"], .018)
        PREVIEW.append(panel)
        for j, (body, z, size) in enumerate(((title, 2.30, .10), (value, 2.06, .26), (row1, 1.81, .073), (row2, 1.63, .073))):
            text(f"Preview_Dashboard_{i}_{j}", body, (x, 2.905, z), size, m["blue"], "CENTER", True)
    text("Preview_Data_Footer", "护士站信息总览    /    屏幕内容由运行时更新", (-.35, y, 1.35), .035, m["white"], "CENTER", True)


def architecture(m):
    cube("地板", (0, 2, -.065), (16, 24, .12), m["floor"])
    slab("Floor_Inlay", rounded_path(9.65, 1.5, .6, -.22), -.004, .005, m["inlay"])
    cube("Ceiling", (0, 2, 3.39), (16, 24, .10), m["wall"])
    # Rounded canopy with a shallow upper reveal and a continuous inner light line.
    cap = rounded_path(9.7, 3.62, .58, -.22)
    slab("Station_Canopy", cap, 2.94, .37, m["stone"])
    tube("Canopy_Lower_LED", [(x, y, 2.93) for x, y in rounded_path(9.47, 3.38, .52, -.11)]+[(4.215, -.11, 2.93)], .011, m["led"])
    text("Station_Header", "护 士 站", (-2.55, -.236, 3.13), .36, m["teal"])
    text("Station_Header_Motto", "用专业守护生命  用温暖传递希望", (-.77, -.237, 3.12), .10, m["teal"])
    cube("Station_Header_Divider", (-.97, -.24, 3.12), (.007, .007, .20), m["teal"])
    for x in (-3.4, -1.7, 0, 1.7, 3.4):
        cylinder(f"Canopy_Downlight_{x}", (x, 1.2, 2.927), .047, .011, m["metal"])
        cylinder(f"Canopy_Downlight_Lens_{x}", (x, 1.2, 2.92), .035, .006, m["led"])
        add_area_light(f"Canopy_Light_{x}", (x, 1.45, 2.88), 35, (1.3, .6), (1, .92, .8), (x, 1.5, .3))
    for x in (-6.1, 6.1):
        for y in (-3, 0, 3, 6, 9):
            cube(f"Corridor_Light_{x}_{y}", (x, y, 3.33), (.055, 2.2, .012), m["led"], .003)
            add_area_light(f"Corridor_Lamp_{x}_{y}", (x, y, 3.29), 45, (.8, 1.9), (1, .96, .87), (x, y, 0))
        side = -1 if x < 0 else 1
        cube("墙壁" if side < 0 else "墙壁2", (side*7.6, 3, 1.66), (.18, 20, 3.32), m["wall"])
        for i, y in enumerate((1.6, 4.6, 7.6)):
            dx = side*7.48
            cube(f"Door_Frame_{side}_{i}", (dx, y, 1.18), (.09, 1.25, 2.36), m["metal"], .012)
            cube(f"Ward_Door_{side}_{i}", (dx-side*.052, y, 1.155), (.065, 1.16, 2.29), m["oak"], .006)
            cube(f"Door_Window_{side}_{i}", (dx-side*.089, y, 1.6), (.009, .33, .58), m["teal"], .005)
            tube(f"Door_Handle_{side}_{i}", [(dx-side*.13, y-.34, .96), (dx-side*.13, y-.14, .96)], .013, m["metal"])
        tube(f"Corridor_Handrail_{side}", [(side*7.33, -2, .86), (side*7.33, 11, .86)], .037, m["teal"])
        cube(f"Wayfinding_Sign_{side}", (x, 1.2, 2.7), (1.18, .07, .28), m["teal"], .012)
        text(f"Wayfinding_Text_{side}", "← 01–08 床" if side < 0 else "09–16 床 →", (x, 1.158, 2.7), .087, m["white"], "CENTER")
        for offset in (-.37, .37):
            cylinder(f"Wayfinding_Rod_{side}_{offset}", (x+offset, 1.2, 3), .009, .31, m["metal"])
        cube(f"End_Window_{side}", (x, 11, 1.72), (2.75, .08, 3.18), m["ui"])
        add_area_light(f"Window_Daylight_{side}", (x, 10.8, 2.0), 280, (2.7, 2.8), (.83, .92, 1), (x, 1, 1.0))
    for x in (-6, -3, 0, 3, 6):
        for y in (-3, 0, 3, 6):
            cube(f"Ceiling_Seam_{x}_{y}", (x, y, 3.333), (2.995, .004, .002), m["inlay"])
    for x in (-2.8, 2.8):
        cube(f"Air_Return_{x}", (x, -1.05, 3.328), (.83, .42, .012), m["metal"], .007)
        for i in range(15):
            cube(f"Air_Return_Slat_{x}_{i}", (x-.37+i*.053, -1.05, 3.315), (.018, .38, .014), m["wall"], .002)


def configure_camera(scene, name):
    camera = bpy.data.objects.get("Reference_Camera")
    if camera is None:
        camera = bpy.data.objects.new("Reference_Camera", bpy.data.cameras.new("Reference_Camera"))
        bpy.context.collection.objects.link(camera)
    views = {
        "front": ((-2.5, -9.5, 1.8), (0, 1.2, 1.65), 34),
        "detail": ((-4.5, -6.4, 1.8), (-.3, .7, 1.2), 39),
        "wall": ((-.35, -.1, 1.85), (-.35, 3, 1.95), 24),
    }
    location, target, lens = views[name]
    camera.location = location
    camera.data.lens = lens
    camera.data.clip_start = .05
    camera.data.clip_end = 100
    point_at(camera, target)
    scene.camera = camera


def export_and_validate(output, revision="v1"):
    for obj in SCREENS:
        assert obj.type == "MESH" and len(obj.data.polygons) == 1, obj.name
        assert obj.data.uv_layers.active is not None, obj.name
    bpy.ops.object.select_all(action="DESELECT")
    preview_set = set(PREVIEW)
    for obj in bpy.context.scene.objects:
        obj.select_set(obj.type in {"MESH", "CURVE", "FONT", "EMPTY"} and obj not in preview_set)
    bpy.ops.export_scene.gltf(filepath=str(output / f"nurse-station-design-{revision}.glb"),
        export_format="GLB", use_selection=True, export_apply=True, export_extras=True,
        export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
    bpy.ops.object.select_all(action="DESELECT")
    report = {"stage": "design-preview-not-production", "revision": revision, "blender": bpy.app.version_string,
        "units": "metres; provisional design dimensions, not a site survey",
        "counter": {"width": 9.23, "depth": 1.08, "height": 1.097},
        "screens": [{"name": o.name, "uv": "0-1", "aspect": o["displayAspect"]} for o in SCREENS],
        "clock": "Clock_Display is an independent round face; analog runtime binding still required",
        "preview_objects_excluded": len(PREVIEW),
        "objects": len(bpy.context.scene.objects),
        "runtime_status": "Not yet integrated; no live data or baked runtime lighting in this review export"}
    (output / "model-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    global FONT
    args_after = sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "output/nurse-station-reference-v1")
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--width", type=int, default=1920)
    parser.add_argument("--views", nargs="+", choices=("front", "detail", "wall"), default=["front"])
    parser.add_argument("--build-only", action="store_true")
    args = parser.parse_args(args_after)
    args.output = args.output.resolve()
    args.output.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    FONT = bpy.data.fonts.load("C:/Windows/Fonts/msyh.ttc")
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 3
    scene.render.resolution_x = args.width
    scene.render.resolution_y = round(args.width*9/16)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.world = bpy.data.worlds.new("Soft_Daylight")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.72, .8, 1, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .3
    m = materials(args.output)
    architecture(m)
    build_counter(m)
    build_backwall(m)
    build_workstations(m)
    dashboard_preview(m)
    # Consistent metre-based mapping keeps wall/cabinet wood grain vertical.
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or m["oak"] not in obj.data.materials[:]:
            continue
        if obj.name == "Nurse_Counter_Oak":
            continue
        uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
        for face in obj.data.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            for loop_index in face.loop_indices:
                p = obj.data.vertices[obj.data.loops[loop_index].vertex_index].co
                uv.data[loop_index].uv = (p.y if axis == 0 else p.x, p.y if axis == 2 else p.z)
    add_area_light("Front_Softbox", (-3, -5, 3.1), 850, (7, 3), (1, .95, .87), (0, 1, 1))
    add_area_light("Right_Window_Fill", (6.6, -1, 2.7), 380, (3, 2.5), (.85, .92, 1), (0, 1, 1))
    configure_camera(scene, "front")
    export_and_validate(args.output)
    bpy.ops.wm.save_as_mainfile(filepath=str(args.output / "nurse-station-design-v1.blend"))
    if not args.build_only:
        for name in args.views:
            configure_camera(scene, name)
            scene.render.filepath = str(args.output / f"{name}.png")
            bpy.ops.render.render(write_still=True)
    print(f"NURSE_STATION_DESIGN_COMPLETE {args.output}", flush=True)


if __name__ == "__main__":
    main()
