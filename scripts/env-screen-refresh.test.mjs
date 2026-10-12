import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { WardCorridorScreenCache } from '../src/core/ward-corridor-screen-cache.ts';
import { makeTP4 } from './fixtures/tp4-runtime-fixtures.mjs';

const stateKey = '__envScreenRefreshTest';
const state = { renders: 0, statuses: [], render: async () => texture('rendered') };
globalThis[stateKey] = state;
const originalNow = Date.now;
let now = originalNow();
Date.now = () => now;

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  configFile: false, envDir: false, appType: 'custom', logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  server: { middlewareMode: true, hmr: false, watch: null },
  plugins: [{
    name: 'env-screen-refresh-boundaries', enforce: 'pre',
    load(id) {
      const path = id.replaceAll('\\', '/').split('?')[0];
      if (path.endsWith('/src/api/template.ts'))
        return `export async function queryTemplateById(id) { return { id, templateContent: ${JSON.stringify(JSON.stringify(makeTP4('door')))} }; }`;
      if (path.endsWith('/src/utils/file-prefix.ts'))
        return `export async function waitForFileUrlPrefix() {}
          export function getFileUrlPrefix() { return ''; }
          export function isFileUrlPrefixLoading() { return false; }`;
      if (path.endsWith('/src/core/template/door-terminal-texture.ts'))
        return `const state = globalThis[${JSON.stringify(stateKey)}];
          export function createDoorTemplateStatusTexture(_room, status) {
            state.statuses.push(status); return { status, dispose() {} };
          }
          export function createFallbackDoorTerminalTexture() { throw new Error('Unexpected fallback'); }
          export function getDoorTerminalScreenLayout() { return { isHorizontal: true }; }
          export function renderDoorTerminalTexture(...args) { state.renders++; return state.render(...args); }`;
    },
  }],
});
const { corridorScreenSignature } = await server.ssrLoadModule('/src/core/ward-corridor-screens.ts');
const { clearTemplateCache, TEMPLATE_CACHE_TTL_MS } = await server.ssrLoadModule('/src/core/template/template-cache.ts');
const { AreaScene } = await server.ssrLoadModule('/src/core/area-scene.ts');
after(async () => {
  Date.now = originalNow;
  delete globalThis[stateKey];
  await server.close();
});
beforeEach(() => {
  clearTemplateCache();
  state.renders = 0;
  state.statuses = [];
  state.render = async () => texture('rendered');
});

const area = { areaName: '测试病区', deptName: '测试科室' };
function makeRoom() {
  return {
    sickroomId: 'room-1', sickroomName: '101', templateId: 42,
    doorEnvData: { temp: '24', humidity: '50' },
    envSync: { lastSuccessAt: 100, failed: false },
    doorStaff: { doctorName: '医生甲', nurseName: '护士甲' },
    beds: [{ bedCode: '01', patient: { name: '测试患者' } }],
  };
}

test('environment timestamps and failure metadata do not change the screen signature or input', () => {
  const room = makeRoom();
  const original = structuredClone(room);
  const signature = corridorScreenSignature(room, area, 1.5);
  for (const envSync of [undefined, { lastSuccessAt: 200, failed: false }, { lastSuccessAt: 100, failed: true }])
    assert.equal(corridorScreenSignature({ ...room, envSync }, area, 1.5), signature);
  assert.deepEqual(room, original);
});

test('actual environment, patient, staff, template and viewport inputs still invalidate screens', () => {
  const room = makeRoom();
  const signature = corridorScreenSignature(room, area, 1.5);
  for (const mutate of [
    value => { value.doorEnvData.temp = '25'; },
    value => { value.doorEnvData.humidity = '60'; },
    value => { value.beds[0].patient.name = '下一位患者'; },
    value => { value.doorStaff.doctorName = '医生乙'; },
    value => { value.templateId = 43; },
  ]) {
    const changed = structuredClone(room);
    mutate(changed);
    assert.notEqual(corridorScreenSignature(changed, area, 1.5), signature);
  }
  assert.notEqual(corridorScreenSignature(room, area, 2), signature);
  assert.notEqual(corridorScreenSignature(room, { ...area, areaName: '另一病区' }, 1.5), signature);
  assert.notEqual(corridorScreenSignature(room, { ...area, deptName: '另一科室' }, 1.5), signature);
});

test('same-value environment polls skip rendering while value changes and manual refresh render again', async () => {
  const cache = new WardCorridorScreenCache();
  const room = makeRoom();
  let renders = 0;
  const refresh = () => cache.update('door', corridorScreenSignature(room, area, 1.5),
    async () => { renders++; return { dispose() {} }; }, () => {});
  await refresh();
  for (let index = 1; index <= 5; index++) {
    room.doorEnvData = { ...room.doorEnvData };
    room.envSync = { lastSuccessAt: 100 + index, failed: index === 3 };
    await refresh();
  }
  assert.equal(renders, 1);
  room.doorEnvData.temp = '25';
  await refresh();
  assert.equal(renders, 2);
  clearTemplateCache();
  await refresh();
  assert.equal(renders, 3);
});

function texture(name) {
  return { name, disposed: false, dispose() { this.disposed = true; } };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function doorFixture() {
  const room = makeRoom();
  const mesh = { roomIndex: 0, doorScreen: { material: {} }, doorIsHorizontal: true };
  const scene = {
    modelKind: 'area', isActive: true, shouldShowWardCorridorModel: () => false,
    area: { ...area, rooms: [room] }, summaries: [{}],
    roomMeshes: new Map([[0, mesh]]), doorRefreshToken: new Map(), doorScreenSignatures: new WeakMap(),
  };
  return { room, mesh, scene, refresh: () => AreaScene.prototype.refreshDoorScreen.call(scene, 0) };
}

test('ordinary door screens skip same-value environment sync without loading flashes', async () => {
  const fixture = doorFixture();
  await fixture.refresh();
  const first = fixture.mesh.doorScreenTexture;
  fixture.room.envSync = { lastSuccessAt: 200, failed: true };
  fixture.room.doorEnvData = { ...fixture.room.doorEnvData };
  await fixture.refresh();
  assert.equal(state.renders, 1);
  assert.deepEqual(state.statuses, ['loading']);
  assert.strictEqual(fixture.mesh.doorScreenTexture, first);
  fixture.room.doorEnvData.temp = '25';
  await fixture.refresh();
  assert.equal(state.renders, 2);
  clearTemplateCache();
  await fixture.refresh();
  assert.equal(state.renders, 3);
});

test('ordinary door screen pending work stays coalesced and TTL starts at successful completion', async () => {
  const fixture = doorFixture();
  const started = deferred();
  const rendered = deferred();
  state.render = () => { started.resolve(); return rendered.promise; };
  const pending = fixture.refresh();
  await started.promise;
  now += TEMPLATE_CACHE_TTL_MS + 1;
  const duplicate = fixture.refresh();
  await new Promise(resolve => setImmediate(resolve));
  const rendersWhilePending = state.renders;
  rendered.resolve(texture('first'));
  await Promise.all([pending, duplicate]);
  assert.equal(rendersWhilePending, 1);
  state.render = async () => texture('next');
  now += TEMPLATE_CACHE_TTL_MS - 1;
  await fixture.refresh();
  assert.equal(state.renders, 1);
  now++;
  await fixture.refresh();
  assert.equal(state.renders, 2);
});

test('ordinary door screen render failures permit immediate retry with the same values', async () => {
  const fixture = doorFixture();
  state.render = async () => { throw new Error('temporary render failure'); };
  await fixture.refresh();
  assert.equal(fixture.mesh.doorScreenTexture.status, 'error');
  state.render = async () => texture('recovered');
  await fixture.refresh();
  assert.equal(state.renders, 2);
  assert.equal(fixture.mesh.doorScreenTexture.name, 'recovered');
});

test('ordinary door screen cache belongs to its mesh binding and discards detached pending textures', async () => {
  const fixture = doorFixture();
  const started = deferred();
  const rendered = deferred();
  state.render = () => { started.resolve(); return rendered.promise; };
  const pending = fixture.refresh();
  await started.promise;
  const nextMesh = { roomIndex: 0, doorScreen: { material: {} }, doorIsHorizontal: true };
  fixture.scene.roomMeshes.set(0, nextMesh);
  const stale = texture('stale');
  rendered.resolve(stale);
  await pending;
  assert.equal(stale.disposed, true);
  assert.equal(nextMesh.doorScreenTexture, undefined);
  state.render = async () => texture('new binding');
  await fixture.refresh();
  assert.equal(nextMesh.doorScreenTexture.name, 'new binding');
  assert.equal(state.renders, 2);
});

test('disposing an ordinary door room invalidates its pending texture', async () => {
  const fixture = doorFixture();
  fixture.mesh.group = { traverse() {} };
  fixture.scene.scene = { remove() {} };
  fixture.scene.disposeDoorTerminalGroup = () => {};
  const started = deferred();
  const rendered = deferred();
  state.render = () => { started.resolve(); return rendered.promise; };
  const pending = fixture.refresh();
  await started.promise;
  AreaScene.prototype.disposeRoomGroup.call(fixture.scene, fixture.mesh);
  const stale = texture('disposed room');
  rendered.resolve(stale);
  await pending;
  assert.equal(stale.disposed, true);
  assert.equal(fixture.scene.doorScreenSignatures.has(fixture.mesh), false);
  assert.notStrictEqual(fixture.mesh.doorScreenTexture, stale);
});

test('ordinary door screens discard pending textures and errors after a template cache clear', async () => {
  for (const fail of [false, true]) {
    const fixture = doorFixture();
    const started = deferred();
    const rendered = deferred();
    state.render = () => { started.resolve(); return rendered.promise; };
    const pending = fixture.refresh();
    await started.promise;
    clearTemplateCache();
    const stale = texture('stale');
    if (fail) rendered.reject(new Error('obsolete failure'));
    else rendered.resolve(stale);
    await pending;
    if (!fail) assert.equal(stale.disposed, true);
    assert.notEqual(fixture.mesh.doorScreenTexture.status, 'error');
    state.render = async () => texture('current generation');
    await fixture.refresh();
    assert.equal(fixture.mesh.doorScreenTexture.name, 'current generation');
  }
});
