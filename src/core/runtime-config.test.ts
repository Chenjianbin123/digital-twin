import assert from 'node:assert/strict';
import test from 'node:test';
import { getRuntimeDeviceHost, loadRuntimeConfig, parseRuntimeConfig, RuntimeConfigError, runtimeStorageKey } from './runtime-config.ts';
import { AUTH_ROLE_KEY, AUTH_TOKEN_KEY, AUTH_USER_KEY, bindAuthSessionToDeployment } from './auth-session.ts';

test('runtime configuration accepts a public host, preserves protocol, and ignores unrelated fields', () => {
  assert.deepEqual(parseRuntimeConfig({ deviceHost: ' https://192.0.2.21 ', unused: true }), { deviceHost: 'https://192.0.2.21' });
  assert.ok(Object.isFrozen(parseRuntimeConfig({ deviceHost: '192.0.2.21' })));
});

test('missing, malformed and unsafe runtime hosts fail without reflecting the supplied value', () => {
  for (const value of [null, [], {}, { deviceHost: 12 }, { deviceHost: '' },
    { deviceHost: 'http://user:synthetic-secret@192.0.2.21' },
    { deviceHost: 'http://192.0.2.21?token=synthetic-secret' },
    { deviceHost: '/swp' }, { deviceHost: 'http://192.0.2.21/other' }]) {
    assert.throws(() => parseRuntimeConfig(value), error => {
      assert.ok(error instanceof RuntimeConfigError);
      assert.doesNotMatch(error.message, /synthetic-secret/);
      return true;
    });
  }
});

test('loader bypasses cache, replaces the hospital host, and drops old configuration on failure', async () => {
  const options: RequestInit[] = [];
  const request: typeof fetch = async (url, init) => {
    assert.equal(url, '/config.json');
    options.push(init!);
    return new Response(JSON.stringify({ deviceHost: options.length === 1 ? '192.0.2.21' : '192.0.2.22' }));
  };
  await loadRuntimeConfig('/config.json', request);
  assert.equal(getRuntimeDeviceHost(), '192.0.2.21');
  await loadRuntimeConfig('/config.json', request);
  assert.equal(getRuntimeDeviceHost(), '192.0.2.22');
  assert.ok(options.every(option => option.cache === 'no-store' && option.signal instanceof AbortSignal));
  for (const request of [
    async () => new Response('', { status: 404 }),
    async () => new Response('<html>SPA fallback</html>'),
    async () => new Response('{bad json'),
    async () => new Response('{"deviceHost":""}'),
    async () => { throw new Error('synthetic-network-error'); },
  ]) {
    await assert.rejects(loadRuntimeConfig('/config.json', request), RuntimeConfigError);
    assert.equal(getRuntimeDeviceHost(), '', 'a failed refresh must not retain the old hospital');
  }
});

test('configuration timeout aborts the request', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = loadRuntimeConfig('/config.json', async (_url, init) => new Promise((_resolve, reject) => {
    init!.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }));
  const rejected = assert.rejects(pending, /无法读取 config.json/);
  context.mock.timers.tick(8_000);
  await rejected;
});

test('hospital changes clear all old authentication fields; reloads of the same hospital retain them', () => {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    clear: () => { entries.clear(); },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => { entries.set(key, value); },
    removeItem: (key: string) => { entries.delete(key); },
  };
  for (const key of [AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_ROLE_KEY]) entries.set(key, 'legacy-session');
  bindAuthSessionToDeployment('http://192.0.2.21:9700/swp', storage);
  for (const key of [AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_ROLE_KEY]) assert.equal(entries.has(key), false);
  for (const key of [AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_ROLE_KEY]) entries.set(key, 'synthetic-session');
  bindAuthSessionToDeployment('http://192.0.2.21:9700/swp', storage);
  assert.equal(entries.get(AUTH_TOKEN_KEY), 'synthetic-session');
  bindAuthSessionToDeployment('http://192.0.2.22:9700/swp', storage);
  for (const key of [AUTH_TOKEN_KEY, AUTH_USER_KEY, AUTH_ROLE_KEY]) assert.equal(entries.has(key), false);
});

test('persistent state keys are stable for the same hospital and isolated across hospitals', async () => {
  const setHost = (deviceHost: string) => loadRuntimeConfig('/config.json', async () => new Response(JSON.stringify({ deviceHost })));
  await setHost('192.0.2.21');
  const first = runtimeStorageKey('ward-state');
  await setHost('http://192.0.2.21:8093/swp');
  assert.equal(runtimeStorageKey('ward-state'), first);
  await setHost('192.0.2.22');
  assert.notEqual(runtimeStorageKey('ward-state'), first);
});
