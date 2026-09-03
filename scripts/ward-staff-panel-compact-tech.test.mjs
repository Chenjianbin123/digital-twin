import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const staffPanel = await readFile(new URL('../src/components/DoorStaffCards.vue', import.meta.url), 'utf8');

test('医护团队面板使用紧凑科技风布局减少留白', () => {
  assert.match(staffPanel, /door-staff-cards__title-count/);
  assert.match(staffPanel, /door-staff-cards__dept-grid/);
  assert.match(staffPanel, /teamRosterCount/);
  assert.match(staffPanel, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(staffPanel, /background:[\s\S]*?radial-gradient[\s\S]*?linear-gradient/);
  assert.match(staffPanel, /@keyframes\s+staff-card-scan/);
  assert.match(staffPanel, /animation:\s*staff-card-scan/);
});
