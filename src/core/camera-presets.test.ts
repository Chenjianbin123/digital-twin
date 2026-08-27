import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveWardCameraViewportScale } from './camera-presets.ts';

test('keeps the ward camera distance unchanged on landscape viewports', () => {
  assert.equal(resolveWardCameraViewportScale(16 / 9), 1);
  assert.equal(resolveWardCameraViewportScale(1), 1);
});

test('moves the ward camera back on narrow portrait viewports', () => {
  const scale = resolveWardCameraViewportScale(390 / 844);

  assert.ok(scale >= 1.9);
  assert.ok(scale <= 2);
  assert.equal(resolveWardCameraViewportScale(0), 1);
});
