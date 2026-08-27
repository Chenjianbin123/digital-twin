import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getContainedDoorTemplateRect,
  getDoorTargetCanvasSize,
  resolveDoorDirector,
} from './door-screen-orientation.ts';

test('keeps the configured device director when a template is present', () => {
  assert.equal(resolveDoorDirector({ director: '0' }, { width: 540, height: 810 }), '0');
  assert.equal(resolveDoorDirector({ director: '1' }, { width: 1920, height: 1080 }), '1');
});

test('uses stable horizontal and vertical target canvas ratios', () => {
  assert.deepEqual(getDoorTargetCanvasSize(true), { width: 960, height: 540 });
  assert.deepEqual(getDoorTargetCanvasSize(false), { width: 480, height: 720 });
});

test('contains a horizontal template inside a vertical screen without stretching', () => {
  assert.deepEqual(
    getContainedDoorTemplateRect(1920, 1080, 480, 720),
    { x: 0, y: 225, width: 480, height: 270 },
  );
});

test('contains a vertical template inside a horizontal screen without stretching', () => {
  assert.deepEqual(
    getContainedDoorTemplateRect(540, 810, 960, 540),
    { x: 300, y: 0, width: 360, height: 540 },
  );
});
