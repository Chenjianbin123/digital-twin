import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');

test('进入病房内 2.5D 视图时自动隐藏右侧信息面板', () => {
  assert.match(app, /import \{ computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch \} from 'vue';/);
  assert.match(app, /watch\(\[\(\) => isWardInterior\.value, \(\) => wardInteriorView\.value\]/);
  assert.match(app, /if \(interior && view === 'plan'\)\s*\n\s*panelsVisible\.value = false;/);
});
