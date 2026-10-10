import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createReferenceCorridorLights, createReferenceCorridorTheme, prepareReferenceCorridor, REFERENCE_CORRIDOR_ROOT } from './reference-corridor.ts';
import { createCorridorTheme, polishHospitalCorridorMaterials } from './ward-corridor-model.ts';
import { wardCorridorSceneConfig, legacyWardCorridorSceneConfig } from '../config/ward-corridor-scene.ts';

test('reference corridor is the production model with its own metre-scale camera, retaining rollback config', () => {
  assert.match(wardCorridorSceneConfig.model.url, /corridor-reference-v2\.glb\?v=/);
  assert.equal(wardCorridorSceneConfig.model.layout, 'reference-v2');
  assert.equal(wardCorridorSceneConfig.model.slotCount, 10);
  assert.equal(wardCorridorSceneConfig.model.canvasTextureFlipY, false);
  assert.deepEqual(wardCorridorSceneConfig.model.doorNodeNames, legacyWardCorridorSceneConfig.model.doorNodeNames);
  assert.deepEqual(wardCorridorSceneConfig.model.entranceDeviceNodeNames, legacyWardCorridorSceneConfig.model.entranceDeviceNodeNames);
  assert.ok(Math.abs(wardCorridorSceneConfig.camera.initial.target.x) < 1);
  assert.match(legacyWardCorridorSceneConfig.model.url, /3-v4\.glb/);
  assert.notEqual(wardCorridorSceneConfig.model, legacyWardCorridorSceneConfig.model);
});

test('reference material preparation retains all PBR maps and UV channels; theme round-trip is lossless', () => {
  const root = new THREE.Group(); root.name = REFERENCE_CORRIDOR_ROOT;
  const map = new THREE.Texture(), aoMap = new THREE.Texture(); aoMap.channel = 1;
  const material = new THREE.MeshStandardMaterial({ color: '#cad1cb', map, aoMap, normalMap: map, roughnessMap: map, roughness: .61, metalness: .4 });
  material.name = 'Brushed aluminium_AO';
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); mesh.name = '地板';
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  // A shared exported material must not be tinted multiple times per theme call.
  root.add(new THREE.Mesh(mesh.geometry, material));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({ color: '#abcfff', map }));
  root.add(screen);
  const original = material.color.clone(), screenColor = screen.material.color.clone();
  assert.equal(prepareReferenceCorridor(root), true);
  assert.equal(mesh.castShadow, false); assert.equal(mesh.receiveShadow, false);
  assert.equal(material.aoMapIntensity, .72);
  const theme = createCorridorTheme();
  theme(root, true); const dark = material.color.clone();
  assert.notDeepEqual(dark, original);
  theme(root, true); assert.deepEqual(material.color, dark);
  polishHospitalCorridorMaterials(root);
  assert.equal(material.roughness, .61); assert.equal(material.metalness, .4);
  theme(root, false); assert.deepEqual(material.color, original);
  assert.equal(material.map, map); assert.equal(material.normalMap, map); assert.equal(material.roughnessMap, map);
  assert.equal(material.aoMap, aoMap); assert.equal(material.aoMap.channel, 1);
  assert.deepEqual(screen.material.color, screenColor);
});

test('reference helpers do not mutate legacy models', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: '#aabbcc' }));
  mesh.material.name = 'Ceramic warm white'; mesh.castShadow = true;
  const original = mesh.material.color.clone();
  assert.equal(prepareReferenceCorridor(mesh), false);
  assert.equal(createReferenceCorridorTheme()(mesh, true), false);
  assert.equal(mesh.castShadow, true); assert.deepEqual(mesh.material.color, original);
});

test('indoor light rig has three soft panels, bounded light count, no shadow passes', () => {
  const lights = createReferenceCorridorLights();
  assert.equal(lights.children.length, 4);
  assert.equal(lights.children.filter(x => x instanceof THREE.RectAreaLight).length, 3);
  assert.ok(lights.children.every(x => !x.castShadow));
  assert.notEqual(lights, createReferenceCorridorLights());
});
