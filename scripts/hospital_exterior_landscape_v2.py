"""Campus planting and distant context refinements for the hospital V2 source.

The campus uses three shared tree meshes, while the distant planting uses a
separate inexpensive silhouette. All scenery is editable geometry; no backdrop
images or downloaded assets are required.
"""
import math
import random

import bpy
from mathutils import Vector

import hospital_reconstruction_common as h
from hospital_reference_landscape import leaf_cloud


def _remove_tree(root):
    for child in list(root.children):
        _remove_tree(child)
    bpy.data.objects.remove(root, do_unlink=True)


def _branch(name, points, radii, parent, segments=9):
    """Taper a bent branch instead of joining constant-radius cylinders."""
    vertices, faces = [], []
    for index, (point, radius) in enumerate(zip(points, radii)):
        tangent = Vector(points[min(index + 1, len(points) - 1)]) - Vector(points[max(0, index - 1)])
        rotation = tangent.to_track_quat('Z', 'Y')
        for j in range(segments):
            angle = j * h.TAU / segments
            vertices.append(Vector(point) + rotation @ Vector((radius * math.cos(angle), radius * math.sin(angle), 0)))
    for row in range(len(points) - 1):
        for j in range(segments):
            a = row * segments + j
            b = row * segments + (j + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    faces.extend([tuple(reversed(range(segments))), tuple(range((len(points)-1)*segments, len(points)*segments))])
    return h.object_mesh(name, vertices, faces, 'bark', parent, True)


def _tree_prototype(parent, species):
    rng = random.Random(440 + species * 91)
    root = h.empty('V2 Branching tree species ' + str(species + 1), parent)
    lean = [.12, -.19, .09][species]
    _branch('V2 tapered tree trunk', [(0, 0, 0), (.035, -.035, .75), (lean, .05, 1.75),
                                    (lean * 1.4, -.10, 2.8), (lean + .20, -.02, 3.9)],
            [.145, .123, .094, .065, .015], root, 12)
    for j in range(5):
        angle = j * 1.25
        _branch('V2 tree root flare', [(0, 0, .3), (math.cos(angle)*.17, math.sin(angle)*.17, .08),
                                     (math.cos(angle)*.37, math.sin(angle)*.37, .015)], [.075, .045, .008], root)
    for j in range(11):
        angle = j * 2.39996 + rng.uniform(-.35, .35)
        distance = rng.uniform(.85, 1.55) * [1.1, .82, 1.22][species]
        z = 3.0 + (j % 4) * .43 + rng.uniform(-.12, .14)
        if j == 10:
            distance, z = .35, 4.65
        end = Vector((math.cos(angle)*distance, math.sin(angle)*distance, z))
        start = Vector((lean*.7, .03, 1.80 + j*.072))
        middle = start.lerp(end, .50) + Vector((0, 0, .30))
        _branch('V2 tapered crown bough', [start, middle, end], [.068 - j*.0025, .034, .007], root)
        for side in [-1, 1]:
            twig_end = end + Vector((math.cos(angle+side*.80)*.42, math.sin(angle+side*.80)*.42, .24))
            _branch('V2 terminal twig', [middle.lerp(end, .65), end, twig_end], [.018, .010, .003], root, 6)
        foliage = leaf_cloud('V2 irregular leaf cluster', 910 + species*31+j, rng.uniform(.70, .91),
                             0, root, count=350, leafscale=.70)
        foliage.location = end
        foliage.scale = (rng.uniform(.95, 1.22), rng.uniform(.90, 1.14), rng.uniform(.82, 1.15))
        foliage.rotation_euler.z = angle
    root['sharedGeometrySpecies'] = species + 1
    return root


def _copy_group(prototype, parent, location, scale, angle, name):
    root = h.empty(name, parent)
    for source in prototype.children:
        obj = source.copy()
        obj.data = source.data
        bpy.context.collection.objects.link(obj)
        obj.parent = root
    root.location = location
    root.scale = (scale, scale, scale)
    root.rotation_euler.z = angle
    return root


def _planting(parent):
    planting = bpy.data.objects['Landscape_Planting']
    old_trees = [o for o in planting.children if o.type == 'EMPTY' and o.name.startswith('Tree_')]
    placements = [(tuple(o.location), tuple(o.scale), o.rotation_euler.z) for o in old_trees]
    for root in old_trees:
        _remove_tree(root)
    # The former right garden occupied the new ambulance corridor. Its shrubs,
    # stone rim, and soil move together; the other existing low beds stay intact.
    for obj in planting.children:
        if obj.name.startswith(('Planting stone edge', 'Garden soil', 'Shrub individual leaves')) and obj.location.x > 40:
            obj.location.x += 6
    species = [_tree_prototype(planting, i) for i in range(3)]
    rng = random.Random(229)
    for i, (location, scale, angle) in enumerate(placements):
        x, y, z = location
        if x == 43:
            x = 49
        location = (x + rng.uniform(-.27, .27), y + rng.uniform(-.25, .25), z)
        size = scale[0] * rng.uniform(.92, 1.06)
        prototype = species[i % 3]
        if i < 3:
            tree = prototype
            tree.location, tree.scale = location, (size, size, size)
            tree.rotation_euler.z = angle + i * .49
        else:
            tree = _copy_group(prototype, planting, location, size, angle + i*.49, 'V2 Campus tree %02d' % (i+1))
        tree['plantingRole'] = 'campus tree'
    shrubs = next(o for o in planting.children if o.name.startswith('Shrub individual leaves'))
    roof = h.empty('V2 Roof_Garden_Planting', parent)
    for garden_index, x in enumerate([-14, -7, 0, 7, 14]):
        for j in range(16):
            shrub = shrubs.copy()
            shrub.data = shrubs.data
            bpy.context.collection.objects.link(shrub)
            shrub.name = 'V2 Roof mixed shrub'
            shrub.parent = roof
            shrub.location = (x-2.17+(j % 8)*.62, -9.13+(j//8)*.83, 8.83)
            s = rng.uniform(.65, .84)
            shrub.scale = (s, s, s*rng.uniform(.8, 1.3))
            shrub.rotation_euler.z = rng.random()*h.TAU
        if garden_index % 2 == 0:
            tree = _copy_group(species[garden_index % 3], roof, (x+.55, -8.7, 8.83),
                               .45, garden_index*.9, 'V2 Roof ornamental tree')
            tree['plantingRole'] = 'roof ornamental tree'


def _road_and_arrival(parent):
    lane = bpy.data.objects['Ambulance side lane']
    lane.location.x = 44
    lane.dimensions.y = 53
    vehicle = bpy.data.objects['Ambulance']
    vehicle.location = (44, -9, .02)
    hardscape = bpy.data.objects['Campus_Hardscape']
    for obj in hardscape.children:
        if obj.name.startswith('Side lane dash') and obj.location.x > 0:
            obj.location.x = 44
        # The old lamp was centered in the widened access pavement.
        if obj.name.startswith(('Light pole foot', 'Pedestrian lamp post', 'Lamp head', 'Lamp diffuser')) and obj.location.x > 41:
            obj.location.x += 6.4
    root = h.empty('V2 Arrival_Details', parent)
    for x in [41.25, 46.75]:
        h.box('V2 ambulance lane edge line', (x, -1, .146), (.095, 51.7, .007), 'V2 marking', 0, root)
    for y in [-18, -1, 17]:
        h.box('V2 lane directional arrow shaft', (44, y, .149), (.14, 1.45, .007), 'V2 marking', 0, root)
        h.object_mesh('V2 lane directional arrow head', [(43.49, y-.68, .153), (44, y-1.48, .153),
                                                       (44.51, y-.68, .153)], [(0, 1, 2)], 'V2 marking', root)
    for y in [-23.4, -15.6]:
        h.box('V2 ambulance stop line', (44, y, .153), (5.5, .16, .007), 'V2 marking', 0, root)
    # A pedestrian-scale directory gives the entrance a legible sense of scale.
    for x in [-22, 22]:
        h.box('V2 campus directory base', (x, -23.4, .18), (.82, .55, .15), 'limestone', .02, root)
        h.box('V2 campus directory monolith', (x, -23.4, 1.23), (.65, .20, 2.05), 'signage', .035, root)
        h.text('V2 directory title', '门 诊', (x, -23.509, 1.86), .19, 'white', root)
        h.text('V2 directory English', 'OUTPATIENT', (x, -23.510, 1.51), .065, 'white', root)
        h.text('V2 directory arrow', '↑', (x, -23.510, 1.07), .34, 'white', root)
        h.box('V2 directory light slit', (x, -23.51, .52), (.44, .015, .026), 'lamp', .002, root)
    for index, (x, y, z, angle) in enumerate([(-9, -17.2, .58, .4), (-8.35, -17.0, .58, -.35),
                                             (2.1, -19.8, .09, .7), (2.8, -20.2, .09, -.1),
                                             (15.0, -24.6, .09, .9), (-16.2, -25, .09, -.6),
                                             (20.4, -16.2, .50, 1.1)]):
        _person(root, index, (x, y, z), angle)


def _person(parent, index, location, angle):
    root = h.empty('V2 scale person %02d' % (index+1), parent)
    clothing = ['V2 figure navy', 'V2 figure taupe', 'V2 figure pale'][index % 3]
    # Restrained detail and ordinary 1.7 m proportions avoid toy-like oversized
    # heads and bright clothes; these figures provide scale in the entry view.
    h.sphere('V2 person head', (0, 0, 1.59), (.094, .088, .128), 'V2 skin', root, 16, 10)
    h.sphere('V2 person hair', (0, .018, 1.65), (.096, .079, .081), 'dark', root, 16, 8)
    _tapered_limb('V2 person torso', [(0, 0, .89), (0, 0, 1.23), (0, 0, 1.45)],
                  [(.14, .092), (.17, .102), (.19, .09)], clothing, root)
    for side in [-1, 1]:
        step = side * .13 * (1 if index % 2 else -.7)
        _tapered_limb('V2 trouser leg', [(side*.083, 0, .93), (side*.095, step*.55, .48), (side*.098, step, .10)],
                      [(.079, .081), (.062, .065), (.044, .052)], 'V2 figure navy', root)
        h.sphere('V2 shoe', (side*.098, step-.055, .062), (.054, .126, .055), 'dark', root, 12, 6)
        _tapered_limb('V2 jacket sleeve', [(side*.174, 0, 1.39), (side*.229, -.025, 1.13),
                                         (side*.217, -.10, .96)], [(.059, .067), (.049, .051), (.036, .041)], clothing, root)
        h.sphere('V2 hand', (side*.218, -.105, .91), (.033, .036, .066), 'V2 skin', root, 10, 6)
    root.location = location
    root.rotation_euler.z = angle
    s = [.98, 1.04, .97, 1.01, .94, 1.02, 1.0][index]
    root.scale = (s, s, s)


def _tapered_limb(name, points, widths, material, parent):
    vertices, faces = [], []
    for point, (rx, ry) in zip(points, widths):
        for j in range(12):
            a = j*h.TAU/12
            vertices.append((point[0]+rx*math.cos(a), point[1]+ry*math.sin(a), point[2]))
    for row in range(len(points)-1):
        for j in range(12):
            a, b = row*12+j, row*12+(j+1)%12
            faces.append((a, b, b+12, a+12))
    faces += [tuple(reversed(range(12))), tuple(range((len(points)-1)*12, len(points)*12))]
    return h.object_mesh(name, vertices, faces, material, parent, True)


def _ridge(parent, seed, y, base_height, material):
    rng = random.Random(seed)
    vertices, faces = [], []
    profile = []
    for i in range(85):
        x = -1150 + i*28
        peak = base_height * (.65+.19*math.sin(i*.33+seed)+.15*math.sin(i*.71)+rng.uniform(-.07, .07))
        profile.append((x, peak))
    for row, (dy, factor) in enumerate([(-85, .0), (-28, .60), (0, 1), (48, .72), (90, 0)]):
        for x, peak in profile:
            vertices.append((x, y+dy, peak*factor-.04))
    for row in range(4):
        for i in range(84):
            a = row*85+i
            faces += [(a, a+1, a+86), (a, a+86, a+85)]
    return h.object_mesh('V2 layered distant ridge', vertices, faces, material, parent, True)


class _Boxes:
    """Batch distant facade solids without thousands of bevel modifiers."""
    def __init__(self):
        self.vertices, self.faces = [], []

    def add(self, x, y, z, w, d, height):
        k = len(self.vertices)
        a, b, c = w/2, d/2, height/2
        self.vertices.extend([(x-a,y-b,z-c), (x+a,y-b,z-c), (x+a,y+b,z-c), (x-a,y+b,z-c),
                              (x-a,y-b,z+c), (x+a,y-b,z+c), (x+a,y+b,z+c), (x-a,y+b,z+c)])
        self.faces.extend([tuple(k+i for i in f) for f in [(0,3,2,1), (4,5,6,7), (0,1,5,4),
                                                        (1,2,6,5), (2,3,7,6), (3,0,4,7)]])

    def create(self, name, material, parent):
        return h.object_mesh(name, self.vertices, self.faces, material, parent)


def _context(parent):
    previous = bpy.data.objects.get('Background_Context')
    if previous:
        _remove_tree(previous)
    root = h.empty('Background_Context', parent)
    for name, color, rough in [('V2 context masonry warm', '#b3b4ae', .86), ('V2 context masonry cool', '#adb9bc', .84),
                               ('V2 context masonry dark', '#84969a', .81), ('V2 context glazing', '#6d888e', .46),
                               ('V2 ridge near', '#899b9e', 1), ('V2 ridge middle', '#a0aeb3', 1),
                               ('V2 ridge far', '#b9c4c8', 1), ('V2 riverbank', '#7e876a', 1)]:
        h.material(name, color, rough)
    _ridge(root, 55, 670, 60, 'V2 ridge far')
    _ridge(root, 36, 580, 45, 'V2 ridge middle')
    _ridge(root, 77, 485, 30, 'V2 ridge near')
    # A shallow river corridor and two uneven banks replace the unbroken lawn.
    h.box('V2 distant river water', (0, 124, -.015), (1600, 88, .035), 'V2 water', 0, root)
    for side in [-1, 1]:
        verts, faces = [], []
        for i in range(70):
            x = -830+i*24
            y = 124+side*(39+6*math.sin(i*.33)+2*math.sin(i*.91))
            verts += [(x, y, .02), (x, y+side*16, .045)]
        for i in range(69):
            faces.append((i*2, i*2+1, i*2+3, i*2+2))
        h.object_mesh('V2 curved planted riverbank', verts, faces, 'V2 riverbank', root)
    rng = random.Random(16518)
    batches = [_Boxes() for _ in range(4)]
    # District spacing creates streets and several depth planes rather than a
    # repeating line of blocks. Window bands include recesses and vertical piers.
    for district_x, district_y, count in [(-260, 195, 24), (-135, 225, 26), (-26, 253, 20),
                                         (107, 220, 22), (235, 245, 27), (370, 240, 14), (-420, 260, 16)]:
        for index in range(count):
            col, row = index % 6, index // 6
            x = district_x+(col-2.5)*17+rng.uniform(-2, 2)
            y = district_y+row*22+rng.uniform(-2, 2)
            w, d = rng.uniform(7, 12), rng.uniform(8, 14)
            floors = rng.randint(4, 11)
            if index % 13 == 0:
                floors += 4
            height = floors*2.9
            stone = batches[rng.randrange(3)]
            stone.add(x, y, height/2, w, d, height)
            stone.add(x, y+.55, height+.45, w*.59, d*.66, .9)
            for floor in range(floors):
                z = floor*2.9+1.65
                batches[3].add(x, y-d/2-.022, z, w-.65, .035, 1.61)
                batches[3].add(x+w/2+.022, y, z, .035, d-.65, 1.61)
            for j in range(1, max(2, round(w/2.2))):
                xx = x-w/2+j*w/max(2, round(w/2.2))
                stone.add(xx, y-d/2-.055, height/2, .15, .09, height-.22)
            for j in range(1, max(2, round(d/2.6))):
                yy = y-d/2+j*d/max(2, round(d/2.6))
                stone.add(x+w/2+.055, yy, height/2, .09, .15, height-.22)
    for batch, material in zip(batches, ['V2 context masonry warm', 'V2 context masonry cool',
                                       'V2 context masonry dark', 'V2 context glazing']):
        city = batch.create('V2 clustered distant city '+material.rsplit(' ', 1)[-1], material, root)
        city.location.y = 100
    forest = h.empty('V2 Distant_Woodland', root)
    prototype = h.empty('V2 distant tree prototype', forest)
    h.cylinder('V2 distant trunk', (0, 0, 1.5), .14, 3, 'bark', parent=prototype, segments=7, edge=0)
    # All instances share three real-leaf meshes: 450 leaves per tree keep the
    # silhouette porous without the smooth balls visible in the first preview.
    for i in range(3):
        angle = i*2.4
        center = Vector((math.cos(angle)*.78, math.sin(angle)*.78, 3.25+i*.39))
        _branch('V2 distant tapered bough', [(0, 0, 2.1), center*.72+Vector((0, 0, .65)), center],
                [.055, .028, .006], prototype, 6)
        canopy = leaf_cloud('V2 distant shared leaf cluster', 1450+i, 1.21, 0, prototype, count=150, leafscale=1.55)
        canopy.location = center
        canopy.scale = (1.10 if i==0 else .95, .94 if i==0 else 1.12, 1.02+i*.06)
        canopy.rotation_euler.z = angle
    positions = []
    for i in range(98):
        positions.append((-320+i*7.5+rng.uniform(-2, 2), 61+rng.uniform(-12, 12), rng.uniform(1.0, 1.7)))
    for i in range(68):
        positions.append((-370+i*11+rng.uniform(-3, 3), 240+rng.uniform(-6, 11), rng.uniform(1, 1.8)))
    for i, (x, y, size) in enumerate(positions):
        if i == 0:
            prototype.location, prototype.scale = (x, y, 0), (size, size, size)
        else:
            _copy_group(prototype, forest, (x, y, 0), size, rng.random()*h.TAU, 'V2 distant tree %03d' % i)
    root['geometryContextOnly'] = True
    root['externalImagesRequired'] = False


def refine(parent):
    """Run once after opening V1 and calling architecture.finishes()."""
    if bpy.data.objects.get('V2 Arrival_Details'):
        raise RuntimeError('Landscape V2 is already present; reopen the V1 source before rebuilding.')
    _planting(parent)
    _road_and_arrival(parent)
    _context(parent)
    bpy.context.view_layer.update()
    return {'treeSpecies': 3, 'ambulanceLaneCenterX': 44, 'rightGardenCenterX': 49,
            'distantTreeCount': 166, 'distantBuildingCount': 149, 'contextUsesImageBackdrops': False}
