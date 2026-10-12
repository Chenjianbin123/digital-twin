import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildEnvironmentSummary, ENV_STALE_AFTER_MS, formatEnvironmentSyncText, resolveEnvironmentStatus, retainEnvironmentReadings } from './environment-state.ts';
import type { TwinWardEntity } from '../types/twin.ts';

const now = 1_000_000;
const fresh = { doorEnvData: { temp: '24℃', relativeHumid: '50%' }, envSync: { lastSuccessAt: now, failed: false } };

test('environment freshness expires at five minutes without changing scene', () => {
  assert.equal(resolveEnvironmentStatus(fresh, now + ENV_STALE_AFTER_MS - 1), 'fresh');
  assert.equal(resolveEnvironmentStatus(fresh, now + ENV_STALE_AFTER_MS), 'stale');
  assert.match(formatEnvironmentSyncText(fresh, now + ENV_STALE_AFTER_MS), /数据已过期/);
});

test('failure retains readings but immediately excludes them from current averages', () => {
  const failed = { ...fresh, envSync: { lastSuccessAt: now, failed: true } };
  assert.equal(resolveEnvironmentStatus(failed, now), 'error');
  assert.match(formatEnvironmentSyncText(failed, now), /更新失败.*上次接收/);
  assert.equal(buildEnvironmentSummary([failed], now).temperature, null);
  assert.equal(failed.doorEnvData.temp, '24℃');
});

test('missing, unknown and invalid timestamps cannot be treated as current readings', () => {
  assert.equal(resolveEnvironmentStatus({}, now), 'missing');
  for (const lastSuccessAt of [null, NaN, Infinity, -1, now + 1]) {
    const room = { ...fresh, envSync: { lastSuccessAt, failed: false } };
    assert.equal(resolveEnvironmentStatus(room, now), 'unknown');
    assert.equal(buildEnvironmentSummary([room], now).validRooms, 0);
  }
  assert.equal(resolveEnvironmentStatus({ doorEnvData: fresh.doorEnvData }, now), 'unknown');
});

test('summary shares validity between means and warnings, retaining unresolved old warnings', () => {
  const rooms = [fresh,
    { doorEnvData: { temp: '32℃', relativeHumid: '80%' }, envSync: { lastSuccessAt: now - ENV_STALE_AFTER_MS, failed: false } },
    { doorEnvData: { temp: '29℃', relativeHumid: '60%' }, envSync: { lastSuccessAt: now, failed: false } },
    {},
  ];
  assert.deepEqual(buildEnvironmentSummary(rooms, now), {
    temperature: 27, humidity: 55, validRooms: 2, pendingRooms: 2,
    warningRooms: 1, unverifiedWarningRooms: 1, totalRooms: 4, source: 'remote',
  });
});

test('demo and database readings remain available with explicit source labels', () => {
  const room = { doorEnvData: fresh.doorEnvData };
  assert.equal(resolveEnvironmentStatus(room, now, 'mock'), 'demo');
  assert.equal(formatEnvironmentSyncText(room, now, 'mock'), '');
  assert.equal(resolveEnvironmentStatus(room, now, 'database'), 'snapshot');
  assert.equal(buildEnvironmentSummary([room], now, 'mock').temperature, 24);
  assert.equal(buildEnvironmentSummary([room], now, 'database').validRooms, 1);
  assert.match(formatEnvironmentSyncText(room, now, 'database'), /数据库快照.*采样时间未知/);
});

test('invalid or absent numeric fields do not become zero or poison averages', () => {
  const rooms = [
    { ...fresh, doorEnvData: { temp: 'Infinity', relativeHumid: ' ' } },
    { ...fresh, doorEnvData: { temp: '0℃', relativeHumid: '0%' } },
  ];
  assert.equal(buildEnvironmentSummary(rooms, now).temperature, 0);
  assert.equal(buildEnvironmentSummary(rooms, now).humidity, 0);
  assert.equal(buildEnvironmentSummary([{ ...fresh, doorEnvData: {} }], now).temperature, null);
});

test('snapshot replacement preserves confirmed values and original time only for the same room and device', () => {
  const room = (sickroomId: string, deviceCode = 'door-1'): TwinWardEntity => ({
    sickroomId, deviceCode, sickroomName: sickroomId, sickroomCode: sickroomId, beds: [],
    doorEnvData: { temp: '99' },
  });
  const previous = { ...room('1'), ...fresh, envSync: { lastSuccessAt: now, failed: true } };
  const next = [room('1'), room('2'), room('1', 'replacement-door')];
  retainEnvironmentReadings(next, [previous]);
  assert.deepEqual(next[0].doorEnvData, fresh.doorEnvData);
  assert.deepEqual(next[0].envSync, previous.envSync);
  assert.notEqual(next[0].envSync, previous.envSync);
  assert.equal(next[1].envSync, undefined);
  assert.equal(next[2].envSync, undefined);
  const confirmed = { ...room('1'), envSync: { lastSuccessAt: now + 1, failed: false } };
  retainEnvironmentReadings([confirmed], [previous]);
  assert.equal(confirmed.doorEnvData?.temp, '99');
  const ambiguous = room('1');
  retainEnvironmentReadings([ambiguous], [previous, { ...previous }]);
  assert.equal(ambiguous.envSync, undefined);
});
