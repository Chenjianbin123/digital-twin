import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';

// Explicitly synthetic, never connects to a hospital backend or reads a real session.
const baseline = process.env.INITIALIZATION_BASELINE === '1';
const root = resolve('.');
const originals = new Map(baseline ? ['src/stores/twin-store.ts', 'src/api/door-device.ts', 'src/core/area-selection-bootstrap.ts']
  .map(file => [resolve(file).replaceAll('\\', '/'), execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' })]) : []);
const server = await createServer({
  configFile: false, root, appType: 'custom',
  cacheDir: 'node_modules/.vite-initialization-test',
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': resolve('src') } },
  define: {
    'import.meta.env.VITE_DATA_SOURCE': JSON.stringify('remote'),
    'import.meta.env.VITE_API_TOKEN': JSON.stringify('synthetic-test-only'),
    'import.meta.env.VITE_DEVICE_HOST': JSON.stringify('http://files.test'),
    'import.meta.env.VITE_REALTIME_URL': JSON.stringify(''),
  },
  plugins: [{ name: 'baseline-source', enforce: 'pre', load(id) { return originals.get(id.replaceAll('\\', '/')); } }],
});
const storageValues = new Map();
const storage = { getItem: key => storageValues.get(key) ?? null,
  setItem: (key, value) => storageValues.set(key, value), removeItem: key => storageValues.delete(key) };
let expiredEvents = 0;
globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval, localStorage: storage, sessionStorage: storage,
  dispatchEvent() { expiredEvents++; } };
const originalFetch = globalThis.fetch;
const template = JSON.parse(readFileSync(new URL('../src/mock/door-template-main.json', import.meta.url), 'utf8'));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const response = data => ({ ok: true, status: 200, json: async () => ({ code: 200, data }) });
let requests = [];
let hospitalDone = false;
let prefixReply = async () => [{ paramKey: 'FILE_FRONT_URL_HEAD', paramValue: 'https://files.test' }];
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  const body = JSON.parse(options.body ?? '{}');
  requests.push(path);
  if (path.includes('querySysParamKeyValueByParamKeys')) return response(await prefixReply());
  if (path.includes('queryHospHospitalInfo')) {
    await pause(250); hospitalDone = true;
    return response({ hospitalName: 'Synthetic hospital' });
  }
  if (path.includes('querySwpDeviceInfo')) return response({ records: [{
    id: body.areaId, deviceCode: `DOOR-${body.areaId}`, isEnable: '1', templateId: 3,
  }] });
  if (path.includes('doorDevice/queryBaseDeviceInfo')) {
    await pause(10);
    return response({ doorDeviceInfo: {
      deviceCode: body.deviceCode, sickroomId: '101', sickroomCode: 'R1', sickroomName: 'R1', templateId: 3,
    }, bedDeviceList: [{ deviceCode: 'BED-1', bedCode: 'B1', bedName: 'B1', isOnline: '1' }], doorSickInfoList: [] });
  }
  if (path.includes('bedDevice/queryBaseDeviceInfo')) {
    await pause(10);
    return response({ bedDeviceInfoVo: { deviceCode: 'BED-1', bedCode: 'B1', templateId: 4, isOnline: '1' },
      bedSickInfoVo: { sickName: 'Synthetic patient', sickNo: 'TEST' } });
  }
  if (path.includes('querySwpTemplateInfoById')) {
    await pause(100);
    return response({ id: body.id, templateContent: template.templateContent, analyzeType: '1' });
  }
  return response({ records: [] });
};

const { useTwinStore } = await server.ssrLoadModule('/src/stores/twin-store.ts');
const prefix = await server.ssrLoadModule('/src/utils/file-prefix.ts');
const { resolveFileUrl } = await server.ssrLoadModule('/src/utils/file-url.ts');
const templates = await server.ssrLoadModule('/src/core/template/template-cache.ts');
const { postJson } = await server.ssrLoadModule('/src/api/http-client.ts');
function storeForTest() {
  setActivePinia(createPinia());
  const store = useTwinStore();
  store.areaOptions = [1, 2].map(id => ({ id, areaCode: String(id), areaName: `Area ${id}`, isEnable: '1' }));
  return store;
}

try {
  await test('area entry keeps patient enrichment but does not wait for hospital or templates', async () => {
    requests = []; hospitalDone = false;
    const store = storeForTest();
    const startedAt = performance.now();
    try {
      assert.equal(await store.enterArea(1), true);
      store.stopRemoteServices();
      const elapsedMs = Math.round(performance.now() - startedAt);
      const templateRequests = requests.filter(path => path.includes('querySwpTemplateInfoById')).length;
      console.log(JSON.stringify({ mode: baseline ? 'HEAD baseline' : 'optimized', elapsedMs, templateRequests, hospitalDone }));
      assert.equal(store.area.rooms[0].beds[0].sickInfo.sickName, 'Synthetic patient');
      if (!baseline) {
        assert.equal(templateRequests, 0);
        assert.equal(hospitalDone, false);
        assert.equal(store.hospitalInfoLoading, true);
      }
      await pause(270);
      assert.equal(store.hospitalInfo.hospitalName, 'Synthetic hospital');
      if (!baseline) {
        await store.refreshCurrentArea();
        assert.equal(requests.filter(path => path.includes('queryHospHospitalInfo')).length, 1);
        assert.equal(requests.filter(path => path.includes('querySwpTemplateInfoById')).length, 0);
      }
    } finally { store.clearSessionState(); }
  });

  if (!baseline) {
    await test('late HTTP/JSON 401 and 403 cannot expire a new session; current requests still expire', async () => {
      const syntheticFetch = globalThis.fetch;
      try {
        for (const layer of ['http', 'json']) for (const status of [401, 403]) {
          for (const mode of ['old', 'current', 'omit']) {
            storageValues.set('TokenKey', 'synthetic-old');
            let release;
            globalThis.fetch = () => new Promise(resolve => { release = resolve; });
            const eventsBefore = expiredEvents;
            const pending = postJson('/synthetic/auth-check', {}, { auth: mode === 'omit' ? 'omit' : 'auto' });
            if (mode === 'old') storageValues.set('TokenKey', 'synthetic-new');
            release({ ok: layer === 'json', status: layer === 'http' ? status : 200,
              json: async () => ({ code: status }) });
            await assert.rejects(pending);
            assert.equal(storage.getItem('TokenKey'), mode === 'current' ? null : mode === 'old' ? 'synthetic-new' : 'synthetic-old');
            assert.equal(expiredEvents - eventsBefore, mode === 'current' ? 1 : 0);
          }
        }
      } finally { globalThis.fetch = syntheticFetch; storageValues.clear(); }
    });

    await test('old hospital completion cannot restore logged-out metadata', async () => {
      const store = storeForTest();
      assert.equal(await store.enterArea(1), true);
      store.clearSessionState();
      await pause(270);
      assert.equal(store.hospitalInfo, null);
      assert.equal(store.hospitalInfoLoading, false);
    });

    await test('on-demand templates share requests and wait for prefix; image URLs react to readiness', async () => {
      requests = []; templates.clearTemplateCache(); prefix.clearFileUrlPrefix();
      let release;
      prefixReply = () => new Promise(resolve => { release = resolve; });
      const pending = prefix.initFileUrlPrefix();
      assert.equal(prefix.initFileUrlPrefix(), pending);
      assert.equal(resolveFileUrl('/swp_upload/test.png'), '');
      let ready = false;
      const a = templates.loadParsedTemplate(3).then(result => { ready = true; return result; });
      const b = templates.loadParsedTemplate(3);
      await pause(120);
      assert.equal(ready, false);
      release([{ paramKey: 'FILE_FRONT_URL_HEAD', paramValue: 'https://resources.test/' }]);
      await pending; await Promise.all([a, b]);
      assert.equal(resolveFileUrl('/swp_upload/test.png'), 'https://resources.test/swp_upload/test.png');
      assert.equal(requests.filter(path => path.includes('querySwpTemplateInfoById')).length, 1);
      assert.equal(requests.filter(path => path.includes('querySysParamKeyValueByParamKeys')).length, 1);
    });

    await test('prefix failure/empty responses settle the barrier; old sessions cannot change a new prefix', async () => {
      for (const reply of [async () => { throw new Error('offline'); }, async () => []]) {
        prefix.clearFileUrlPrefix(); prefixReply = reply;
        await prefix.initFileUrlPrefix();
        assert.equal(prefix.isFileUrlPrefixLoading(), false);
        assert.equal(prefix.getFileUrlPrefix(), 'http://files.test:9704');
      }
      prefix.clearFileUrlPrefix();
      let release;
      prefixReply = () => new Promise(resolve => { release = resolve; });
      const old = prefix.initFileUrlPrefix();
      prefix.clearFileUrlPrefix();
      prefixReply = async () => [{ paramKey: 'FILE_FRONT_URL_HEAD', paramValue: 'https://new.test' }];
      await prefix.initFileUrlPrefix();
      release([{ paramKey: 'FILE_FRONT_URL_HEAD', paramValue: 'https://old.test' }]);
      await old;
      assert.equal(prefix.getFileUrlPrefix(), 'https://new.test');
    });
  }
} finally {
  prefix.clearFileUrlPrefix(); templates.clearTemplateCache();
  globalThis.fetch = originalFetch;
  await server.close();
}
