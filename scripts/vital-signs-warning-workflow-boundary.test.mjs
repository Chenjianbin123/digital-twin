import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';

const workflow = await fs.readFile(new URL('../src/core/alert-workflow.ts', import.meta.url), 'utf8');
const types = await fs.readFile(new URL('../src/types/twin.ts', import.meta.url), 'utf8');

test('alert workflow reserves a dedicated vital task and history category', () => {
  assert.match(workflow, /AlertTaskType\s*=\s*['"]call['"].*['"]vital['"]/s);
  assert.match(workflow, /event\.taskType\s*===\s*['"]vital['"]/);
  assert.match(workflow, /vitalMetric/);
  assert.match(types, /HistoryCategory\s*=\s*['"]infusion['"].*['"]vital['"]/s);
});

