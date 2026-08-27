import assert from 'node:assert/strict';
import test from 'node:test';

import { createRetryablePromiseCache } from './retryable-promise-cache.ts';

test('reuses a resolved value before its ttl expires', async () => {
  let now = 100;
  let calls = 0;
  const cache = createRetryablePromiseCache<string, number>({ ttlMs: 50, now: () => now });
  assert.equal(await cache.load('template', async () => ++calls), 1);
  now = 149;
  assert.equal(await cache.load('template', async () => ++calls), 1);
  assert.equal(calls, 1);
});

test('reloads a resolved value after its ttl expires', async () => {
  let now = 100;
  let calls = 0;
  const cache = createRetryablePromiseCache<string, number>({ ttlMs: 50, now: () => now });
  assert.equal(await cache.load('template', async () => ++calls), 1);
  now = 150;
  assert.equal(await cache.load('template', async () => ++calls), 2);
});

test('removes rejected requests immediately so they can be retried', async () => {
  const cache = createRetryablePromiseCache<string, number>({ ttlMs: 50 });
  await assert.rejects(cache.load('template', async () => { throw new Error('offline'); }));
  assert.equal(await cache.load('template', async () => 2), 2);
});
