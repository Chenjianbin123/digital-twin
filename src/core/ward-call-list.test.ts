import test from 'node:test';
import assert from 'node:assert/strict';
import { roomCallTasks, canLocateRoomCall, roomCallDataStatus } from './ward-call-list.ts';
import type { AlertTask } from './alert-workflow.ts';
import type { TwinWardEntity } from '../types/twin.ts';
const ward = { sickroomCode: 'R1', beds: [{ bedCode: '1' }, { bedCode: '2' }] } as TwinWardEntity;
const call = (extra: Partial<AlertTask> = {}) => ({ id: 'a', type: 'call', source: 'swp-call', roomIndex: 0, roomCode: 'R1', bedCode: '1', locationStatus: 'matched', startedAt: '2026-09-14T08:00:00Z', ...extra }) as AlertTask;
test('call list excludes other rooms, ambiguous locations and non-call events', () => {
  const tasks = [call(), call({ id: 'other', roomIndex: 1 }), call({ id: 'mismatch', roomCode: 'R2' }), call({ id: 'unknown', locationStatus: 'unmatched-identifiers' }), call({ id: 'vital', type: 'vital' }), call({ id: 'local', source: undefined })];
  assert.deepEqual(roomCallTasks(tasks, ward, 0).map(t => t.id), ['a']);
  assert.deepEqual(roomCallTasks([], ward, 0), []);
});
test('oldest known call is first; invalid times remain last and input order is preserved', () => {
  const tasks = [call({ id: 'invalid', startedAt: 'bad' }), call({ id: 'new', startedAt: '2026-09-14T09:00:00Z' }), call()];
  assert.deepEqual(roomCallTasks(tasks, ward, 0).map(t => t.id), ['a', 'new', 'invalid']);
  assert.equal(tasks[0]!.id, 'invalid');
});
test('locating requires a unique bed and honors upstream restrictions', () => {
  assert.ok(canLocateRoomCall(call(), ward));
  assert.equal(canLocateRoomCall(call({ canLocate: false }), ward), false);
  assert.equal(canLocateRoomCall(call({ bedCode: '9' }), ward), false);
  assert.equal(canLocateRoomCall(call(), { ...ward, beds: [...ward.beds, ward.beds[0]!] }), false);
});
test('old, invalid, failed and partial snapshots never report ready', () => {
  const now = Date.parse('2026-09-14T08:01:00Z');
  const sync = { phase: 'ready' as const, lastSyncedAt: '2026-09-14T08:00:00Z', error: null, warning: null };
  assert.equal(roomCallDataStatus(sync, now), 'ready');
  assert.equal(roomCallDataStatus(sync, now + 300_000), 'stale');
  assert.equal(roomCallDataStatus({ ...sync, lastSyncedAt: 'bad' }, now), 'stale');
  assert.equal(roomCallDataStatus({ ...sync, phase: 'error' }, now), 'error');
  assert.equal(roomCallDataStatus({ ...sync, phase: 'partial' }, now), 'warning');
  assert.equal(roomCallDataStatus(undefined, now), 'loading');
});
