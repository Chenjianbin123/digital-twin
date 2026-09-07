import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const [alertPanel, nursePanel, areaPanel, wardPanel, app, wardScene3d, wardScene] = await Promise.all([
  fs.readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/components/AreaInfoPanel.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/App.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/components/WardScene3D.vue', import.meta.url), 'utf8'),
  fs.readFile(new URL('../src/core/ward-scene.ts', import.meta.url), 'utf8'),
]);

test('exposes vital warning labels on nurse-facing surfaces', () => {
  assert.match(alertPanel, /生命体征/);
  assert.match(alertPanel, /vital/);
  assert.match(nursePanel, /生命体征预警/);
  assert.match(areaPanel, /生命体征预警/);
  assert.match(wardPanel, /生命体征/);
  assert.match(app, /activeAlertTask\.type === ['"]vital['"]/);
});

test('passes a vital warning bed state into the 3D ward scene', () => {
  assert.match(wardScene3d, /vital-warning/);
  assert.match(wardScene3d, /vitalWarningBedCodes/);
  assert.match(wardScene, /setVitalWarningBedCodes/);
});

