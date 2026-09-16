import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStationTheme } from './station-theme.ts';
test('station theme restores originals and leaves screens untouched', () => {
 const apply = createStationTheme(); const root=new THREE.Group();
 let wall=new THREE.MeshStandardMaterial({color:'#dddbca'});wall.name='Warm_White_Paint';
 const screen=new THREE.MeshBasicMaterial({color:'#ffffff'});
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),wall),new THREE.Mesh(new THREE.BoxGeometry(),screen));
 const light=new THREE.HemisphereLight(0xe6f1ff,0xb3a28a,.6);const lights=new THREE.Group();lights.add(light);
 const original=wall.color.clone();
 for(let i=0;i<3;i++) {apply(root,lights,true);wall=(root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;assert.notEqual(wall.color.getHex(),original.getHex());assert.equal(screen.color.getHex(),0xffffff);apply(root,lights,false);assert.equal(wall.color.getHex(),original.getHex());assert.equal(light.intensity,.6);}
});

test('dark materials soften reflections and restore physical properties without accumulating changes', () => {
 const apply=createStationTheme();const root=new THREE.Group();
 let surface=new THREE.MeshStandardMaterial({color:'#eeeecc',roughness:.31,envMapIntensity:1.2});surface.name='Warm_White_Solid_Surface';
 let led=new THREE.MeshStandardMaterial({color:'#ffeed0',emissive:'#ffc070',emissiveIntensity:3});led.name='Warm_LED';
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),surface),new THREE.Mesh(new THREE.BoxGeometry(),led));
 const original=led.emissive.clone();
 for(let i=0;i<4;i++){
 apply(root,undefined,true);surface=(root.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;led=(root.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial;assert.equal(surface.roughness,.82);assert.ok(surface.envMapIntensity<1.2);assert.ok(led.emissiveIntensity<3);
 apply(root,undefined,false);assert.equal(surface.roughness,.31);assert.equal(surface.envMapIntensity,1.2);assert.equal(led.emissiveIntensity,3);assert.equal(led.emissive.getHex(),original.getHex());
 }
});

test('approved palette separates shared wood surfaces and restores texture maps', () => {
 const root = new THREE.Group(); const apply = createStationTheme();
 const map = new THREE.Texture(); const normalMap = new THREE.Texture();
 const wood = new THREE.MeshStandardMaterial({ color: '#a48361', map, normalMap }); wood.name = 'Natural_Oak';
 const wall = new THREE.Mesh(new THREE.BoxGeometry(), wood); wall.name = 'Oak_Wall_Panel_00';
 const counter = new THREE.Mesh(new THREE.BoxGeometry(), wood); counter.name = 'Nurse_Counter_Oak';
 root.add(wall, counter);
 apply(root, undefined, true);
 const darkWall = wall.material; const darkCounter = counter.material;
 assert.notEqual(darkWall, darkCounter);
 assert.equal(darkWall.color.getHexString(), 'b2bec3');
 assert.equal(darkCounter.color.getHexString(), '718793');
 assert.equal(darkWall.map, null); assert.equal(darkWall.normalMap, null);
 assert.equal(wood.map, map);
 for (let i = 0; i < 3; i++) {
  apply(root, undefined, false);
  assert.equal(wall.material.map, map); assert.equal(wall.material.normalMap, normalMap);
  assert.equal(counter.material.color.getHexString(), 'a48361');
  apply(root, undefined, true);
  assert.equal(wall.material, darkWall); assert.equal(counter.material, darkCounter);
 }
});
