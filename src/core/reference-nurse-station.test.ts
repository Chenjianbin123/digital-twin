import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { bindReferenceStationDisplays, createReferenceStationLights, prepareReferenceStation, REFERENCE_SCREENS, referenceStationFov } from './reference-nurse-station.ts';

function modelFixture() {
  const model = new THREE.Group();
  for (const [,name] of REFERENCE_SCREENS) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.24, 1.44), new THREE.MeshStandardMaterial());
    mesh.name = name;
    mesh.position.set(1, 2, -4);
    model.add(mesh);
  }
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(.224,.224,.008),new THREE.MeshStandardMaterial());
  clock.name='Clock_Display';clock.rotation.x=Math.PI/2;clock.position.set(2.13,2.28,-3.983);model.add(clock);
  return model;
}
test('narrow views preserve horizontal framing without changing camera distance', () => {
  assert.equal(referenceStationFov(16/9,38),38);
  const narrow=referenceStationFov(.5,38);
  assert.ok(narrow>38 && narrow<180);
  assert.ok(Number.isFinite(referenceStationFov(Number.NaN,38)));
  const horizontal=Math.tan(narrow*Math.PI/360)*.5;
  assert.ok(Math.abs(horizontal-Math.tan(38*Math.PI/360)*16/9)<1e-10);
});
test('reference model keeps authored units and exact screen mapping', () => {
  const model = modelFixture();
  prepareReferenceStation(model);
  assert.deepEqual(model.scale.toArray(),[1,1,1]);
  assert.deepEqual(model.position.toArray(),[0,0,0]);
  const kinds:string[]=[];
  const displays=bindReferenceStationDisplays(model,kind=>{kinds.push(kind);return new THREE.Texture();});
  assert.deepEqual(kinds,['dashboard','taskQueue','wardStatus','bedMonitor','deviceHealth','clock']);
  assert.equal(displays.length,6);
  for (const display of displays.slice(0,5)) {
    assert.equal(display.texture.flipY,false);
    assert.deepEqual(display.screen.position.toArray(),[1,2,-4]);
    assert.equal(display.screen.geometry.getAttribute('uv').count,4);
    assert.equal((display.screen.material as THREE.MeshBasicMaterial).toneMapped,false);
  }
  assert.equal(model.getObjectByName('Screen_Main')!.visible,false);
  assert.equal(displays[5].texture.flipY,true);
  assert.equal(displays[5].screen.geometry.type,'CircleGeometry');
  assert.ok(displays[5].screen.position.z>-3.983);
});
test('missing screens fail before any material or visibility is changed', () => {
  const model=modelFixture();
  model.remove(model.getObjectByName('Screen_Work_04')!);
  let calls=0;
  assert.throws(()=>bindReferenceStationDisplays(model,()=>{calls++;return new THREE.Texture();}),/Screen_Work_04/);
  assert.equal(calls,0);
  assert.equal(model.getObjectByName('Screen_Main')!.visible,true);
});
test('missing UV and missing clock are rejected explicitly', () => {
  const model=modelFixture();
  const screen=model.getObjectByName('Screen_Main') as THREE.Mesh;
  screen.geometry.deleteAttribute('uv');
  assert.throws(()=>bindReferenceStationDisplays(model,()=>new THREE.Texture()),/UV/);
  screen.geometry=new THREE.PlaneGeometry(3.24,1.44);
  model.remove(model.getObjectByName('Clock_Display')!);
  assert.throws(()=>bindReferenceStationDisplays(model,()=>new THREE.Texture()),/Clock_Display/);
});
test('runtime glass avoids refraction pass and only fixed lights cache shadows', () => {
  const model=modelFixture();
  const material=new THREE.MeshPhysicalMaterial({transmission:.8});
  material.name='V2_Window_Glass';
  const glass=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  glass.name='Window_Glazing_1';model.add(glass);
  prepareReferenceStation(model);
  assert.equal(material.transmission,0);
  assert.equal(material.opacity,.16);
  assert.equal(material.depthWrite,false);
  assert.equal(glass.castShadow,false);
  const lights=createReferenceStationLights();
  const key=lights.children.find(child=>child instanceof THREE.SpotLight) as THREE.SpotLight;
  assert.equal(key.shadow.autoUpdate,false);
  assert.equal(key.shadow.needsUpdate,true);
});

test('wide wall display preserves face-frame alignment and does not accumulate on repeated preparation', () => {
  const model = modelFixture();
  const face = model.getObjectByName('Screen_Main') as THREE.Mesh;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(3.33, 1.53, .09), new THREE.MeshStandardMaterial());
  frame.name = 'Screen_Main_Frame'; frame.position.copy(face.position); model.add(frame);
  const size = (node: THREE.Object3D) => new THREE.Box3().setFromObject(node).getSize(new THREE.Vector3());
  prepareReferenceStation(model);
  assert.ok(Math.abs(size(face).x - 3.24 * 1.24) < 1e-6);
  assert.ok(Math.abs(size(face).y - 1.44 * .88) < 1e-6);
  assert.ok(Math.abs(face.position.y - 2.1) < 1e-6);
  assert.deepEqual(frame.position.toArray(), face.position.toArray());
  assert.ok(Math.abs(model.getObjectByName('Clock_Display')!.position.x - 2.31) < 1e-6);
  const before = face.matrixWorld.toArray();
  prepareReferenceStation(model);
  assert.deepEqual(face.matrixWorld.toArray(), before);
  const displays = bindReferenceStationDisplays(model, () => new THREE.Texture());
  assert.deepEqual(displays[0].screen.position.toArray(), face.position.toArray());
  assert.deepEqual(displays[0].screen.scale.toArray(), face.scale.toArray());
});
