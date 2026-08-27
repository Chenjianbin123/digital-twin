import assert from 'node:assert/strict';
import test from 'node:test';
import * as dataStatusModule from './data-status.ts';
import { resolveDataStatus } from './data-status.ts';

test('resolves loading, warning, stale and error data states', () => {
  assert.equal(resolveDataStatus({ phase: 'loading', hasWarnings: false, lastFetchedAtMs: null, nowMs: 0 }), 'loading');
  assert.equal(resolveDataStatus({ phase: 'ready', hasWarnings: true, lastFetchedAtMs: 0, nowMs: 1_000 }), 'warning');
  assert.equal(resolveDataStatus({ phase: 'ready', hasWarnings: false, lastFetchedAtMs: 0, nowMs: 301_000 }), 'stale');
  assert.equal(resolveDataStatus({ phase: 'error', hasWarnings: false, lastFetchedAtMs: null, nowMs: 0 }), 'error');
});

test('builds source-level health without pretending shared ward data is independently refreshed', () => {
  const builder = (dataStatusModule as Record<string, unknown>).buildDataHealthSummary;
  assert.equal(typeof builder, 'function');
  if (typeof builder !== 'function')
    return;

  assert.deepEqual(builder({
    wardStatus: 'warning',
    eventSync: { phase: 'error', lastSyncedAt: '2026-08-25T09:00:00', error: '接口失败', warning: null },
  }), {
    level: 'error',
    label: '数据同步异常',
    canDeclareNormal: false,
    items: [
      { key: 'beds', label: '床位与患者', status: 'warning', detail: '病区数据部分同步' },
      { key: 'devices', label: '设备状态', status: 'warning', detail: '随病区数据同步' },
      { key: 'environment', label: '病房环境', status: 'warning', detail: '随病区数据同步' },
      { key: 'infusion', label: '输液状态', status: 'warning', detail: '随病区数据同步' },
      { key: 'events', label: '呼叫与报警', status: 'error', detail: '同步中断，当前显示最近一次数据' },
    ],
  });
});

test('allows normal-operation wording only when ward and event data are current', () => {
  const builder = (dataStatusModule as Record<string, unknown>).buildDataHealthSummary;
  assert.equal(typeof builder, 'function');
  if (typeof builder !== 'function')
    return;

  const result = builder({
    wardStatus: 'ready',
    eventSync: { phase: 'ready', lastSyncedAt: '2026-08-25T10:00:00', error: null, warning: null },
  });
  assert.equal(result.level, 'ready');
  assert.equal(result.canDeclareNormal, true);
});
