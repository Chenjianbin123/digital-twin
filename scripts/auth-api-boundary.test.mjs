import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authApi = readFileSync(new URL('../src/api/auth.ts', import.meta.url), 'utf8');
const httpClient = readFileSync(new URL('../src/api/http-client.ts', import.meta.url), 'utf8');
const databaseTwin = readFileSync(new URL('../src/api/database-twin.ts', import.meta.url), 'utf8');
const twinStore = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
const deviceCache = readFileSync(new URL('../src/utils/device-cache.ts', import.meta.url), 'utf8');

test('SWP login hashes passwords and omits stale authentication', () => {
  assert.match(authApi, /import md5 from 'js-md5'/);
  assert.match(authApi, /const LOGIN_PATH = 'system\/sysUser\/login'/);
  assert.match(authApi, /userPassword: md5\(password\)/);
  assert.match(authApi, /postJson<AuthUser>[\s\S]*?auth: 'omit'/);
});

test('database login and role confirmation use the protected database adapter', () => {
  assert.match(authApi, /getDataSource\(\) === 'database'/);
  assert.match(authApi, /databaseAuthUrl\('\/auth\/login'\)/);
  assert.match(authApi, /databaseAuthUrl\('\/auth\/role-confirm'\)/);
  assert.match(authApi, /Authorization: `Bearer \$\{token\}`/);
});

test('SWP role confirmation uses the active session token', () => {
  assert.match(authApi, /const ROLE_CONFIRM_PATH = 'system\/sysUser\/roleConfirm'/);
  assert.match(authApi, /\{ roleId, token \}/);
});

test('HTTP client injects session token and expires invalid sessions', () => {
  assert.match(httpClient, /auth\?: 'auto' \| 'omit'/);
  assert.match(httpClient, /getSessionToken\(\) \|\| getApiToken\(\)/);
  assert.match(httpClient, /headers\.token = token/);
  assert.match(httpClient, /res\.status === 401 \|\| res\.status === 403/);
  assert.match(httpClient, /payload\.code === 401 \|\| payload\.code === 403/);
  assert.match(httpClient, /clearAuthSession\(\)/);
  assert.match(httpClient, /AUTH_EXPIRED_EVENT/);
});

test('database requests use bearer sessions and expire unauthorized sessions', () => {
  assert.match(databaseTwin, /getSessionToken\(\)/);
  assert.match(databaseTwin, /Authorization: `Bearer \$\{token\}`/);
  assert.match(databaseTwin, /res\.status === 401 \|\| res\.status === 403/);
  assert.match(databaseTwin, /clearAuthSession\(\)/);
  assert.match(databaseTwin, /AUTH_EXPIRED_EVENT/);
});

test('database mode lists, enters, switches, and refreshes only authorized areas', () => {
  assert.match(twinStore, /fetchDatabaseAreas/);
  assert.match(twinStore, /dataSource\.value === 'database'/);
  assert.match(twinStore, /fetchDatabaseTwinArea\(selectedOption\.areaCode\)/);
  assert.match(twinStore, /\['remote', 'database'\]\.includes\(dataSource\.value\)/);
});

test('device API token prefers the authenticated browser session', () => {
  assert.match(deviceCache, /getSessionToken\(\)/);
});
