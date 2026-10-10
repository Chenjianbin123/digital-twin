import { readWorkspaceSource } from './helpers/read-workspace-source.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readWorkspaceSource();
const header = readFileSync(new URL('../src/components/dashboard/DashboardHeader.vue', import.meta.url), 'utf8');

test('root app starts local workspace without authentication', () => {
  assert.doesNotMatch(app, /SwpLoginGate|readAuthSession|authSession|AUTH_EXPIRED_EVENT/);
  assert.match(app, /useWorkspaceBootstrap\(loadAreaSelectionContext,/);
  assert.match(app, /onMounted\(\(\) => \{\s*store.setAlertOperator\('操作员'\);\s*void bootstrapDigitalTwin\(\)/);
});

test('startup cancellation restarts the local workspace', () => {
  assert.match(app, /function restartLocalWorkspace\(\)/);
  assert.match(app, /@cancel="restartLocalWorkspace"/);
  assert.match(app, /operator-name="操作员"/);
});

test('local workspace does not subscribe to session expiry', () => {
  assert.doesNotMatch(readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8'), /auth-session|addEventListener/);
});

test('dashboard header has no login or logout command', () => {
  assert.doesNotMatch(header, /aria-label="退出登录"|emit\('logout'\)/);
});
