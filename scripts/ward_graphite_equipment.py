"""Physical bedside equipment, without baked patient content or room lighting."""

import math

from mathutils import Vector

import ward_graphite_common as h


def _rod(name, start, end, radius, material, parent):
    a, b = Vector(start), Vector(end)
    obj = h.cylinder(name, (a + b) / 2, radius, (b - a).length,
                     material, vertices=24, parent=parent)
    obj.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return obj


def _front_disc(name, loc, radius, depth, material, parent, vertices=32):
    return h.cylinder(name, loc, radius, depth, material,
                      rotation=(math.pi / 2, 0, 0), vertices=vertices, parent=parent)


def _ring(name, x, y, z, radius, wire, material, parent):
    return h.tube(name, [(x + radius * math.cos(i * math.tau / 40), y,
                         z + radius * math.sin(i * math.tau / 40)) for i in range(40)],
                  wire, material, parent=parent, cyclic=True)


def _electrical_socket(parent, x, z):
    h.box('BedHeadwall_Socket_Backplate', (x, -1.307, z), (.126, .019, .126),
          'plastic', bevel=.008, parent=parent)
    h.box('BedHeadwall_Socket_Face', (x, -1.293, z), (.103, .014, .104),
          'white', bevel=.006, parent=parent)
    for dx, dz, angle in [(-.022, .002, -.22), (.022, .002, .22), (0, .031, 0)]:
        recess = h.box('BedHeadwall_Socket_Recess', (x + dx, -1.283, z + dz),
                       (.007, .006, .019), 'dark', bevel=.002, parent=parent)
        recess.rotation_euler.y = angle
    for dz in (-.048, .048):
        _front_disc('BedHeadwall_Socket_Fixing', (x, -1.282, z + dz), .0026, .002,
                    'steel', parent, vertices=12)


def _gas_port(parent, x, material):
    z = 1.568
    _front_disc('BedHeadwall_GasPort_Mount', (x, -1.307, z), .047, .024, 'graphite', parent)
    _front_disc('BedHeadwall_GasPort_SatinRing', (x, -1.288, z), .040, .018, 'steel', parent)
    _front_disc('BedHeadwall_GasPort_InnerRecess', (x, -1.276, z), .025, .008, 'dark', parent)
    _ring('BedHeadwall_GasPort_KeyedCollar', x, -1.268, z, .024, .004, material, parent)
    _ring('BedHeadwall_GasPort_PolishedLip', x, -1.264, z, .030, .0022, 'silver', parent)
    for angle in (0, math.pi):
        h.box('BedHeadwall_GasPort_Keyway', (x + .022 * math.cos(angle), -1.262,
                                            z + .022 * math.sin(angle)),
              (.006, .012, .012), 'dark', bevel=.001, parent=parent)


def _call_handset(parent):
    handset = h.empty('BedNurseCallHandset', parent=parent)
    x = -1.076
    h.box('Bed_Call_Cradle', (x, -1.285, 1.561), (.105, .048, .232),
          'graphite', bevel=.022, parent=handset)
    h.box('Bed_Call_Handpiece', (x, -1.248, 1.572), (.090, .051, .216),
          'white', bevel=.029, parent=handset)
    _front_disc('Bed_Call_ButtonBezel', (x, -1.217, 1.591), .027, .007, 'silver', handset)
    _front_disc('Bed_Call_Button', (x, -1.212, 1.591), .023, .009, 'red', handset)
    h.box('Bed_Call_TactileMark', (x, -1.205, 1.591), (.004, .003, .023),
          'white', bevel=.001, parent=handset)
    for dx in (-.013, 0, .013):
        _front_disc('Bed_Call_SpeakerPerforation', (x + dx, -1.219, 1.634),
                    .0027, .002, 'dark', handset, vertices=12)
    h.box('Bed_Call_StatusLed', (x, -1.220, 1.519), (.018, .005, .005),
          'cyan', bevel=.002, parent=handset)
    h.tube('Bed_Call_CableTop', [(x, -1.248, 1.47), (x, -1.247, 1.43),
                               (x + .008, -1.247, 1.401)],
           .0034, 'plastic', parent=handset)
    coil = []
    turns, steps = 12, 240
    for i in range(steps + 1):
        t = i / steps
        angle = math.tau * turns * t
        coil.append((x + .008 + .009 * math.cos(angle),
                     -1.247 + .009 * math.sin(angle), 1.40 - .318 * t))
    h.tube('Bed_Call_CoiledCord', coil, .0027, 'plastic', parent=handset)
    h.tube('Bed_Call_CableReturn', [coil[-1], (x + .018, -1.25, 1.04),
                                  (x + .050, -1.267, 1.022),
                                  (x + .082, -1.294, 1.056), (x + .082, -1.309, 1.108)],
           .0034, 'plastic', parent=handset)
    _front_disc('Bed_Call_CableJack', (x + .082, -1.309, 1.111), .012, .02, 'graphite', handset)
    return handset


def _terminal(parent):
    terminal = h.empty('BedTerminal', parent=parent)
    terminal['assetRole'] = 'bedside-terminal'
    terminal['runtimeSurface'] = 'BedTerminalSurface'
    h.box('BedTerminal_WallMount', (-.68, -1.35, 1.6), (.20, .040, .14),
          'graphite', bevel=.012, parent=terminal)
    h.box('BedTerminal_SilverChassis', (-.68, -1.327, 1.6), (.398, .037, .242),
          'silver', bevel=.012, parent=terminal)
    h.box('BedTerminal_BlackBezel', (-.68, -1.308, 1.6), (.390, .013, .234),
          'dark', bevel=.009, parent=terminal)
    width, height = .36, .2025
    surface = h.mesh('BedTerminalSurface',
                     [(0, -width / 2, -height / 2), (0, width / 2, -height / 2),
                      (0, width / 2, height / 2), (0, -width / 2, height / 2)],
                     [(0, 1, 2, 3)], 'screen', parent=terminal,
                     uvs=[(0, 0), (1, 0), (1, 1), (0, 1)])
    # The runtime relies on this local YZ plane and un-applied rotation.
    surface.location = (-.68, -1.30, 1.6)
    surface.rotation_euler.z = math.pi / 2
    surface['surfaceRole'] = 'bed-terminal-template'
    surface['contentSource'] = 'runtime-only'
    h.box('BedTerminal_StatusLed', (-.515, -1.302, 1.704), (.013, .004, .002),
          'cyan', bevel=.0008, parent=terminal)
    return terminal, surface


def _headwall(parent):
    headwall = h.empty('BedHeadwall', parent=parent)
    h.box('BedHeadwall_RecessedFrame', (0, -1.404, 1.54), (2.70, .116, 1.44),
          'dark', bevel=.024, parent=headwall)
    h.box('BedHeadwall_GraphiteFace', (0, -1.346, 1.54), (2.658, .035, 1.394),
          'graphite', bevel=.014, parent=headwall)
    h.box('BedHeadwall_SilverServiceBand', (0, -1.320, 1.56), (2.606, .018, .32),
          'silver', bevel=.009, parent=headwall)
    for z in (.98, 2.23):
        h.box('BedHeadwall_CyanInlay', (0, -1.324, z), (2.60, .010, .007),
              'cyan', bevel=.003, parent=headwall)
    for z in (1.382, 1.738):
        h.box('BedHeadwall_ServiceBandGasket', (0, -1.319, z), (2.62, .009, .005),
              'dark', bevel=.0015, parent=headwall)
    h.box('BedHeadwall_ReadingLightHousing', (.15, -1.284, 2.03), (1.32, .095, .033),
          'steel', bevel=.009, parent=headwall)
    h.box('BedHeadwall_ReadingLightDiffuser', (.15, -1.247, 2.014), (1.266, .041, .010),
          'lamp', bevel=.003, parent=headwall)
    for x in (.34, .525, .71, .895, 1.08):
        _electrical_socket(headwall, x, 1.56)
    for x, material in [(-.315, 'steel'), (-.133, 'socket'), (.05, 'socket')]:
        _gas_port(headwall, x, material)
    handset = _call_handset(headwall)
    terminal, surface = _terminal(headwall)
    # This non-rendering locator is available for live bed-number content.
    label_anchor = h.empty('BedNumberAnchor', parent=headwall)
    label_anchor.location = (1.025, -1.308, 2.005)
    label_anchor['contentSource'] = 'runtime-only'
    return headwall, handset, terminal, surface, label_anchor


def _cabinet(parent):
    cabinet = h.empty('BedsideCabinet', parent=parent)
    cabinet.location = (-.96, -.72, 0)
    h.box('BedCabinet_FloatingToe', (0, 0, .050), (.41, .38, .080),
          'dark', bevel=.018, parent=cabinet)
    h.box('BedCabinet_MainCarcass', (0, 0, .392), (.50, .48, .65),
          'silver', bevel=.030, parent=cabinet)
    h.box('BedCabinet_OakTop', (0, .006, .737), (.53, .513, .035),
          'oak', bevel=.016, parent=cabinet)
    h.box('BedCabinet_TopShadowReveal', (0, .005, .713), (.487, .474, .008),
          'dark', bevel=.003, parent=cabinet)
    for z, height in [(.612, .167), (.294, .450)]:
        h.box('BedCabinet_DrawerShadowGap', (0, .241, z), (.449, .010, height + .016),
              'dark', bevel=.014, parent=cabinet)
        h.box('BedCabinet_DrawerFront', (0, .251, z), (.433, .019, height),
              'graphite', bevel=.013, parent=cabinet)
        handle_z = z + height / 2 - .041
        for x in (-.070, .070):
            h.box('BedCabinet_HandleFoot', (x, .268, handle_z), (.016, .020, .011),
                  'steel', bevel=.004, parent=cabinet)
        h.box('BedCabinet_SlimHandle', (0, .280, handle_z), (.161, .016, .012),
              'steel', bevel=.005, parent=cabinet)
    h.box('BedCabinet_FineCyanTrim', (0, .263, .511), (.446, .003, .004),
          'cyan', bevel=.001, parent=cabinet)
    # A folded sheet peeking through an actual dark opening reads better than a white box.
    h.box('BedCabinet_TissueBox', (.025, -.03, .798), (.23, .132, .078),
          'graphite', bevel=.009, parent=cabinet)
    h.box('BedCabinet_TissueSlot', (.025, -.03, .840), (.14, .027, .004),
          'dark', bevel=.002, parent=cabinet)
    tissue = h.mesh('BedCabinet_FoldedTissue',
                    [(-.036, -.041, .842), (.070, -.041, .843), (.064, -.030, .890),
                     (.019, -.014, .880), (-.017, -.027, .905), (-.040, -.024, .871)],
                    [(0, 1, 2, 3, 4, 5)], 'linen', parent=cabinet)
    thickness = tissue.modifiers.new('Paper thickness', 'SOLIDIFY')
    thickness.thickness = .0005
    return cabinet


def _infusion_stand(parent):
    stand = h.empty('IVStand', parent=parent)
    stand.location = (.82, -.91, 0)
    for index in range(5):
        angle = math.tau * index / 5
        end_x, end_y = .224 * math.cos(angle), .224 * math.sin(angle)
        _rod('IVStand_FiveStarFoot', (0, 0, .122), (end_x, end_y, .092), .014, 'steel', stand)
        h.cylinder('IVStand_CasterTyre', (end_x, end_y, .039), .036, .031, 'rubber',
                   rotation=(math.pi / 2, 0, angle), vertices=24, parent=stand)
        h.cylinder('IVStand_CasterStem', (end_x, end_y, .078), .012, .052,
                   'steel', vertices=16, parent=stand)
    h.cylinder('IVStand_BaseHub', (0, 0, .128), .042, .104, 'graphite', vertices=32, parent=stand)
    h.cylinder('IVStand_LowerColumn', (0, 0, .69), .017, 1.18, 'steel', parent=stand)
    h.cylinder('IVStand_ExtensionLock', (0, 0, 1.273), .024, .049, 'graphite', parent=stand)
    h.box('IVStand_LockThumbScrew', (.028, 0, 1.273), (.036, .024, .027),
          'plastic', bevel=.007, parent=stand)
    h.cylinder('IVStand_UpperTelescopic', (0, 0, 1.607), .010, .678, 'silver', vertices=24, parent=stand)
    h.sphere('IVStand_TopCap', (0, 0, 1.965), (.016, .016, .016), 'graphite', parent=stand)
    for side in (-1, 1):
        points = [(0, 0, 1.942), (side * .121, 0, 1.942), (side * .149, 0, 1.936)]
        points.extend((side * (.148 + .025 * math.sin(i * math.pi / 20)), 0,
                       1.912 + .025 * math.cos(i * math.pi / 20)) for i in range(21))
        points.extend([(side * .124, 0, 1.897), (side * .123, 0, 1.910)])
        h.tube('IVStand_BentHanger', points, .0035, 'steel', parent=stand)
    infusion = h.empty('InfusionEquipment', parent=parent)
    infusion.location = (.82, -.91, 0)
    infusion.hide_render = True
    infusion['assetRole'] = 'optional-infusion-equipment'
    bottle = h.cylinder('Infusion_Bottle', (-.145, 0, 1.773), .039, .159,
                         'glass', vertices=32, parent=infusion)
    cap = h.cylinder('Infusion_BottleCap', (-.145, 0, 1.683), .027, .022,
                     'plastic', vertices=24, parent=infusion)
    # Blender visibility is not inherited by children of an Empty.
    bottle.hide_render = True
    cap.hide_render = True
    return stand, infusion


def build_equipment(parent):
    """Return named subassemblies and the unmodified runtime screen contract."""
    headwall, handset, terminal, surface, label_anchor = _headwall(parent)
    cabinet = _cabinet(parent)
    stand, infusion = _infusion_stand(parent)
    return {'headwall': headwall, 'handset': handset, 'terminal': terminal,
            'surface': surface, 'bed_number_anchor': label_anchor,
            'cabinet': cabinet, 'iv_stand': stand, 'infusion': infusion}
