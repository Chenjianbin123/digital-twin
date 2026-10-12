"""Export-only contact AO for joined static graphite ward geometry.

Editable source objects and runtime display surfaces must not be passed here.
"""

import json
import math
from pathlib import Path

import bpy
import numpy as np


def _occlusion_socket(material):
    group = bpy.data.node_groups.get('glTF Material Output')
    if group is None:
        group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
        group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    node = material.node_tree.nodes.new('ShaderNodeGroup')
    node.node_tree = group
    return node.inputs['Occlusion']


def bake_contact_ao(obj, size, out, label):
    """Bake UV1 contact AO while retaining UV0 and all existing PBR images."""
    if obj is None or obj.type != 'MESH' or not obj.data.polygons:
        raise ValueError('Contact AO requires one non-empty joined static mesh')
    if 'Surface' in obj.name or obj.get('contentSource') == 'runtime-only':
        raise ValueError('Runtime display surfaces must never be AO baked')
    if not isinstance(size, int) or size < 1:
        raise ValueError('AO image size must be a positive integer')
    if not label or Path(label).name != label or '/' in label or '\\' in label:
        raise ValueError('AO label must be a filename stem, not a path')
    if any(slot.material is None or not slot.material.use_nodes for slot in obj.material_slots):
        raise ValueError('Every static mesh material must have a node tree')
    if not obj.material_slots:
        raise ValueError('Contact AO requires at least one material slot')
    mesh = obj.data
    if len(mesh.uv_layers) > 1:
        raise ValueError('Contact AO expects only UV0; an existing UV1 must be reviewed explicitly')
    scene = bpy.context.scene
    if scene.world is None:
        raise ValueError('Configure the scene world before baking contact AO')
    previous = {
        'engine': scene.render.engine,
        'samples': scene.cycles.samples,
        'distance': scene.world.light_settings.distance,
        'margin': scene.render.bake.margin,
        'clear': scene.render.bake.use_clear,
    }
    for selected in list(bpy.context.selected_objects):
        selected.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    if not mesh.uv_layers:
        mesh.uv_layers.new(name='UVMap')
    mesh.uv_layers[0].name = 'UVMap'
    mesh.uv_layers.new(name='AOMap')
    mesh.uv_layers.active_index = 1
    # AO belongs to this reusable assembly. Neighbouring beds, room shells and
    # preview-only graphics must not leave permanent silhouettes in its texture.
    render_visibility = [(other, other.hide_render) for other in scene.objects
                         if other.type in {'MESH', 'CURVE', 'FONT', 'SURFACE', 'META'}]
    try:
        for other, _ in render_visibility:
            other.hide_render = other != obj
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.003,
                                 area_weight=.5, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode='OBJECT')
        image = bpy.data.images.new(label, width=size, height=size, alpha=False)
        image.colorspace_settings.name = 'Non-Color'
        image.generated_color = (1, 1, 1, 1)
        copies = {}
        for slot in obj.material_slots:
            original = slot.material
            if original in copies:
                slot.material = copies[original]
                continue
            material = original.copy()
            material.name = original.name + '_AO'
            copies[original] = material
            slot.material = material
            nodes, links = material.node_tree.nodes, material.node_tree.links
            primary = nodes.new('ShaderNodeUVMap')
            primary.uv_map = 'UVMap'
            for node in list(nodes):
                if node.type == 'TEX_IMAGE':
                    links.new(primary.outputs['UV'], node.inputs['Vector'])
                elif node.type == 'NORMAL_MAP':
                    node.uv_map = 'UVMap'
            ao_uv = nodes.new('ShaderNodeUVMap')
            ao_uv.uv_map = 'AOMap'
            target = nodes.new('ShaderNodeTexImage')
            target.image = image
            links.new(ao_uv.outputs['UV'], target.inputs['Vector'])
            links.new(target.outputs['Color'], _occlusion_socket(material))
            nodes.active = target
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 16
        scene.world.light_settings.distance = .6
        scene.render.bake.margin = 6
        scene.render.bake.use_clear = True
        print(f'WARD_GRAPHITE_AO_START {label} {size}px', flush=True)
        bpy.ops.object.bake(type='AO')
        values = np.empty(size * size * 4, dtype=np.float32)
        image.pixels.foreach_get(values)
        red = values.reshape(-1, 4)[:, 0]
        stats = {'label': label, 'size': size, 'min': float(red.min()),
                 'max': float(red.max()), 'std': float(red.std()),
                 'variance': float(red.var())}
        # Match the established silver-station guard: .005 is a standard deviation.
        if not np.isfinite(red).all() or stats['std'] <= .005:
            raise RuntimeError(f'AO bake contains no useful contact shading: {stats}')
        texture_dir = Path(out) / 'textures'
        texture_dir.mkdir(parents=True, exist_ok=True)
        image.filepath_raw = str(texture_dir / (label + '.png'))
        image.file_format = 'PNG'
        image.save()
        image.pack()
        print('WARD_GRAPHITE_AO_DONE ' + json.dumps(stats), flush=True)
        return stats
    finally:
        for other, was_hidden in render_visibility:
            other.hide_render = was_hidden
        if obj.mode != 'OBJECT':
            bpy.ops.object.mode_set(mode='OBJECT')
        mesh.uv_layers.active_index = 0
        mesh.uv_layers[0].active_render = True
        scene.render.engine = previous['engine']
        scene.cycles.samples = previous['samples']
        scene.world.light_settings.distance = previous['distance']
        scene.render.bake.margin = previous['margin']
        scene.render.bake.use_clear = previous['clear']
