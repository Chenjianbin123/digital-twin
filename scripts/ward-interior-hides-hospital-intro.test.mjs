import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8');

test('病房内场景不展示医院介绍，病区走廊仍可展示', () => {
  assert.match(
    app,
    /<HospitalIntroPanel[\s\S]*?v-if="isWard"[\s\S]*?:info="hospitalInfo"/,
    'HospitalIntroPanel should only render in ward corridor scene',
  );
  assert.match(
    app,
    /<WardInfoPanel[\s\S]*?v-else-if="isWardInterior && currentWard"/,
    'Ward interior should continue rendering the ward information panel',
  );
});
