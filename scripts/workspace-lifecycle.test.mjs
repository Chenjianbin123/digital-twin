import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, ref } from 'vue';
import { useWorkspaceBootstrap } from '../src/core/use-workspace-bootstrap.ts';
import { useWorkspacePanels } from '../src/core/use-workspace-panels.ts';
import { useComponentLoader } from '../src/core/use-component-loader.ts';
import { prepareAreaSelection } from '../src/core/area-selection-bootstrap.ts';
import { buildWorkspaceMetrics, getAreaTemperature } from '../src/core/workspace-metrics.ts';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function setup(t, factory) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 0 });
  const scope = effectScope();
  t.after(() => { scope.stop(); t.mock.timers.reset(); });
  return { scope, result: scope.run(factory) };
}
function tick(t, count = 100) {
  for (let i = 0; i < count; i++) t.mock.timers.tick(56);
}

test('fast bootstrap closes after a short anti-flash hold instead of simulated progress', async t => {
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(async context => {
    context.onPhase(74, '数据已完成');
    return null;
  }));
  await boot.start();
  assert.equal(boot.progress.value, 100);
  t.mock.timers.tick(179);
  assert.equal(boot.visible.value, true);
  t.mock.timers.tick(1);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.busy.value, false);
});

test('slow bootstrap stays visible until completion and then only holds 80ms', async t => {
  const request = deferred();
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(() => request.promise));
  const task = boot.start();
  tick(t, 100);
  assert.equal(boot.visible.value, true);
  assert.ok(boot.progress.value < 100);
  request.resolve(null); await task;
  t.mock.timers.tick(79);
  assert.equal(boot.visible.value, true);
  t.mock.timers.tick(1);
  assert.equal(boot.visible.value, false);
});

test('failed startup exposes retry without waiting for simulated progress or late phases', async t => {
  let context;
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(async c => {
    context = c; throw new Error('offline');
  }));
  await boot.start();
  context.onPhase(80, 'late phase');
  t.mock.timers.tick(180);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.error.value, 'offline');
  assert.equal(boot.phase.value, '初始化未完成，请重试');
});

test('cancelled bootstrap cannot overwrite a new login or complete its loader', async t => {
  const requests = [];
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(context => {
    const request = { ...deferred(), context }; requests.push(request); return request.promise;
  }));
  const first = boot.start();
  assert.equal(requests.length, 1);
  boot.start();
  assert.equal(requests.length, 1, 'duplicate startup does not reload');
  boot.cancel();
  const second = boot.start();
  requests[0].context.onPhase(80, 'old phase');
  requests[0].resolve('old error');
  await first;
  tick(t);
  assert.equal(boot.error.value, null);
  assert.equal(boot.phase.value, '初始化智慧病房资源');
  assert.equal(boot.busy.value, true);
  assert.equal(boot.visible.value, true);
  requests[1].resolve(null);
  await second;
  tick(t);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.progress.value, 100);
  assert.equal(boot.busy.value, false);
});

test('cancel during completion fade leaves the next startup intact', async t => {
  const next = deferred();
  let calls = 0;
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(() => ++calls === 1 ? Promise.resolve(null) : next.promise));
  await boot.start();
  for (let i = 0; i < 200 && boot.progress.value < 100; i++) t.mock.timers.tick(56);
  assert.equal(boot.progress.value, 100);
  assert.equal(boot.visible.value, true);
  boot.cancel();
  const second = boot.start();
  tick(t, 20);
  assert.equal(boot.visible.value, true);
  assert.equal(boot.busy.value, true);
  next.resolve(null); await second;
});

test('scope disposal cancels timers and ignores late error and phase updates', async t => {
  const request = deferred(); let context;
  const { scope, result: boot } = setup(t, () => useWorkspaceBootstrap(c => { context = c; return request.promise; }));
  const task = boot.start(); scope.stop();
  context.onPhase(90, 'obsolete'); request.reject(new Error('obsolete')); await task;
  tick(t);
  assert.equal(context.isCurrent(), false);
  assert.equal(boot.error.value, null);
  assert.equal(boot.visible.value, false);
  assert.equal(boot.progress.value, 0);
  assert.equal(boot.start(), undefined);
});

test('failed initialization can retry and concurrent retries are coalesced', async t => {
  let calls = 0; const request = deferred();
  const { result: boot } = setup(t, () => useWorkspaceBootstrap(() => ++calls === 1 ? Promise.reject(new Error('offline')) : request.promise));
  await boot.start(); tick(t);
  assert.equal(boot.error.value, 'offline');
  const retry = boot.retry(); boot.retry();
  assert.equal(calls, 2);
  assert.equal(boot.error.value, null);
  assert.equal(boot.busy.value, true);
  request.resolve(null); await retry;
  assert.equal(boot.busy.value, false);
});

test('cancelled area bootstrap never enters a remembered area from a newer session', async () => {
  const list = deferred(); let current = true; let entered = 0;
  const task = prepareAreaSelection({ useRemoteDeviceApi: true,
    assertRuntimeConfigured() {}, initializeFilePrefix: async () => {},
    loadAreaOptions: () => list.promise, loadLocalArea: async () => null,
    getRememberedAreaId: () => 42, enterRememberedArea: async () => { entered++; },
    onPhase() {}, isCurrent: () => current,
  });
  current = false; list.resolve(); await task;
  assert.equal(entered, 0);
});

test('component download rejection exposes failure, then retry recovers', async t => {
  let calls = 0, failures = 0;
  const { result: loader } = setup(t, () => useComponentLoader(() => ++calls === 1 ? Promise.reject(new Error('network')) : Promise.resolve('loaded'), () => failures++));
  await loader.retry();
  assert.equal(loader.failed.value, true); assert.equal(failures, 1);
  await loader.retry();
  assert.equal(loader.component.value, 'loaded'); assert.equal(loader.failed.value, false);
});

test('timed out download cannot replace a successful retry', async t => {
  const old = deferred(); let calls = 0, failures = 0;
  const { result: loader } = setup(t, () => useComponentLoader(() => ++calls === 1 ? old.promise : Promise.resolve('new'), () => failures++, 100));
  const first = loader.retry(); t.mock.timers.tick(100);
  assert.equal(loader.failed.value, true); assert.equal(failures, 1);
  await loader.retry(); old.resolve('old'); await first;
  assert.equal(loader.component.value, 'new');
});

test('unmounted component loader cannot report a failure into another scene', async t => {
  const request = deferred(); let failures = 0;
  const { scope, result: loader } = setup(t, () => useComponentLoader(() => request.promise, () => failures++, 100));
  const task = loader.retry(); scope.stop(); t.mock.timers.tick(1000);
  request.reject(new Error('late')); await task;
  assert.equal(failures, 0); assert.equal(loader.failed.value, false);
});

test('panel visibility remembers each view independently and resets with the area session', t => {
  const scope = effectScope(); t.after(() => scope.stop());
  const scene = ref('nurse-station'), interior = ref('3d'), area = ref('area:1');
  const { panelsVisible } = scope.run(() => useWorkspacePanels(scene, interior, area));
  assert.equal(panelsVisible.value, true);
  panelsVisible.value = false;
  scene.value = 'ward'; assert.equal(panelsVisible.value, true);
  scene.value = 'ward-interior'; interior.value = 'plan'; assert.equal(panelsVisible.value, false);
  panelsVisible.value = true;
  interior.value = '3d'; assert.equal(panelsVisible.value, true);
  interior.value = 'plan'; assert.equal(panelsVisible.value, true, 'explicit plan preference survives');
  scene.value = 'nurse-station'; assert.equal(panelsVisible.value, false, 'explicit station preference survives');
  area.value = 'area:2'; assert.equal(panelsVisible.value, true);
  scene.value = 'ward-interior'; assert.equal(panelsVisible.value, false);
});

const area = { areaName: 'Test', areaCode: 'A', deptName: 'Test', rooms: [{
  sickroomName: 'R', sickroomCode: 'R', sickroomId: 'R', deviceCode: 'D',
  beds: [{ bedCode: 'B', bedName: '1', deviceCode: 'B', isOccupied: false, isOnline: false, position: { x: 0, z: 0 } }],
}] };
test('workspace metrics preserve zero and separate hospital capacity from area occupancy', () => {
  const rows = buildWorkspaceMetrics(area, { bedNum: 100 });
  assert.equal(rows.find(r => r.key === 'bed').label, '医院开放床位');
  assert.equal(rows.find(r => r.key === 'bed').value, 100);
  for (const key of ['device','patient','rate']) assert.equal(rows.find(r => r.key === key).value, 0);
  assert.equal(rows.find(r => r.key === 'rate').label, '病区入住率');
  assert.equal(buildWorkspaceMetrics(area, null)[0].value, 1);
  assert.equal(buildWorkspaceMetrics(area, { bedNum: 0 })[0].value, 0);
  assert.deepEqual(buildWorkspaceMetrics(null, null), []);
  assert.equal(buildWorkspaceMetrics({ ...area, rooms: [] }, null).some(r => r.key === 'rate'), false);
});
test('temperature accepts zero, skips missing and invalid readings', () => {
  assert.equal(getAreaTemperature(area), undefined);
  assert.equal(getAreaTemperature({ ...area, rooms: [{ doorEnvData: { temp: '0℃' } }] }), '0');
  assert.equal(getAreaTemperature({ ...area, rooms: [{ doorEnvData: { temp: '--' } }, { doorEnvData: { temp: '25°C' } }] }), '25');
});
