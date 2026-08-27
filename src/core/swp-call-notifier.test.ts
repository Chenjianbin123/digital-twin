import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwpCallNotifier } from './swp-call-notifier.ts';
import type { NormalizedSwpEvent } from '../types/swp-events.ts';

function call(id: string): NormalizedSwpEvent {
  return {
    id,
    source: 'swp-call',
    areaId: 8,
    taskType: 'call',
    severity: 'critical',
    timestampMs: 1,
    title: '患者呼叫',
    description: '601病房 1床',
    location: null,
    locationStatus: 'missing-identifiers',
    locationLabel: '一病区',
  };
}

test('notifies each active SWP call occurrence only once', async () => {
  const alerts: string[][] = [];
  const notifier = createSwpCallNotifier({
    alert: async (events) => {
      alerts.push(events.map(event => event.id));
    },
  });

  assert.deepEqual(await notifier.process([call('call-1')]), ['call-1']);
  assert.deepEqual(await notifier.process([call('call-1')]), []);
  assert.deepEqual(await notifier.process([call('call-1'), call('call-2')]), ['call-2']);
  assert.deepEqual(alerts, [['call-1'], ['call-2']]);
});

test('does not notify for alarms or when reminders are disabled', async () => {
  let alertCount = 0;
  const notifier = createSwpCallNotifier({
    isEnabled: () => false,
    alert: async () => { alertCount += 1; },
  });
  const alarm = { ...call('alarm-1'), source: 'swp-alarm' as const, taskType: 'infusion' as const };

  assert.deepEqual(await notifier.process([alarm, call('call-1')]), []);
  assert.equal(alertCount, 0);
});
