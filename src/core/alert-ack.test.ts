import assert from 'node:assert/strict';
import test from 'node:test';

import * as alertAck from './alert-ack.ts';
import { removeAlertAckRecord, type AlertAckRecordMap } from './alert-ack.ts';

test('removes one local acknowledgement without changing other tasks', () => {
  const records: AlertAckRecordMap = {
    hidden: {
      taskId: 'hidden',
      status: 'resolved',
      operator: '护士站',
      updatedAt: '2026-08-25T08:00:00.000Z',
      syncState: 'local',
    },
    handling: {
      taskId: 'handling',
      status: 'handling',
      operator: '护士站',
      updatedAt: '2026-08-25T08:01:00.000Z',
      syncState: 'local',
    },
  };

  const next = removeAlertAckRecord(records, 'hidden', false);

  assert.equal('hidden' in next, false);
  assert.equal(next.handling, records.handling);
});

test('clears handling records only after their real source task recovers', () => {
  const reconcile = (alertAck as Record<string, unknown>).clearRecoveredAlertAckRecords;
  assert.equal(typeof reconcile, 'function');
  if (typeof reconcile !== 'function')
    return;

  const records: AlertAckRecordMap = {
    recovered: {
      taskId: 'recovered',
      status: 'handling',
      operator: '护士站',
      updatedAt: '2026-08-25T08:00:00.000Z',
      syncState: 'local',
    },
    active: {
      taskId: 'active',
      status: 'handling',
      operator: '护士站',
      updatedAt: '2026-08-25T08:01:00.000Z',
      syncState: 'local',
    },
  };

  const next = reconcile(records, ['recovered', 'active'], ['active'], false);

  assert.equal('recovered' in next, false);
  assert.equal(next.active, records.active);
});
