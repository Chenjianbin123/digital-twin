import assert from 'node:assert/strict';
import test from 'node:test';
import { createCallReminderDelivery } from './call-reminder-delivery.ts';
import type { NormalizedSwpEvent } from '../types/swp-events.ts';

const event = { id: 'call-1', areaId: 8, timestampMs: 10 } as NormalizedSwpEvent;

test('two pages sharing a lock submit each channel only once', async () => {
  let receipts: unknown = [];
  let chain = Promise.resolve();
  let sent = 0;
  const create = () => createCallReminderDelivery({
    read: () => receipts, write: value => { receipts = value; },
    lock: run => { const result = chain.then(run); chain = result.catch(() => {}); return result; },
    send: async () => { sent += 1; }, now: () => 100,
  });
  await Promise.all([create()([event]), create()([event])]);
  assert.equal(sent, 1);
});

test('a failure does not write a receipt; another area or occurrence is not suppressed', async () => {
  let receipts: unknown = [];
  let sent = 0;
  const deliver = createCallReminderDelivery({
    read: () => receipts, write: value => { receipts = value; }, lock: run => run(),
    send: async () => { if (++sent === 1) throw Error('blocked'); }, now: () => 100,
  });
  await assert.rejects(deliver([event]), /blocked/);
  assert.deepEqual(receipts, []);
  await deliver([event]);
  await deliver([event]);
  await deliver([{ ...event, areaId: 9 }]);
  await deliver([{ ...event, timestampMs: 11 }]);
  assert.equal(sent, 4);
});
