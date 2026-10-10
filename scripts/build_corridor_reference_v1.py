"""Reference-led corridor, Blender 4.5 LTS. All dimensions are design assumptions.

blender -b --python scripts/build_corridor_reference_v1.py -- --samples 48 --width 1664
The editable source and rendered sample contain a PREVIEW_ONLY collection. GLB
exports never include its illustrative room numbers or patient-like screen data.
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

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/corridor-reference-v1"
ASSET = ROOT / "public/models/hospital-corridor/corridor-reference-v1.glb"
STATIC = []
PREVIEW = []
MATS = {}
FONT = None
WIDTH, LENGTH, HEIGHT = 4.6, 22.6, 3.12
ENTRY = -3.5


def material(name, rgb, roughness=.5, metal=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1)
        bsdf.inputs["Emission Strength"].default_value = emission
    MATS[name] = mat
    return mat


def texture(mat, name, rgb):
    h, w = rgb.shape[:2]
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = np.clip(rgb, 0, 1)
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = str(OUT / "textures" / f"{name}.png")
    img.file_format = "PNG"
    img.save()
    img.pack()
    nodes = mat.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], nodes.get("Principled BSDF").inputs["Base Color"])


def register(obj, mat, dynamic=False, parent=None):
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    if not dynamic and not parent:
        STATIC.append(obj)
    return obj


def box(name, pos, size, mat, bevel=.008, dynamic=False, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Project in metres: long grain remains vertical on both sides of each door.
    for polygon in obj.data.polygons:
        normal = polygon.normal
        for li in polygon.loop_indices:
            p = obj.data.vertices[obj.data.loops[li].vertex_index].co
            u = p.y / 1.4 if abs(normal.x) > .5 else p.x / 1.4
            v = p.z / 2.3 if abs(normal.z) < .5 else p.y / 1.4
            obj.data.uv_layers.active.data[li].uv = (u + .5, v + .5)
    if bevel:
        mod = obj.modifiers.new("Manufactured edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod = obj.modifiers.new("Weighted panel normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
    return register(obj, mat, dynamic, parent)


def cylinder(name, pos, radius, depth, mat, direction=(0, 0, 1), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=depth, location=pos)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(direction).to_track_quat("Z", "Y").to_euler()
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return register(obj, mat, parent is not None, parent)


def group(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def face(name, pos, w, h, mat, direction, parent=None):
    # Local YZ plane becomes glTF XY after axis conversion. Screen UVs are also
    # re-oriented by the real runtime helper; never bake a mirrored template.
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(0, -w/2, -h/2), (0, w/2, -h/2),
                     (0, w/2, h/2), (0, -w/2, h/2)], [], [(0, 1, 2, 3)])
    mesh.update()
    uv = mesh.uv_layers.new(name="UVMap")
    for loop, coord in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        loop.uv = coord
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler.z = 0 if direction > 0 else math.pi
    obj["screenAspect"] = w / h
    obj["runtimeTemplateSurface"] = True
    return register(obj, mat, True, parent)


def text(name, body, pos, size, mat, side=None, preview=False):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.size = body, size
    curve.font = FONT
    curve.align_x, curve.align_y = "CENTER", "CENTER"
    curve.extrude = .0003
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (math.pi/2, 0, 0 if side is None else -side * math.pi/2)
    register(obj, mat, preview)
    if preview:
        PREVIEW.append(obj)
    return obj


def area_light(name, pos, target, power, color, sx, sy):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.color = power, color
    data.shape, data.size, data.size_y = "RECTANGLE", sx, sy
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    return obj


def oval_shell(name, cx, cy, rx, ry, z, height, mat):
    verts, faces = [], []
    for level in (z, z + height):
        for i in range(96):
            angle = 2 * math.pi * i / 96
            verts.append((cx + rx * math.cos(angle), cy + ry * math.sin(angle), level))
    for i in range(96):
        j = (i + 1) % 96
        faces.append((i, j, j+96, i+96))
    faces += [tuple(reversed(range(96))), tuple(range(96, 192))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    for polygon in mesh.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return register(obj, mat)


def build_materials():
    material("Ceramic warm white", (.79, .80, .78), .65)
    material("Impact panel pearl grey", (.57, .60, .59), .45)
    material("Brushed aluminium", (.50, .54, .55), .33, .7)
    material("Door pale ash", (.68, .64, .56), .5)
    material("Floor fine aggregate", (.60, .62, .62), .38)
    material("Graphite gaskets", (.045, .054, .057), .65)
    material("Satin clinical teal", (.13, .34, .38), .43, .12)
    material("Handrail ivory", (.85, .84, .79), .4)
    material("门口机周", (.12, .14, .15), .32, .4)
    material("门口机内", (.013, .045, .085), .4, 0, .15)
    material("Sign dark enamel", (.008, .018, .028), .78)
    material("Room identity surface", (.008, .018, .028), .78)
    material("Etched white type", (.76, .90, 1), .5, 0, .6)
    material("Linear warm diffuser", (1, .91, .75), .3, 0, 2)
    material("Linear neutral diffuser", (.91, .97, 1), .3, 0, 2)
    material("Door cyan status", (.20, .75, .72), .3, 0, 1.4)
    material("Glazing blue grey", (.14, .24, .26), .18, .18)
    material("Foliage", (.13, .29, .065), .7)
    material("Daylight beyond window", (.61, .78, .85), .6, 0, .65)
    rng = np.random.default_rng(191)
    rows, cols = np.mgrid[0:1024, 0:512]
    lines = rng.normal(0, 1, 512)
    grain = (lines[None, :] * .024 + np.sin(cols*.67 + np.sin(rows*.009)*1.3)*.012
             + rng.normal(0, .009, (1024, 512)))
    texture(MATS["Door pale ash"], "pale-ash-grain", np.array([.74, .71, .65])[None, None, :] + grain[:, :, None])
    fleck = rng.normal(0, .021, (512, 512))
    texture(MATS["Floor fine aggregate"], "fine-aggregate", np.array([.68, .70, .70])[None, None, :] + fleck[:, :, None])


def door_bay(side, bay):
    n = bay + 1 if side < 0 else bay + 6
    x, y = side * WIDTH / 2, 1.45 + bay * 3.72
    door = group(f"门{n}")
    door["slotIndex"], door["physicalRoomId"] = n, ""
    mat = MATS
    # Two leaves and real recessed glazing; no patient or room identity baked in.
    for a, b in [(-.72, -.38), (-.365, .72)]:
        if b < 0:
            box(f"Door_{n}_passive_leaf", (x+.035*side, y+(a+b)/2, 1.165), (.065, b-a, 2.31), mat["Door pale ash"], .004, parent=door)
        else:
            window_lo, window_hi = -.10, .13
            for lo, hi in [(a, window_lo), (window_hi, b)]:
                box(f"Door_{n}_stile", (x+.035*side, y+(lo+hi)/2, 1.165), (.065, hi-lo, 2.31), mat["Door pale ash"], .003, parent=door)
            for z, h in [(.51, .99), (2.14, .36)]:
                box(f"Door_{n}_rail", (x+.035*side, y+.015, z), (.065, .23, h), mat["Door pale ash"], .003, parent=door)
            box(f"Door_{n}_vision_glass", (x+.035*side, y+.015, 1.485), (.025, .22, .97), mat["Glazing blue grey"], .002, parent=door)
            for yy in (-.113, .143):
                box(f"Door_{n}_vision_bead", (x-.005*side, y+yy, 1.485), (.055, .025, 1.02), mat["Brushed aluminium"], .003, parent=door)
            for zz in (.978, 1.99):
                box(f"Door_{n}_vision_bead", (x-.005*side, y+.015, zz), (.055, .28, .025), mat["Brushed aluminium"], .003, parent=door)
        box(f"Door_{n}_kickplate", (x-.006*side, y+(a+b)/2, .16), (.025, b-a-.025, .30), mat["Brushed aluminium"], .003, parent=door)
    for yy in (-.775, .775):
        box(f"Door_{n}_jamb", (x-.023*side, y+yy, 1.20), (.15, .09, 2.40), mat["Brushed aluminium"], .006, parent=door)
    box(f"Door_{n}_head", (x-.023*side, y, 2.37), (.15, 1.64, .085), mat["Brushed aluminium"], .006, parent=door)
    box(f"Door_{n}_handle_plate", (x-.03*side, y-.29, .96), (.04, .075, .23), mat["Brushed aluminium"], .012, parent=door)
    cylinder(f"Door_{n}_handle_stem", (x-.085*side, y-.29, 1.01), .018, .10, mat["Brushed aluminium"], (1, 0, 0), door)
    cylinder(f"Door_{n}_lever", (x-.13*side, y-.205, 1.01), .018, .20, mat["Brushed aluminium"], (0, 1, 0), door)
    # Status lamp is a physical fitting, not a fabricated patient alarm state.
    box(f"Door_{n}_lamp_frame", (x-.045*side, y, 2.65), (.075, .30, .17), mat["Brushed aluminium"], .013)
    box(f"Door_{n}_lamp_diffuser", (x-.087*side, y, 2.65), (.018, .24, .11), mat["Door cyan status"], .008)
    device = group(f"门口机{n}")
    device["templateAspect"], device["bindingSlot"] = 9/16, n
    yy = y - 1.13
    box(f"Device_{n}_mount", (x-.05*side, yy, 1.40), (.08, .29, .49), mat["Brushed aluminium"], .016, parent=device)
    box(f"Device_{n}_bezel", (x-.095*side, yy, 1.40), (.024, .267, .465), mat["门口机周"], .010, parent=device)
    face(f"DoorScreen_{n}", (x-.110*side, yy, 1.40), .225, .40, mat["门口机内"], -side, device)
    box(f"Device_{n}_underglow", (x-.065*side, yy, 1.15), (.04, .22, .009), mat["Linear warm diffuser"], .003, parent=device)
    box(f"Device_{n}_room_plate", (x-.022*side, yy, 1.845), (.04, .29, .19), mat["Sign dark enamel"], .008, parent=device)
    face(f"DoorLabel_{n}", (x-.044*side, yy, 1.845), .282, .176, mat["Room identity surface"], -side, device)
    text(f"Preview_room_{n}", str(300+n), (x-.047*side, yy, 1.845), .105, mat["Etched white type"], side, True)
    text(f"Preview_screen_heading_{n}", f"{300+n} 病房", (x-.113*side, yy, 1.53), .028, mat["Etched white type"], side, True)
    for row in range(3):
        ob = box(f"Preview_screen_row_{n}_{row}", (x-.113*side, yy, 1.45-row*.087), (.001, .173, .002), mat["Satin clinical teal"], 0, True)
        PREVIEW.append(ob)
        text(f"Preview_screen_sample_{n}_{row}", "—  —  —", (x-.115*side, yy, 1.42-row*.087), .02, mat["Etched white type"], side, True)


def architecture():
    m = MATS
    corridor_center, span = (LENGTH+ENTRY)/2, LENGTH-ENTRY
    box("地板", (0, corridor_center, -.065), (WIDTH+.46, span+.4, .13), m["Floor fine aggregate"], .012, True)
    box("天花板", (0, corridor_center, HEIGHT+.07), (WIDTH+.4, span+.3, .14), m["Ceramic warm white"], .005, True)
    # Thin continuous outer shells define the runtime camera volume; inner panels
    # are separate editable pieces with genuine openings for all ten doors.
    for side in (-1, 1):
        x = side*WIDTH/2
        box("墙壁" if side < 0 else "墙壁2", (x+side*.19, corridor_center, HEIGHT/2), (.1, span, HEIGHT), m["Ceramic warm white"], .004, True)
        segments, cursor = [], ENTRY
        for bay in range(5):
            y = 1.45+bay*3.72
            segments.append((cursor, y-.82))
            cursor = y+.82
            box(f"Lintel_{side}_{bay}", (x+side*.09, y, (2.43+HEIGHT)/2), (.18, 1.64, HEIGHT-2.43), m["Ceramic warm white"], .004)
            door_bay(side, bay)
        segments.append((cursor, LENGTH))
        for i, (start, end) in enumerate(segments):
            center, length = (start+end)/2, end-start
            box(f"Wall_upper_{side}_{i}", (x+.085*side, center, 2.09), (.17, length-.006, 2.06), m["Ceramic warm white"], .004)
            box(f"Wall_lower_{side}_{i}", (x+.07*side, center, .53), (.19, length-.006, 1.05), m["Impact panel pearl grey"], .004)
            box(f"Skirting_{side}_{i}", (x-.033*side, center, .055), (.035, length-.006, .11), m["Brushed aluminium"], .003)
            box(f"Protection_rail_{side}_{i}", (x-.092*side, center, .965), (.13, max(.1, length-.10), .155), m["Handrail ivory"], .045)
            box(f"Rail_teal_inlay_{side}_{i}", (x-.161*side, center, .965), (.011, max(.07, length-.19), .055), m["Satin clinical teal"], .014)
            if length > 1.5:
                box(f"Wall_silver_reveal_{side}_{i}", (x-.01*side, center+.30, HEIGHT/2), (.033, .05, HEIGHT-.025), m["Brushed aluminium"], .006)
        box(f"Floor_border_{side}", (x-.14*side, corridor_center, .002), (.018, span, .004), m["Brushed aluminium"], .001)
    for i in range(19):
        y = .60+i*1.18
        box(f"Ceiling_module_reveal_{i}", (0, y, HEIGHT-.004), (WIDTH-.04, .008, .012), m["Brushed aluminium"], .001)
    for side in (-1, 1):
        x = side*1.46
        box(f"Ceiling_teal_line_{side}", (x, corridor_center, HEIGHT-.016), (.05, span-.10, .019), m["Satin clinical teal"], .003)
        for i in range(9):
            y = .95+i*2.42
            box(f"Light_recess_{side}_{i}", (x-side*.115, y, HEIGHT-.021), (.19, 1.50, .031), m["Brushed aluminium"], .004)
            box(f"Light_diffuser_{side}_{i}", (x-side*.115, y, HEIGHT-.04), (.145, 1.44, .016), m["Linear neutral diffuser"], .004)
    for i, y in enumerate((3.9, 8.8, 13.7, 18.6)):
        box(f"Vent_frame_{i}", (0, y, HEIGHT-.023), (1.62, .25, .045), m["Brushed aluminium"], .005)
        for j in range(6):
            box(f"Vent_slot_{i}_{j}", (0, y-.095+j*.037, HEIGHT-.048), (1.50, .015, .012), m["Graphite gaskets"], .001)
        cylinder(f"Smoke_detector_{i}", (.35, y-1.05, HEIGHT-.035), .059, .065, m["Ceramic warm white"])
        cylinder(f"Detector_lens_{i}", (.35, y-1.05, HEIGHT-.071), .025, .009, m["Impact panel pearl grey"])
    # Hanging directional sign remains static; ward content uses separate screens.
    for x in (-.85, .85):
        cylinder("Sign_suspension", (x, 5.9, 2.935), .016, .37, m["Graphite gaskets"])
    box("Wayfinding_rim", (0, 5.9, 2.56), (2.06, .10, .47), m["Brushed aluminium"], .04)
    box("Wayfinding_panel", (0, 5.842, 2.56), (2.015, .021, .425), m["Sign dark enamel"], .03)
    text("Direction_wards", "← 病房", (-.51, 5.827, 2.56), .17, m["Etched white type"])
    text("Direction_station", "护士站 ↑", (.48, 5.827, 2.56), .17, m["Etched white type"])
    box("Direction_divider", (0, 5.825, 2.56), (.005, .003, .23), m["Etched white type"], .001)


def destination():
    m = MATS
    cx, cy = .82, 19.25
    oval_shell("Station_counter_body", cx, cy, 1.40, .70, .08, .90, m["Brushed aluminium"])
    oval_shell("Station_counter_toe", cx, cy, 1.36, .67, .045, .04, m["Linear warm diffuser"])
    oval_shell("Station_counter_trim", cx, cy, 1.405, .705, .80, .04, m["Satin clinical teal"])
    oval_shell("Station_counter_top", cx, cy, 1.44, .74, .98, .065, m["Handrail ivory"])
    oval_shell("Station_canopy", cx, cy, 1.50, .82, 2.38, .40, m["Brushed aluminium"])
    oval_shell("Station_canopy_crown", cx, cy, 1.50, .82, 2.79, .023, m["Linear warm diffuser"])
    oval_shell("Station_canopy_underlight", cx, cy, 1.40, .75, 2.36, .02, m["Linear warm diffuser"])
    text("Station_identity", "护 士 站", (cx, cy-.834, 2.58), .20, m["Etched white type"])
    for x in (.10, 1.30):
        box("Desktop_monitor", (x, cy, 1.235), (.37, .065, .25), m["Graphite gaskets"], .012)
        box("Monitor_stem", (x, cy, 1.095), (.04, .04, .10), m["Brushed aluminium"], .007)
    box("Rear_wall_header", (0, LENGTH+.08, 2.9), (WIDTH+.30, .16, .44), m["Ceramic warm white"])
    box("Daylight", (0, LENGTH+.12, 1.36), (WIDTH-.08, .05, 2.70), m["Daylight beyond window"], .001)
    for x in (-2.22, -.80, .62, 2.20):
        box("Window_mullion", (x, LENGTH-.015, 1.36), (.035, .095, 2.70), m["Brushed aluminium"], .003)
    for z in (.10, .95, 2.69):
        box("Window_transom", (0, LENGTH-.02, z), (WIDTH-.08, .095, .035), m["Brushed aluminium"], .003)
    for i in range(12):
        box("Blind_louvre", (0, LENGTH-.07, 2.23+i*.037), (WIDTH-.08, .055, .018), m["Handrail ivory"], .002)
    # A compact pair of wall displays keeps the existing area/clock display API.
    for i, y in enumerate((19.10, 20.45), 1):
        device = group(f"CorridorDisplayHousing_{i}")
        box(f"Wall_display_frame_{i}", (-2.25, y, 1.9), (.09, 1.05, .62), m["门口机周"], .018, parent=device)
        face(f"走廊屏{i}", (-2.198, y, 1.9), .96, .54, m["门口机内"], 1, device)
    cylinder("Planter", (-.96, 20.18, .60), .16, .31, m["Handrail ivory"])
    rng = np.random.default_rng(44)
    for i in range(19):
        base = Vector((-.96, 20.18, .75))
        end = base + Vector((rng.uniform(-.20, .20), rng.uniform(-.20, .20), rng.uniform(.13, .40)))
        cylinder("Plant_stem", (base+end)/2, .0025, (end-base).length, m["Foliage"], end-base)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=end)
        obj = bpy.context.object
        obj.name = "Plant_leaf"
        obj.scale = (.045, .115, .009)
        obj.rotation_euler = (rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0, 6.28))
        register(obj, m["Foliage"])


def setup_render(width, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.render.resolution_x, scene.render.resolution_y = width, round(width*941/1672)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (.25, .25, .25)
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.80, .87, 1, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .28
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.view_settings.exposure = -.45
    for y in (1.0, 4.6, 8.2, 11.8, 15.4, 19.0, 21.8):
        area_light("Ceiling_softbox", (0, y, 3.03), (0, y, 0), 105, (1, .95, .88), 2.2, 1.8)
    area_light("Rear_daylight", (0, LENGTH-.10, 1.8), (0, 9, 1.3), 220, (.77, .90, 1), 4.2, 2.4)
    area_light("Entrance_fill", (0, -1.2, 2.5), (0, 4, 1.4), 150, (.88, .94, 1), 4.4, 2)
    camera = bpy.data.objects.new("Camera_reference", bpy.data.cameras.new("Reference 24mm"))
    bpy.context.collection.objects.link(camera)
    camera.location = (-.15, -3.25, 1.65)
    camera.rotation_euler = (Vector((.25, 15, 1.59))-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens, camera.data.clip_end = 24, 100
    scene.camera = camera
    scene.render.filepath = str(OUT / "corridor-reference-v1.png")


def export_runtime():
    # Source stays split and editable. Only this transient export copy is merged.
    bpy.ops.object.select_all(action="DESELECT")
    for obj in STATIC:
        if obj.type == "FONT":
            obj.select_set(True)
    if bpy.context.selected_objects:
        bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
        bpy.ops.object.convert(target="MESH")
    for obj in STATIC:
        if obj.type == "MESH":
            bpy.context.view_layer.objects.active = obj
            for mod in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=mod.name)
    grouped = {}
    for obj in STATIC:
        if obj.type == "MESH":
            grouped.setdefault(obj.data.materials[0].name, []).append(obj)
    for name, objects in grouped.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        objects[0].name = "Static_" + name
    for n in range(1, 11):
        # Door identity survives as its parent; merge its fittings, not other
        # doors or any of the template surfaces.
        door = bpy.data.objects[f"门{n}"]
        objects = [obj for obj in door.children if obj.type == "MESH"]
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            bpy.context.view_layer.objects.active = obj
            for mod in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = f"DoorAssembly_{n}"
    # Original entries of joined objects are invalid RNA references, so only
    # resolve survivors through the current scene instead of reusing that list.
    preview_names = {obj.name for obj in PREVIEW}
    root = group("CorridorReferenceV1")
    root["units"] = "metres"
    root["layoutKind"] = "schematic-not-surveyed"
    root["sourceReference"] = "ward-corridor-concept-v1.png"
    runtime = [obj for obj in bpy.context.scene.objects
               if obj.type in {"MESH", "EMPTY"} and obj != root and obj.name not in preview_names]
    for obj in runtime:
        if obj.parent is None:
            obj.parent = root
    # Existing AreaScene turns glTF by +90deg around Y. Compensate in the asset
    # so its final long axis is Z; this does not change the editable source view.
    root.rotation_euler.z = -math.pi/2
    bpy.context.view_layer.update()
    points = [obj.matrix_world @ Vector(corner) for obj in runtime if obj.type == "MESH" for corner in obj.bound_box]
    root.location.x -= (min(p.x for p in points)+max(p.x for p in points))/2
    root.location.y -= (min(p.y for p in points)+max(p.y for p in points))/2
    bpy.ops.object.select_all(action="DESELECT")
    for obj in runtime + [root]:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    ASSET.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(ASSET), export_format="GLB", use_selection=True,
                              export_apply=True, export_extras=True, export_cameras=False,
                              export_lights=False, export_image_format="AUTO", export_yup=True)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    for obj in runtime:
        if obj.type == "MESH":
            mesh = obj.evaluated_get(depsgraph).to_mesh()
            mesh.calc_loop_triangles()
            triangles += len(mesh.loop_triangles)
            obj.evaluated_get(depsgraph).to_mesh_clear()
    manifest = {"asset": str(ASSET.relative_to(ROOT)).replace("\\", "/"),
                "source": "output/corridor-reference-v1/corridor-reference-v1.blend",
                "dimensionsMetres": {"width": WIDTH, "length": LENGTH-ENTRY, "height": HEIGHT},
                "surveyed": False, "doorSlots": 10, "screenAspect": "9:16",
                "triangles": triangles, "meshObjects": sum(o.type == "MESH" for o in runtime),
                "bytes": ASSET.stat().st_size, "previewDataExported": False}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("CORRIDOR_EXPORT " + json.dumps(manifest, ensure_ascii=False))


def main():
    global FONT
    parser = argparse.ArgumentParser()
    parser.add_argument("--samples", type=int, default=48)
    parser.add_argument("--width", type=int, default=1664)
    parser.add_argument("--skip-render", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    (OUT / "textures").mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    FONT = bpy.data.fonts.load("C:/Windows/Fonts/msyh.ttc")
    bpy.context.scene.unit_settings.system = "METRIC"
    build_materials()
    architecture()
    destination()
    setup_render(args.width, args.samples)
    collection = bpy.data.collections.new("PREVIEW_ONLY — illustrative data, excluded from GLB")
    bpy.context.scene.collection.children.link(collection)
    for obj in PREVIEW:
        for owner in list(obj.users_collection):
            owner.objects.unlink(obj)
        collection.objects.link(obj)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "corridor-reference-v1.blend"))
    if not args.skip_render:
        bpy.ops.render.render(write_still=True)
    export_runtime()


if __name__ == "__main__":
    main()
