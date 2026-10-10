import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCorridorChartData } from './ward-corridor-charts.ts';
import type { RoomSummary } from './area-summary.ts';
import type { InspectionRoomSummary } from '../types/inspection.ts';

function room(code: string, total: number, occupied: number, roomIndex = 0): RoomSummary {
  return { roomIndex, sickroomCode: code, sickroomName: `${code}房`, totalBeds: total,
    occupiedBeds: occupied, infusingCount: 0, offlineCount: 0, callingCount: 0,
    envAlertLevel: 'normal', priority: 'normal', accentColor: '#4FC3F7', statusText: '' };
}
function inspection(code: string, latestAt: string | null, roomIndex = 0): InspectionRoomSummary {
  return { roomCode: code, roomName: `${code}房`, roomIndex, latestAt, latestNurseName: null,
    state: latestAt ? 'normal' : 'no-record', stateLabel: '', overdueCount: 0, dueCount: 0,
    normalCount: 0, records: [] };
}

test('charts keep empty physical beds and a shared bed-count scale', () => {
  const data = buildCorridorChartData([room('301', 5, 3), room('302', 4, 4), room('303', 4, 2)], []);
  assert.equal(data.total, 13);
  assert.equal(data.occupied, 9);
  assert.equal(data.empty, 4);
  assert.equal(data.ratio, 9 / 13);
  assert.equal(data.maxBeds, 5);
  assert.deepEqual(data.rows.map(row => row.empty), [2, 0, 2]);
});

test('inspection records follow room codes, never the reordered array indexes', () => {
  const data = buildCorridorChartData([room('B', 2, 1, 0), room('A', 3, 2, 1)], [
    inspection('A', '2026-09-30T10:20:00', 0), inspection('OTHER', '2026-09-30T11:00:00', 1),
  ]);
  assert.equal(data.recorded, 1);
  assert.equal(data.missing, 1);
  assert.equal(data.rows[0].latestAt, null);
  assert.equal(data.rows[1].timeLabel, '10:20');
});

test('zero beds do not become zero percent occupancy', () => {
  assert.equal(buildCorridorChartData([], []).ratio, null);
  assert.equal(buildCorridorChartData([room('A', 0, 0)], []).ratio, null);
  assert.equal(buildCorridorChartData([room('A', 4, 0)], []).ratio, 0);
});

test('invalid counts are shown as unknown instead of a misleading total', () => {
  for (const total of [-1, NaN, Infinity, 1.5]) {
    const data = buildCorridorChartData([room('A', total, 1)], []);
    assert.equal(data.total, null);
    assert.equal(data.ratio, null);
    assert.equal(data.rows[0].empty, null);
  }
  assert.equal(buildCorridorChartData([room('A', 2, 3)], []).occupied, null);
});

test('missing or invalid inspection timestamps are not counted as records', () => {
  const data = buildCorridorChartData([room('A', 2, 2), room('B', 2, 0)], [
    inspection('A', 'not-a-date'), inspection('B', null),
  ]);
  assert.equal(data.recorded, 0);
  assert.equal(data.missing, 2);
});
