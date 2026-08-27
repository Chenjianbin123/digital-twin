import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const header = readFileSync(new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url), 'utf8');
const env = readFileSync(new URL('../.env.development', import.meta.url), 'utf8');

test('root app gates ward bootstrap behind a confirmed authentication session', () => {
  assert.match(app, /import SwpLoginGate/);
  assert.match(app, /readAuthSession/);
  assert.match(app, /async function bootstrapDigitalTwin\(\)/);
  assert.match(app, /if \(authSession\.value\)[\s\S]*?bootstrapDigitalTwin\(\)/);
  assert.match(app, /<SwpLoginGate[\s\S]*?v-if="!authSession"[\s\S]*?@authenticated="handleAuthenticated"/);
});

test('root app handles session expiry and logout', () => {
  assert.match(app, /AUTH_EXPIRED_EVENT/);
  assert.match(app, /clearAuthSession\(\)/);
  assert.match(app, /function handleLogout\(\)/);
  assert.match(app, /@logout="handleLogout"/);
});

test('dashboard header exposes a clear logout command', () => {
  assert.match(header, /logout: \[\]/);
  assert.match(header, /aria-label="退出登录"/);
  assert.match(header, /emit\('logout'\)/);
});

test('development environment uses the authenticated remote SWP data source', () => {
  assert.match(env, /^VITE_DATA_SOURCE=remote$/m);
});
