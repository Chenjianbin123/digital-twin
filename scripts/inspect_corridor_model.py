import bpy
from mathutils import Vector

path = "/Users/chenjianbin/Projects/3D/digital-twin/public/models/hospital-corridor/area-new-source.glb"
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
min_v = Vector((float("inf"), float("inf"), float("inf")))
max_v = Vector((float("-inf"), float("-inf"), float("-inf")))
for obj in meshes:
    for corner in obj.bound_box:
        world = obj.matrix_world @ Vector(corner)
        min_v.x = min(min_v.x, world.x)
        min_v.y = min(min_v.y, world.y)
        min_v.z = min(min_v.z, world.z)
        max_v.x = max(max_v.x, world.x)
        max_v.y = max(max_v.y, world.y)
        max_v.z = max(max_v.z, world.z)

print("BOUNDS", tuple(round(v, 3) for v in min_v), tuple(round(v, 3) for v in max_v))
for obj in sorted(meshes, key=lambda item: item.name):
    if obj.name.startswith("门"):
        print("DOOR", obj.name, "loc", tuple(round(v, 3) for v in obj.location), "dim", tuple(round(v, 3) for v in obj.dimensions))
