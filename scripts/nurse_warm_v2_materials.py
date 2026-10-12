"""Reference-led material refinement for the editable warm-v2 nurse station.

Reuse the existing shader graph, keep runtime surfaces/UVs untouched, and save
new packed images only under the requested v2 output directory.
"""

import math
from pathlib import Path

import bpy
import numpy as np


_PALETTE = {
    'white': ('#d2d8db', .29), 'wall': ('#bcc3c7', .63),
    'oak': ('#aa977b', .42), 'floor': ('#98a4ae', .16),
    'floor_blue': ('#52758f', .18), 'blue': ('#294455', .48),
}

_FONT = {
    'A': ('01110', '10001', '10001', '11111', '10001', '10001', '10001'),
    'B': ('11110', '10001', '10001', '11110', '10001', '10001', '11110'),
    'C': ('01111', '10000', '10000', '10000', '10000', '10000', '01111'),
    'D': ('11110', '10001', '10001', '10001', '10001', '10001', '11110'),
    'E': ('11111', '10000', '10000', '11110', '10000', '10000', '11111'),
    'F': ('11111', '10000', '10000', '11110', '10000', '10000', '10000'),
    'G': ('01111', '10000', '10000', '10111', '10001', '10001', '01111'),
    'H': ('10001', '10001', '10001', '11111', '10001', '10001', '10001'),
    'I': ('11111', '00100', '00100', '00100', '00100', '00100', '11111'),
    'J': ('00111', '00010', '00010', '00010', '10010', '10010', '01100'),
    'K': ('10001', '10010', '10100', '11000', '10100', '10010', '10001'),
    'L': ('10000', '10000', '10000', '10000', '10000', '10000', '11111'),
    'M': ('10001', '11011', '10101', '10101', '10001', '10001', '10001'),
    'N': ('10001', '11001', '11001', '10101', '10011', '10011', '10001'),
    'O': ('01110', '10001', '10001', '10001', '10001', '10001', '01110'),
    'P': ('11110', '10001', '10001', '11110', '10000', '10000', '10000'),
    'Q': ('01110', '10001', '10001', '10001', '10101', '10010', '01101'),
    'R': ('11110', '10001', '10001', '11110', '10100', '10010', '10001'),
    'S': ('01111', '10000', '10000', '01110', '00001', '00001', '11110'),
    'T': ('11111', '00100', '00100', '00100', '00100', '00100', '00100'),
    'U': ('10001', '10001', '10001', '10001', '10001', '10001', '01110'),
    'V': ('10001', '10001', '10001', '10001', '10001', '01010', '00100'),
    'W': ('10001', '10001', '10001', '10101', '10101', '10101', '01010'),
    'X': ('10001', '10001', '01010', '00100', '01010', '10001', '10001'),
    'Y': ('10001', '10001', '01010', '00100', '00100', '00100', '00100'),
    'Z': ('11111', '00001', '00010', '00100', '01000', '10000', '11111'),
    '0': ('01110', '10001', '10011', '10101', '11001', '10001', '01110'),
    '1': ('00100', '01100', '00100', '00100', '00100', '00100', '01110'),
    '2': ('01110', '10001', '00001', '00010', '00100', '01000', '11111'),
    '3': ('11110', '00001', '00001', '01110', '00001', '00001', '11110'),
    '4': ('00010', '00110', '01010', '10010', '11111', '00010', '00010'),
    '5': ('11111', '10000', '10000', '11110', '00001', '00001', '11110'),
    '6': ('01110', '10000', '10000', '11110', '10001', '10001', '01110'),
    '7': ('11111', '00001', '00010', '00100', '01000', '01000', '01000'),
    '8': ('01110', '10001', '10001', '01110', '10001', '10001', '01110'),
    '9': ('01110', '10001', '10001', '01111', '00001', '00001', '01110'),
    '-': ('00000', '00000', '00000', '11111', '00000', '00000', '00000'),
    '/': ('00001', '00010', '00010', '00100', '01000', '01000', '10000'),
    ':': ('00000', '00100', '00100', '00000', '00100', '00100', '00000'),
    ' ': ('00000',) * 7,
}


def _rgb(hex_color):
    return np.array([int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)], dtype=np.float32)


def _smooth_noise(rng, size, grid_x, grid_y):
    """Periodic bilinear noise avoids obvious tile seams without new dependencies."""
    coarse = rng.random((grid_y, grid_x)).astype(np.float32)
    x = np.arange(size, dtype=np.float32) * grid_x / size
    y = np.arange(size, dtype=np.float32) * grid_y / size
    xi, yi = x.astype(np.int32), y.astype(np.int32)
    xf, yf = x - xi, y - yi
    xf, yf = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    top = coarse[yi[:, None], xi[None, :]] * (1 - xf)[None, :]
    top += coarse[yi[:, None], (xi + 1)[None, :] % grid_x] * xf[None, :]
    bottom = coarse[(yi + 1)[:, None] % grid_y, xi[None, :]] * (1 - xf)[None, :]
    bottom += coarse[(yi + 1)[:, None] % grid_y, (xi + 1)[None, :] % grid_x] * xf[None, :]
    return (top * (1 - yf)[:, None] + bottom * yf[:, None]).astype(np.float32) - .5


def _normal_map(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * .5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * .5
    normal = np.stack((-dx * strength, -dy * strength, np.ones_like(height)), axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return normal * .5 + .5


def _pbr_pixels(key, material, rng, size):
    y, x = np.mgrid[0:size, 0:size].astype(np.float32) / size
    fine = rng.normal(0, 1, (size, size)).astype(np.float32)
    broad = _smooth_noise(rng, size, 8, 8)
    base = np.asarray(material.diffuse_color[:3], dtype=np.float32)
    roughness = material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value
    if key == 'oak':
        warp = .006 * np.sin(math.tau * y) + .009 * _smooth_noise(rng, size, 5, 7)
        grain = .34 * _smooth_noise(rng, size, 37, 4)
        pores = np.zeros((size, size), dtype=np.float32)
        for _ in range(64):
            center, width = rng.random(), rng.uniform(.00035, .0016)
            wobble = .0014 * np.sin(math.tau * (y * rng.integers(1, 5)) + rng.uniform(0, math.tau))
            distance = np.abs((x + warp + wobble - center + .5) % 1 - .5)
            strength = rng.uniform(.18, .58)
            pores += np.exp(-np.square(distance / width)) * strength
        grain += -.20 * pores + .014 * fine
        color = np.clip(base * (1 + grain[:, :, None] * .40), 0, 1)
        rough = np.clip(roughness + grain * .075 + broad * .022, .30, .58)
        normal = _normal_map(grain, .48)
    elif key in {'floor', 'floor_blue'}:
        # Fine quartz aggregate with sparse wear marks, not a coarse noise/bump carpet.
        quartz = np.clip(fine, -1.8, 1.8) * .18
        quartz += _smooth_noise(rng, size, 170, 170) * .28
        scratches = np.zeros((size, size), dtype=np.float32)
        for _ in range(28):
            center_x, center_y = rng.random(2)
            width, length = rng.uniform(.00035, .00085), rng.uniform(.025, .12)
            dx = np.abs((x - center_x + .5) % 1 - .5)
            dy = np.abs((y - center_y + .5) % 1 - .5)
            scratches += np.exp(-np.square(dx / width) - np.square(dy / length)) * rng.uniform(.2, .6)
        variation = quartz * .045 + broad * .025 + scratches * .009
        color = np.clip(base * (1 + variation[:, :, None]), 0, 1)
        rough = np.clip(roughness + quartz * .022 + broad * .028 + scratches * .018, .10, .26)
        normal = _normal_map(quartz * .13 + scratches * .025, .32)
    else:
        # Keep the existing blue upholstery but replace its map in the same graph.
        weave = np.sin(x * math.tau * 220) * np.sin(y * math.tau * 220)
        grain = weave * .10 + fine * .025
        color = np.clip(base * (1 + grain[:, :, None] * .15), 0, 1)
        rough = np.clip(roughness + grain * .08, .75, .98)
        normal = _normal_map(grain, .50)
    return {'color': color, 'roughness': np.repeat(rough[:, :, None], 3, axis=2), 'normal': normal}


def _existing_texture(material, channel):
    shader = material.node_tree.nodes.get('Principled BSDF')
    socket_name = {'color': 'Base Color', 'roughness': 'Roughness', 'normal': 'Normal'}[channel]
    socket = shader.inputs[socket_name]
    if not socket.is_linked:
        raise ValueError(f'{material.name} has no existing {channel} texture connection')
    node = socket.links[0].from_node
    if channel == 'normal':
        if node.type != 'NORMAL_MAP' or not node.inputs['Color'].is_linked:
            raise ValueError(f'{material.name} normal map chain differs from the v1 contract')
        node = node.inputs['Color'].links[0].from_node
    if node.type != 'TEX_IMAGE':
        raise ValueError(f'{material.name} {channel} is not an image node')
    return node


def _image(out, name, pixels, color, encode_linear=False):
    height, width = pixels.shape[:2]
    rgba = np.ones((height, width, 4), dtype=np.float32)
    rgba[:, :, :3] = (np.where(pixels <= .0031308, pixels * 12.92,
                               1.055 * np.power(pixels, 1 / 2.4) - .055)
                       if encode_linear else pixels)
    if not np.isfinite(rgba).all():
        raise ValueError(f'Non-finite image pixels: {name}')
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    image.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
    image.pixels.foreach_set(rgba.ravel())
    image.filepath_raw = str(out / 'textures' / (name + '.png'))
    image.file_format = 'PNG'
    image.save()
    image.pack()
    return image


def _dashboard():
    """Draw explicit synthetic operational graphics; no patient-identifying data."""
    canvas = np.empty((576, 1024, 3), dtype=np.float32)
    canvas[:] = _rgb('#102733')

    def rect(x, y, width, height, color):
        canvas[max(y, 0):min(y + height, 576), max(x, 0):min(x + width, 1024)] = _rgb(color)

    def text(message, x, y, scale=2, color='#dcebf0'):
        for letter in message:
            if letter not in _FONT:
                raise ValueError(f'Unsupported synthetic dashboard glyph: {letter}')
            for row, bits in enumerate(_FONT[letter]):
                for column, bit in enumerate(bits):
                    if bit == '1':
                        rect(x + column * scale, y + row * scale, scale, scale, color)
            x += 6 * scale

    def line(points, color, thickness=2):
        for (ax, ay), (bx, by) in zip(points, points[1:]):
            steps = max(abs(bx - ax), abs(by - ay), 1)
            for step in range(steps + 1):
                t = step / steps
                rect(round(ax + (bx - ax) * t), round(ay + (by - ay) * t), thickness, thickness, color)

    rect(0, 0, 1024, 78, '#193746')
    rect(28, 22, 6, 31, '#67c5cb')
    text('WARD WORKSPACE', 49, 26, 3)
    rect(861, 20, 132, 37, '#8c7043')
    text('DEMO', 889, 27, 3, '#fff0d7')
    text('SYNTHETIC DATA - NOT LIVE', 31, 91, 2, '#93b2bf')
    for x, label, value, accent in [(30, 'BEDS', '24', '#74c9cf'), (275, 'OCCUPIED', '18', '#b7cfdb'),
                                     (520, 'AVAILABLE', '6', '#94bbaa'), (765, 'TASKS', '12', '#d3ba91')]:
        rect(x, 124, 228, 118, '#1a3947')
        rect(x, 124, 228, 3, accent)
        text(label, x + 16, 143, 2, '#9ab6c1')
        text(value, x + 17, 175, 7, accent)
    rect(30, 260, 552, 252, '#16323f')
    text('WORKLOAD TREND', 47, 279, 2, '#c7dce5')
    for y in (326, 366, 406, 446):
        rect(61, y, 492, 1, '#2a4855')
    for index, value in enumerate(['00', '04', '08', '12', '16', '20']):
        text(value, 63 + index * 92, 475, 2, '#7e9ea9')
    trend = [(67, 425), (116, 414), (166, 425), (215, 371), (265, 392),
             (313, 350), (363, 366), (412, 331), (461, 358), (515, 338), (548, 355)]
    line(trend, '#6ac5cf', 3)
    line([(x, y + 26 + index % 3 * 5) for index, (x, y) in enumerate(trend)], '#6f99ac', 2)
    rect(600, 260, 393, 252, '#16323f')
    text('NURSING TASKS', 620, 279, 2, '#c7dce5')
    for row, (label, value, color) in enumerate([('ROUND', .78, '#78bcc9'), ('REVIEW', .46, '#7fa6b9'),
                                              ('SUPPLY', .62, '#a4b5a5'), ('CHECK', .91, '#b2cbd6')]):
        y = 322 + row * 43
        text(label, 620, y, 2, '#9ab6c1')
        rect(725, y, 236, 15, '#284955')
        rect(725, y, round(236 * value), 15, color)
    rect(30, 532, 963, 1, '#31515e')
    text('DEMO DISPLAY / NO PATIENT DATA', 31, 547, 2, '#86a8b5')
    # Raster drawing uses top-left origin; Blender's image buffer starts at the bottom.
    return np.flipud(canvas).copy()


def _material_inventory(root):
    materials = set()
    for obj in [root, *root.children_recursive]:
        if obj.data is not None and hasattr(obj.data, 'materials'):
            materials.update(material for material in obj.data.materials if material is not None)
    images = set()
    bindings = 0
    for material in materials:
        if not material.use_nodes:
            continue
        images.update(node.image for node in material.node_tree.nodes if node.type == 'TEX_IMAGE' and node.image is not None)
        shader = material.node_tree.nodes.get('Principled BSDF')
        if shader:
            bindings += sum(shader.inputs[key].is_linked for key in ('Base Color', 'Roughness', 'Metallic', 'Normal', 'Emission Color'))
    return {'materials': len(materials), 'images': len(images), 'textureBindings': bindings}


def refine_materials(h, root, out):
    """Refine existing v1 shaders/images and return the auditable v2 report."""
    out = Path(out)
    texture_dir = out / 'textures'
    texture_dir.mkdir(parents=True, exist_ok=True)
    required = set(_PALETTE) | {'fabric'}
    missing = sorted(required - h.M.keys())
    if missing:
        raise ValueError(f'Missing v1 source materials: {missing}')
    nodes_before = {key: len(h.M[key].node_tree.nodes) for key in required}
    for key, (color, roughness) in _PALETTE.items():
        material = h.M[key]
        rgb = h.linear(color)
        material.diffuse_color = (*rgb, 1)
        shader = material.node_tree.nodes['Principled BSDF']
        shader.inputs['Base Color'].default_value = (*rgb, 1)
        shader.inputs['Roughness'].default_value = roughness
    rng = np.random.default_rng(10102026)
    replacements = []
    for key in ('oak', 'floor', 'floor_blue', 'fabric'):
        material = h.M[key]
        channels = _pbr_pixels(key, material, rng, 1024)
        for channel, pixels in channels.items():
            node = _existing_texture(material, channel)
            image = _image(out, f'warm-v2-{key}-{channel}', pixels,
                           color=channel == 'color', encode_linear=channel == 'color')
            node.image = image
            replacements.append({'material': material.name, 'channel': channel,
                                 'image': image.name, 'size': [1024, 1024],
                                 'path': image.filepath_raw, 'packed': image.packed_file is not None})
    screens = [obj for obj in root.children_recursive if obj.name == 'Screen_Main']
    if len(screens) != 1 or screens[0].type != 'MESH' or len(screens[0].data.materials) != 1:
        raise ValueError('One independent single-material Screen_Main is required')
    screen = screens[0]
    screen_material = screen.data.materials[0]
    for obj in root.children_recursive:
        if obj != screen and obj.data is not None and hasattr(obj.data, 'materials'):
            if screen_material in list(obj.data.materials):
                raise ValueError('Screen_Main material must not be shared with other geometry')
    screen_nodes_before = len(screen_material.node_tree.nodes)
    screen_texture = _existing_texture(screen_material, 'color')
    screen_image = _image(out, 'warm-v2-dashboard-demo', _dashboard(), color=True)
    screen_texture.image = screen_image
    screen['contentSource'] = 'synthetic DEMO dashboard; no patient data; replace at runtime'
    screen_material.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = .28
    for key, count in nodes_before.items():
        if len(h.M[key].node_tree.nodes) != count:
            raise RuntimeError(f'Shader node count changed unexpectedly for {key}')
    if len(screen_material.node_tree.nodes) != screen_nodes_before:
        raise RuntimeError('Main screen shader node count changed unexpectedly')
    inventory = _material_inventory(root)
    if inventory['materials'] > 48 or inventory['images'] > 40 or inventory['textureBindings'] > 64:
        raise RuntimeError(f'Warm-v2 material budget exceeded: {inventory}')
    return {'palette': {key: {'color': value[0], 'roughness': value[1]} for key, value in _PALETTE.items()},
            'replacedPbrImages': replacements, 'reusedPbrImageNodes': len(replacements),
            'dashboard': {'image': screen_image.name, 'size': [1024, 576],
                          'path': screen_image.filepath_raw, 'packed': screen_image.packed_file is not None,
                          'synthetic': True, 'uvModified': False},
            'inventory': inventory, 'shaderNodesAdded': 0, 'v1ImagesOverwritten': False}
