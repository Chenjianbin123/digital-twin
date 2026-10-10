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

test('failed delivery is retried on a later poll instead of being marked announced', async () => {
  let attempts = 0;
  const notifier = createSwpCallNotifier({ alert: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('audio blocked');
  } });
  await notifier.process([call('retry')]).catch(() => {});
  assert.deepEqual(await notifier.process([call('retry')]), ['retry']);
  assert.equal(attempts, 2);
});

test('retries at most three times and can explicitly retry failed events', async () => {
  let attempts = 0;
  const notifier = createSwpCallNotifier({ alert: async () => { attempts++; throw Error('blocked'); } });
  for (let i = 0; i < 5; i++) await notifier.process([call('limited')]);
  assert.equal(attempts, 3);
  notifier.retryFailed();
  await notifier.process([call('limited')]);
  assert.equal(attempts, 4);
});

test('concurrent polls do not duplicate delivery; a reset invalidates an in-flight result', async () => {
  let release!: () => void;
  let attempts = 0;
  const notifier = createSwpCallNotifier({ alert: async () => {
    attempts++;
    if (attempts === 1) await new Promise<void>(resolve => { release = resolve; });
  } });
  const first = notifier.process([call('concurrent')]);
  assert.deepEqual(await notifier.process([call('concurrent')]), []);
  notifier.reset();
  release();
  assert.deepEqual(await first, []);
  assert.deepEqual(await notifier.process([call('concurrent')]), ['concurrent']);
  assert.deepEqual(await notifier.process([{ ...call('old'), retained: true }]), []);
});
