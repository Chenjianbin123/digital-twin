import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventRecordBrowser, type EventPageState } from './event-record-browser.ts';
import type { SwpRecordPage } from '../types/swp-events.ts';

type Record = { id: string };
function page(current: number, ids = [`${current}-1`, `${current}-2`], total = 5): SwpRecordPage<Record> {
  return { records: ids.map(id => ({ id })), coverage: { received: ids.length, current, size: 2, total, pages: Math.ceil(total / 2), complete: total === ids.length } };
}

test('fetches only requested pages, retains one page and uses backend total', async () => {
  let state!: EventPageState<Record>;
  const calls: number[] = [];
  const browser = createEventRecordBrowser(async current => { calls.push(current); return page(current); }, next => { state = next; });
  assert.deepEqual(calls, []);
  assert.equal(await browser.go(1), true);
  assert.equal(state.total, 5);
  assert.equal(state.records.length, 2);
  assert.equal(state.hasNext, true);
  await browser.go(2);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(state.records.length, 2);
  assert.equal(state.page, 2);
  await browser.go(3);
  assert.equal(state.hasNext, false);
});

test('retains last page on failure and retries the requested page', async () => {
  let state!: EventPageState<Record>;
  let fail = true;
  const browser = createEventRecordBrowser(async current => {
    if (current === 2 && fail) throw Error('模拟失败');
    return page(current);
  }, next => { state = next; });
  await browser.go(1);
  assert.equal(await browser.go(2), false);
  assert.equal(state.page, 1);
  assert.equal(state.error, '模拟失败');
  fail = false;
  assert.equal(await browser.go(2), true);
  assert.equal(state.error, null);
});

test('ignores stale ward responses and prevents duplicate concurrent queries', async () => {
  let state!: EventPageState<Record>;
  let resolve!: (result: SwpRecordPage<Record>) => void;
  const browser = createEventRecordBrowser(() => new Promise<SwpRecordPage<Record>>(done => { resolve = done; }), next => { state = next; });
  const first = browser.go(1);
  assert.equal(await browser.go(1), false);
  browser.reset();
  resolve(page(1));
  assert.equal(await first, false);
  assert.equal(state.records.length, 0);
  assert.equal(state.page, 0);
});

test('rejects mismatched, repeated and empty pages; deduplicates records', async () => {
  let state!: EventPageState<Record>;
  let response = page(2);
  const browser = createEventRecordBrowser(async () => response, next => { state = next; });
  assert.equal(await browser.go(1), false);
  response = page(1, ['a', 'a']);
  assert.equal(await browser.go(1), true);
  assert.equal(state.records.length, 1);
  assert.match(state.warning!, /去重/);
  response = page(2, ['a', 'a']);
  assert.equal(await browser.go(2), false);
  assert.match(state.error!, /重复/);
  response = page(2, []);
  assert.equal(await browser.go(2), false);
  assert.match(state.error!, /空页/);
});

test('reports changing totals, accepts a truly empty first page and rejects invalid page inputs', async () => {
  let state!: EventPageState<Record>;
  const browser = createEventRecordBrowser(async current => current === 1 ? page(1) : page(2, ['new'], 3), next => { state = next; });
  await browser.go(1);
  await browser.go(2);
  assert.match(state.warning!, /数量发生变化/);
  assert.equal(state.total, 3);
  assert.equal(await browser.go(0), false);
  assert.equal(await browser.go(1.5), false);
  const empty = createEventRecordBrowser(async () => page(1, [], 0), next => { state = next; });
  assert.equal(await empty.go(1), true);
  assert.equal(state.hasNext, false);
});
