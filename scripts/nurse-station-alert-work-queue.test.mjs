import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, station] = await Promise.all([
  readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
]);

const progress = await readFile(new URL('../src/core/alert-progress.ts', import.meta.url), 'utf8');
assert.match(progress, /type AlertTaskFilter = 'active' \| 'confirmed' \| 'handling' \| 'all'/);
assert.match(panel, /alertProgress\(task, props.ackRecords\)/);
assert.match(panel, /filter\?:\s*AlertTaskFilter/);
assert.match(panel, /未处理/);
assert.match(panel, /已关注/);
assert.match(panel, /已提交/);
assert.match(panel, /全部/);
assert.match(panel, /filteredTasks/);
assert.match(panel, /isSourceManagedTask/);
assert.match(station, /alertFilter/);
assert.match(station, /:filter="alertFilter"/);

console.log('Nurse-station alert work queue boundary checks passed.');
