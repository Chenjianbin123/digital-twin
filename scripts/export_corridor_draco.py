import bpy
from pathlib import Path

source = Path("/Users/chenjianbin/Projects/3D/digital-twin/public/models/hospital-corridor/source/area-source.glb")
output = Path("/Users/chenjianbin/Projects/3D/digital-twin/public/models/hospital-corridor/area-draco-preview.glb")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))

bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_image_format="AUTO",
    export_materials="EXPORT",
    export_texcoords=True,
    export_normals=True,
    export_cameras=False,
    export_lights=False,
)
print(f"exported {output} ({output.stat().st_size} bytes)")
