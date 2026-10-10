"""Reopen the native asset and validate geometry, bindings and render provenance."""
import hashlib
import json
import math
import struct
import sys
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/hospital-floor-reference-v1'
SOURCE=OUT/'hospital-floor-reference-v1.blend'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(theme_object_types=None):
    bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    scene=bpy.data.scenes['Floor_Light'];bpy.context.window.scene=scene
    scene.view_layers[0].update();graph=bpy.context.evaluated_depsgraph_get()
    failures=[];rooms=[o for o in scene.objects if o.name.startswith('Room_') and o.get('capacity')==2]
    beds=[o for o in scene.objects if o.get('assetRole')=='physical-bed']
    if len(rooms)!=8:failures.append('Expected eight rooms')
    if len(beds)!=16:failures.append('Expected sixteen physical beds')
    if len({b['bedId'] for b in beds})!=16:failures.append('Duplicate bed IDs')
    if len({r['roomId'] for r in rooms})!=8:failures.append('Duplicate room IDs')
    contacts=[];bed_bounds=[];room_projection=[]
    for room in rooms:
        children=[b for b in beds if b.parent==room]
        if len(children)!=2 or {b.get('slot') for b in children}!={1,2}:failures.append('Invalid slots '+room.name)
        floor=next(o for o in room.children if o.name.startswith('Room resilient floor'))
        floor_corners=[floor.matrix_world@Vector(v) for v in floor.bound_box]
        floor_z=max(v.z for v in floor_corners)
        xmin,xmax=min(v.x for v in floor_corners),max(v.x for v in floor_corners)
        ymin,ymax=min(v.y for v in floor_corners),max(v.y for v in floor_corners)
        label=bpy.data.objects['Room number '+room['roomNumber']]
        projected=world_to_camera_view(scene,scene.camera,label.matrix_world.translation)
        corners=[world_to_camera_view(scene,scene.camera,Vector((x,y,.13)))
                 for x,y in [(xmin,ymin),(xmax,ymin),(xmax,ymax),(xmin,ymax)]]
        room_projection.append({'number':room['roomNumber'],'label':[projected.x,projected.y],
                                'corners':[[p.x,p.y] for p in corners]})
        local_bounds=[]
        for bed in children:
            if bed['roomId']!=room['roomId']:failures.append('Cross-room bed binding '+bed.name)
            body=next(o for o in bed.children if o.get('assetRole')=='bed-body')
            vertices=[]
            for obj in body.children_recursive:
                if obj.type=='MESH':
                    ev=obj.evaluated_get(graph)
                    vertices.extend(ev.matrix_world@Vector(v) for v in ev.bound_box)
                if 'Caster_Tyre' in obj.name:
                    ev=obj.evaluated_get(graph)
                    points=[ev.matrix_world@v.co for v in ev.data.vertices]
                    gap=min(p.z for p in points)-floor_z
                    contacts.append({'tyre':obj.name,'gapMetres':gap})
                    if abs(gap)>.002:failures.append('Tyre not grounded '+obj.name)
            lo=[min(p[i] for p in vertices) for i in range(3)]
            hi=[max(p[i] for p in vertices) for i in range(3)]
            if lo[0]<xmin or hi[0]>xmax or lo[1]<ymin or hi[1]>ymax:
                failures.append('Bed outside physical room '+bed.name)
            record={'bed':bed.name,'min':lo,'max':hi};bed_bounds.append(record);local_bounds.append(record)
        if len(local_bounds)==2:
            a,b=local_bounds
            if all(min(a['max'][i],b['max'][i])>max(a['min'][i],b['min'][i]) for i in [0,1]):
                failures.append('Overlapping bed bodies '+room.name)
    dark=bpy.data.scenes['Floor_Dark']
    # Theme-specific lighting may differ while physical geometry stays shared.
    same_objects={o.as_pointer() for o in scene.objects if theme_object_types is None or o.type in theme_object_types}=={
        o.as_pointer() for o in dark.objects if theme_object_types is None or o.type in theme_object_types}
    same_camera=scene.camera==dark.camera
    if not same_objects or not same_camera:failures.append('Theme scene geometry/camera differs')
    if len(contacts)!=128:failures.append('Expected 128 twin-caster tyres')
    triangles=0;mesh_count=0;unique_meshes=set()
    for obj in scene.objects:
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):failures.append('Nonfinite transform '+obj.name)
        if obj.type not in {'MESH','CURVE','FONT'} or obj.hide_render:continue
        mesh_count+=obj.type=='MESH'
        if obj.type=='MESH':unique_meshes.add(obj.data.as_pointer())
        ev=obj.evaluated_get(graph);mesh=ev.to_mesh()
        triangles+=sum(len(face.vertices)-2 for face in mesh.polygons)
        ev.to_mesh_clear()
    unbound_images=[im.name for im in bpy.data.images if im.source=='FILE' and not im.packed_file]
    if unbound_images:failures.append('Unpacked image dependencies')
    external_fonts=[font.name for font in bpy.data.fonts if font.filepath!='<builtin>' and not font.packed_file]
    if external_fonts:failures.append('Unpacked font dependencies')
    for mesh in bpy.data.meshes:
        if not all(math.isfinite(value) for vertex in mesh.vertices for value in vertex.co):
            failures.append('Nonfinite mesh vertices '+mesh.name)
    reference=bpy.data.images.get('REFERENCE - concept image, not a render')
    if not reference or not reference.packed_file:failures.append('Missing packed reference')
    doors=[o for o in scene.objects if o.get('assetRole')=='door-terminal']
    terminals=[o for o in scene.objects if o.get('assetRole')=='bedside-terminal']
    if len(doors)!=8 or len(terminals)!=16:failures.append('Incorrect screen binding anchor counts')
    renders={};source_sha=sha(SOURCE)
    if '--source-only' not in sys.argv:
        for view in ['light','dark','detail']:
            path=OUT/(view+'.png');settings=OUT/(view+'-render-settings.json')
            if not path.exists() or not settings.exists():failures.append('Missing render '+view);continue
            raw=path.read_bytes();width,height=struct.unpack('>II',raw[16:24]);meta=json.loads(settings.read_text())
            valid=meta.get('sourceSha256')==source_sha and meta.get('pngSha256')==sha(path)
            valid=valid and (width,height)==(meta['width'],meta['height']) and meta['samples']>=48
            if not valid:failures.append('Invalid render provenance/quality '+view)
            renders[view]={'width':width,'height':height,'samples':meta['samples'],'valid':valid,'sha256':sha(path)}
    report={'source':str(SOURCE),'sourceSha256':source_sha,'sourceBytes':SOURCE.stat().st_size,
            'blenderVersion':bpy.app.version_string,'rooms':len(rooms),'physicalBeds':len(beds),
            'meshObjects':mesh_count,'uniqueMeshes':len(unique_meshes),'evaluatedTriangles':triangles,
            'doorTerminals':len(doors),'bedsideTerminals':len(terminals),
            'themeScenesShareGeometry':same_objects,'themeScenesShareCamera':same_camera,
            'tyreContacts':len(contacts),'maxTyreFloorGapMetres':max(abs(x['gapMetres']) for x in contacts),
            'bedBounds':bed_bounds,'roomProjection':room_projection,
            'packedReference':bool(reference and reference.packed_file),
            'externalImageDependencies':unbound_images,'externalFontDependencies':external_fonts,
            'renderProvenance':renders,'failures':failures,
            'limitations':'Concept-derived dimensions; no claim of surveyed geometry or pixel-perfect fidelity; no web integration'}
    (OUT/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print('FLOOR_VALIDATION '+json.dumps({k:v for k,v in report.items() if k not in {'bedBounds','roomProjection'}},ensure_ascii=False),flush=True)
    if failures:raise RuntimeError('; '.join(failures))


if __name__=='__main__':main()
