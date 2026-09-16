import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const source = readFileSync(new URL('../src/components/WardInfoPanel.vue', import.meta.url), 'utf8');
const navigation = readFileSync(new URL('../src/components/WardBedNavigator.vue', import.meta.url), 'utf8');
test('ward info panel keeps accessible bed selection available with patient details', () => {
  assert.match(source, /<WardBedNavigator v-if="ward"/);
  assert.match(source, /@select="emit\('bedClick', \$event\)"/);
  assert.match(navigation, /<select[^>]*@change="choose"/);
  assert.match(navigation, /emit\('select', bed\)/);
  assert.match(navigation, /上一床/);
  assert.match(navigation, /空床（不在 3D 展示）/);
});
