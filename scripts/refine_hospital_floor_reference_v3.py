"""Refine the native clinical ward and render pure-model theme/detail views."""
import hashlib
import json
import sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import hospital_floor_furnishings_v3 as furnishings
import build_hospital_floor_reference_v1 as pipeline

OUT=h.ROOT/'output/hospital-floor-reference-v3'
SOURCE=OUT/'hospital-floor-reference-v3.blend'
V2=h.ROOT/'output/hospital-floor-reference-v2/hospital-floor-reference-v2.blend'
VIEWS={'light':'Floor_Light','dark':'Floor_Dark','detail':'Floor_Light','station':'Floor_Light'}
CAMERAS={'light':'Floor_Overview_Camera','dark':'Floor_Overview_Camera',
         'detail':'Floor_Detail_Camera','station':'Nursing_Detail_Camera'}


def build():
    bpy.ops.wm.open_mainfile(filepath=str(V2));bpy.context.window.scene=bpy.data.scenes['Floor_Light']
    h.M.clear();h.M.update({m.name:m for m in bpy.data.materials})
    h.material('V3_NursingFloor','#b7c9c8',.52,noise=.003)
    h.material('V3_Mirror','#c4d0d4',.12,metal=.95)
    root=bpy.data.objects['Hospital_Floor_Reference_V2'];root.name='Hospital_Floor_Reference_V3'
    detail=h.empty('Hospital_Clinical_Furnishings_V3',root)
    furnishings.nursing(detail);furnishings.transport(detail)
    furnishings.room_details(detail);furnishings.support_rooms(detail)
    for name,color,roughness in [('Floor_Vinyl','#cedbd7',.55),('Floor_Stone','#c0cbce',.42),
                                  ('Floor_Wall','#e5e8e4',.67),('Floor_Oak','#bcae95',.53)]:
        mat=h.M[name];mat.diffuse_color=(*h.rgb(color),1)
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=mat.diffuse_color
        shader.inputs['Roughness'].default_value=roughness
    bpy.data.objects['Large soft key'].data.size=8.5
    camera=bpy.data.objects['Floor_Detail_Camera'];camera.location=(12,-17,18)
    camera.data.ortho_scale=10.0;h.aim(camera,(2.2,-4.65,1.0))
    pipeline.camera('Nursing_Detail_Camera',(10,-14,14),(0,.5,.55),12.3)
    light=bpy.data.scenes['Floor_Light'];dark=bpy.data.scenes['Floor_Dark']
    for obj in list(light.objects):
        if obj.name not in dark.objects:dark.collection.objects.link(obj)
    for scene in [light,dark]:
        scene['revision']='V3 nursing support, equipment parking and clinical room detailing'
        scene['deliveredViews']=json.dumps(CAMERAS)
    h.save(OUT,SOURCE.stem,pipeline.REFERENCE,{'version':3,'basedOn':str(V2),'rooms':8,'beds':16,
          'pureModelViews':True,'themes':['Floor_Light','Floor_Dark'],'views':CAMERAS,
          'fidelity':'General clinical ward concept, not surveyed floor-plan reconstruction'})


def render(view,width,samples):
    scene=bpy.data.scenes[VIEWS[view]];bpy.context.window.scene=scene
    scene.camera=bpy.data.objects[CAMERAS[view]]
    width=min(width,1600) if view in {'detail','station'} else width
    scene.render.resolution_x=width;scene.render.resolution_y=round(width*2/3)
    scene.cycles.samples=samples;scene.cycles.use_denoising=False
    scene.render.film_transparent=True;scene.view_layers[0].cycles.denoising_store_passes=True
    scene.render.use_compositing=False
    scene.render.image_settings.file_format='OPEN_EXR_MULTILAYER'
    scene.render.image_settings.color_depth='32';scene.render.image_settings.exr_codec='ZIP'
    scene.render.filepath=str(OUT/(view+'-raw.exr'))
    bpy.ops.render.render(write_still=True)
    metadata={'width':width,'height':scene.render.resolution_y,'samples':samples,
              'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
              'viewTransform':scene.view_settings.view_transform,'look':scene.view_settings.look,
              'exposure':scene.view_settings.exposure,'gamma':scene.view_settings.gamma,
              'output':view+'.png','scene':scene.name,'camera':scene.camera.name}
    (OUT/(view+'-render-settings.json')).write_text(json.dumps(metadata,indent=2),encoding='utf-8')
    print('FLOOR_V3_RENDER_FINISHED '+view,flush=True)


if __name__=='__main__':
    pipeline.OUT=OUT;pipeline.SOURCE=SOURCE;pipeline.VIEWS=VIEWS
    pipeline.build=build;pipeline.render=render;pipeline.main()
