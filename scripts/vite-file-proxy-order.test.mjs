import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadConfigFromFile } from 'vite';

const configFile = resolve('vite.config.ts');

test('development preserves proxy routing while build and preview use runtime configuration', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'digital-twin-proxy-test-'));
  const previousCwd = process.cwd();
  const keys = ['VITE_DEVICE_HOST', 'VITE_API_BASE_URL', 'VITE_DATA_SOURCE'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const readConfig = command => loadConfigFromFile({ command, mode: 'test' }, configFile, directory, 'silent', undefined, 'native');
  try {
    // No private dotenv files; evaluate the actual config against synthetic deployment values.
    process.chdir(directory);
    for (const env of [
      { VITE_DEVICE_HOST: '192.0.2.21', VITE_API_BASE_URL: '192.0.2.99' },
      { VITE_API_BASE_URL: 'http://192.0.2.21:8093/swp' },
    ]) {
      for (const key of keys) delete process.env[key];
      Object.assign(process.env, env, { VITE_DATA_SOURCE: 'remote' });
      const { config } = await readConfig('serve');
      for (const proxy of [config.server.proxy]) {
        assert.equal(proxy['/swp'].target, 'http://192.0.2.21:9700');
        assert.equal(proxy['/swp_upload'].target, 'http://192.0.2.21:9704');
        assert.ok(Object.keys(proxy).indexOf('/swp_upload') < Object.keys(proxy).indexOf('/swp'));
      }
    }
    for (const key of keys) delete process.env[key];
    await assert.rejects(readConfig('serve'), /VITE_DEVICE_HOST/);
    const built = await readConfig('build');
    assert.equal(built.config.server.proxy['/swp'], undefined, 'build must not depend on a hospital address');
    const previewed = await loadConfigFromFile({ command: 'serve', mode: 'test', isPreview: true }, configFile, directory, 'silent', undefined, 'native');
    assert.equal(previewed.config.preview.proxy['/swp'], undefined, 'production preview uses runtime config');
    for (const source of ['mock', 'database']) {
      process.env.VITE_DATA_SOURCE = source;
      const { config } = await readConfig('serve');
      assert.equal(config.server.proxy['/swp'], undefined, 'optional modes must not proxy to a default hospital');
    }
  }
  finally {
    process.chdir(previousCwd);
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
