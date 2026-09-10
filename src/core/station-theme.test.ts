import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStationTheme } from './station-theme.ts';
test('station theme restores originals and leaves screens untouched', () => {
 const apply = createStationTheme(); const root=new THREE.Group();
 const wall=new THREE.MeshStandardMaterial({color:'#dddbca'});wall.name='Warm_White_Paint';
 const screen=new THREE.MeshBasicMaterial({color:'#ffffff'});
 root.add(new THREE.Mesh(new THREE.BoxGeometry(),wall),new THREE.Mesh(new THREE.BoxGeometry(),screen));
 const light=new THREE.HemisphereLight(0xe6f1ff,0xb3a28a,.6);const lights=new THREE.Group();lights.add(light);
 const original=wall.color.clone();
 for(let i=0;i<3;i++) {apply(root,lights,true);assert.notEqual(wall.color.getHex(),original.getHex());assert.equal(screen.color.getHex(),0xffffff);apply(root,lights,false);assert.equal(wall.color.getHex(),original.getHex());assert.equal(light.intensity,.6);}
});
