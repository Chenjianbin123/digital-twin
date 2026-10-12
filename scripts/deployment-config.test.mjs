import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Exercise the production consumers without private environment files or real requests.
async function runtime(host, run) {
  const server = await createServer({
    configFile: false, envDir: false, envPrefix: 'DEPLOYMENT_TEST_UNUSED_', root: resolve('.'), appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { '@': resolve('src') } },
    define: {
      'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true',
      'import.meta.env.VITE_DEVICE_HOST': JSON.stringify(host),
      'import.meta.env.VITE_API_BASE_URL': '""', 'import.meta.env.VITE_API_TOKEN': '""',
    },
  });
  const previousWindow = globalThis.window, previousFetch = globalThis.fetch;
  globalThis.window = { setTimeout, clearTimeout, location: { hostname: 'unrelated-static.test' },
    sessionStorage: { getItem: () => 'synthetic-deployment-test-only' } };
  globalThis.fetch = async () => { throw Error('Unmocked test request'); };
  try { await run(server); }
  finally { globalThis.window = previousWindow; globalThis.fetch = previousFetch; await server.close(); }
}

test('production refuses to use any build host before runtime configuration is loaded', async () => {
  for (const host of ['', 'not a host', '/swp']) await runtime(host, async server => {
    const device = await server.ssrLoadModule('/src/utils/device-cache.ts');
    assert.throws(() => device.getApiBaseUrl(), /配置|地址/);
  });
});

test('runtime host overrides build host and keeps API 9700 and files 9704', async () => {
  await runtime('https://192.0.2.21:8093/swp', async server => {
    const config = await server.ssrLoadModule('/src/core/runtime-config.ts');
    await config.loadRuntimeConfig('/config.json', async () => new Response(JSON.stringify({ deviceHost: 'https://192.0.2.22:8093/swp' })));
    const device = await server.ssrLoadModule('/src/utils/device-cache.ts');
    assert.equal(device.getApiBaseUrl(), 'https://192.0.2.22:9700/swp');
    assert.equal(device.deriveFileHostFromDeviceHost(), 'https://192.0.2.22:9704');
  });
});

test('host input never accepts embedded credentials, query strings or unrelated paths', async () => {
  await runtime('192.0.2.21', async server => {
    const device = await server.ssrLoadModule('/src/utils/device-cache.ts');
    for (const host of ['http://user:synthetic-secret@192.0.2.21', 'http://192.0.2.21?token=synthetic-secret', 'http://192.0.2.21/other', 'ftp://192.0.2.21']) {
      assert.equal(device.normalizeDeviceHost(host), '', 'invalid address must not be silently normalized');
    }
  });
});

test('an old backend file prefix cannot send current deployment resources to the previous IP', async () => {
  await runtime('http://192.0.2.21', async server => {
    const config = await server.ssrLoadModule('/src/core/runtime-config.ts');
    await config.loadRuntimeConfig('/config.json', async () => new Response(JSON.stringify({ deviceHost: 'http://192.0.2.21' })));
    globalThis.fetch = async () => ({ ok: true, status: 200,
      json: async () => ({ code: 200, data: [{ paramKey: 'FILE_FRONT_URL_HEAD', paramValue: 'http://192.0.2.99:9704' }] }) });
    const prefix = await server.ssrLoadModule('/src/utils/file-prefix.ts');
    const files = await server.ssrLoadModule('/src/utils/file-url.ts');
    await prefix.initFileUrlPrefix();
    assert.equal(files.resolveFileUrl('/swp_upload/synthetic.png'), 'http://192.0.2.21:9704/swp_upload/synthetic.png');
  });
});

test('attention records are preserved separately for each runtime hospital', async () => {
  await runtime('', async server => {
    const entries = new Map();
    globalThis.window.localStorage = {
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
    };
    const config = await server.ssrLoadModule('/src/core/runtime-config.ts');
    const setHost = deviceHost => config.loadRuntimeConfig('/config.json', async () => new Response(JSON.stringify({ deviceHost })));
    const ack = await server.ssrLoadModule('/src/core/alert-ack.ts');
    await setHost('192.0.2.21');
    const records = { 'synthetic-task': { taskId: 'synthetic-task', status: 'handling', operator: 'synthetic', updatedAt: '2026-10-09', syncState: 'local' } };
    ack.saveAlertAckRecords(records);
    await setHost('192.0.2.22');
    assert.deepEqual(ack.loadAlertAckRecords(), {});
    await setHost('192.0.2.21');
    assert.deepEqual(ack.loadAlertAckRecords(), records);
  });
});
