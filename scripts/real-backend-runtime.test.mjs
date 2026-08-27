import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const developmentEnv = readFileSync(new URL('../.env.development', import.meta.url), 'utf8');
const productionEnv = readFileSync(new URL('../.env.production', import.meta.url), 'utf8');
const store = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8');
const bottomNav = readFileSync(new URL('../src/components/dashboard/DashboardBottomNav.vue', import.meta.url), 'utf8');
const toolbar = readFileSync(new URL('../src/components/WardToolbar.vue', import.meta.url), 'utf8');
const areaInfoPanel = readFileSync(new URL('../src/components/AreaInfoPanel.vue', import.meta.url), 'utf8');

test('development and production use the real SWP backend at 192.168.96.104', () => {
  for (const env of [developmentEnv, productionEnv]) {
    assert.match(env, /^VITE_DATA_SOURCE=remote$/m);
    assert.match(env, /^VITE_DEVICE_HOST=192\.168\.96\.104$/m);
  }
});

test('real runtime services use polling or configured realtime without starting simulators', () => {
  const startRemoteIndex = store.indexOf('function startRemoteServices');
  const startRemoteBody = store.slice(startRemoteIndex, store.indexOf('\n  }', startRemoteIndex) + 4);
  assert.match(startRemoteBody, /startRealtimeChannel\(store\)/);
  assert.match(startRemoteBody, /startEnvFetcher\(store\)/);
  assert.match(startRemoteBody, /startRemoteAreaFetcher\(store\)/);
  assert.doesNotMatch(startRemoteBody, /startSimulation|startEnvSimulator|startCallPusher|startStatusPusher/);
});

test('simulation controls are rendered only for explicit mock mode', () => {
  assert.match(bottomNav, /v-if="props\.dataSource === 'mock'"/);
  assert.match(toolbar, /v-if="dataSource === 'mock'"/);
  assert.match(app, /:data-source="dataSource"/);
});

test('device totals never assume a room terminal is online', () => {
  assert.match(app, /room\.isOnline === true/);
  assert.match(areaInfoPanel, /room\.isOnline === true/);
  assert.doesNotMatch(areaInfoPanel, /onlineDevices \+= 1/);
});
