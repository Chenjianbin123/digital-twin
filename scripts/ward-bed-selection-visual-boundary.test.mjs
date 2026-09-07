import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8');

function methodBody(name) {
  const start = source.indexOf(`private ${name}`);
  assert.ok(start >= 0, `${name} method should exist`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next >= 0 ? next : undefined);
}

test('selected bed highlight uses a restrained blue accent instead of status-green overlays', () => {
  const createSelectionMeshes = methodBody('createSelectionMeshes');

  assert.match(createSelectionMeshes, /selectionColor = new THREE\.Color\(0x4fc3ff\)/);
  assert.doesNotMatch(createSelectionMeshes, /new THREE\.Color\(status\.color\)/);
  assert.match(createSelectionMeshes, /new THREE\.CylinderGeometry\(0\.34, 0\.46, 0\.055/);
  assert.match(createSelectionMeshes, /opacity: 0\.055/);
});

test('selected bed highlight is anchored to the mattress center instead of the glb group origin', () => {
  const anchorSelectionMeshesToBed = methodBody('anchorSelectionMeshesToBed');
  assert.match(anchorSelectionMeshesToBed, /new THREE\.Box3\(\)\.setFromObject\(mattress\)/);
  assert.match(anchorSelectionMeshesToBed, /group\.worldToLocal\(center\.clone\(\)\)/);
  assert.match(anchorSelectionMeshesToBed, /selection\.ring\.position\.x = localCenter\.x/);
  assert.match(anchorSelectionMeshesToBed, /selection\.ring\.position\.z = localCenter\.z/);
  assert.match(anchorSelectionMeshesToBed, /selection\.pulse\.position\.x = localCenter\.x/);
  assert.match(anchorSelectionMeshesToBed, /selection\.beam\.position\.z = localCenter\.z/);

  assert.match(source, /this\.anchorSelectionMeshesToBed\(group, bound\.mattress, selection\)/);
  assert.match(source, /this\.anchorSelectionMeshesToBed\(group, cloned\.mattress, selection\)/);
  assert.match(source, /this\.anchorSelectionMeshesToBed\(group, mattress, selection\)/);
});

test('selected bed animation keeps the highlight close to the bed footprint', () => {
  const animate = methodBody('animate = ');

  assert.match(animate, /meshGroup\.selectionRing\.scale\.set\(0\.58 \* selectPulse, 1\.04 \* selectPulse, 1\)/);
  assert.match(animate, /mat\.opacity = 0\.22 \+ Math\.sin\(elapsed \* 3\.2\) \* 0\.06/);
  assert.match(animate, /mat\.opacity = 0\.045 \+ Math\.sin\(elapsed \* 2\.2\) \* 0\.015/);
});
