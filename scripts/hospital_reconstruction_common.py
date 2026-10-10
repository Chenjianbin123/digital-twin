"""Blender-only geometry and rendering helpers for reference reconstruction.

Uses data meshes for repeated architecture: operators become expensive when every
window frame forces a scene dependency-graph update. No project assets are replaced.
"""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
M = {}
TAU = math.tau


def rgb(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels)


def material(name, color, rough=.45, metal=0, emission=0, noise=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb(color), 1)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = mat.diffuse_color
    shader.inputs['Roughness'].default_value = rough
    shader.inputs['Metallic'].default_value = metal
    if emission:
        shader.inputs['Emission Color'].default_value = mat.diffuse_color
        shader.inputs['Emission Strength'].default_value = emission
    if noise:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coordinates = nodes.new('ShaderNodeTexCoord')
        texture = nodes.new('ShaderNodeTexNoise')
        texture.inputs['Scale'].default_value = 180
        texture.inputs['Detail'].default_value = 2
        links.new(coordinates.outputs['Generated'], texture.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .16
        bump.inputs['Distance'].default_value = noise
        links.new(texture.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    M[name] = mat
    return mat


def object_mesh(name, vertices, faces, material_name=None, parent=None, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    if material_name:
        data.materials.append(M[material_name])
    obj.parent = parent
    for face in data.polygons:
        face.use_smooth = smooth
    return obj


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    return obj


def bevel(obj, width, segments=3):
    if width:
        # Weighted normals preserve broad flat surfaces; smoothing is also needed
        # on the bevel faces or rounded upholstery shows faceted highlights.
        for face in obj.data.polygons:
            face.use_smooth = True
        modifier = obj.modifiers.new('Physical edge radius', 'BEVEL')
        modifier.width = width
        modifier.segments = segments
        modifier.harden_normals = True
        modifier = obj.modifiers.new('Surface normals', 'WEIGHTED_NORMAL')
        modifier.keep_sharp = True
    return obj


def box(name, loc, size, mat, edge=.008, parent=None):
    x, y, z = (d / 2 for d in size)
    vertices = [(-x,-y,-z), (x,-y,-z), (x,y,-z), (-x,y,-z),
                (-x,-y,z), (x,-y,z), (x,y,z), (-x,y,z)]
    faces = [(0,3,2,1), (4,5,6,7), (0,1,5,4), (1,2,6,5), (2,3,7,6), (3,0,4,7)]
    obj = object_mesh(name, vertices, faces, mat, parent)
    obj.location = loc
    return bevel(obj, min(edge, min(size) * .45))


def cylinder(name, loc, radius, depth, mat, rotation=(0,0,0), parent=None, segments=32, edge=.0015):
    vertices = [(radius*math.cos(i*TAU/segments), radius*math.sin(i*TAU/segments), z)
                for z in [-depth/2, depth/2] for i in range(segments)]
    faces = [tuple(reversed(range(segments))), tuple(range(segments, 2*segments))]
    faces += [(i, (i+1)%segments, (i+1)%segments+segments, i+segments) for i in range(segments)]
    obj = object_mesh(name, vertices, faces, mat, parent)
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    obj.location = loc
    obj.rotation_euler = rotation
    return bevel(obj, edge, 2)


def bar(name, a, b, radius, mat, parent=None, segments=20):
    a, b = Vector(a), Vector(b)
    obj = cylinder(name, (a+b)/2, radius, (b-a).length, mat, parent=parent, segments=segments)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def beam(name, a, b, width, depth, mat, parent=None, edge=.012):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a+b)/2, (width,depth,(b-a).length), mat, edge, parent)
    obj.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return obj


def sphere(name, loc, scale, mat, parent=None, segments=20, rings=10):
    vertices = []
    for j in range(rings+1):
        phi = math.pi*j/rings
        for i in range(segments):
            theta = TAU*i/segments
            vertices.append((math.sin(phi)*math.cos(theta)*scale[0],
                             math.sin(phi)*math.sin(theta)*scale[1], math.cos(phi)*scale[2]))
    faces = [(j*segments+i, j*segments+(i+1)%segments, (j+1)*segments+(i+1)%segments, (j+1)*segments+i)
             for j in range(rings) for i in range(segments)]
    obj = object_mesh(name, vertices, faces, mat, parent, True)
    obj.location = loc
    return obj


def ring(name, loc, radius, thickness, mat, parent=None, rotation=(0,0,0), segments=48):
    vertices = []
    for i in range(segments):
        a = TAU*i/segments
        for j in range(8):
            b = TAU*j/8
            r = radius + thickness*math.cos(b)
            vertices.append((r*math.cos(a), r*math.sin(a), thickness*math.sin(b)))
    faces = [(i*8+j, ((i+1)%segments)*8+j, ((i+1)%segments)*8+(j+1)%8, i*8+(j+1)%8)
             for i in range(segments) for j in range(8)]
    obj = object_mesh(name, vertices, faces, mat, parent, True)
    obj.location = loc
    obj.rotation_euler = rotation
    return obj


def tube(name, points, radius, mat, parent=None):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 3
    spline = data.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point, xyz in zip(spline.points, points):
        point.co = (*xyz, 1)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(M[mat])
    obj.parent = parent
    return obj


def text(name, body, loc, size, mat, parent=None, rotation=(math.pi/2,0,0)):
    data = bpy.data.curves.new(name, 'FONT')
    data.body = body
    data.size = size
    data.align_x = 'CENTER'
    data.align_y = 'CENTER'
    data.extrude = .001
    data.font = bpy.data.fonts.get('Microsoft YaHei Regular') or bpy.data.fonts.load('C:/Windows/Fonts/msyh.ttc')
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    obj.parent = parent
    data.materials.append(M[mat])
    return obj


def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


def area(name, loc, target, power, size, color=(1,1,1), size_y=None):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.color = color
    data.shape = 'RECTANGLE'
    data.size = size
    data.size_y = size_y or size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    aim(obj,target)
    return obj


def setup(out, camera_loc, target, lens, width, samples):
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .04
    scene.cycles.max_bounces = 8
    scene.cycles.transparent_max_bounces = 8
    scene.render.resolution_x = width
    scene.render.resolution_y = round(width*941/1672)
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.film_transparent = False
    scene.render.filepath = str(out/'hero.png')
    data = bpy.data.cameras.new('Reference matching camera')
    data.lens = lens
    data.clip_end = 1500
    camera = bpy.data.objects.new('Reference_Hero_Camera',data)
    bpy.context.collection.objects.link(camera)
    camera.location = camera_loc
    aim(camera,target)
    scene.camera = camera
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                area.spaces.active.region_3d.view_perspective = 'CAMERA'
                area.spaces.active.shading.color_type = 'MATERIAL'
    return camera


def save(out, name, reference, metadata):
    """Pack reference and fonts so the native source can be moved to another PC."""
    out.mkdir(parents=True,exist_ok=True)
    image = bpy.data.images.load(str(reference), check_existing=True)
    image.name = 'REFERENCE - concept image, not a render'
    image.use_fake_user = True
    image.pack()
    bpy.context.scene['referenceImage'] = image.name
    bpy.context.scene['surveyedGeometry'] = False
    bpy.context.scene['referenceMatch'] = 'Manual reconstruction; no claim of pixel-perfect or surveyed accuracy'
    bpy.ops.file.pack_all()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')))
    report = {'blenderVersion':bpy.app.version_string,'source':str(out/(name+'.blend')),
              'reference':str(reference),'meshObjects':sum(o.type=='MESH' for o in bpy.context.scene.objects),
              'materials':len(bpy.data.materials),'surveyed':False, **metadata}
    (out/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('RECONSTRUCTION_SAVED '+json.dumps(report,ensure_ascii=False),flush=True)
