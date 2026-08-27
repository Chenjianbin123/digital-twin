import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/components/AreaSelectionView.vue', import.meta.url),
  'utf8',
);
const rootRule = source.match(/\.area-selection\s*\{([\s\S]*?)&__header/)?.[1] ?? '';

assert.match(rootRule, /(?:^|\n)\s*height:\s*100%\s*;/);
assert.match(rootRule, /(?:^|\n)\s*min-height:\s*0\s*;/);
assert.match(rootRule, /(?:^|\n)\s*overflow-x:\s*hidden\s*;/);
assert.match(rootRule, /(?:^|\n)\s*overflow-y:\s*auto\s*;/);
assert.match(source, /&__header\s*\{[\s\S]*?position:\s*sticky\s*;/);
assert.match(source, /rememberedAreaId:\s*number\s*\|\s*null\s*;/);
assert.match(source, /v-if="rememberedAreaId === areaOption\.id"/);
assert.doesNotMatch(source, /v-if="preferredAreaId === areaOption\.id"/);

console.log('Area-selection layout tests passed.');
