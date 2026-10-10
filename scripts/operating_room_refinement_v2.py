"""V2 equipment refinements. Blender geometry, never a painted-over render."""
import math
import random

import bpy
import numpy as np
from mathutils import Matrix, Vector

import hospital_reconstruction_common as h


def remove(objects):
    for obj in list(objects):
        bpy.data.objects.remove(obj, do_unlink=True)


def material_finish():
    h.M.update({m.name: m for m in bpy.data.materials})
    settings = {
        'white': ('#e4e5e4', .30, .04), 'wall': ('#bfc3c5', .30, .28),
        'silver': ('#b9bec3', .25, 1), 'steel': ('#d4d7dc', .19, 1),
        'padding': ('#242628', .34, 0), 'graphite': ('#25282b', .34, .12),
        'floor': ('#b1b6bd', .33, 0), 'teal': ('#48757b', .29, .20),
        'hose': ('#d1d6d8', .35, 0), 'drape': ('#6288a0', .87, 0),
    }
    for name, (color, rough, metal) in settings.items():
        mat = h.M[name]
        mat.diffuse_color = (*h.rgb(color), 1)
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = mat.diffuse_color
        shader.inputs['Roughness'].default_value = rough
        shader.inputs['Metallic'].default_value = metal
        if name in {'silver', 'steel'}:
            shader.inputs['Anisotropic'].default_value = .32
        if name == 'padding':
            shader.inputs['Coat Weight'].default_value = .035
            shader.inputs['Coat Roughness'].default_value = .34
    h.material('V2 dark steel', '#78818a', .25, 1)
    h.material('V2 polished reflector', '#eceef2', .075, 1)
    h.material('V2 black optical seal', '#121518', .26, 0)
    h.material('V2 label', '#d8dddf', .65)
    h.material('V2 label ink', '#344851', .55)
    h.material('V2 cobalt', '#356586', .28, .12)
    glass = h.M['glass'].node_tree.nodes.get('Principled BSDF')
    glass.inputs['Base Color'].default_value = (.94, .97, .99, 1)
    glass.inputs['Transmission Weight'].default_value = 1
    glass.inputs['Roughness'].default_value = .035
    glass.inputs['IOR'].default_value = 1.46
    h.material('V2 lens', '#f0f2f4', .045)
    lens = h.M['V2 lens'].node_tree.nodes.get('Principled BSDF')
    lens.inputs['Transmission Weight'].default_value = .92
    lens.inputs['IOR'].default_value = 1.49
    # Object coordinates keep grain at a physical scale across differently sized panels.
    for name, scale, distance, strength, lo, hi in [
        ('floor', 1100, .00055, .25, .29, .41),
        ('padding', 1700, .00015, .22, .40, .52),
        ('silver', 750, .000025, .13, .27, .34),
        ('steel', 850, .000015, .09, .23, .31),
    ]:
        mat = h.M[name]
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get('Principled BSDF')
        coordinates = nodes.new('ShaderNodeTexCoord')
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = scale
        noise.inputs['Detail'].default_value = 2
        links.new(coordinates.outputs['Object'], noise.inputs['Vector'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Distance'].default_value = distance
        bump.inputs['Strength'].default_value = strength
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
        ramp = nodes.new('ShaderNodeMapRange')
        ramp.inputs['To Min'].default_value = lo
        ramp.inputs['To Max'].default_value = hi
        links.new(noise.outputs['Fac'], ramp.inputs['Value'])
        links.new(ramp.outputs['Result'], shader.inputs['Roughness'])
        if name == 'floor':
            color = nodes.new('ShaderNodeValToRGB')
            color.color_ramp.elements[0].position = .22
            color.color_ramp.elements[0].color = (*h.rgb('#929ca7'), 1)
            color.color_ramp.elements[1].position = .78
            color.color_ramp.elements[1].color = (*h.rgb('#b8c0c8'), 1)
            links.new(noise.outputs['Fac'], color.inputs[0])
            links.new(color.outputs['Color'], shader.inputs['Base Color'])


def outline(w, length, radius, segments=10):
    result = []
    for cx, cy, start in [(w/2-radius, length/2-radius, 0),
                          (-w/2+radius, length/2-radius, 90),
                          (-w/2+radius, -length/2+radius, 180),
                          (w/2-radius, -length/2+radius, 270)]:
        for i in range(segments):
            angle = math.radians(start + 90*i/(segments-1))
            result.append((cx+radius*math.cos(angle), cy+radius*math.sin(angle)))
    return result


def cushion(name, center, width, length, parent):
    x, y, z = center
    boundary = outline(width, length, .046)
    levels = [(.93, -.048), (1, -.023), (1, .019), (.98, .039),
              (.91, .050), (.68, .058), (.31, .062)]
    n = len(boundary)
    vertices = [(px*s, py*s, dz) for s, dz in levels for px, py in boundary]
    faces = [tuple(reversed(range(n)))]
    for j in range(len(levels)-1):
        faces.extend((j*n+i, j*n+(i+1)%n, (j+1)*n+(i+1)%n, (j+1)*n+i) for i in range(n))
    faces.append(tuple(range((len(levels)-1)*n, len(levels)*n)))
    obj = h.object_mesh(name, vertices, faces, 'padding', parent, True)
    obj.location = center
    path = [(x+px*.997, y+py*.997, z-.023) for px, py in boundary]
    h.tube(name+' welded edge', path+[path[0]], .0017, 'graphite', parent)
    return obj


def lathe(name, profile, mat, parent, loc=(0, 0, 0), segments=48):
    vertices = [(r*math.cos(i*h.TAU/segments), r*math.sin(i*h.TAU/segments), z)
                for r, z in profile for i in range(segments)]
    faces = [(j*segments+i, j*segments+(i+1)%segments,
              (j+1)*segments+(i+1)%segments, (j+1)*segments+i)
             for j in range(len(profile)-1) for i in range(segments)]
    obj = h.object_mesh(name, vertices, faces, mat, parent, True)
    obj.location = loc
    return obj


def knurled_knob(name, loc, radius, length, parent, axis='Z'):
    root = h.empty(name, parent)
    h.cylinder(name+' body', (0, 0, 0), radius, length, 'graphite', parent=root, segments=48)
    for i in range(24):
        a = h.TAU*i/24
        h.bar('Machined grip flute', (radius*math.cos(a), radius*math.sin(a), -length*.35),
              (radius*math.cos(a), radius*math.sin(a), length*.35), .0012, 'V2 dark steel', root, 8)
    h.cylinder('Knob steel cap', (0, 0, length*.5), radius*.52, .003, 'steel', parent=root)
    root.location = loc
    if axis == 'X':
        root.rotation_euler.y = math.pi/2
    elif axis == 'Y':
        root.rotation_euler.x = math.pi/2
    return root


def refine_table():
    root = bpy.data.objects['Operating_Table']
    old = list(root.children_recursive)
    remove(o for o in old if any(tag in o.name for tag in
           ['seamless pad', 'cushion', 'Floor bumper', 'Stainless base casting', 'Base upper cover', 'Knurled locking knob']))
    x, y = .45, -.55
    for name, dy, length, width in [('Head', 1.13, .39, .60), ('Back', .65, .53, .63), ('Pelvis', .045, .62, .64)]:
        cushion(name+' contoured upholstery', (x, y+dy, 1.094), width, length, root)
    for side in [-1, 1]:
        cushion('Leg contoured upholstery', (x+side*.168, y-.70, 1.090), .312, .79, root)
    for obj in list(root.children_recursive):
        if obj.name.startswith('Hydraulic bellows'):
            obj.location.z += .135
        elif obj.name.startswith('Telescopic column'):
            obj.location.z = .49
            obj.scale.z = .84
        elif obj.name.startswith('Column foot'):
            obj.location.z = .29
    for name, z, dims, mat in [
        ('V2 low profile base bumper', .075, (.86, 1.38, .11), 'rubber'),
        ('V2 pressed stainless base', .171, (.85, 1.39, .16), 'steel'),
        ('V2 inset base top', .257, (.73, 1.25, .028), 'V2 dark steel'),
    ]:
        obj = h.box(name, (x, y, z), dims, mat, .065, root)
        obj.modifiers[0].segments = 6
    for side in [-1, 1]:
        for dy in [-.83, -.26, .40, .91]:
            xx = x+side*.379
            h.box('Quick release rail clamp', (xx, y+dy, .974), (.052, .083, .072), 'steel', .009, root)
            h.cylinder('Clamp spindle', (xx+side*.019, y+dy, .927), .009, .11, 'steel', parent=root)
            knurled_knob('Rail locking thumbwheel', (xx+side*.019, y+dy, .86), .023, .057, root)
            h.cylinder('Hex retaining screw', (xx+side*.029, y+dy, .978), .010, .007, 'V2 dark steel', (0, math.pi/2, 0), root, 6)
        for dy in [-.27, .59]:
            h.cylinder('Articulation outer bearing', (x+side*.33, y+dy, 1.006), .036, .024, 'V2 dark steel', (0, math.pi/2, 0), root, 48)
            h.cylinder('Articulation axle head', (x+side*.346, y+dy, 1.006), .019, .016, 'steel', (0, math.pi/2, 0), root, 48)
        h.beam('Deck longitudinal load beam', (x+side*.24, y-.90, .936), (x+side*.24, y+.94, .936), .031, .047, 'V2 dark steel', root, .006)
        h.bar('Tilt actuator rod', (x+side*.16, y, .83), (x+side*.16, y+.37, .97), .012, 'steel', root)
        h.bar('Tilt actuator housing', (x+side*.16, y-.19, .755), (x+side*.16, y+.16, .89), .025, 'silver', root)
    h.box('Table service badge', (x, y-.192, .48), (.15, .006, .042), 'V2 label', .003, root)
    h.text('Table service engraving', 'OR / 01', (x, y-.197, .48), .013, 'V2 label ink', root)
    # Scale around the table's floor contact, not the global scene origin.
    root.scale = (1.09, 1.09, 1)
    root.location = (-.82, .26, 0)
    bpy.context.view_layer.update()
    deck_scale = Matrix.Translation((x, y, 1)) @ Matrix.Diagonal((1.055, 1.19, 1, 1)) @ Matrix.Translation((-x, -y, -1))
    for obj in root.children:
        is_deck = obj.location.z > .84
        if obj.type == 'CURVE' and obj.data.splines:
            points = [p.co.z for spline in obj.data.splines for p in spline.points]
            is_deck = bool(points) and min(points) > .82
        if is_deck:
            obj.matrix_local = deck_scale @ obj.matrix_local
    return root


def rebuild_lights(parent):
    old = bpy.data.objects['Dual_Surgical_Lights']
    remove([*old.children_recursive, old])
    root = h.empty('Dual_Surgical_Lights', parent)
    mount = (-1.37, .85, 3.16)
    h.cylinder('Light ceiling flange', mount, .21, .10, 'white', parent=root, segments=64)
    h.cylinder('Coaxial suspension column', (-1.37, .85, 3.00), .082, .31, 'white', parent=root, segments=64)
    for z in [2.86, 2.95, 3.10]:
        h.ring('Column bearing seam', (-1.37, .85, z), .083, .0028, 'silver', root)
    for label, elbow, position, radius, normal in [
        ('Main', (-2.10, .40), (-1.38, -.30, 2.58), .480, (.04, -.67, -.74)),
        ('Secondary', (.20, 1.09), (.40, .57, 2.52), .365, (.04, -.63, -.77)),
    ]:
        lx, ly, lz = position
        h.beam(label+' horizontal boom', (-1.37, .85, 2.96), (*elbow, 2.96), .10, .084, 'white', root)
        h.cylinder(label+' articulated pivot', (*elbow, 2.89), .076, .25, 'white', parent=root, segments=64)
        h.ring('Boom joint collar', (*elbow, 2.78), .078, .003, 'silver', root)
        end = (lx-.03, ly+.16, 2.72)
        h.beam(label+' counterbalanced arm', (*elbow, 2.80), end, .079, .066, 'white', root)
        h.bar(label+' spring trim', (*elbow, 2.76), (end[0], end[1], end[2]-.035), .006, 'silver', root)
        head = h.empty(label+'_Optical_Head', root)
        head.location = position
        head.rotation_euler = Vector(normal).to_track_quat('Z', 'Y').to_euler()
        lathe('Sculpted lamp shell', [(0, -.079), (radius*.52, -.077), (radius*.91, -.055),
              (radius, -.016), (radius, .015), (radius*.972, .032)], 'white', head, segments=96)
        h.ring('Optical perimeter seal', (0, 0, .034), radius*.962, .009, 'V2 black optical seal', head, segments=96)
        h.cylinder('Polished lamp face', (0, 0, .028), radius*.94, .010, 'V2 dark steel', parent=head, segments=96)
        h.ring('Chrome outer reflector ring', (0, 0, .037), radius*.93, .006, 'steel', head, segments=96)
        for fraction, count in [(.28, 8), (.49, 14), (.69, 20), (.85, 24)]:
            for i in range(count):
                a = h.TAU*(i+.23)/count
                xx, yy = radius*fraction*math.cos(a), radius*fraction*math.sin(a)
                rr = radius*.069
                lathe('Parabolic LED reflector', [(rr*.25, .034), (rr*.44, .037),
                      (rr*.71, .045), (rr*.97, .057), (rr, .059)], 'V2 polished reflector', head, (xx, yy, 0), 24)
                h.cylinder('LED phosphor emitter', (xx, yy, .038), rr*.23, .003, 'light', parent=head, segments=16)
                h.sphere('Optical convex glass lens', (xx, yy, .054), (rr*.83, rr*.83, .005), 'V2 lens', head, 24, 10)
                h.ring('Individual lens retaining ring', (xx, yy, .059), rr, .0014, 'steel', head, segments=24)
        h.cylinder('Sterile handle mounting collar', (0, 0, .061), radius*.152, .042, 'V2 dark steel', parent=head, segments=64)
        h.ring('Sterile handle flange', (0, 0, .080), radius*.147, .004, 'steel', head)
        lathe('Ergonomic sterile grip', [(.024, .071), (.025, .085), (.017, .106),
              (.020, .185), (.027, .203), (.025, .211), (0, .211)], 'graphite', head)
        for side in [-1, 1]:
            points = [(side*(radius+.017)*math.cos(a), (radius+.017)*math.sin(a), -.025)
                      for a in [(-.65+j*.10) for j in range(14)]]
            h.tube('Lamp exterior aiming grip', points, .015, 'white', head)
        # The yoke terminates at the posed head's real local X-axis bearing points.
        rotation = head.rotation_euler.to_matrix()
        anchor_a = Vector(position)+rotation@Vector((radius+.018, 0, -.025))
        anchor_b = Vector(position)+rotation@Vector((-radius-.018, 0, -.025))
        rear = Vector(position)+rotation@Vector((0, 0, -.17))
        h.tube(label+' continuous supporting yoke', [anchor_a, rear+rotation@Vector((radius*.8, 0, 0)),
               rear+rotation@Vector((-radius*.8, 0, 0)), anchor_b], .023, 'white', root)
        h.bar(label+' terminal suspension', end, rear, .028, 'white', root)
        for p in [anchor_a, anchor_b]:
            h.sphere('Lamp yoke pivot cap', p, (.039, .039, .039), 'silver', root, 24, 12)
    return root


def refine_screens():
    # Authored standby graphic embedded in the Blender source, without external UI images.
    width_px, height_px = 768, 480
    yy, xx = np.mgrid[0:height_px, 0:width_px].astype(np.float32)
    xx /= width_px-1
    yy /= height_px-1
    pixels = np.ones((height_px, width_px, 4), dtype=np.float32)
    band = np.zeros_like(xx)
    for offset, intensity in [(0, .20), (.06, .08), (-.09, .05)]:
        center = .47+.13*np.sin(xx*6.0-2.3)+.14*xx+offset
        band += intensity*np.exp(-((yy-center)/.030)**2)
        band += intensity*.23*np.exp(-((yy-center+.06)/.11)**2)
    pixels[:, :, 0] = .009+band*.48
    pixels[:, :, 1] = .015+band*.64
    pixels[:, :, 2] = .025+band*.91
    image = bpy.data.images.new('V2 authored standby graphic', width=width_px, height=height_px)
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    image.use_fake_user = True
    mat = h.material('V2 diagnostic standby', '#102030', .24)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    texture = mat.node_tree.nodes.new('ShaderNodeTexImage')
    texture.image = image
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
    mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Emission Color'])
    shader.inputs['Emission Strength'].default_value = .55
    for root in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
        cases = [o for o in root.children if o.name.startswith('Display enclosure')]
        if not cases:
            continue
        case = cases[0]
        x, y, z = case.location
        width, _, height = case.dimensions
        remove(o for o in root.children if o.name.startswith(('Demonstration trace', 'Demo indicator', 'Display soft key', 'Standby abstract ribbon')))
        front = y-.047
        if root.name.startswith('Diagnostic_Display'):
            obj = h.object_mesh('Diagnostic standby image surface',
                [(x-width*.46, front, z-height*.445), (x+width*.46, front, z-height*.445),
                 (x+width*.46, front, z+height*.445), (x-width*.46, front, z+height*.445)],
                [(0, 1, 2, 3)], 'V2 diagnostic standby', root)
            uv = obj.data.uv_layers.new(name='Display UV')
            for loop, coord in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
                loop.uv = coord
            continue
        compact = width < .25
        if compact:
            h.text('Module state', 'READY', (x-width*.11, front, z+height*.07), height*.18, 'cyan', root)
            h.text('Module demo label', 'DEMO', (x-width*.12, front, z-height*.22), height*.11, 'silver', root)
            continue
        h.text('Monitor header', 'DEMO   /   OR 01', (x-width*.15, front, z+height*.38), height*.055, 'silver', root)
        for row, (label, value, color) in enumerate([('ECG', '72', 'green'), ('SpO2', '98', 'cyan'), ('CO2', '35', 'yellow')]):
            zz = z+height*(.21-row*.225)
            points = []
            for i in range(160):
                t = (i%43)/43
                if row == 0:
                    wave = .015*math.sin(t*h.TAU)-.14*math.exp(-((t-.36)/.022)**2)+.55*math.exp(-((t-.40)/.018)**2)-.23*math.exp(-((t-.44)/.023)**2)+.08*math.exp(-((t-.69)/.07)**2)
                elif row == 1:
                    wave = .13*math.sin(t*h.TAU)+.045*math.sin(t*2*h.TAU)
                else:
                    wave = .22*(1/(1+math.exp(-55*(t-.24)))-1/(1+math.exp(-50*(t-.74))))-.07
                points.append((x-width*.43+i*width*.59/159, front, zz+wave*height*.19))
            h.tube('Demo '+label+' trace', points, .0007, color, root)
            h.text('Demo numeric '+label, value, (x+width*.31, front, zz), height*.135, color, root)
            h.text('Channel label', label, (x+width*.30, front, zz+height*.09), height*.042, color, root)
        h.text('Screen bottom status', 'SIMULATION  /  NO PATIENT DATA', (x, front, z-height*.38), height*.040, 'silver', root)


def refine_anesthesia():
    root = bpy.data.objects['Anesthesia_Workstation']
    x, y = -1.1, 1.78
    remove(o for o in root.children if o.name.startswith(('Breathing circuit hose', 'Hose corrugation')))
    for i in range(2):
        points = [(x-.43+i*.09, y-.20, 1.44), (x-.54+i*.06, y-.24, 1.18),
                  (x-.66+i*.10, y-.31-i*.06, .69), (x-.65+i*.10, y-.35-i*.07, .48),
                  (x-.54+i*.06, y-.43-i*.06, .47), (x-.47+i*.045, y-.48-i*.045, .73),
                  (x-.48+i*.045, y-.47-i*.045, 1.32)]
        corrugated_hose('Continuous breathing hose', points, root)
        h.cylinder('Breathing hose terminal', points[-1], .026, .052, 'V2 cobalt', parent=root)
    h.tube('Breathing bag neck', [(x-.48, y-.47, 1.34), (x-.52, y-.40, 1.36),
           (x-.52, y-.20, 1.31), (x-.52, y-.20, 1.22)], .018, 'white', root)
    # Additional face seams, absorber, bellows and real joints break up the box silhouette.
    h.box('Anesthesia vertical service panel', (x-.283, y-.298, .65), (.060, .018, .67), 'silver', .006, root)
    h.box('Anesthesia blue base trim', (x, y-.337, .22), (.66, .028, .062), 'V2 cobalt', .012, root)
    for zz in [.32, .96]:
        for xx in [x-.275, x+.275]:
            h.cylinder('Service panel screw', (xx, y-.318, zz), .005, .004, 'steel', (math.pi/2, 0, 0), root, 12)
    h.box('Machine identity plate', (x, y-.320, .87), (.22, .003, .036), 'silver', .003, root)
    h.text('Anesthesia identity', 'ANESTHESIA / 01', (x, y-.324, .87), .011, 'V2 label ink', root)
    h.box('Flowmeter white housing', (x-.30, y-.108, 1.49), (.24, .13, .29), 'white', .011, root)
    for i in range(3):
        xx = x-.34+i*.073
        for tick in range(10):
            h.box('Flow calibration tick', (xx+.006, y-.184, 1.39+tick*.018), (.016 if tick%3==0 else .009, .001, .0013), 'V2 label ink', .0003, root)
        h.sphere('Flow indicator float', (xx, y-.163, 1.43+i*.035), (.010, .010, .009), 'V2 dark steel', root)
    for xx in [x-.40, x-.31]:
        h.cylinder('Breathing port collar', (xx, y-.17, 1.42), .031, .055, 'V2 cobalt', (math.pi/2, 0, 0), root)
    h.cylinder('CO2 absorber clear chamber', (x-.45, y+.055, 1.235), .081, .255, 'glass', parent=root, segments=48)
    h.cylinder('CO2 absorber granular fill', (x-.45, y+.055, 1.22), .072, .193, 'white', parent=root, segments=48)
    for zz in [1.105, 1.365]:
        h.cylinder('Absorber locking collar', (x-.45, y+.055, zz), .087, .027, 'silver', parent=root)
    h.cylinder('Ventilator clear bellows chamber', (x+.40, y+.17, 1.47), .091, .27, 'glass', parent=root, segments=48)
    for i in range(12):
        h.cylinder('Ventilator concertina bellows', (x+.40, y+.17, 1.355+i*.019), .073, .012, 'hose', parent=root, segments=48)
    h.cylinder('Bellows top lid', (x+.40, y+.17, 1.62), .098, .025, 'white', parent=root)
    h.tube('Scavenging blue tube', [(x-.49, y+.1, 1.12), (x-.63, y+.06, 1.02),
           (x-.66, y+.03, .59), (x-.58, y-.04, .53), (x-.52, y-.10, .75)], .010, 'V2 cobalt', root)
    h.tube('Monitor power cable', [(x-.1, y+.20, 1.87), (x+.09, y+.28, 1.67),
           (x+.20, y+.29, 1.10), (x+.27, y+.27, .57)], .004, 'graphite', root)
    h.bar('Anesthesia front push rail', (x-.35, y-.405, 1.05), (x+.35, y-.405, 1.05), .014, 'steel', root)
    for side in [-1, 1]:
        h.bar('Push rail support', (x+side*.34, y-.405, 1.05), (x+side*.34, y-.26, 1.05), .014, 'steel', root)


def refine_cart_and_room():
    root = bpy.data.objects['Foreground_Instrument_Cart']
    x, y = -2.8, -1.55
    remove(o for o in root.children_recursive if o.name.startswith(('Folded sterile drape', 'Instrument handle')))
    # A continuous cloth top with a hanging front edge; the folds are actual vertices.
    vertices = []
    nx, ny = 41, 45
    for j in range(ny):
        t = j/(ny-1)
        yy = y+.215-t*.61
        drop = max(0, t-.70)*.48
        for i in range(nx):
            xx = x+(i/(nx-1)-.5)*.73
            wave = (.002+drop*.09)*math.sin(i*.69+t*2.4)+.0015*math.cos(i*.27-t*8)
            vertices.append((xx, max(y-.292, yy), 1.058-drop+wave))
    faces = [(j*nx+i, j*nx+i+1, (j+1)*nx+i+1, (j+1)*nx+i) for j in range(ny-1) for i in range(nx-1)]
    cloth = h.object_mesh('Continuous folded sterile cloth', vertices, faces, 'drape', root, True)
    solid = cloth.modifiers.new('Cloth thickness', 'SOLIDIFY')
    solid.thickness = .0012
    for dx in [-.19, .15]:
        for i in range(3):
            xx = x+dx-.075+i*.072
            zz = 1.112
            h.ring('Forceps finger loop', (xx-.012, y-.071, zz), .013, .0022, 'steel', root, segments=24)
            h.ring('Forceps thumb loop', (xx+.012, y-.071, zz), .013, .0022, 'steel', root, segments=24)
            h.bar('Forceps blade', (xx-.008, y-.059, zz), (xx+.002, y+.09, zz+.003), .0024, 'steel', root, 12)
            h.bar('Forceps opposing blade', (xx+.008, y-.059, zz), (xx-.002, y+.09, zz+.003), .0024, 'steel', root, 12)
            h.cylinder('Forceps pivot rivet', (xx, y-.005, zz+.003), .003, .003, 'V2 dark steel', parent=root, segments=16)
    root.location = (-.90, 1.30, 0)
    # Make stored supplies legible, with deliberately varied contents instead of identical bottles.
    wall = bpy.data.objects['Integrated_Wall_Equipment']
    remove(o for o in wall.children if o.name.startswith(('Stock bottle', 'Bottle cap')))
    rng = random.Random(2031)
    for cy in [.18, 1.39, 2.60]:
        for row, z in enumerate([1.29, 1.70, 2.12, 2.55]):
            if row%2:
                for i in range(4):
                    yy = cy-.40+i*.255
                    ht = rng.uniform(.14, .20)
                    h.box('Sterile supply pack', (3.83, yy, z+ht/2+.012), (.25, .22, ht), 'white', .007, wall)
                    h.box('Supply blue label band', (3.697, yy, z+ht*.42), (.004, .20, .018), 'V2 cobalt', .001, wall)
            else:
                for i in range(5):
                    yy = cy-.41+i*.20
                    ht = rng.uniform(.17, .24)
                    lathe('Clear stock bottle', [(.0, .005), (.049, .005), (.050, ht*.72),
                          (.026, ht*.88), (.023, ht), (0, ht)], 'glass', wall, (3.80, yy, z+.018), 32)
                    h.cylinder('Stock cap V2', (3.80, yy, z+.025+ht), .025, .025, 'white', parent=wall)
                    h.box('Bottle paper label', (3.749, yy, z+ht*.47), (.003, .072, .073), 'V2 label', .001, wall)
                    h.box('Bottle label stripe', (3.746, yy, z+ht*.50), (.002, .061, .018), 'V2 cobalt', .001, wall)
    # Frame a shallow recess in the vision panel; the old opaque metal plate hid its glass.
    remove(o for o in bpy.data.objects if o.name.startswith(('Vision panel frame', 'Vision panel seal', 'Dim corridor behind window')))
    shell = bpy.data.objects['Room_Shell']
    for dx in [-.198, .198]:
        h.box('Door vision vertical frame', (-2.84+dx, 3.333, 1.61), (.019, .030, .415), 'steel', .007, shell)
    for dz in [-.198, .198]:
        h.box('Door vision horizontal frame', (-2.84, 3.333, 1.61+dz), (.415, .030, .019), 'steel', .007, shell)
    h.box('Vision panel frosted backing', (-2.84, 3.366, 1.61), (.374, .003, .374), 'hose', .01, shell)
    h.bar('Visible corridor horizontal mullion', (-3.02, 3.36, 1.66), (-2.66, 3.36, 1.66), .006, 'white', shell)
    # The dual displays occupy the same ceiling mounting point but use larger panels.
    for screen in [o for o in bpy.data.objects if o.name.startswith('Diagnostic_Display') and o.type == 'EMPTY']:
        pivot = Vector(next(o.location for o in screen.children if o.name.startswith('Display enclosure')))
        screen.scale = (1.19, 1, 1.19)
        screen.location = (pivot.x*(1-1.19)+(-.06 if pivot.x < 3 else .06), 0, pivot.z*(1-1.19))
    for o in bpy.data.objects:
        if o.name.startswith('Sealed wall panel') or o.name.startswith('Right sealed wall panel'):
            # Narrower dark seams maintain panel construction without a heavy black grid.
            o.scale.x = 1.003 if o.name.startswith('Sealed') else 1
    return root


def ground_casters():
    """Move each fork and its wheel pair together to the finished floor plane."""
    parts = ('Caster swivel', 'Caster fork', 'Non marking tyre', 'Wheel hub', 'Foot brake')
    for parent in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
        forks = [o for o in parent.children if o.name.startswith('Caster fork')]
        if not forks:
            continue
        groups = {f.name: [] for f in forks}
        for obj in parent.children:
            if obj.name.startswith(parts):
                closest = min(forks, key=lambda f: (obj.location.x-f.location.x)**2+(obj.location.y-f.location.y)**2)
                groups[closest.name].append(obj)
        for objects in groups.values():
            wheels = [o for o in objects if o.name.startswith('Non marking tyre')]
            if not wheels:
                raise RuntimeError('Caster fork without tyres')
            clearance = min(o.location.z-max(abs(v.co.y) for v in o.data.vertices) for o in wheels)
            for obj in objects:
                obj.location.z -= clearance


def corrugated_hose(name, control_points, parent):
    """Sample a Catmull-Rom centerline by arc length to keep rib pitch uniform."""
    controls = [Vector(p) for p in control_points]
    controls = [controls[0], *controls, controls[-1]]
    curve = []
    for j in range(1, len(controls)-2):
        p0, p1, p2, p3 = controls[j-1:j+3]
        for i in range(50):
            t = i/50
            curve.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    curve.append(controls[-1])
    distances = np.array([0, *np.cumsum([(curve[i]-curve[i-1]).length for i in range(1, len(curve))])])
    count = int(distances[-1]/.0025)+1
    arc = np.linspace(0, distances[-1], count)
    points = [Vector(p) for p in np.stack([np.interp(arc, distances, [p[axis] for p in curve]) for axis in range(3)], axis=1)]
    vertices = []
    sides = 16
    for i, point in enumerate(points):
        tangent = (points[min(i+1, count-1)]-points[max(0, i-1)]).normalized()
        u = tangent.cross(Vector((0, 1, 0))).normalized()
        v = tangent.cross(u).normalized()
        radius = .0205+.0023*math.cos(arc[i]*h.TAU/.009)
        for j in range(sides):
            angle = j*h.TAU/sides
            vertices.append(point+radius*(u*math.cos(angle)+v*math.sin(angle)))
    faces = [(i*sides+j, i*sides+(j+1)%sides, (i+1)*sides+(j+1)%sides, (i+1)*sides+j)
             for i in range(count-1) for j in range(sides)]
    return h.object_mesh(name, vertices, faces, 'hose', parent, True)
