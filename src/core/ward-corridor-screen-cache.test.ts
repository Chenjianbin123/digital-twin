import assert from 'node:assert/strict';
import test from 'node:test';
import { WardCorridorScreenCache } from './ward-corridor-screen-cache.ts';

test('render concurrency is capped and queued updates coalesce to latest', async () => {
  const cache = new WardCorridorScreenCache();
  const finish: Array<() => void> = [];
  const seen: string[] = [];
  let active = 0;
  let peak = 0;
  const render = () => new Promise<{ dispose(): void }>(resolve => {
    active++; peak = Math.max(peak, active);
    finish.push(() => { active--; resolve({ dispose() {} }); });
  });
  const jobs = [
    cache.update('a', '1', render, () => seen.push('a')),
    cache.update('b', '1', render, () => seen.push('b')),
    cache.update('c', 'old', render, () => seen.push('old')),
    cache.update('c', 'new', render, () => seen.push('new')),
  ];
  assert.equal(finish.length, 2);
  finish.shift()!(); finish.shift()!();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(finish.length, 1);
  finish.shift()!();
  await Promise.all(jobs);
  assert.equal(peak, 2);
  assert.deepEqual(seen, ['a', 'b', 'new']);
});


test('ten unchanged screens are skipped; changing one room renders exactly one screen', async () => {
  const cache = new WardCorridorScreenCache();
  let renders = 0;
  const frame = () => { renders++; return Promise.resolve({ dispose() {} }); };
  for (let round = 0; round < 10; round++) {
    await Promise.all(Array.from({ length: 10 }, (_, index) =>
      cache.update(String(index), 'same', frame, () => {})));
  }
  assert.equal(renders, 10);
  await cache.update('3', 'changed', frame, () => {});
  assert.equal(renders, 11);
  assert.equal(cache.stats.skipped, 90);
});
test('out-of-order rendering and disposed bindings cannot overwrite current screens', async () => {
  const cache = new WardCorridorScreenCache();
  let finish!: (value: { dispose(): void }) => void;
  let discarded = 0;
  const seen: string[] = [];
  const pending = cache.update('door', 'old', () => new Promise<{ dispose(): void }>(resolve => { finish = resolve; }), () => seen.push('old'));
  await cache.update('door', 'new', async () => ({ dispose() {} }), () => seen.push('new'));
  finish({ dispose() { discarded++; } });
  await pending;
  assert.deepEqual(seen, ['new']);
  const detached = cache.update('door', 'third', () => new Promise<{ dispose(): void }>(resolve => { finish = resolve; }), () => seen.push('detached'));
  cache.clear();
  finish({ dispose() { discarded++; } });
  await detached;
  assert.equal(discarded, 2);
  assert.deepEqual(seen, ['new']);
});
test('failed rendering is retryable with the same data', async () => {
  const cache = new WardCorridorScreenCache();
  await assert.rejects(cache.update('door', 'same', async () => { throw Error('offline'); }, () => {}));
  let applied = false;
  await cache.update('door', 'same', async () => ({ dispose() {} }), () => { applied = true; });
  assert.equal(applied, true);
});

test('unchanged screens render again when their configured TTL expires', async () => {
  let now = 100;
  let renders = 0;
  const cache = new WardCorridorScreenCache({ ttlMs: 50, now: () => now });
  const render = async () => { renders++; return { dispose() {} }; };
  await cache.update('door', 'same', render, () => {});
  now = 149;
  await cache.update('door', 'same', render, () => {});
  assert.equal(renders, 1);
  now = 150;
  await cache.update('door', 'same', render, () => {});
  assert.equal(renders, 2);
});

test('screen TTL starts after rendering succeeds', async () => {
  let now = 0;
  let renders = 0;
  let finish!: () => void;
  const cache = new WardCorridorScreenCache({ ttlMs: 50, now: () => now });
  const first = cache.update('door', 'same', () => {
    renders++;
    return new Promise<{ dispose(): void }>((resolve) => {
      finish = () => resolve({ dispose() {} });
    });
  }, () => {});
  now = 100;
  finish();
  await first;
  const render = async () => { renders++; return { dispose() {} }; };
  now = 149;
  await cache.update('door', 'same', render, () => {});
  assert.equal(renders, 1);
  now = 150;
  await cache.update('door', 'same', render, () => {});
  assert.equal(renders, 2);
});

test('in-flight rendering stays coalesced even when it takes longer than the TTL', async () => {
  let now = 0;
  let renders = 0;
  let applied = 0;
  let finish!: () => void;
  const cache = new WardCorridorScreenCache({ ttlMs: 50, now: () => now });
  const render = () => {
    renders++;
    return new Promise<{ dispose(): void }>((resolve) => {
      finish = () => resolve({ dispose() {} });
    });
  };
  const first = cache.update('door', 'same', render, () => { applied++; });
  now = 200;
  await cache.update('door', 'same', render, () => { applied++; });
  assert.equal(renders, 1);
  finish();
  await first;
  assert.equal(applied, 1);
});
