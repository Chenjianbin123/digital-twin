import assert from 'node:assert/strict';
import test from 'node:test';
import { buildNurseStationViewModel } from './nurse-station-view-model.ts';
import { buildNurseStatusPresentation, SYNC_STATUS_LABELS } from './nurse-status-presentation.ts';

function fixture() {
  return buildNurseStationViewModel({ area: { areaCode: 'test', areaName: '测试', deptName: '测试', rooms: [] }, roomSummaries: [], wardDataStatus: 'warning', swpEventSync: { phase: 'error', lastSyncedAt: null, error: '呼叫同步失败', warning: null } });
}
test('status separates patient calls from clinical emergency and preserves vital priority', () => {
  const vm = fixture();
  vm.metrics.calling = 2;
  assert.equal(buildNurseStatusPresentation(vm).eventLabel, '有患者呼叫，待处理');
  vm.metrics.vitalWarnings = 1;
  assert.equal(buildNurseStatusPresentation(vm).eventLabel, '有体征预警，需关注');
  vm.metrics.calling = vm.metrics.vitalWarnings = 0;
  assert.equal(buildNurseStatusPresentation(vm).eventLabel, vm.state.label);
});
test('source details retain warnings, failures and absent timestamps without fabricating causes', () => {
  const status = buildNurseStatusPresentation(fixture(), ['病房详情保留上次数据', '病房详情保留上次数据']);
  assert.equal(status.sources.length, 4);
  assert.deepEqual(status.sources[0].reasons, ['病房详情保留上次数据']);
  assert.deepEqual(status.sources[1].reasons, ['呼叫同步失败']);
  assert.equal(status.sources[1].syncedAt, null);
  assert.deepEqual(status.sources[2].reasons, []);
  assert.equal(SYNC_STATUS_LABELS.stale, '更新延迟');
});
test('successful source does not retain obsolete warnings', () => {
  const vm = fixture();
  vm.dataFreshnessItems[0].status = 'ready';
  assert.deepEqual(buildNurseStatusPresentation(vm, ['旧告警']).sources[0].reasons, []);
});

test('nursing notices are safe summaries while technical reasons remain available for troubleshooting', () => {
  const vm = fixture();
  vm.swpEventSync.error = 'HTTP 502 /synthetic-api 接口失败';
  const event = buildNurseStatusPresentation(vm).sources.find(item => item.key === 'events')!;
  assert.match(event.notice, /暂未获取信息.*现场/);
  assert.doesNotMatch(event.notice, /HTTP|502|接口|后台|上次记录/);
  assert.deepEqual(event.reasons, ['HTTP 502 /synthetic-api 接口失败']);
});
