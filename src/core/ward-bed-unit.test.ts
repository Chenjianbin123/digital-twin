import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createWardBedUnit, disposeWardBedUnit, placeWardBedUnit, prepareModularWardRoom } from './ward-bed-unit.ts';
function asset() {
  const root = new THREE.Group(); root.name = 'BedUnit';
  for (const name of ['BedBody', 'BedsideCabinet', 'BedTerminal', 'IVStand', 'InfusionEquipment']) { const g = new THREE.Group(); g.name = name; root.add(g); }
  const body = new THREE.Mesh(new THREE.BoxGeometry(.94, .7, 1.66), new THREE.MeshStandardMaterial()); root.getObjectByName('BedBody')!.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.38, .26).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial()); screen.name = 'BedTerminalSurface'; root.add(screen);
  return root;
}
test('clones complete units with isolated screen resources and shared static body geometry', () => {
  const source = asset(), a = createWardBedUnit(source, 'A'), b = createWardBedUnit(source, 'B');
  assert.notEqual(a.group, b.group); assert.notEqual(a.screen.material, b.screen.material); assert.notEqual(a.screen.geometry, b.screen.geometry);
  assert.equal((a.body.children[0] as THREE.Mesh).geometry, (b.body.children[0] as THREE.Mesh).geometry);
  a.infusion.visible = true; assert.equal(b.infusion.visible, false);
  placeWardBedUnit(a.group, 0); placeWardBedUnit(b.group, 1);
  assert.notDeepEqual(a.group.position.toArray(), b.group.position.toArray());
  assert.throws(() => placeWardBedUnit(b.group, 2), /No room slot/);
  let disposed = 0; (source.getObjectByName('BedBody')!.children[0] as THREE.Mesh).geometry.addEventListener('dispose', () => disposed++);
  disposeWardBedUnit(a); assert.equal(disposed, 0); assert.equal(b.infusion.visible, false);
});
test('screen UVs are upright with separate image coordinates', () => {
  const unit = createWardBedUnit(asset(), 'A'); const p = unit.screen.geometry.getAttribute('position'), uv = unit.screen.geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) { assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1); assert.equal(uv.getY(i), p.getY(i) > 0 ? 0 : 1); }
});
test('unbedded room accepts modular asset and hides only configured leftover props', () => {
  const room = new THREE.Group(); for (const name of ['外壳', '灯', 'Medicinal_Props.020_Medical_Props_0.005', 'keep']) { const m = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); m.name = name; room.add(m); }
  const parts = prepareModularWardRoom(room, asset()); assert.equal(parts.mode, 'modular');
  assert.equal(room.getObjectByName('Medicinal_Props.020_Medical_Props_0.005')!.visible, false); assert.equal(room.getObjectByName('keep')!.visible, true);
});
