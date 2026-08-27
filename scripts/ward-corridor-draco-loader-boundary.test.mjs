import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

test('病房走廊运行时配置 Draco 解码器', () => {
  assert.match(source, /import \{ DRACOLoader \} from 'three\/examples\/jsm\/loaders\/DRACOLoader\.js';/);
  assert.match(source, /const dracoLoader = new DRACOLoader\(\);/);
  assert.match(source, /dracoLoader\.setDecoderPath\('\/draco\/'\);/);
  assert.match(source, /loader\.setDRACOLoader\(dracoLoader\);/);
});
