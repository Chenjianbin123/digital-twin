"""Editable, open-backed white-and-oak nurse-station counter in metres.

The public side faces -Y.  Only counter geometry is built here; workstation
equipment, seats and room lights belong to their respective scene modules.
"""

import math

from mathutils import Vector
from mathutils.geometry import tessellate_polygon


_HALF_WIDTH = 2.8
_CORNER = .32
_LEFT_RETURN = 2.6
_RIGHT_RETURN = 1.10
_OAK_START = .16


def _outer_path(inset=0, steps=24):
    """A continuous open U, from the long left return to the short right one."""
    radius = _CORNER - inset
    if radius <= 0:
        raise ValueError('Outer silhouette inset must be smaller than the corner radius')
    path = [(-_HALF_WIDTH + inset, _LEFT_RETURN)]
    for index in range(steps + 1):
        angle = math.pi + index * math.pi / (2 * steps)
        path.append((-_HALF_WIDTH + _CORNER + radius * math.cos(angle),
                     _CORNER + radius * math.sin(angle)))
    path.extend([(_OAK_START, inset), (_HALF_WIDTH - _CORNER, inset)])
    for index in range(1, steps + 1):
        angle = 1.5 * math.pi + index * math.pi / (2 * steps)
        path.append((_HALF_WIDTH - _CORNER + radius * math.cos(angle),
                     _CORNER + radius * math.sin(angle)))
    path.append((_HALF_WIDTH - inset, _RIGHT_RETURN))
    return path


def _work_inner_path(inset=.76, radius=.16, steps=24):
    """The worktop inner edge has its own radius instead of a negative offset."""
    left, right = -_HALF_WIDTH + inset, _HALF_WIDTH - inset
    turn_y = inset + radius
    path = [(left, _LEFT_RETURN)]
    for index in range(steps + 1):
        angle = math.pi + index * math.pi / (2 * steps)
        path.append((left + radius + radius * math.cos(angle), turn_y + radius * math.sin(angle)))
    path.append((right - radius, inset))
    for index in range(1, steps + 1):
        angle = 1.5 * math.pi + index * math.pi / (2 * steps)
        path.append((right - radius + radius * math.cos(angle), turn_y + radius * math.sin(angle)))
    path.append((right, _RIGHT_RETURN))
    return path


def _edge_finish(obj, radius=.004, segments=3):
    bevel = obj.modifiers.new('Small cleanable edge radius', 'BEVEL')
    bevel.width = radius
    bevel.segments = segments
    bevel.harden_normals = True
    normals = obj.modifiers.new('Weighted manufactured normals', 'WEIGHTED_NORMAL')
    normals.keep_sharp = True
    return obj


def _strip(h, parent, name, outer, inner, bottom, top, material, bevel=.003):
    """A capped thin wall/rim; the open rear never becomes a solid cuboid."""
    if len(outer) != len(inner):
        raise ValueError('Matched strip paths must contain the same number of points')
    count = len(outer)
    vertices = [(x, y, z) for z in (bottom, top) for path in (outer, inner) for x, y in path]
    faces = []
    for index in range(count - 1):
        next_index = index + 1
        faces.extend([
            (index, next_index, next_index + 2 * count, index + 2 * count),
            (index + count, index + 3 * count, next_index + 3 * count, next_index + count),
            (index + 2 * count, next_index + 2 * count, next_index + 3 * count, index + 3 * count),
            (index + count, next_index + count, next_index, index),
        ])
    faces.extend([(0, 2 * count, 3 * count, count),
                  (count - 1, 2 * count - 1, 4 * count - 1, 3 * count - 1)])
    obj = h.mesh(name, vertices, faces, material, parent=parent)
    # Only the vertical shell is smooth, leaving worktop surfaces perfectly planar.
    for polygon in obj.data.polygons:
        polygon.use_smooth = polygon.index < (count - 1) * 4 and polygon.index % 4 < 2
    return _edge_finish(obj, bevel) if bevel else obj


def _slab(h, parent, name, outer, inner, bottom, top, material):
    """Explicitly triangulate the concave U so glTF cannot bridge its opening."""
    outline = outer + list(reversed(inner))
    points = [Vector((x, y, 0)) for x, y in outline]
    # Blender 4.5 returns flattened vertex indices, not Vector instances.
    triangles = tessellate_polygon([points])
    count = len(points)
    vertices = [(point.x, point.y, z) for z in (bottom, top) for point in points]
    faces = [tuple(reversed(triangle)) for triangle in triangles]
    faces.extend(tuple(index + count for index in triangle) for triangle in triangles)
    faces.extend((index, (index + 1) % count, (index + 1) % count + count, index + count)
                 for index in range(count))
    return _edge_finish(h.mesh(name, vertices, faces, material, parent=parent), .0045)


def _front_sections(h, parent):
    outside = _outer_path(0)
    inside = _outer_path(.014)
    split = next(index for index, point in enumerate(outside) if abs(point[0] - _OAK_START) < .000001)
    _strip(h, parent, 'Desk_WhiteLeft_RadiusedFascia', outside[:split + 1], inside[:split + 1],
           .155, 1.020, 'white', .004)
    _strip(h, parent, 'Desk_OakRight_RadiusedFascia', outside[split:], inside[split:],
           .155, 1.020, 'oak', .003)
    # Real, restrained panel joints distinguish manufactured joinery from one large box.
    for x in (-1.91, -.64):
        h.box('Desk_WhiteFascia_ExpansionJoint', (x, -.0008, .585), (.0018, .002, .839),
              'silver', bevel=.0005, parent=parent)
    for x in (.71, 1.26, 1.81, 2.36):
        h.box('Desk_OakFascia_PanelJoint', (x, -.0008, .585), (.0015, .002, .839),
              'dark', bevel=.0004, parent=parent)
    h.box('Desk_WhiteOak_TransitionReveal', (_OAK_START, -.001, .585), (.003, .0025, .844),
          'silver', bevel=.0005, parent=parent)


def _working_side(h, parent):
    # The lower staff worktop is ~.64 m deep; the .19 m high privacy ledge is separate.
    _slab(h, parent, 'Desk_InnerStaffWorktop', _outer_path(.12), _work_inner_path(),
          .713, .750, 'white')
    for x in (-1.68, -.36, .96, 1.74):
        h.box('Desk_Worktop_CantileverBracket', (x, .414, .693), (.035, .558, .028),
              'silver', bevel=.004, parent=parent)
        h.box('Desk_Worktop_BracketWallFoot', (x, .120, .624), (.035, .030, .155),
              'silver', bevel=.004, parent=parent)
    for y in (1.35, 2.34):
        h.box('Desk_Return_WorktopBracket', (-2.39, y, .693), (.558, .035, .028),
              'silver', bevel=.004, parent=parent)
        h.box('Desk_Return_BracketWallFoot', (-2.663, y, .624), (.030, .035, .155),
              'silver', bevel=.004, parent=parent)
    # Closed caps at the two return ends finish the thin shell without closing staff access.
    h.box('Desk_LeftReturn_EndCap', (-2.751, _LEFT_RETURN - .010, .589), (.078, .019, .86),
          'white', bevel=.005, parent=parent)
    h.box('Desk_RightReturn_EndCap', (2.751, _RIGHT_RETURN - .010, .589), (.078, .019, .86),
          'oak', bevel=.005, parent=parent)
    for x in (-1.55, .10, 1.65):
        h.box('Desk_Inner_ServiceAccess', (x, .107, .433), (.63, .008, .373),
              'wall', bevel=.009, parent=parent)
        h.box('Desk_Inner_ServiceAccess_Latch', (x + .262, .113, .443), (.025, .004, .018),
              'silver', bevel=.004, parent=parent)


def build_desk(h, root):
    """Build a high/low counter with rear access and return its Desk group."""
    desk = h.empty('Desk', parent=root)
    desk['assetRole'] = 'open-backed-nurse-counter'
    desk['publicDirection'] = '-Y'
    desk['staffEntry'] = 'rear opening; no rear crossbar or central solid fill'
    desk['outerCounterHeight'] = 1.07
    desk['staffWorktopHeight'] = .75
    _strip(h, desk, 'Desk_Continuous_ThinShell', _outer_path(.014), _outer_path(.105),
           .151, 1.026, 'white', .004)
    _front_sections(h, desk)
    _strip(h, desk, 'Desk_RecessedToeKick', _outer_path(.063), _outer_path(.124),
           .014, .151, 'silver', .003)
    _strip(h, desk, 'Desk_FloatingBase_ShadowReveal', _outer_path(.018), _outer_path(.064),
           .128, .151, 'dark', .0015)
    _strip(h, desk, 'Desk_Continuous_WarmBaseDiffuser', _outer_path(.008), _outer_path(.016),
           .132, .140, 'lamp', .002)
    _strip(h, desk, 'Desk_Top_ShadowGasket', _outer_path(.012), _outer_path(.172),
           1.022, 1.035, 'silver', .002)
    _strip(h, desk, 'Desk_Continuous_TopLightDiffuser', _outer_path(.001), _outer_path(.010),
           1.027, 1.033, 'lamp', .0014)
    _strip(h, desk, 'Desk_White_RadiusedPublicLedge', _outer_path(0), _outer_path(.190),
           1.035, 1.070, 'white', .005)
    _working_side(h, desk)
    h.text('Desk_Chinese_NurseStation', '护士站', (-1.23, -.012, .730), .173, 'blue',
           parent=desk, rotation=(math.pi / 2, 0, 0))
    h.text('Desk_English_NurseStation', 'NURSE STATION', (-1.23, -.012, .565), .052, 'blue',
           parent=desk, rotation=(math.pi / 2, 0, 0))
    h.box('Desk_Label_FineUnderline', (-1.23, -.010, .515), (.64, .003, .003),
          'silver', bevel=.001, parent=desk)
    return desk
