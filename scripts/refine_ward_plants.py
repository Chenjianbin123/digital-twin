"""Add two detailed, separately addressable indoor plant assets to the ward review model."""
from pathlib import Path
import bpy,math,json,random
import numpy as np
from mathutils import Vector
ROOT=Path('E:/projects/digital-twin');OUT=ROOT/'output/ward-model-refinement/plants';OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'output/ward-model-refinement/clinical-window/ward-room-clinical-window.blend'),load_ui=False,use_scripts=False)
scene=bpy.context.scene;rng=random.Random(731)
def material(name,color,rough=.5):
 m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF'];n.inputs['Base Color'].default_value=(*color,1);n.inputs['Roughness'].default_value=rough;return m
leaf=material('Plant textured leaf front',(.035,.16,.045),.42)
back=material('Plant lighter leaf reverse',(.11,.22,.07),.62)
wood=material('Plant woody stems',(.12,.085,.045),.77)
petiole=material('Plant green petioles',(.10,.19,.045),.56)
soil=material('Plant potting substrate',(.028,.018,.012),.96)
pebble=material('Plant substrate granules',(.11,.075,.045),.95)
ceramic=material('Plant warm ceramic',(.72,.70,.63),.42)
teal=material('Plant small ceramic',(.20,.36,.32),.42)
# Bake a UV-aligned leaf pattern, including midrib, secondary veins and restrained mottling.
size=512;yy,xx=np.mgrid[0:size,0:size].astype(np.float32);u=xx/(size-1);v=yy/(size-1);x=(u-.5)*2
noise=np.random.default_rng(731).normal(0,.006,(size,size))
center=np.exp(-(x/.025)**2)
phase=(v-np.abs(x)*.24)*11
veins=np.exp(-(np.sin(phase*math.pi)/.10)**2)*(.3+.7*(1-np.abs(x)))
base=np.zeros((size,size,4),np.float32);base[:,:,3]=1
for c,value in enumerate([.035,.135,.029]):base[:,:,c]=np.clip(value+noise+[.038,.07,.013][c]*center+[.012,.025,.008][c]*veins+[.006,.022,.004][c]*np.sin(v*math.pi),0,1)
img=bpy.data.images.new('Plant leaf veins color',width=size,height=size);img.pixels.foreach_set(base.ravel());img.filepath_raw=str(OUT/'leaf-veins.png');img.file_format='PNG';img.save();img.pack()
node=leaf.node_tree.nodes.new('ShaderNodeTexImage');node.image=img;leaf.node_tree.links.new(node.outputs['Color'],leaf.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
leaf.node_tree.nodes['Principled BSDF'].inputs['Subsurface Weight'].default_value=.045
height=center*.025+veins*.007
dy,dx=np.gradient(height)
normals=np.stack([-dx*30,-dy*30,np.ones_like(dx)],axis=-1)
normals/=np.linalg.norm(normals,axis=-1,keepdims=True)
normal_pixels=np.ones((size,size,4),np.float32);normal_pixels[:,:,:3]=normals*.5+.5
normal_img=bpy.data.images.new('Plant leaf vein normal',width=size,height=size)
normal_img.colorspace_settings.name='Non-Color';normal_img.pixels.foreach_set(normal_pixels.ravel())
normal_img.filepath_raw=str(OUT/'leaf-veins-normal.png');normal_img.file_format='PNG';normal_img.save();normal_img.pack()
normal_tex=leaf.node_tree.nodes.new('ShaderNodeTexImage');normal_tex.image=normal_img
normal_node=leaf.node_tree.nodes.new('ShaderNodeNormalMap');normal_node.inputs['Strength'].default_value=.35
leaf.node_tree.links.new(normal_tex.outputs['Color'],normal_node.inputs['Color'])
leaf.node_tree.links.new(normal_node.outputs['Normal'],leaf.node_tree.nodes['Principled BSDF'].inputs['Normal'])

def mesh_obj(name,verts,faces,mat,parent=None):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.materials.append(mat);obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
 if parent:obj.parent=parent
 for p in data.polygons:p.use_smooth=True
 return obj

def stem(name,points,radii,mat,parent):
 # A tapered mesh tube exports without relying on Blender-only curve settings.
 verts=[];sides=10
 for i,p in enumerate(points):
  tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(i-1,0)])
  tangent.normalize();axis=tangent.cross(Vector((0,0,1)))
  if axis.length<.001:axis=tangent.cross(Vector((0,1,0)))
  axis.normalize();other=tangent.cross(axis)
  for k in range(sides):verts.append(Vector(p)+float(radii[i])*(axis*math.cos(k*math.tau/sides)+other*math.sin(k*math.tau/sides)))
 faces=[(i*sides+k,i*sides+(k+1)%sides,(i+1)*sides+(k+1)%sides,(i+1)*sides+k) for i in range(len(points)-1) for k in range(sides)]
 faces += [tuple(reversed(range(sides))),tuple((len(points)-1)*sides+k for k in range(sides))]
 return mesh_obj(name,verts,faces,mat,parent)

def pot(parent,rad,height,mat):
 profile=[(0,.005),(rad*.68,.005),(rad*.75,.012),(rad*.98,height-.012),(rad,height-.005),(rad,height+.001),(rad-.006,height+.007),(rad-.012,height+.001),(rad-.014,height-.014),(rad*.68,.025),(0,.025)]
 verts=[(r*math.cos(a*math.tau/96),r*math.sin(a*math.tau/96),z) for r,z in profile for a in range(96)]
 faces=[(i*96+k,i*96+(k+1)%96,(i+1)*96+(k+1)%96,(i+1)*96+k) for i in range(len(profile)-1) for k in range(96)]
 mesh_obj(parent.name+'_CeramicPot',verts,faces,mat,parent)
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=rad-.017,depth=.014,location=(0,0,height-.032))
 obj=bpy.context.object;obj.name=parent.name+'_Soil';obj.data.materials.append(soil);obj.parent=parent
 for i in range(32):
  angle=rng.random()*math.tau;r=math.sqrt(rng.random())*(rad-.023)
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=rng.uniform(.002,.0045),location=(r*math.cos(angle),r*math.sin(angle),height-.023))
  obj=bpy.context.object;obj.name=parent.name+'_SoilGranule%02d'%i;obj.scale=(1,1,.6);obj.data.materials.append(pebble);obj.parent=parent

def blade(name,origin,direction,length,width,parent,twist=0):
 forward=Vector(direction).normalized();side=forward.cross(Vector((0,0,1)))
 if side.length<.01:side=Vector((1,0,0))
 side.normalize();up=side.cross(forward).normalized()
 if up.z<0:up=-up
 verts=[];uvs=[];rows,cols=26,12
 for i in range(rows+1):
  t=i/rows;envelope=math.sin(math.pi*t)**.72
  for j in range(cols+1):
   q=j/cols*2-1
   bow=length*(.045*math.sin(math.pi*t)-.05*t*t)
   cup=width*(.055*q*q-.015*abs(q))*envelope
   ripple=.00065*math.sin(t*math.pi*6+twist)*q*q*envelope
   p=Vector(origin)+forward*(length*t)+side*(width*.5*q*envelope)+up*(bow+cup+ripple)
   verts.append(p);uvs.append((j/cols,t))
 faces=[(i*(cols+1)+j,i*(cols+1)+j+1,(i+1)*(cols+1)+j+1,(i+1)*(cols+1)+j) for i in range(rows) for j in range(cols)]
 obj=mesh_obj(name,verts,faces,leaf,parent);obj.data.materials.append(back)
 uv=obj.data.uv_layers.new(name='LeafUV')
 for poly in obj.data.polygons:
  for loop in poly.loop_indices:uv.data[loop].uv=uvs[obj.data.loops[loop].vertex_index]
 mod=obj.modifiers.new('Real leaf thickness','SOLIDIFY');mod.thickness=.00055;mod.material_offset=1;mod.material_offset_rim=1
 mid=[Vector(origin)+forward*(length*t)+up*(length*(.045*math.sin(math.pi*t)-.05*t*t)+.0008) for t in np.linspace(.015,.96,14)]
 stem(name+'_Midrib',mid,[.00075*(1-i/15)+.00012 for i in range(14)],petiole,parent)
 return obj

floorplant=bpy.data.objects.new('WardPlant_FloorFicus',None);scene.collection.objects.link(floorplant);floorplant.location=(-2.30,1.18,.903)
pot(floorplant,.145,.235,ceramic)
trunk=[(.018*math.sin(t*2),.016*math.sin(t*3),.207+t*.55) for t in np.linspace(0,1,22)]
stem('Ficus_Trunk',trunk,[.011*(1-i/28) for i in range(22)],wood,floorplant)
for i in range(17):
 t=.12+i*.046;angle=i*2.399+rng.uniform(-.2,.2);start=Vector((.018*math.sin(t*2),.016*math.sin(t*3),.207+t*.55))
 d=Vector((math.cos(angle),math.sin(angle),rng.uniform(.08,.38)))
 end=start+d*.048
 stem('Ficus_Petiole%02d'%i,[start+d*(.048*t)+Vector((0,0,.003*math.sin(math.pi*t))) for t in np.linspace(0,1,9)],[.0025-.0013*t for t in np.linspace(0,1,9)],petiole,floorplant)
 blade('Ficus_Leaf%02d'%i,end,d,rng.uniform(.155,.22)*(1-.25*t),rng.uniform(.070,.094),floorplant,angle)
blade('Ficus_NewLeaf',trunk[-1],(.16,.22,1),.085,.023,floorplant)
small=bpy.data.objects.new('WardPlant_SillZZ',None);scene.collection.objects.link(small);small.location=(-1.30,2.05,1.620)
pot(small,.068,.104,teal)
for i in range(5):
 angle=i*math.tau/5+.25;h=rng.uniform(.18,.27);lean=Vector((math.cos(angle),math.sin(angle),0))*.073
 points=[Vector((0,0,.086))+lean*t*t+Vector((0,0,h*t)) for t in np.linspace(0,1,15)]
 stem('ZZ_Stem%02d'%i,points,[.0028*(1-j/20) for j in range(15)],petiole,small)
 for j in range(4):
  t=.32+j*.18;center=Vector((0,0,.086))+lean*t*t+Vector((0,0,h*t))
  for sign in [-1,1]:
   a=angle+sign*1.12;d=Vector((math.cos(a),math.sin(a),.36))
   blade('ZZ_Leaf%d_%d_%d'%(i,j,sign),center,d,.058*(1-.15*j),.026,small,a)
for obj in [floorplant,small]:obj['assetType']='indoor-plant';obj['designProposal']=True;obj['bindingState']='unmapped'
# Consolidate repeated parts per material, retaining two independently selectable plants.
for plant in [floorplant,small]:
 for category in ['Leaf','Midrib','SoilGranule']:
  objects=[o for o in plant.children if o.type=='MESH' and (('Leaf' in o.name and 'Midrib' not in o.name) if category=='Leaf' else category in o.name)]
  if len(objects)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in objects:o.select_set(True)
   bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();bpy.context.object.name=plant.name+'_'+category
scene.cycles.samples=40
camera=scene.camera
views={'overview':((.52,-3.95,2.4),(-1.35,-.3,1.45),24),'plant-detail':((-1.32,.32,1.67),(-2.30,1.18,1.33),36),'sill-plant':((-1.04,1.25,1.99),(-1.30,2.05,1.83),58)}
camera.location=views['overview'][0];camera.data.lens=24;camera.rotation_euler=(Vector(views['overview'][1])-camera.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'ward-room-with-plants.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:
 if o.type in {'MESH','EMPTY'} and not o.hide_render and not o.get('previewOnly'):o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'ward-room-with-plants.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True)
for name,(loc,target,lens) in views.items():
 camera.location=loc;camera.data.lens=lens;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
 scene.render.filepath=str(OUT/(name+'.jpg'));bpy.ops.render.render(write_still=True)
(OUT/'report.json').write_text(json.dumps({'plantsAdded':2,'floorLeaves':18,'sillLeaflets':40,'leafTextureSize':512,'liveAssetReplaced':False},indent=2),encoding='utf8')
print('WARD_PLANTS_COMPLETE')
