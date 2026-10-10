import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAlertQueuePresentation } from './alert-queue-presentation.ts';

const base = { status: 'ready' as const, supported: true, taskCount: 0, filter: 'active' as const, categoryFiltered: false };
test('failed, loading, partial and stale empty queues never declare no alerts', () => {
  for (const status of ['loading', 'error', 'warning', 'stale'] as const) {
    const result = buildAlertQueuePresentation({ ...base, status });
    assert.ok(result.notice);
    assert.equal(result.emptyTitle, result.notice);
    assert.equal(result.countsKnown, false);
    assert.match(result.detail, /现场情况确认是否仍有待办/);
  }
});
test('retained items remain countable with a visible failure warning', () => {
  const result = buildAlertQueuePresentation({ ...base, taskCount: 3, status: 'error' });
  assert.equal(result.countsKnown, true);
  assert.match(result.detail, /当前列表可能不完整/);
  assert.match(result.notice, /暂未更新/);
});
test('successful empty data, filtered empty data and unsupported sources stay distinct', () => {
  assert.match(buildAlertQueuePresentation(base).emptyTitle, /当前记录中暂无待办/);
  assert.match(buildAlertQueuePresentation({ ...base, taskCount: 2 }).emptyTitle, /筛选/);
  assert.match(buildAlertQueuePresentation({ ...base, categoryFiltered: true }).emptyTitle, /筛选/);
  const unsupported = buildAlertQueuePresentation({ ...base, supported: false });
  assert.match(unsupported.notice, /暂无法查看/);
  assert.equal(unsupported.countsKnown, false);
});
