import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { createServer } from 'vite';

// Fully synthetic responses: no real session or hospital connection is used.
globalThis.window = { setTimeout, clearTimeout, sessionStorage: { getItem: () => null }, location: { origin: 'http://synthetic.test' } };
const server = await createServer({ configFile: false, root: resolve('.'), appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null },
  resolve: { alias: { '@': resolve('src') } }, define: { 'import.meta.env.VITE_API_TOKEN': JSON.stringify('') } });
try {
  const api = await server.ssrLoadModule('/src/api/http-client.ts');
  await test('business failure is rejected and not recorded as a successful request', async () => {
    api.clearRecentApiRequests();
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({code:500,message:'synthetic-sensitive-body'}) });
    await assert.rejects(api.postJson('/swp/swp/swpCallInfo/querySwpCallInfo', { patient: 'synthetic-sensitive-body' }, {auth:'omit'}));
    assert.equal(api.getRecentApiRequests()[0].ok, false);
    assert.doesNotMatch(JSON.stringify(api.getRecentApiRequests()), /synthetic-sensitive-body/);
  });
  await test('timeout neither exposes URL secrets nor retains them in diagnostics', async () => {
    api.clearRecentApiRequests();
    globalThis.fetch = async () => { throw new DOMException('synthetic-sensitive-body', 'AbortError'); };
    await assert.rejects(api.postJson('http://synthetic.test/patient/synthetic-sensitive-path?token=synthetic-sensitive-query', {}, {auth:'omit'}), error => {
      assert.doesNotMatch(error.message, /synthetic-sensitive/);
      return true;
    });
    assert.doesNotMatch(JSON.stringify(api.getRecentApiRequests()), /synthetic-sensitive/);
  });
  await test('gateway and network errors provide distinct safe guidance', async () => {
    globalThis.fetch = async () => ({ok:false,status:502,statusText:'synthetic-sensitive-body'});
    await assert.rejects(api.postJson('/system/sysUser/login',{}, {auth:'omit'}), error => {
      assert.match(error.message, /网关/); assert.equal(error.kind, 'gateway'); return true;
    });
    globalThis.fetch = async () => { throw new TypeError('synthetic-sensitive-body'); };
    await assert.rejects(api.postJson('/system/sysUser/login',{}, {auth:'omit'}), error => {
      assert.equal(error.kind, 'network'); assert.doesNotMatch(error.message, /synthetic-sensitive/); return true;
    });
  });
}
finally { await server.close(); }
