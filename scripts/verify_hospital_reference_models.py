"""Finalize/reopen native deliverables and inspect geometry, assets and renders.

Run with -- --asset hospital|operating-room [--pack-reference] [--render-detail].
This verifies native assets, not surveyed dimensions or pixel-perfect similarity.
"""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h

ASSETS={
    'hospital':{
        'folder':'hospital-exterior-reference-v1','root':'HospitalExterior_Reference_V1',
        'roles':['Hospital_Buildings','Central_Inpatient_Tower','West_Wing','East_Wing',
                 'Outpatient_Podium','Campus_Hardscape','Landscape_Planting','Ambulance'],
        'detail_loc':(28,-51,12),'detail_target':(0,-16,5),'detail_lens':43,
        'reference':'hospital-exterior-high-fidelity-v1.png',
    },
    'operating-room':{
        'folder':'operating-room-reference-v1','root':'OperatingRoom_Reference_V1',
        'roles':['Room_Shell','Integrated_Wall_Equipment','Operating_Table','Dual_Surgical_Lights',
                 'Anesthesia_Workstation','Equipment_Pendant','Dual_Monitor_Arm','Mobile_Accessories'],
        'detail_loc':(-1.8,-3.0,1.95),'detail_target':(.22,-.40,1.02),'detail_lens':41,
        'reference':'operating-room-high-fidelity-v1.png',
    },
}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--asset',choices=ASSETS,required=True)
    parser.add_argument('--render-detail',action='store_true')
    parser.add_argument('--pack-reference',action='store_true',help='Explicitly embed and retain the reference before validation')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    config=ASSETS[args.asset]
    out=h.ROOT/'output'/config['folder']
    source=out/(config['folder']+'.blend')
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene=bpy.context.scene
    if args.pack_reference:
        reference=h.ROOT/'output/imagegen/hospital-concepts-20261005'/config['reference']
        image=bpy.data.images.load(str(reference),check_existing=True)
        image.name='REFERENCE - concept image, not a render'
        image.use_fake_user=True
        image.pack()
        scene['referenceImage']=image.name
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
        # Check what was actually persisted, not just this Python process's data.
        bpy.ops.wm.open_mainfile(filepath=str(source))
        scene=bpy.context.scene
    failures=[]
    root=scene.objects.get(config['root'])
    if root is None:failures.append('Missing asset root')
    for name in config['roles']:
        obj=scene.objects.get(name)
        if obj is None or not obj.children_recursive:failures.append('Missing or empty assembly: '+name)
    if scene.unit_settings.system!='METRIC':failures.append('Units must be metric')
    if not scene.camera or scene.camera.type!='CAMERA':failures.append('Missing render camera')
    if scene.render.engine!='CYCLES':failures.append('Expected native Cycles scene')
    if not scene.world or not scene.world.use_nodes:failures.append('Missing lighting world')
    packed_images=[]
    reference=bpy.data.images.get(scene.get('referenceImage',''))
    if reference is None or not reference.packed_file or not reference.use_fake_user:
        failures.append('Reference image must remain packed after reopening')
    for image in bpy.data.images:
        if image.source=='FILE':
            if not image.packed_file:failures.append('Unpacked image: '+image.name)
            else:packed_images.append(image.name)
    for font in bpy.data.fonts:
        if font.filepath and font.filepath!='<builtin>' and not font.packed_file:
            failures.append('Unpacked font: '+font.name)
    meshes=[o for o in scene.objects if o.type=='MESH']
    unique_meshes={o.data.as_pointer():o.data for o in meshes}.values()
    unique_vertices=0
    for mesh in unique_meshes:
        positions=np.empty(len(mesh.vertices)*3,dtype=np.float32)
        mesh.vertices.foreach_get('co',positions)
        if not np.isfinite(positions).all():failures.append('Invalid geometry: '+mesh.name)
        unique_vertices+=len(mesh.vertices)
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):
            failures.append('Invalid world matrix: '+obj.name)
        if obj.type=='MESH' and not obj.data.materials:failures.append('Mesh has no material: '+obj.name)
    if args.asset=='operating-room':
        table=scene.objects.get('Operating_Table')
        for obj in table.children_recursive if table else []:
            if obj.type=='MESH' and any(mod.type=='BEVEL' for mod in obj.modifiers):
                if not all(face.use_smooth for face in obj.data.polygons):
                    failures.append('Faceted bevel on operating table: '+obj.name)
    evaluated_triangles=0
    depsgraph=bpy.context.evaluated_depsgraph_get()
    renderable=[o for o in scene.objects if o.type in {'MESH','CURVE','FONT'}]
    for obj in renderable:
        evaluated=obj.evaluated_get(depsgraph)
        mesh=evaluated.to_mesh()
        mesh.calc_loop_triangles()
        evaluated_triangles+=len(mesh.loop_triangles)
        evaluated.to_mesh_clear()
    render=out/'hero.png'
    if not render.is_file():failures.append('Main Cycles render is missing')
    else:
        image=bpy.data.images.load(str(render),check_existing=False)
        dimensions=list(image.size)
        if dimensions[0]<1672:failures.append('Main render is still a draft')
        bpy.data.images.remove(image)
    report={'asset':args.asset,'source':str(source),'blenderVersion':bpy.app.version_string,
            'meshObjects':len(meshes),'uniqueVertices':unique_vertices,
            'evaluatedTrianglesIncludingInstances':evaluated_triangles,
            'packedImages':packed_images,'sourceBytes':source.stat().st_size,
            'renderDimensions':dimensions if render.is_file() else None,
            'requiredAssemblies':config['roles'],'failures':failures,
            'scope':'Native source structure and render checks; no production runtime or exact reference-match claim'}
    (out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('NATIVE_ASSET_VALIDATION '+json.dumps(report,ensure_ascii=False),flush=True)
    if failures:raise RuntimeError('Native asset verification failed: '+', '.join(failures))
    if args.render_detail:
        original_camera=scene.camera
        camera=scene.objects.get('Detail_Camera')
        if camera is None:
            data=bpy.data.cameras.new('Model detail lens')
            camera=bpy.data.objects.new('Detail_Camera',data)
            bpy.context.collection.objects.link(camera)
        camera.data.lens=config['detail_lens']
        camera.location=config['detail_loc']
        h.aim(camera,config['detail_target'])
        # Store both useful cameras while keeping the approved hero as default.
        bpy.context.preferences.filepaths.save_version=0
        bpy.ops.wm.save_as_mainfile(filepath=str(source))
        report['sourceBytes']=source.stat().st_size
        (out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        scene.camera=camera
        scene.render.resolution_x=1600
        scene.render.resolution_y=900
        scene.cycles.samples=48
        scene.render.filepath=str(out/'detail.png')
        bpy.ops.render.render(write_still=True)
        scene.camera=original_camera


if __name__=='__main__':main()
