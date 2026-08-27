import assert from 'node:assert/strict';
import type { RoomPriority, RoomSummary } from '../src/core/area-summary.ts';
import { selectNurseStationMarkers } from '../src/core/nurse-station-markers.ts';

function makeSummary(roomIndex: number, priority: RoomPriority): RoomSummary {
  return {
    roomIndex,
    sickroomName: `${roomIndex + 1}01病房`,
    sickroomCode: `room-${roomIndex}`,
    totalBeds: 6,
    occupiedBeds: 4,
    infusingCount: priority === 'infusing' ? 1 : 0,
    offlineCount: priority === 'offline' ? 1 : 0,
    callingCount: priority === 'calling' ? 1 : 0,
    envAlertLevel: priority === 'danger' ? 'danger' : priority === 'warning' ? 'warning' : 'normal',
    priority,
    accentColor: '#4fc3f7',
    statusText: '4/6 在床',
  };
}

const summaries = [
  makeSummary(0, 'normal'),
  makeSummary(1, 'warning'),
  makeSummary(2, 'calling'),
  makeSummary(3, 'empty'),
  makeSummary(4, 'offline'),
  makeSummary(5, 'danger'),
  makeSummary(6, 'infusing'),
  makeSummary(7, 'calling'),
];
const originalOrder = summaries.map(room => room.roomIndex);

assert.deepEqual(
  selectNurseStationMarkers(summaries).map(room => room.roomIndex),
  [2, 7, 5, 4, 6, 1],
  'markers should prioritize urgent rooms, keep ties stable, and default to six',
);
assert.deepEqual(
  selectNurseStationMarkers(summaries, 4).map(room => room.roomIndex),
  [2, 7, 5, 4],
  'custom limits should be applied after prioritization',
);
assert.deepEqual(selectNurseStationMarkers(summaries, 0), []);
assert.deepEqual(summaries.map(room => room.roomIndex), originalOrder, 'input order must not be mutated');

console.log('Nurse-station marker tests passed.');
