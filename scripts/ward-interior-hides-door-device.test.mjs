import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const wardPanel = await readFile(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8');

test('病房内侧边栏不展示门口机设备信息块', () => {
  assert.doesNotMatch(wardPanel, /<h3>\s*门口机\s*<\/h3>/);
  assert.doesNotMatch(wardPanel, /class="ward-info-panel__door"/);
  assert.doesNotMatch(wardPanel, /设备\s*SN|设备\s*IP|病房编码/);
});
