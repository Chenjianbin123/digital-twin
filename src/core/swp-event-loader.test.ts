import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwpEventSnapshotLoader } from './swp-event-loader.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

const area: TwinAreaEntity = {
  areaName: '一病区',
  areaCode: 'A1',
  deptName: '内科',
  rooms: [],
};

test('updates alarms and preserves calls when only the call endpoint fails', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => { throw new Error('呼叫接口不可用'); },
    fetchAlarms: async () => [{ id: 2, areaId: 8, eventStatus: '0', alarmStartTime: '2026-08-21 10:01:00' }],
  });

  const result = await load(8, area);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.refreshedSources, ['swp-alarm']);
  assert.equal(result.warning, '活动呼叫同步失败：呼叫接口不可用');
});

test('fails the event refresh only when both live endpoints fail', async () => {
  const load = createSwpEventSnapshotLoader({
    fetchCalls: async () => { throw new Error('呼叫失败'); },
    fetchAlarms: async () => { throw new Error('报警失败'); },
  });

  await assert.rejects(() => load(8, area), /呼叫失败.*报警失败/);
});
