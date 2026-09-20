import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWardIssueSummary, resolveWardInteriorDataStatus } from './ward-interior-status.ts';

const unbound = { bedCode: '208', bedName: '208床', kind: 'unbound' as const, message: '未关联床头机设备' };
const failed = { bedCode: '99', bedName: '99床', kind: 'request-failed' as const, message: '床头机信息查询超时，请重新同步' };
const input = { phase: 'ready' as const, lastFetchedAtMs: 1000, nowMs: 1001, busy: false, issues: [] };

test('current-room status counts affected beds and distinguishes binding from request failures', () => {
  assert.equal(buildWardIssueSummary([unbound]), '本病房 1 个床位未关联床头机');
  assert.equal(buildWardIssueSummary([failed]), '本病房 1 个床位信息同步异常');
  assert.equal(buildWardIssueSummary([unbound, failed]), '本病房 2 个床位需关注（1 个未关联设备，1 个同步异常）');
  assert.equal(buildWardIssueSummary([unbound, unbound]), '本病房 1 个床位未关联床头机');
  assert.equal(buildWardIssueSummary([]), '');
  const conflict = { bedCode: '13', bedName: '空床', kind: 'occupancy-conflict' as const, message: '名称与入住记录不一致' };
  assert.equal(buildWardIssueSummary([conflict]), '本病房 1 个床位入住数据需核对');
  assert.equal(buildWardIssueSummary([unbound, conflict]), '本病房 2 个床位需关注（1 个未关联设备，1 个入住数据待核对）');
});

test('only current-room issues determine warnings; global failure and staleness remain visible', () => {
  assert.equal(resolveWardInteriorDataStatus(input), 'ready');
  assert.equal(resolveWardInteriorDataStatus({ ...input, issues: [unbound] }), 'warning');
  assert.equal(resolveWardInteriorDataStatus({ ...input, issues: [unbound], busy: true }), 'loading');
  assert.equal(resolveWardInteriorDataStatus({ ...input, phase: 'error' }), 'error');
  assert.equal(resolveWardInteriorDataStatus({ ...input, nowMs: 400000, issues: [unbound] }), 'stale');
  assert.equal(resolveWardInteriorDataStatus({ ...input, phase: 'loading' }), 'loading');
});
