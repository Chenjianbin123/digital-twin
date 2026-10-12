"""Editable architectural refinements for the hospital exterior V2 scene."""
import math
import random

import bpy

import hospital_reconstruction_common as h


def remove(objects):
    for obj in list(objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def assign(obj, name):
    obj.data.materials.clear()
    obj.data.materials.append(h.M[name])


def finishes():
    h.M.update({m.name: m for m in bpy.data.materials})
    for name, color, rough, metal in [
        ('stone', '#ded8cd', .58, 0), ('limestone', '#c6c4ba', .68, 0),
        ('joint', '#929489', .80, 0), ('silver', '#8b979d', .25, .90),
        ('dark', '#303c42', .34, .65), ('asphalt', '#454b4c', .87, 0),
        ('grass', '#5c684a', .98, 0), ('leaf', '#465d2d', .72, 0),
        ('leaflight', '#768343', .75, 0), ('leafdark', '#30462b', .80, 0),
        ('signage', '#21515a', .39, .25), ('teal', '#356f70', .35, .4),
    ]:
        mat = h.M[name]
        shader = mat.node_tree.nodes.get('Principled BSDF')
        mat.diffuse_color = (*h.rgb(color), 1)
        shader.inputs['Base Color'].default_value = mat.diffuse_color
        shader.inputs['Roughness'].default_value = rough
        shader.inputs['Metallic'].default_value = metal
    for i in range(5):
        mat = h.M['glazing'+str(i)]
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.66+i*.018, .77+i*.012, .82+i*.01, 1)
        shader.inputs['Transmission Weight'].default_value = .92
        shader.inputs['Metallic'].default_value = .02
        shader.inputs['Roughness'].default_value = .075+i*.009
        shader.inputs['IOR'].default_value = 1.46
    for name in ['glass', 'glassdark']:
        shader = h.M[name].node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.77, .87, .91, 1)
        shader.inputs['Transmission Weight'].default_value = .96
        shader.inputs['Metallic'].default_value = .02
        shader.inputs['Roughness'].default_value = .045
    for name, color, rough, metal in [
        ('V2 interior plaster', '#c8c4b8', .84, 0),
        ('V2 interior cool', '#aab6b5', .86, 0),
        ('V2 interior deep', '#727b7c', .9, 0),
        ('V2 warm blind', '#c7bc9e', .89, 0),
        ('V2 linen', '#dedcd0', .89, 0),
        ('V2 interior oak', '#978265', .66, 0),
        ('V2 lobby terrazzo', '#8d9187', .44, 0),
        ('V2 seat', '#677b7a', .62, 0),
        ('V2 membrane', '#909992', .86, 0),
        ('V2 water', '#607b86', .19, .22),
        ('V2 marking', '#ded8c3', .85, 0),
        ('V2 figure navy', '#485866', .89, 0),
        ('V2 figure taupe', '#a29685', .91, 0),
        ('V2 figure pale', '#d2d0c7', .87, 0),
        ('V2 skin', '#b58f75', .83, 0),
    ]:
        h.material(name, color, rough, metal)
    h.material('V2 interior light', '#fff0cd', .35, 0, 2.5)
    # Use metre-scaled grain; the V1 generated-coordinate bump inflated stone pores.
    for name, scale, distance, strength in [('stone', 90, .0007, .18), ('limestone', 65, .001, .22),
                                               ('asphalt', 70, .0018, .35), ('V2 water', .4, .065, .14)]:
        mat = h.M[name]
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coordinates = nodes.new('ShaderNodeTexCoord')
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = 3
        links.new(coordinates.outputs['Object'], noise.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Distance'].default_value = distance
        bump.inputs['Strength'].default_value = strength
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs[0], nodes.get('Principled BSDF').inputs['Normal'])
    mat = h.M['paving']
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    coords = nodes.new('ShaderNodeTexCoord')
    brick = nodes.new('ShaderNodeTexBrick')
    brick.inputs['Scale'].default_value = 1
    brick.inputs['Brick Width'].default_value = 1.2
    brick.inputs['Row Height'].default_value = .6
    brick.inputs['Mortar Size'].default_value = .009
    brick.inputs['Color1'].default_value = (*h.rgb('#b6b8b1'), 1)
    brick.inputs['Color2'].default_value = (*h.rgb('#cbc9bf'), 1)
    brick.inputs['Mortar'].default_value = (*h.rgb('#979e99'), 1)
    links.new(coords.outputs['Object'], brick.inputs['Vector'])
    links.new(brick.outputs['Color'], nodes.get('Principled BSDF').inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Distance'].default_value = .006
    bump.inputs['Strength'].default_value = .20
    links.new(brick.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs[0], nodes.get('Principled BSDF').inputs['Normal'])


def tower_interiors():
    rng = random.Random(811)
    specs = [('Central_Inpatient_Tower', -4, 9, 40, 19, 10),
             ('West_Wing', -31, 7, 16, 19, 5), ('East_Wing', 27, 6, 17, 24, 7)]
    for name, x, y, w, depth, floors in specs:
        root = bpy.data.objects[name]
        remove(o for o in root.children if o.name.startswith('Tower structural mass'))
        h.box('V2 recessed building core', (x, y, 7.72+floors*3.15/2),
              (w-5.6, depth-5.6, floors*3.15-.1), 'V2 interior deep', .015, root)
        for floor in range(floors):
            h.box('V2 real floor plate', (x, y, 7.72+floor*3.15+.36),
                  (w-.10, depth-.10, .20), 'V2 interior plaster', .012, root)
        for facade in [o for o in root.children if o.type == 'EMPTY' and 'facade' in o.name]:
            remove(o for o in facade.children if o.name.startswith(('Recessed dark facade', 'Visible interior blind slat')))
            panes = [o for o in facade.children if o.name.startswith('Window insulated glazing')]
            for pane in panes:
                xx, _, zz = pane.location
                width = pane.dimensions.x
                floor_z = zz-1.765
                tone = rng.choice(['V2 interior plaster', 'V2 interior cool', 'V2 interior deep'])
                h.box('V2 room back wall', (xx, 1.90, zz), (width+.07, .08, 2.9), tone, 0, facade)
                h.box('V2 room partition', (xx+width/2+.03, .95, zz), (.07, 1.85, 2.85), tone, 0, facade)
                h.box('V2 opaque insulated spandrel', (xx, .0, floor_z+.29), (width+.09, .12, .58), 'spandrel', .005, facade)
                h.box('V2 recessed sash stile', (xx+width*.23, -.115, zz+.28), (.026, .04, 1.72), 'dark', .002, facade)
                h.box('V2 window drip flashing', (xx, -.26, floor_z+.70), (width+.05, .11, .025), 'silver', .002, facade)
                if rng.random() < .34:
                    drop = rng.uniform(.36, 1.55)
                    for j in range(max(2, round(drop/.09))):
                        h.box('V2 recessed blind slat', (xx, .055, floor_z+2.80-j*.09),
                              (width-.08, .046, .045), 'V2 warm blind' if rng.random()<.3 else 'V2 linen', 0, facade)
                elif rng.random() < .38:
                    for side in [-1, 1]:
                        h.box('V2 gathered privacy curtain', (xx+side*width*.35, .14, zz),
                              (width*.18, .10, 2.06), 'V2 linen', .027, facade)
                if rng.random() < .10:
                    h.box('V2 recessed interior luminaire', (xx, .9, floor_z+2.91),
                          (width*.50, .70, .025), 'V2 interior light', .006, facade)
    name = bpy.data.objects['Hospital name']
    name.data.body = '仁 和 医 院'
    name.data.size = 1.92
    name.location.z = 40.38
    name.data.extrude = .055
    backer = bpy.data.objects['Main tower sign backer']
    backer.location.z = 40.28
    backer.scale.x = .84
    backer.scale.z = .86
    # Taller fins at the centre tower's outer thirds reproduce the reference rhythm.
    root = bpy.data.objects['Central_Inpatient_Tower']
    for xx in [-21.6, -17.9, 9.9, 13.6]:
        h.box('V2 vertical limestone blade', (xx, -.81, 23.45), (.52, .45, 31.48), 'stone', .017, root)
        for zz in [7.72+i*1.05 for i in range(31)]:
            h.box('V2 stone blade bed joint', (xx, -1.039, zz), (.515, .003, .013), 'joint', 0, root)


def entry_and_podium():
    root = bpy.data.objects['Outpatient_Podium']
    remove(o for o in root.children if o.name.startswith(('Podium main body', 'Glazed lobby shadow', 'Entrance canopy dark infill', 'Entrance door portal')))
    h.box('V2 podium rear service core', (0, -.2, 4), (78.7, 7.6, 7.9), 'stone', .02, root)
    h.box('V2 lobby finished floor', (0, -10.5, .42), (78.6, 10.8, .30), 'V2 lobby terrazzo', .015, root)
    h.box('V2 podium ceiling underside', (0, -7, 7.82), (78.8, 17.7, .18), 'white', .018, root)
    for xx in [-35, -26, -17, -8, 8, 17, 26, 35]:
        h.box('V2 lobby structural column', (xx, -12, 4.16), (.48, .48, 7.34), 'V2 interior plaster', .028, root)
    h.box('V2 lobby back wall', (0, -5.6, 4.1), (34, .16, 7.15), 'V2 interior plaster', .01, root)
    h.box('V2 recessed lobby mezzanine slab', (0, -6.6, 3.94), (30, 4.0, .25), 'V2 interior plaster', .012, root)
    for xx in [-12, -6, 0, 6, 12]:
        h.box('V2 mezzanine balustrade pane', (xx, -8.63, 4.64), (5.94, .025, 1.05), 'glass', .002, root)
        h.bar('V2 mezzanine balustrade post', (xx-2.98, -8.66, 4.08), (xx-2.98, -8.66, 5.2), .025, 'silver', root)
    h.bar('V2 mezzanine handrail', (-15, -8.66, 5.21), (15, -8.66, 5.21), .027, 'silver', root)
    for xx in [-4.9, 0, 4.9]:
        for dx in [-1.96, 1.96]:
            h.box('V2 open entrance portal jamb', (xx+dx, -16.52, 2.11), (.14, .19, 3.48), 'dark', .012, root)
        h.box('V2 automatic door operator', (xx, -16.53, 3.89), (4.05, .24, .24), 'silver', .018, root)
        h.box('V2 automatic door threshold', (xx, -16.54, .52), (3.83, .23, .035), 'silver', .007, root)
    h.box('V2 registration reception desk', (0, -9.6, 1.12), (9, 1.15, 1.10), 'V2 interior oak', .07, root)
    h.box('V2 reception stone worktop', (0, -9.6, 1.70), (9.14, 1.29, .12), 'stone', .025, root)
    h.text('V2 interior wayfinding', '门 诊 服 务', (0, -5.71, 3.30), .59, 'signage', root)
    for side in [-1, 1]:
        for xx in [9.6, 12.8]:
            for yy in [-12.8, -10.3]:
                for i in range(3):
                    px = side*xx+(i-1)*.60
                    h.box('V2 waiting seat', (px, yy, 1.00), (.52, .52, .10), 'V2 seat', .055, root)
                    h.box('V2 waiting backrest', (px, yy+.22, 1.28), (.52, .09, .58), 'V2 seat', .06, root)
                    for dx in [-.18, .18]:
                        h.bar('V2 waiting chair leg', (px+dx, yy, .60), (px+dx, yy, .95), .027, 'silver', root)
    for xx in [-12, -6, 0, 6, 12]:
        h.box('V2 lobby linear ceiling light', (xx, -11.2, 7.70), (.11, 7.8, .035), 'V2 interior light', .006, root)
        # Match the visible fittings so glass reflects strips instead of a softbox.
        h.area('V2 warm lobby illumination', (xx*1.23, -11.2, 7.66),
               (xx*1.23, -11.2, .5), 240, .135, (1, .88, .68), 7.8)
    # Glazing is split at its actual structural supports, with seal and clamp detail.
    for i in range(16):
        xx = -15+i*2
        for j in range(4):
            yy = -16.73-j*1.75
            pane = h.box('V2 canopy laminated glass', (xx, yy, 5.205), (1.94, 1.69, .024), 'glass', .003, root)
            for dx in [-.83, .83]:
                h.box('V2 canopy pane pressure clamp', (xx+dx, yy, 5.236), (.13, .055, .024), 'silver', .003, root)
    for xx in [-5, 5]:
        h.box('V2 canopy intermediate column', (xx, -21.7, 2.67), (.17, .17, 5.08), 'steel', .01, root)
        h.box('V2 column base plate', (xx, -21.7, .19), (.36, .36, .04), 'silver', .006, root)
    for xx in [-15, -5, 5, 15]:
        for dy in [-.50, .50]:
            h.beam('V2 canopy column diagonal brace', (xx, -21.7, 4.55), (xx, -21.7+dy, 5.00), .065, .065, 'silver', root)
    for yy in [-17.60, -19.35, -21.10, -22.86]:
        h.box('V2 canopy sealing transom', (0, yy, 5.24), (32, .043, .025), 'dark', .003, root)
    sign = bpy.data.objects['Outpatient services sign']
    sign.data.size = 1.40
    sign.data.space_character = 1.08
    sign.location.y = -16.32
    for xx in [-13.8, 13.8]:
        h.box('V2 entry information totem', (xx, -17.1, 1.6), (.60, .19, 2.35), 'signage', .028, root)
        h.text('V2 entry totem heading', '门诊', (xx, -17.205, 2.22), .19, 'white', root)
        h.text('V2 entry totem level', '1F', (xx, -17.205, 1.76), .32, 'white', root)
        for j in range(4):
            h.box('V2 totem directory line', (xx, -17.206, 1.27-j*.16), (.39, .008, .026), 'white', .001, root)
    for xx in [-14, -7, 0, 7, 14]:
        h.box('V2 roof garden trough', (xx, -8.7, 8.52), (5.4, 2.1, .50), 'stone', .045, root)
        h.box('V2 roof garden soil', (xx, -8.7, 8.79), (5.12, 1.85, .07), 'soil', .018, root)
    for xx in range(-38, 39, 3):
        h.box('V2 terrace balustrade glass', (xx, -15.78, 8.92), (2.93, .017, 1.16), 'glass', .002, root)
        h.bar('V2 terrace railing post', (xx-1.48, -15.80, 8.33), (xx-1.48, -15.80, 9.55), .022, 'silver', root)
    h.bar('V2 terrace handrail', (-39.5, -15.8, 9.56), (39.5, -15.8, 9.56), .024, 'silver', root)
    return root
