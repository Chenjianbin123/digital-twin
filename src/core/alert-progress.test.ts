import assert from 'node:assert/strict';
import test from 'node:test';
import { alertProgress } from './alert-progress.ts';
import type { AlertTask } from './alert-workflow.ts';
import type { AlertAckRecord } from './alert-ack.ts';

const task = { id: 'alarm', source: 'swp-alarm', type: 'infusion', status: 'handling', startedAt: '2026-09-30 12:00:00' } as AlertTask;
const ack = { taskId: 'alarm', status: 'handling', syncState: 'synced', eventStartedAt: task.startedAt } as AlertAckRecord;
test('only an explicitly synced record for this occurrence is shown as submitted', () => {
  assert.equal(alertProgress(task), 'confirmed');
  for (const syncState of ['local', 'pending', 'failed'] as const)
    assert.equal(alertProgress(task, { alarm: { ...ack, syncState } }), 'confirmed');
  assert.equal(alertProgress(task, { alarm: ack }), 'handling');
  assert.equal(alertProgress(task, { alarm: { ...ack, eventStartedAt: 'old' } }), 'confirmed');
  assert.equal(alertProgress({ ...task, status: 'pending' }, { alarm: ack }), 'active');
});
test('source-managed calls and inspections remain local confirmations', () => {
  assert.equal(alertProgress({ ...task, source: 'swp-call', type: 'call' }, { alarm: ack }), 'confirmed');
  assert.equal(alertProgress({ ...task, source: 'swp-inspection', type: 'inspection' }, { alarm: ack }), 'confirmed');
});
