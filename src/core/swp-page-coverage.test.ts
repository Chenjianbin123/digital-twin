import test from 'node:test';
import assert from 'node:assert/strict';
import { readSwpRecordPage } from './swp-page-coverage.ts';

test('preserves real response pagination without treating page one as a complete set', () => {
  const result = readSwpRecordPage({ records: Array(10).fill({ id: 1 }), total: 1333, size: 10, current: 1, pages: 134 });
  assert.equal(result.coverage.total, 1333);
  assert.equal(result.coverage.complete, false);
});
test('only consistent complete first pages can declare completeness', () => {
  assert.equal(readSwpRecordPage({ records: [], total: 0, current: 1, size: 10, pages: 0 }).coverage.complete, true);
  for (const page of [
    { records: [] }, { records: [], total: 10, current: 1 },
    { records: [], total: 0, current: 2 }, { records: [], total: 0, current: 1, pages: 3 },
  ]) assert.equal(readSwpRecordPage(page).coverage.complete, false);
  assert.throws(() => readSwpRecordPage(undefined), /有效记录/);
});
