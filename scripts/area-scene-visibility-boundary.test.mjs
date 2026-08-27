import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const areaScene = readFileSync(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('病区走廊隐藏护士站，返回护士站时恢复', () => {
  assert.match(areaScene, /if \(this\.nurseGroup\)\n\s*this\.nurseGroup\.visible = !visible;/);
  assert.match(areaScene, /this\.setCorridorContentVisible\(showCorridor\);/);
});
