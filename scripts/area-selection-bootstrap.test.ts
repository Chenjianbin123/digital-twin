import assert from 'node:assert/strict';
import { prepareAreaSelection } from '../src/core/area-selection-bootstrap.ts';

const successfulCalls: string[] = [];
const success = await prepareAreaSelection({
  useRemoteDeviceApi: true,
  assertRuntimeConfigured() {
    successfulCalls.push('runtime');
  },
  async initializeFilePrefix() {
    successfulCalls.push('files');
  },
  async loadAreaOptions() {
    successfulCalls.push('areas');
  },
  async loadLocalArea() {
    successfulCalls.push('local');
    return null;
  },
  getRememberedAreaId() {
    return 192;
  },
  async enterRememberedArea(areaId) {
    successfulCalls.push(`enter:${areaId}`);
  },
  onPhase(progress, label) {
    successfulCalls.push(`${progress}:${label}`);
  },
});

assert.equal(success, null);
assert.deepEqual(successfulCalls.slice(0, 3), [
  '18:校验设备运行环境',
  'runtime',
  '34:加载病区文件资源',
]);
assert.ok(successfulCalls.indexOf('files') < successfulCalls.indexOf('enter:192'));
assert.ok(successfulCalls.indexOf('areas') < successfulCalls.indexOf('enter:192'));

const firstVisitCalls: string[] = [];
const firstVisitResult = await prepareAreaSelection({
  useRemoteDeviceApi: true,
  assertRuntimeConfigured() {},
  async initializeFilePrefix() {},
  async loadAreaOptions() {
    firstVisitCalls.push('areas');
  },
  async loadLocalArea() {
    firstVisitCalls.push('local');
    return null;
  },
  getRememberedAreaId() {
    firstVisitCalls.push('remembered');
    return null;
  },
  async enterRememberedArea(areaId) {
    firstVisitCalls.push(`enter:${areaId}`);
  },
  onPhase() {},
});

assert.equal(firstVisitResult, null);
assert.deepEqual(firstVisitCalls, ['areas', 'remembered']);

const failedCalls: string[] = [];
const failure = await prepareAreaSelection({
  useRemoteDeviceApi: true,
  assertRuntimeConfigured() {
    failedCalls.push('runtime');
  },
  async initializeFilePrefix() {
    failedCalls.push('files');
    throw new Error('文件服务暂不可用');
  },
  async loadAreaOptions() {
    failedCalls.push('areas');
  },
  async loadLocalArea() {
    failedCalls.push('local');
    return null;
  },
  getRememberedAreaId() {
    failedCalls.push('remembered');
    return 192;
  },
  async enterRememberedArea(areaId) {
    failedCalls.push(`enter:${areaId}`);
  },
  onPhase(progress) {
    failedCalls.push(`phase:${progress}`);
  },
});

assert.equal(failure, null);
assert.ok(failedCalls.includes('areas'));
assert.ok(failedCalls.includes('enter:192'));

const rememberedFailure = await prepareAreaSelection({
  useRemoteDeviceApi: true,
  assertRuntimeConfigured() {},
  async initializeFilePrefix() {},
  async loadAreaOptions() {},
  async loadLocalArea() { return null; },
  getRememberedAreaId() { return 192; },
  async enterRememberedArea() { return false; },
  onPhase() {},
});
assert.match(rememberedFailure ?? '', /恢复上次工作病区失败/);

const localCalls: string[] = [];
const localResult = await prepareAreaSelection({
  useRemoteDeviceApi: false,
  assertRuntimeConfigured() {
    localCalls.push('runtime');
  },
  async initializeFilePrefix() {
    localCalls.push('files');
  },
  async loadAreaOptions() {
    localCalls.push('areas');
  },
  async loadLocalArea() {
    localCalls.push('local');
    return null;
  },
  getRememberedAreaId() {
    localCalls.push('remembered');
    return 192;
  },
  async enterRememberedArea(areaId) {
    localCalls.push(`enter:${areaId}`);
  },
  onPhase(progress) {
    localCalls.push(`phase:${progress}`);
  },
});

assert.equal(localResult, null);
assert.deepEqual(localCalls, [
  'phase:18',
  'phase:34',
  'phase:58',
  'local',
]);

const localFailure = await prepareAreaSelection({
  useRemoteDeviceApi: false,
  assertRuntimeConfigured() {},
  async initializeFilePrefix() {},
  async loadAreaOptions() {},
  async loadLocalArea() {
    return '模拟病区加载失败';
  },
  getRememberedAreaId() {
    return null;
  },
  async enterRememberedArea() {},
  onPhase() {},
});

assert.equal(localFailure, '模拟病区加载失败');

const databaseCalls: string[] = [];
const databaseResult = await prepareAreaSelection({
  useRemoteDeviceApi: false,
  useAreaSelection: true,
  assertRuntimeConfigured() {
    databaseCalls.push('runtime');
  },
  async initializeFilePrefix() {
    databaseCalls.push('files');
  },
  async loadAreaOptions() {
    databaseCalls.push('areas');
  },
  async loadLocalArea() {
    databaseCalls.push('local');
    return null;
  },
  getRememberedAreaId() {
    databaseCalls.push('remembered');
    return null;
  },
  async enterRememberedArea() {
    databaseCalls.push('enter');
  },
  onPhase() {},
});

assert.equal(databaseResult, null);
assert.deepEqual(databaseCalls, ['files', 'areas', 'remembered']);

console.log('Area-selection bootstrap tests passed.');
