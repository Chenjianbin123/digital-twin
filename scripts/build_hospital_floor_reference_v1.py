"""Build and render a native ward cutaway from the accepted paired concept."""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0,str(Path(__file__).resolve().parent))
import hospital_reconstruction_common as h
import hospital_floor_reference_details as d
import ward_graphite_common as gh
from ward_graphite_bed import build_bed
from ward_graphite_equipment import build_equipment

OUT=h.ROOT/'output/hospital-floor-reference-v1'
SOURCE=OUT/'hospital-floor-reference-v1.blend'
REFERENCE=h.ROOT/'output/imagegen/hospital-floor-themes-20261009/hospital-floor-light-dark-v1.png'
VIEWS={'light':'Floor_Light','dark':'Floor_Dark','detail':'Floor_Light'}


def clone(root, parent, name):
    copies={}
    for original in [root]+list(root.children_recursive):
        obj=original.copy();obj.name=name+'_'+original.name
        bpy.context.collection.objects.link(obj);copies[original]=obj
    for original,obj in copies.items():
        obj.parent=copies.get(original.parent,parent)
        obj.matrix_basis=original.matrix_basis.copy()
    result=copies[root];result.name=name
    return result


def camera(name,loc,target,scale):
    data=bpy.data.cameras.new(name);data.type='ORTHO';data.ortho_scale=scale;data.clip_end=300
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
    obj.location=loc;h.aim(obj,target)
    return obj


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'textures').mkdir(exist_ok=True)
    h.M.clear();gh.M.clear();gh.make_materials(OUT);d.palette()
    # Build the detailed boolean bed once; linked meshes preserve editable parts.
    prototype=h.empty('Prototype_Bed')
    build_bed(prototype);equipment=build_equipment(prototype)
    # Smaller furniture fits two bed modules per room without changing bed geometry.
    equipment['cabinet'].location.x=-.78
    equipment['headwall'].scale.x=.76
    for obj in equipment['headwall'].children_recursive:
        if obj.type=='MESH' and 'GraphiteFace' in obj.name:
            obj.data.materials.clear();obj.data.materials.append(h.M['Floor_Oak'])
        if obj.type=='MESH' and 'RecessedFrame' in obj.name:
            obj.data.materials.clear();obj.data.materials.append(h.M['Floor_CutEdge'])
    root=h.empty('Hospital_Floor_Reference_V1')
    root['assetRole']='ward-floor';root['units']='metres'
    root['bindingNote']='Demo identifiers only; bind real rooms/beds through explicit mapping'
    d.box('Structural floor slab',(0,0,-.095),(25.50,14.66,.31),'Floor_CutEdge',.06,root)
    d.box('Continuous clinical floor',(0,0,.045),(25.27,14.44,.08),'Floor_Stone',.01,root)
    for x in range(-12,13):d.box('Stone floor joint',(x,0,.087),(.007,14.40,.003),'Floor_Seam',0,root)
    for y in range(-7,8):d.box('Stone floor joint',(0,y,.088),(25.24,.007,.003),'Floor_Seam',0,root)
    rooms=[];beds=[]
    for north in [True,False]:
        for i,x in enumerate([-6.6,-2.2,2.2,6.6]):
            number=101+i+(0 if north else 4)
            room=d.room_shell(root,number,x,north);rooms.append(room)
            for slot,dx in enumerate([-1.07,1.07],1):
                bed=clone(prototype,room,f'Bed_{number}_{slot:02d}')
                bed.location=(x+dx,5.41 if north else -4.0,.10)
                bed.rotation_euler.z=math.pi
                bed['assetRole']='physical-bed';bed['bedId']=f'demo-{number}-{slot:02d}'
                bed['roomId']=room['roomId'];bed['slot']=slot;beds.append(bed)
    for obj in [prototype]+list(prototype.children_recursive):bpy.data.objects.remove(obj,do_unlink=True)
    d.station(root);d.wings(root)
    graphics=h.empty('Preview_Graphics',root);graphics['previewOnly']=True
    for north in [True,False]:
        for i,x in enumerate([-6.6,-2.2,2.2,6.6]):
            number=101+i+(0 if north else 4)
            y=6.63 if north else -2.78
            d.box('Room label plaque',(x,y,2.53),(1.07,.045,.31),'Floor_White',.015,graphics)
            h.text('Room number '+str(number),str(number),(x,y-.029,2.53),.24,'Floor_Ink',graphics)
    # The display layer can be hidden without altering the architectural model.
    for a,b in [((.02,2.20,.12),(.02,7.10,.12)),((4.38,2.20,.12),(4.38,7.10,.12)),
                ((.02,2.20,.12),(4.38,2.20,.12)),((.02,7.10,.12),(4.38,7.10,.12))]:
        h.bar('Selected room 103 perimeter',a,b,.025,'Floor_Blue',graphics)
    alert=h.text('Room106 demo alert','!',(-1.51,-2.82,2.53),.24,'Floor_Amber',graphics)
    alert['previewOnly']=True
    hero=camera('Floor_Overview_Camera',(0,-28,32),(0,0,.30),29.1)
    detail=camera('Floor_Detail_Camera',(16,-19,20),(2.2,-2.8,.7),13.8)
    light=bpy.context.scene;light.name='Floor_Light'
    light.world=bpy.data.worlds.new('Floor neutral environment');light.world.use_nodes=True
    light.world.node_tree.nodes['Background'].inputs[0].default_value=(.76,.84,.92,1)
    light.world.node_tree.nodes['Background'].inputs[1].default_value=.40
    h.area('Large soft key',(-8,-4,20),(0,0,0),3300,15,(1,.96,.90),12)
    h.area('Window fill',(9,9,14),(0,0,0),2100,12,(.87,.94,1),8)
    h.area('Front bounce',(0,-12,9),(0,0,1),1000,11,(.92,.97,1),6)
    for x in [-6.6,-2.2,2.2,6.6]:
        for y in [-4.7,4.7]:h.area('Room practical light',(x,y,4.2),(x,y,0),55,2.5,(1,.98,.94),2)
    light.camera=hero;light.unit_settings.system='METRIC'
    light.render.engine='CYCLES';light.cycles.samples=64;light.cycles.use_denoising=False
    light.cycles.adaptive_threshold=.025;light.cycles.max_bounces=8
    light.cycles.transmission_bounces=6;light.cycles.transparent_max_bounces=8
    light.render.resolution_x=2400;light.render.resolution_y=1600
    light.render.resolution_percentage=100;light.render.film_transparent=False
    light.render.image_settings.file_format='PNG';light.render.image_settings.color_mode='RGBA'
    light.view_settings.view_transform='AgX';light.view_settings.look='AgX - Medium High Contrast'
    light.view_settings.exposure=.12
    dark=light.copy();dark.name='Floor_Dark';dark.use_fake_user=True;dark.world=light.world.copy()
    dark.world.name='Floor cool environment'
    dark.world.node_tree.nodes['Background'].inputs[0].default_value=(.44,.60,.78,1)
    dark.world.node_tree.nodes['Background'].inputs[1].default_value=.30
    dark.view_settings.exposure=.05
    # Camera background follows the app theme without recolouring illumination.
    for scene,color in [(light,'#dce8ed'),(dark,'#102632')]:
        nodes=scene.world.node_tree.nodes;links=scene.world.node_tree.links
        ambient=nodes.get('Background');output=nodes.get('World Output')
        backdrop=nodes.new('ShaderNodeBackground');backdrop.inputs[0].default_value=(*h.rgb(color),1)
        backdrop.inputs[1].default_value=1
        rays=nodes.new('ShaderNodeLightPath');mix=nodes.new('ShaderNodeMixShader')
        links.new(rays.outputs['Is Camera Ray'],mix.inputs[0])
        links.new(ambient.outputs[0],mix.inputs[1]);links.new(backdrop.outputs[0],mix.inputs[2])
        links.new(mix.outputs[0],output.inputs['Surface'])
    light['theme']='light';dark['theme']='dark'
    for scene in [light,dark]:
        scene['layoutRooms']=8;scene['physicalBeds']=16
        scene['designNote']='Reference reconstruction; inferred dimensions; not surveyed geometry'
        scene['reference']=str(REFERENCE)
    bpy.context.window.scene=light
    h.save(OUT,SOURCE.stem,REFERENCE,{'rooms':8,'beds':16,'themes':['Floor_Light','Floor_Dark'],
         'camera':hero.name,'detailCamera':detail.name,'boundsMetres':[25.5,14.66],
         'fidelity':'Visible reference-led geometry; inferred spatial dimensions, no exact-match claim'})


def render(view,width,samples):
    scene=bpy.data.scenes[VIEWS[view]];bpy.context.window.scene=scene
    scene.camera=bpy.data.objects['Floor_Detail_Camera' if view=='detail' else 'Floor_Overview_Camera']
    scene.render.resolution_x=width;scene.render.resolution_y=round(width*2/3)
    scene.cycles.samples=samples;scene.cycles.use_denoising=False
    scene.render.film_transparent=True
    scene.view_layers[0].cycles.denoising_store_passes=True
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
    print('FLOOR_RENDER_FINISHED '+view,flush=True)


def denoise(view):
    # Reuse proven empty-process OIDN; then output an RGBA composite for the UI board.
    metadata=json.loads((OUT/(view+'-render-settings.json')).read_text())
    if metadata['sourceSha256']!=hashlib.sha256(SOURCE.read_bytes()).hexdigest():
        raise RuntimeError('Render/source provenance mismatch')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=1
    scene.camera=camera('Composite camera',(0,0,1),(0,0,0),2)
    scene.render.resolution_x=metadata['width'];scene.render.resolution_y=metadata['height']
    scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA'
    scene.render.filepath=str(OUT/metadata['output'])
    for attr in ['view_transform','look','exposure','gamma']:
        key='viewTransform' if attr=='view_transform' else attr
        setattr(scene.view_settings,attr,metadata[key])
    scene.use_nodes=True;nodes=scene.node_tree.nodes;links=scene.node_tree.links;nodes.clear()
    source=nodes.new('CompositorNodeImage');source.image=bpy.data.images.load(str(OUT/(view+'-raw.exr')))
    filt=nodes.new('CompositorNodeDenoise');filt.prefilter='FAST';filt.quality='HIGH';filt.inputs['HDR'].default_value=True
    for src,dst in [('Combined','Image'),('Denoising Normal','Normal'),('Denoising Albedo','Albedo')]:
        links.new(source.outputs[src],filt.inputs[dst])
    alpha=nodes.new('CompositorNodeSetAlpha');alpha.mode='REPLACE_ALPHA'
    links.new(filt.outputs['Image'],alpha.inputs['Image']);links.new(source.outputs['Alpha'],alpha.inputs['Alpha'])
    output=nodes.new('CompositorNodeComposite');links.new(alpha.outputs['Image'],output.inputs['Image'])
    bpy.ops.render.render(write_still=True)
    metadata['pngSha256']=hashlib.sha256((OUT/metadata['output']).read_bytes()).hexdigest()
    metadata['denoising']='OIDN in separate empty scene; alpha preserved'
    (OUT/(view+'-render-settings.json')).write_text(json.dumps(metadata,indent=2),encoding='utf-8')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--render-only',action='store_true')
    parser.add_argument('--denoise-only',action='store_true');parser.add_argument('--skip-render',action='store_true')
    parser.add_argument('--views',nargs='+',choices=VIEWS,default=['light'])
    parser.add_argument('--width',type=int,default=2400);parser.add_argument('--samples',type=int,default=64)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if not 400<=args.width<=4096 or not 1<=args.samples<=512:parser.error('Invalid render quality')
    if args.denoise_only:
        for view in args.views:denoise(view)
        return
    if args.render_only:bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
    else:build()
    if not args.skip_render:
        for view in args.views:render(view,args.width,args.samples)


if __name__=='__main__':main()
