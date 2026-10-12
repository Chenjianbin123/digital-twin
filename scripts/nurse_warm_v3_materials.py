"""Small, glTF-compatible material refinements of the editable warm-v2 master.

Keep the original packed images, UVs and runtime surfaces intact. Wood variants
share their three source images; only two floor roughness images are derived.
"""

from pathlib import Path

import bpy
import numpy as np


_WOOD = {
    'counter': '#aa9577',
    'door': '#a18c6d',
    'column': '#a59173',
    'portal': '#97846a',
}
_FLOOR = {
    'floor': {'color': '#95a0a8', 'gain': 1.35, 'offset': .045, 'normal': .30},
    'floor_blue': {'color': '#507188', 'gain': 1.25, 'offset': .050, 'normal': .28},
}


def _shader(material):
    if not material.use_nodes:
        raise ValueError(f'Expected node-based PBR material: {material.name}')
    shader = material.node_tree.nodes.get('Principled BSDF')
    if shader is None:
        raise ValueError(f'Missing Principled BSDF: {material.name}')
    return shader


def _texture(material, socket_name):
    socket = _shader(material).inputs[socket_name]
    if not socket.is_linked or len(socket.links) != 1:
        raise ValueError(f'Expected one texture connection: {material.name}/{socket_name}')
    node = socket.links[0].from_node
    if socket_name == 'Normal':
        if node.type != 'NORMAL_MAP' or not node.inputs['Color'].is_linked:
            raise ValueError(f'Expected a normal-map node: {material.name}')
        node = node.inputs['Color'].links[0].from_node
    if node.type != 'TEX_IMAGE' or node.image is None:
        raise ValueError(f'Expected the unrefined v2 image node: {material.name}/{socket_name}')
    # Packed images load lazily after opening a .blend. Reading size requests
    # the packed buffer; checking has_data first can reject a valid image.
    width, height = node.image.size
    if min(width, height) <= 0 or not node.image.has_data:
        raise ValueError(f'Missing source image pixels: {node.image.name}')
    if node.image.packed_file is None and not node.image.packed_files:
        raise ValueError(f'Source image must already be packed: {node.image.name}')
    return node


def _color_factor(h, material, color, source_rgb):
    target = h.linear(color)
    factor = tuple(target[i] / source_rgb[i] for i in range(3))
    # Blender stores diffuse colors as float32; an unchanged channel may divide
    # to 1 + a few ulps. Reject real brightening, then clamp only roundoff.
    if not all(0 < value <= 1 + 1e-6 for value in factor):
        raise ValueError(f'Color factor exceeds the glTF 0..1 range: {material.name}/{factor}')
    factor = tuple(min(1.0, value) for value in factor)
    shader = _shader(material)
    socket = shader.inputs['Base Color']
    old_link = socket.links[0]
    source_socket = old_link.from_socket
    nodes, links = material.node_tree.nodes, material.node_tree.links
    # Blender 4.5's glTF exporter explicitly recognizes this Mix node pattern.
    # A linked socket's default_value, or the legacy MixRGB node, is not enough.
    mix = nodes.new('ShaderNodeMix')
    mix.name = 'WarmV3_BaseColorFactor'
    mix.label = 'glTF baseColorFactor — shared original wood/stone image'
    mix.data_type = 'RGBA'
    mix.blend_type = 'MULTIPLY'
    mix.clamp_factor = True
    mix.clamp_result = False
    mix.inputs[0].default_value = 1.0
    mix.inputs[7].default_value = (*factor, 1)
    links.remove(old_link)
    links.new(source_socket, mix.inputs[6])
    links.new(mix.outputs[2], socket)
    material.diffuse_color = (*target, 1)
    socket.default_value = (*target, 1)
    return [round(value, 7) for value in factor] + [1.0]


def _opaque_dielectric(material):
    shader = _shader(material)
    for name in ('Alpha', 'Metallic', 'Transmission Weight'):
        if shader.inputs[name].is_linked:
            raise ValueError(f'Unexpected non-opaque v2 material input: {material.name}/{name}')
    shader.inputs['Alpha'].default_value = 1
    shader.inputs['Metallic'].default_value = 0
    shader.inputs['Transmission Weight'].default_value = 0


def _wood_role(name):
    if name.startswith('Door_') and any(part in name for part in
            ('_RearStile', '_HandleStile', '_LowerLeaf', '_UpperLeaf')):
        return 'door'
    if name.startswith('V2_LeftDoor_Leaf'):
        return 'door'
    if name.startswith(('Station_BackgroundOakPier', 'LeftCorridor_InnerOakPier')):
        return 'column'
    if ((name.startswith('Door_') and any(part in name for part in ('_OakJamb', '_OakLintel')))
            or (name.startswith('V2_RightDoor_') and any(part in name for part in ('_OuterOakJamb', '_OakTransom')))
            or name.startswith(('V2_LeftDoor_OakJamb', 'V2_LeftDoor_OakHeader'))):
        return 'portal'
    return None


def _floor_roughness(material, key, settings, output_dir):
    node = _texture(material, 'Roughness')
    source = node.image
    if source.colorspace_settings.name != 'Non-Color':
        raise ValueError(f'Roughness image must be Non-Color: {source.name}')
    width, height = source.size
    rgba = np.empty(width * height * 4, dtype=np.float32)
    source.pixels.foreach_get(rgba)
    rgba = rgba.reshape(height, width, 4)
    roughness = np.clip(rgba[:, :, 0] * settings['gain'] + settings['offset'], .18, .42)
    if not np.isfinite(roughness).all() or float(roughness.std()) <= .001:
        raise ValueError(f'Invalid or uniform source roughness: {source.name}')
    rgba[:, :, :3] = roughness[:, :, None]
    rgba[:, :, 3] = 1
    name = f'warm-v3-{key}-roughness'
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(output_dir / 'textures' / f'{name}.png')
    image.file_format = 'PNG'
    image.save()
    image.pack()
    node.image = image
    shader = _shader(material)
    shader.inputs['Roughness'].default_value = float(roughness.mean())
    shader.inputs['Normal'].links[0].from_node.inputs['Strength'].default_value = settings['normal']
    return {'material': material.name, 'sourceImage': source.name, 'image': image.name,
            'path': image.filepath_raw, 'size': [width, height], 'packed': image.packed_file is not None,
            'mean': float(roughness.mean()), 'min': float(roughness.min()),
            'max': float(roughness.max()), 'std': float(roughness.std()),
            'normalStrength': settings['normal']}


def _inventory(root):
    materials = {slot.material for obj in [root, *root.children_recursive]
                 for slot in obj.material_slots if slot.material is not None}
    images, bindings = set(), 0
    for material in materials:
        if not material.use_nodes:
            continue
        images.update(node.image for node in material.node_tree.nodes
                      if node.type == 'TEX_IMAGE' and node.image is not None)
        shader = material.node_tree.nodes.get('Principled BSDF')
        if shader:
            bindings += sum(shader.inputs[key].is_linked
                            for key in ('Base Color', 'Roughness', 'Metallic', 'Normal', 'Emission Color'))
    unpacked = sorted(image.name for image in images if image.packed_file is None and not image.packed_files)
    return {'materials': len(materials), 'images': len(images), 'textureBindings': bindings,
            'unpackedImages': unpacked}


def refine_materials(h, root, output_dir):
    """Refine only material assignments/graphs in the loaded working copy."""
    required = ('oak', 'floor', 'floor_blue')
    if root.get('warmV3MaterialRefinement'):
        raise ValueError('Warm-v3 material refinement has already been applied')
    if any(key not in h.M for key in required):
        raise ValueError('Initialize h.M from the editable warm-v2 master first')
    objects = [root, *root.children_recursive]
    screens = {obj.name: tuple(slot.material for slot in obj.material_slots)
               for obj in objects if obj.get('runtimeSurface')}
    protected = {material for slots in screens.values() for material in slots}
    if len(screens) != 13 or any(h.M[key] in protected for key in required):
        raise ValueError('Expected 13 independent, protected v2 runtime screens')
    for key in required:
        for socket in ('Base Color', 'Roughness', 'Normal'):
            _texture(h.M[key], socket)
    role_objects = {role: [] for role in ('door', 'column', 'portal')}
    for obj in objects:
        role = _wood_role(obj.name)
        if role and any(slot.material == h.M['oak'] for slot in obj.material_slots):
            role_objects[role].append(obj)
    if any(not selected for selected in role_objects.values()):
        raise ValueError('Expected editable door leaves, oak columns and portal meshes')
    for role in role_objects:
        if bpy.data.materials.get(f'WarmStationV3_oak_{role}') is not None:
            raise ValueError(f'Warm-v3 material already exists: {role}')
    output_dir = Path(output_dir).resolve()
    (output_dir / 'textures').mkdir(parents=True, exist_ok=True)
    before = _inventory(root)
    source_oak = h.M['oak']
    source_rgb = tuple(source_oak.diffuse_color[:3])
    variants = {'counter': source_oak}
    for role, selected in role_objects.items():
        material = source_oak.copy()
        material.name = f'WarmStationV3_oak_{role}'
        variants[role] = material
        h.M[f'v3_oak_{role}'] = material
        for obj in selected:
            # Linked mesh datablocks must not leak a door variant into another object.
            if obj.data.users > 1:
                obj.data = obj.data.copy()
            for slot in obj.material_slots:
                if slot.material == source_oak:
                    slot.material = material
    wood_report = {}
    for role, material in variants.items():
        _opaque_dielectric(material)
        factor = _color_factor(h, material, _WOOD[role], source_rgb)
        wood_report[role] = {'material': material.name, 'referenceColor': _WOOD[role],
                             'baseColorFactor': factor,
                             'assignedObjects': [obj.name for obj in role_objects.get(role, [])]}
    floor_report = []
    for key, settings in _FLOOR.items():
        material = h.M[key]
        _opaque_dielectric(material)
        factor = _color_factor(h, material, settings['color'], tuple(material.diffuse_color[:3]))
        entry = _floor_roughness(material, key, settings, output_dir)
        entry['baseColorFactor'] = factor
        floor_report.append(entry)
    if screens != {obj.name: tuple(slot.material for slot in obj.material_slots)
                   for obj in objects if obj.get('runtimeSurface')}:
        raise RuntimeError('Protected runtime screen materials changed')
    after = _inventory(root)
    if (after['materials'] > 48 or after['images'] > 40 or after['textureBindings'] > 64
            or after['unpackedImages']):
        raise RuntimeError(f'Warm-v3 material/packed-image budget violated: {after}')
    root['warmV3MaterialRefinement'] = True
    return {'wood': wood_report, 'floor': floor_report, 'inventoryBefore': before,
            'inventoryAfter': after, 'materialClones': 3, 'derivedImages': 2,
            'v2ImageFilesOverwritten': False, 'sourceImagesRetained': True,
            'runtimeScreensPreserved': len(screens), 'uvModified': False,
            'geometryAdded': 0, 'cameraAndLightsModified': False,
            'note': 'Existing manufactured door reveals are retained; no painted AO or fake black edge was added.'}
