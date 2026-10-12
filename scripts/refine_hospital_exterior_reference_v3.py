"""Build a separate V3 native hospital with outpatient parking and forecourt."""
import json
import shutil
import sys
from pathlib import Path
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import refine_hospital_exterior_reference_v2 as renderer
import hospital_exterior_parking_v3 as parking
import hospital_exterior_campus_v3 as campus

OUT=h.ROOT/'output/hospital-exterior-reference-v3'
SOURCE=OUT/'hospital-exterior-reference-v3.blend'
V2=h.ROOT/'output/hospital-exterior-reference-v2/hospital-exterior-reference-v2.blend'
VIEWS={
    'hero':('Reference_Hero_Camera',(78,-178,44),(-2,-24,15),48),
    'entrance':('Entrance_Detail_Camera',(26,-56,14),(0,-17,4.8),44),
    'parking':('Parking_Detail_Camera',(-74,-91,45),(-32,-43,0),48),
    'comparison':('V2_Comparison_Camera',None,None,None),
}


def build():
    bpy.ops.wm.open_mainfile(filepath=str(V2))
    h.M.clear()
    h.M.update({m.name:m for m in bpy.data.materials})
    old=bpy.data.objects['Reference_Hero_Camera']
    camera=old.copy(); camera.data=old.data.copy()
    camera.name='V2_Comparison_Camera'
    bpy.context.collection.objects.link(camera)
    bpy.data.objects['HospitalExterior_Reference_V2'].name='HospitalExterior_Reference_V3'
    new_campus=h.empty('V3_Campus')
    campus.architecture()
    details=parking.build(new_campus)
    campus.build(new_campus)
    renderer.cameras()
    scene=bpy.context.scene
    scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.48
    sun=bpy.data.objects['Soft afternoon sun']
    sun.data.energy=3.3
    sun.data.color=(1,.92,.80)
    sun.data.angle=.045
    sun.location=(-80,-70,105)
    h.aim(sun,(0,-12,0))
    scene.view_settings.exposure=.30
    scene.cycles.samples=96
    scene.render.resolution_x=2560
    scene.render.resolution_y=1441
    scene.render.filepath=str(OUT/'hero.png')
    scene['revision']='V3 - outpatient parking, clinical facades and hospital forecourt'
    scene['sourceV2']=str(V2)
    scene['deliveredViews']=json.dumps({k:v[0] for k,v in VIEWS.items()})
    scene['parkingLayout']=json.dumps(details,ensure_ascii=False)
    h.save(OUT,SOURCE.stem,renderer.REFERENCE,{
        'version':3,'basedOn':str(V2),'camera':scene.camera.name,
        'views':{k:v[0] for k,v in VIEWS.items()},'parking':details,
        'fidelity':'Editable visual design; not a surveyed hospital or civil/accessibility certification',
    })
    shutil.copy2(V2.parent/'environment-license.txt',OUT/'environment-license.txt')


if __name__=='__main__':
    # Reuse the already tested EXR-to-empty-process denoising path without
    # changing any V2 file or duplicating its renderer and provenance logic.
    renderer.OUT=OUT
    renderer.SOURCE=SOURCE
    renderer.VIEWS=VIEWS
    renderer.build=build
    renderer.main()
