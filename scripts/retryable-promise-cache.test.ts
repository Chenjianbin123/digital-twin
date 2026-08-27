import assert from 'node:assert/strict';
import { createRetryablePromiseCache } from '../src/core/retryable-promise-cache.ts';

const cache = createRetryablePromiseCache<number, string>();
let attempts = 0;

await assert.rejects(cache.load(796, async () => {
  attempts += 1;
  throw new Error('temporary failure');
}), /temporary failure/);

const value = await cache.load(796, async () => {
  attempts += 1;
  return 'template-ok';
});

assert.equal(value, 'template-ok');
assert.equal(attempts, 2);
assert.equal(await cache.load(796, async () => 'unexpected'), 'template-ok');

cache.clear();
assert.equal(await cache.load(796, async () => 'reloaded'), 'reloaded');
