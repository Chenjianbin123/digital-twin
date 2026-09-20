import assert from 'node:assert/strict';
import test from 'node:test';
import { clearLoadTimings, getLoadTimings, measureLoadStage, startLoadStage } from './load-timing.ts';

test('load timings are bounded, payload-free, and preserve task failures', async () => {
  clearLoadTimings();
  assert.equal(await measureLoadStage('area-options', async () => 42), 42);
  await assert.rejects(measureLoadStage('bed-details', async () => { throw new Error('test'); }));
  assert.deepEqual(getLoadTimings().map(r => r.outcome), ['ready', 'error']);
  assert.deepEqual(Object.keys(getLoadTimings()[0]).sort(), ['durationMs', 'outcome', 'stage']);
  for (let i = 0; i < 70; i++) startLoadStage('area-entry')();
  assert.equal(getLoadTimings().length, 60);
  assert.equal(performance.getEntriesByName('digital-twin:area-entry').length, 1);
  const old = startLoadStage('hospital-info');
  clearLoadTimings();
  old();
  assert.deepEqual(getLoadTimings(), []);
});
