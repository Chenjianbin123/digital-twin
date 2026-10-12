import assert from 'node:assert/strict';
import test from 'node:test';
import { configuredDeviceHost, deploymentEndpoints, deploymentFilePrefix } from './deployment-endpoints.ts';

test('one host produces fixed API and file ports without changing its protocol', () => {
  for (const host of ['192.0.2.21', 'http://192.0.2.21', 'http://192.0.2.21:8093/swp/']) {
    assert.deepEqual(deploymentEndpoints(host), { apiBase: 'http://192.0.2.21:9700/swp', fileOrigin: 'http://192.0.2.21:9704' });
  }
  assert.deepEqual(deploymentEndpoints('https://[2001:db8::1]/swp'), {
    apiBase: 'https://[2001:db8::1]:9700/swp', fileOrigin: 'https://[2001:db8::1]:9704',
  });
});

test('bad configuration is rejected with a fixed message, never containing the supplied address', () => {
  for (const host of ['', '/swp', '//192.0.2.21', 'not a host', '999.999.1.1', 'ftp://192.0.2.21',
    'http://user:synthetic-secret@192.0.2.21', 'http://192.0.2.21?token=synthetic-secret',
    'http://192.0.2.21#fragment', 'http://192.0.2.21/other', 'http://192.0.2.21\\other']) {
    assert.throws(() => deploymentEndpoints(host), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /VITE_DEVICE_HOST/);
      assert.doesNotMatch(error.message, /synthetic-secret|192\.0\.2\.21/);
      return true;
    });
  }
});

test('the preferred host and legacy alias have the same precedence in all consumers', () => {
  assert.equal(configuredDeviceHost({ VITE_DEVICE_HOST: ' 192.0.2.21 ', VITE_API_BASE_URL: '192.0.2.99' }), '192.0.2.21');
  assert.equal(configuredDeviceHost({ VITE_DEVICE_HOST: ' ', VITE_API_BASE_URL: ' 192.0.2.99 ' }), '192.0.2.99');
  assert.equal(configuredDeviceHost({}), '');
});

test('resource prefixes retain same-server paths but never change the configured host, protocol or port', () => {
  const origin = 'https://192.0.2.21:9704';
  assert.equal(deploymentFilePrefix(`${origin}/files/`, origin), `${origin}/files`);
  for (const prefix of [undefined, '', '/files', 'javascript:alert(1)', 'https://192.0.2.99:9704',
    'http://192.0.2.21:9704', 'https://192.0.2.21:9700', `${origin}/?token=synthetic-secret`,
    'https://user:synthetic-secret@192.0.2.21:9704']) {
    assert.equal(deploymentFilePrefix(prefix, origin), origin);
  }
  assert.equal(deploymentFilePrefix('https://old.test', ''), '');
});
