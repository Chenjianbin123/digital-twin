import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const dialogUrl = new URL('../src/components/WardPlanBedDialog.vue', import.meta.url);
const dialog = existsSync(dialogUrl) ? readFileSync(dialogUrl, 'utf8') : '';

test('2.5D 点击床位后展示科技感床位详情浮层', () => {
  assert.ok(dialog, '应创建 WardPlanBedDialog.vue');
  assert.match(app, /import WardPlanBedDialog from '@\/components\/WardPlanBedDialog\.vue';/);
  assert.match(app, /<WardPlanBedDialog[\s\S]*?v-if="isWardInterior && wardInteriorView === 'plan' && selectedBed"/);
  assert.match(app, /@close="store\.clearSelection"/);
  assert.match(dialog, /ward-plan-bed-dialog/);
  assert.match(dialog, /护理等级|责任医生|责任护士|过敏|隔离|呼叫中|输液/);
});
