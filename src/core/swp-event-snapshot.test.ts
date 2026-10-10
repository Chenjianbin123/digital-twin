import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSwpEventSnapshot } from './swp-event-snapshot.ts';
import type { NormalizedSwpEvent } from '../types/swp-events.ts';

const call = { id: 'call', source: 'swp-call' } as NormalizedSwpEvent;
const alarm = { id: 'alarm', source: 'swp-alarm' } as NormalizedSwpEvent;
test('an incomplete page retains missing events without duplicating returned events', () => {
  const merged = mergeSwpEventSnapshot([call, alarm], { events: [{ ...call, title: 'updated' }], refreshedSources: [] });
  assert.equal(merged.length, 2);
  assert.equal(merged.find(event => event.id === 'alarm')?.retained, true);
  assert.equal(merged.find(event => event.id === 'call')?.retained, false);
  assert.equal(merged.find(event => event.id === 'call')?.title, 'updated');
});
test('only a complete source can clear events absent from its snapshot', () => {
  const merged = mergeSwpEventSnapshot([call, alarm], { events: [], refreshedSources: ['swp-call'] });
  assert.deepEqual(merged.map(event => event.id), ['alarm']);
  assert.deepEqual(mergeSwpEventSnapshot(merged, { events: [], refreshedSources: ['swp-alarm'] }), []);
});
