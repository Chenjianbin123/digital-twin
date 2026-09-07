import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, station] = await Promise.all([
  readFile(new URL('../src/components/AlertTaskPanel.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/components/NurseStationPanel.vue', import.meta.url), 'utf8'),
]);

assert.match(panel, /type AlertTaskFilter = ['"]active['"] \| ['"]handling['"] \| ['"]all['"]/);
assert.match(panel, /filter\?:\s*AlertTaskFilter/);
assert.match(panel, /未处理/);
assert.match(panel, /处理中/);
assert.match(panel, /全部/);
assert.match(panel, /filteredTasks/);
assert.match(panel, /isSourceManagedTask/);
assert.match(station, /alertFilter/);
assert.match(station, /:filter="alertFilter"/);

console.log('Nurse-station alert work queue boundary checks passed.');
