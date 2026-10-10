"""Reference-led warm hospital architecture; dimensions are design assumptions.

Blender metres: Z up, the clear left corridor runs towards +Y, and the ward
doors are on the X=4.3 wall facing -X. No operational patient data is authored.
"""

import math


DOOR_CENTRES = (0.1, 3.4, 6.7, 10.0, 13.3, 16.6, 19.9)


def _rounded_rectangle(width, depth, radius, centre_y, steps=12):
    points = []
    for x, y, angle in (
        (width / 2 - radius, -depth / 2 + radius, -90),
        (width / 2 - radius, depth / 2 - radius, 0),
        (-width / 2 + radius, depth / 2 - radius, 90),
        (-width / 2 + radius, -depth / 2 + radius, 180),
    ):
        for i in range(steps + 1):
            a = math.radians(angle + 90 * i / steps)
            points.append((x + radius * math.cos(a), centre_y + y + radius * math.sin(a)))
    return points


def _ceiling_ring(h, parent):
    outer = _rounded_rectangle(6.32, 3.65, 0.54, 1.35)
    inner = _rounded_rectangle(5.93, 3.26, 0.345, 1.35)
    count = len(outer)
    vertices = ([(x, y, 3.027) for x, y in outer]
                + [(x, y, 3.027) for x, y in inner]
                + [(x, y, 3.115) for x, y in outer]
                + [(x, y, 3.115) for x, y in inner])
    faces = []
    for i in range(count):
        j = (i + 1) % count
        faces.extend((
            (i, count + i, count + j, j),
            (count * 2 + i, count * 2 + j, count * 3 + j, count * 3 + i),
            (i, j, count * 2 + j, count * 2 + i),
            (count + i, count * 3 + i, count * 3 + j, count + j),
        ))
    ring = h.mesh('Station_Ceiling_RoundedSoffit', vertices, faces, 'white', parent=parent)
    bevel = ring.modifiers.new('Soft architectural edge', 'BEVEL')
    bevel.width = 0.004
    bevel.segments = 3
    trace = _rounded_rectangle(6.08, 3.41, 0.42, 1.35)
    h.tube('Station_Ceiling_ContinuousLight', [(x, y, 3.020) for x, y in trace],
           0.012, 'lamp', parent=parent, cyclic=True)
    return ring


def _door(h, parent, centre_y, number):
    door = h.empty(f'WardDoor_{number}', parent=parent)
    opening_half = 0.64
    for side in (-1, 1):
        y = centre_y + side * (opening_half - 0.036)
        h.box(f'Door_{number}_OakJamb', (4.286, y, 1.16), (0.18, 0.084, 2.32),
              'oak', bevel=0.006, parent=door)
        h.box(f'Door_{number}_SteelReveal', (4.190, y, 1.16), (0.016, 0.092, 2.32),
              'silver', bevel=0.003, parent=door)
    h.box(f'Door_{number}_OakLintel', (4.286, centre_y, 2.282), (0.18, 1.36, 0.095),
          'oak', bevel=0.006, parent=door)
    h.box(f'Door_{number}_TopSteelReveal', (4.190, centre_y, 2.290), (0.016, 1.39, 0.034),
          'silver', bevel=0.003, parent=door)

    # The glazed observation slot is a real opening in a four-part door leaf.
    leaf_x = 4.320
    leaf_low, leaf_high = centre_y - 0.556, centre_y + 0.556
    slot_low, slot_high = centre_y - 0.277, centre_y - 0.073
    slot_bottom, slot_top = 1.095, 1.785
    for label, lo, hi in (('RearStile', leaf_low, slot_low), ('HandleStile', slot_high, leaf_high)):
        h.box(f'Door_{number}_{label}', (leaf_x, (lo + hi) / 2, 1.112),
              (0.054, hi - lo, 2.182), 'oak', bevel=0.004, parent=door)
    h.box(f'Door_{number}_LowerLeaf', (leaf_x, (slot_low + slot_high) / 2, (0.021 + slot_bottom) / 2),
          (0.054, slot_high - slot_low, slot_bottom - 0.021), 'oak', bevel=0.003, parent=door)
    h.box(f'Door_{number}_UpperLeaf', (leaf_x, (slot_low + slot_high) / 2, (slot_top + 2.203) / 2),
          (0.054, slot_high - slot_low, 2.203 - slot_top), 'oak', bevel=0.003, parent=door)
    h.box(f'Door_{number}_ObservationGlass', (4.312, (slot_low + slot_high) / 2, 1.440),
          (0.009, slot_high - slot_low - 0.016, slot_top - slot_bottom - 0.018),
          'glass', bevel=0.002, parent=door)
    for y in (slot_low, slot_high):
        h.box(f'Door_{number}_VisionFrameVertical', (4.285, y, 1.440), (0.035, 0.023, 0.722),
              'steel', bevel=0.004, parent=door)
    for z in (slot_bottom, slot_top):
        h.box(f'Door_{number}_VisionFrameHorizontal', (4.285, (slot_low + slot_high) / 2, z),
              (0.035, 0.228, 0.023), 'steel', bevel=0.004, parent=door)
    h.box(f'Door_{number}_KickPlate', (4.287, centre_y, 0.160), (0.013, 1.08, 0.253),
          'silver', bevel=0.007, parent=door)
    handle_y = centre_y + 0.416
    h.box(f'Door_{number}_LockPlate', (4.276, handle_y, 1.01), (0.026, 0.070, 0.221),
          'steel', bevel=0.009, parent=door)
    h.tube(f'Door_{number}_LeverHandle', [(4.254, handle_y, 1.053), (4.208, handle_y, 1.053),
                                       (4.198, handle_y - 0.013, 1.053), (4.198, handle_y - 0.127, 1.053)],
           0.012, 'steel', parent=door)
    # A neutral rear recess stops a closed glazed door looking through the scene edge.
    h.box(f'Door_{number}_InteriorRecess', (4.79, centre_y, 1.18), (0.03, 1.26, 2.36),
          'wall', bevel=0, parent=door)

    label_y = centre_y + 0.972
    h.box(f'Door_{number}_RoomPlateMount', (4.245, label_y, 2.09), (0.062, 0.304, 0.207),
          'silver', bevel=0.011, parent=door)
    h.box(f'Door_{number}_RoomPlateBlue', (4.209, label_y, 2.09), (0.012, 0.285, 0.187),
          'blue', bevel=0.008, parent=door)
    h.text(f'Door_{number}_Number', str(number), (4.200, label_y, 2.09), 0.105, 'white',
           parent=door, rotation=(math.pi / 2, 0, -math.pi / 2))
    screen_y, screen_z = centre_y + 1.023, 1.507
    h.box(f'Door_{number}_TerminalHousing', (4.235, screen_y, screen_z), (0.077, 0.174, 0.269),
          'silver', bevel=0.010, parent=door)
    h.box(f'Door_{number}_TerminalBezel', (4.190, screen_y, screen_z), (0.014, 0.147, 0.241),
          'dark', bevel=0.007, parent=door)
    screen_x, half_w, half_h = 4.180, 0.0635, 0.105
    surface = h.mesh(f'DoorScreen_{number}', [
        (screen_x, screen_y + half_w, screen_z - half_h),
        (screen_x, screen_y - half_w, screen_z - half_h),
        (screen_x, screen_y - half_w, screen_z + half_h),
        (screen_x, screen_y + half_w, screen_z + half_h),
    ], [(0, 1, 2, 3)], 'screen', parent=door,
       uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    surface['runtimeSurface'] = True
    surface['contentSource'] = 'runtime-only'
    surface['screenRole'] = 'ward-door-template'
    surface['physicalDoorLabel'] = str(number)
    return surface


def _ward_wall(h, parent):
    wall = h.empty('Right_Ward_Wall', parent=parent)
    start, end, opening_half = -1.42, 22.02, 0.64
    cursor = start
    for number, centre in enumerate(DOOR_CENTRES, 301):
        low, high = centre - opening_half, centre + opening_half
        width = low - cursor
        if width > 0:
            y = (cursor + low) / 2
            h.box(f'WardWall_Pier_{number}', (4.405, y, 1.575), (0.21, width, 3.15),
                  'wall', bevel=0.003, parent=wall)
            h.box(f'WardWall_Skirting_{number}', (4.280, y, 0.070), (0.035, width, 0.14),
                  'silver', bevel=0.006, parent=wall)
            if width > 0.55:
                ya, yb = cursor + 0.095, low - 0.095
                h.tube(f'WardWall_Handrail_{number}', [(4.155, ya, 0.90), (4.155, yb, 0.90)],
                       0.037, 'white', parent=wall)
                for bracket_y in (ya + 0.10, yb - 0.10):
                    h.box(f'WardWall_HandrailBracket_{number}', (4.232, bracket_y, 0.871),
                          (0.118, 0.028, 0.027), 'steel', bevel=0.005, parent=wall)
        h.box(f'WardWall_Lintel_{number}', (4.405, centre, 2.735), (0.21, 1.28, 0.83),
              'wall', bevel=0.003, parent=wall)
        cursor = high
    h.box('WardWall_EndPier', (4.405, (cursor + end) / 2, 1.575), (0.21, end - cursor, 3.15),
          'wall', bevel=0.003, parent=wall)
    screens = [_door(h, wall, centre, number) for number, centre in enumerate(DOOR_CENTRES, 301)]
    return wall, screens


def _hanging_sign(h, parent):
    sign = h.empty('NurseStation_HangingSign', parent=parent)
    for x in (-0.04, 1.36):
        h.cylinder('Sign_SuspensionRod', (x, 1.12, 2.951), 0.008, 0.354,
                   'steel', vertices=16, parent=sign)
        h.box('Sign_CeilingRosette', (x, 1.12, 3.131), (0.054, 0.054, 0.022),
              'silver', bevel=0.006, parent=sign)
    h.box('Sign_SilverPerimeter', (0.66, 1.12, 2.630), (2.16, 0.077, 0.342),
          'silver', bevel=0.037, parent=sign)
    h.box('Sign_DeepBlueFace', (0.66, 1.071, 2.630), (2.128, 0.025, 0.310),
          'blue', bevel=0.028, parent=sign)
    h.text('Sign_Chinese_NurseStation', '护 士 站', (0.898, 1.052, 2.632), 0.210, 'white',
           parent=sign, rotation=(math.pi / 2, 0, 0))
    shield_x, shield_y, shield_z = -0.070, 1.049, 2.632
    outline = [(-0.094, 0.092), (-0.083, -0.049), (0, -0.109), (0.083, -0.049), (0.094, 0.092)]
    h.mesh('Sign_NursingShield', [(shield_x + x, shield_y, shield_z + z) for x, z in outline],
           [tuple(range(5))], 'white', parent=sign)
    h.box('Sign_ShieldCrossHorizontal', (shield_x, shield_y - 0.003, shield_z + 0.006),
          (0.099, 0.003, 0.025), 'blue', bevel=0.002, parent=sign)
    h.box('Sign_ShieldCrossVertical', (shield_x, shield_y - 0.004, shield_z + 0.006),
          (0.025, 0.003, 0.094), 'blue', bevel=0.002, parent=sign)
    return sign


def build_architecture(h, root):
    """Build the room shell without changing materials, scene state or model URLs."""
    architecture = h.empty('Architecture', parent=root)
    architecture['surveyed'] = False
    architecture['designIntent'] = 'Left clear corridor, right ward doors, warm medical reception'
    floor = h.empty('地板', parent=architecture)
    h.box('Floor_ClinicalBase', (-0.65, 7.075, -0.065), (10.15, 30.15, 0.13),
          'floor', bevel=0, parent=floor)
    h.box('Floor_LeftBlueCorridor', (-4.30, 7.075, 0.003), (2.72, 30.15, 0.006),
          'floor_blue', bevel=0.001, parent=floor)
    h.box('Floor_RightBlueRoute', (3.62, 7.075, 0.003), (1.36, 30.15, 0.006),
          'floor_blue', bevel=0.001, parent=floor)
    for x in (-5.675, -2.925, 2.925):
        h.box('Floor_QuietWayfindingBorder', (x, 7.075, 0.006), (0.045, 30.15, 0.003),
              'white', bevel=0, parent=floor)

    ward_wall, screens = _ward_wall(h, architecture)
    h.box('LeftCorridor_OuterWall', (-5.815, 7.01, 1.575), (0.23, 30.02, 3.15),
          'wall', bevel=0.003, parent=architecture)
    h.box('LeftCorridor_CovedSkirting', (-5.681, 7.01, 0.072), (0.040, 30.02, 0.144),
          'silver', bevel=0.010, parent=architecture)
    h.tube('LeftCorridor_ContinuousHandrail', [(-5.573, -8.0, 0.90), (-5.573, 21.70, 0.90)],
           0.035, 'white', parent=architecture)
    for i in range(17):
        h.box(f'LeftCorridor_HandrailBracket_{i:02d}', (-5.638, -7.78 + 1.82 * i, 0.87),
              (0.108, 0.03, 0.028), 'steel', bevel=0.004, parent=architecture)
    # Narrow timber piers repeat down the passage without projecting into its clear width.
    for i, y in enumerate((8.25, 12.78, 17.31, 21.66)):
        h.box(f'LeftCorridor_InnerOakPier_{i:02d}', (-2.665, y, 1.575), (0.46, 0.39, 3.15),
              'oak', bevel=0.012, parent=architecture)
    h.box('Station_BackgroundWall', (-0.95, 3.810, 1.575), (3.70, 0.240, 3.15),
          'wall', bevel=0.003, parent=architecture)
    for x, width in ((-2.565, 0.47), (0.742, 0.315)):
        h.box('Station_BackgroundOakPier', (x, 3.663, 1.575), (width, 0.18, 3.15),
              'oak', bevel=0.009, parent=architecture)
    h.box('Station_BackgroundSkirting', (-0.91, 3.673, 0.071), (3.50, 0.042, 0.142),
          'silver', bevel=0.006, parent=architecture)

    end_window = h.empty('Corridor_EndWindow', parent=architecture)
    h.box('Corridor_EndSillWall', (-4.30, 22.070, 0.324), (2.80, 0.18, 0.648),
          'wall', bevel=0.003, parent=end_window)
    h.box('Corridor_EndHeaderWall', (-4.30, 22.070, 3.043), (2.80, 0.18, 0.214),
          'wall', bevel=0.003, parent=end_window)
    h.box('Corridor_EndWindowGlass', (-4.30, 22.024, 1.794), (2.69, 0.012, 2.24),
          'glass', bevel=0, parent=end_window)
    for x in (-5.68, -4.30, -2.92):
        h.box('Corridor_EndWindowMullion', (x, 21.987, 1.795), (0.052, 0.104, 2.31),
              'silver', bevel=0.004, parent=end_window)
    for z in (0.668, 2.922):
        h.box('Corridor_EndWindowTransom', (-4.30, 21.987, z), (2.79, 0.104, 0.052),
              'silver', bevel=0.004, parent=end_window)
    h.box('Corridor_EndStoneSill', (-4.30, 21.923, 0.650), (2.82, 0.26, 0.044),
          'white', bevel=0.010, parent=end_window)
    h.box('Architecture_EndWall', (0.705, 22.080, 1.575), (7.21, 0.18, 3.15),
          'wall', bevel=0, parent=architecture)

    ceiling = h.empty('Ceiling', parent=architecture)
    h.box('Ceiling_HygienicBase', (-0.65, 7.075, 3.177), (10.15, 30.15, 0.054),
          'white', bevel=0, parent=ceiling)
    for i in range(9):
        x = -5.70 + 1.2 * i
        h.box(f'Ceiling_LongPanelJoint_{i:02d}', (x, 7.075, 3.148), (0.003, 30.15, 0.004),
              'wall', bevel=0, parent=ceiling)
    for i in range(25):
        y = -7.4 + 1.2 * i
        h.box(f'Ceiling_CrossPanelJoint_{i:02d}', (-0.65, y, 3.148), (10.13, 0.003, 0.004),
              'wall', bevel=0, parent=ceiling)
    for i, y in enumerate((0.80, 4.15, 7.50, 10.85, 14.20, 17.55, 20.90)):
        for label, x in (('Hall', -4.29), ('Ward', 3.52)):
            h.box(f'Ceiling_{label}_LightFrame_{i:02d}', (x, y, 3.131), (0.72, 0.40, 0.038),
                  'silver', bevel=0.006, parent=ceiling)
            h.box(f'Ceiling_{label}_LightDiffuser_{i:02d}', (x, y, 3.108), (0.673, 0.353, 0.012),
                  'lamp', bevel=0.006, parent=ceiling)
    for x in (-1.53, 1.50):
        h.box('Station_Ceiling_WorkLightFrame', (x, 1.20, 3.111), (1.18, 0.31, 0.045),
              'silver', bevel=0.009, parent=ceiling)
        h.box('Station_Ceiling_WorkLightDiffuser', (x, 1.20, 3.083), (1.12, 0.26, 0.015),
              'lamp', bevel=0.006, parent=ceiling)
    soffit = _ceiling_ring(h, ceiling)
    sign = _hanging_sign(h, ceiling)
    return {'architecture': architecture, 'floor': floor, 'ceiling': ceiling,
            'ward_wall': ward_wall, 'door_screens': screens, 'hanging_sign': sign,
            'soffit': soffit, 'end_window': end_window}
