"""Reuse physical-bed validation and check the hospital-specific revision."""
import hashlib
import json
import sys
from pathlib import Path
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parent))
import verify_hospital_floor_reference_v1 as base

base.OUT=base.ROOT/'output/hospital-floor-reference-v2'
base.SOURCE=base.OUT/'hospital-floor-reference-v2.blend'
base.main()
report=json.loads((base.OUT/'validation.json').read_text(encoding='utf-8'))
scene=bpy.data.scenes['Floor_Light']
details=bpy.data.objects['Hospital_Clinical_Details_V2']
report['clinicalDetails']=len(details.children_recursive)
report['roomCallIndicators']=sum(o.get('assetRole')=='room-call-indicator' for o in scene.objects)
report['clinicalTrolleys']=sum(o.get('assetRole')=='clinical-trolley' for o in scene.objects)
report['slidingRoomDoors']=sum(o.get('mechanism')=='corridor-side sliding' for o in scene.objects)
report['diagonalBirdseyeCamera']=abs(scene.camera.location.x)>10
report['corridorBoundaryWidthMetres']=scene['circulationWidthMetres']
v1=base.ROOT/'output/hospital-floor-reference-v1/hospital-floor-reference-v1.blend'
report['v1Preserved']=hashlib.sha256(v1.read_bytes()).hexdigest()=='ec9478cd8d8773fa22653795e406c4e50724c97ae4ecf9e1833dc9dcd5398e27'
checks={'indicators':report['roomCallIndicators']==8,'trolleys':report['clinicalTrolleys']==2,
        'doors':report['slidingRoomDoors']==4,'camera':report['diagonalBirdseyeCamera'],'preservedV1':report['v1Preserved']}
for key,ok in checks.items():
    if not ok:report['failures'].append('V2 check failed: '+key)
(base.OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('HOSPITAL_FLOOR_V2_CHECKS '+json.dumps(checks),flush=True)
if report['failures']:raise RuntimeError(str(report['failures']))
