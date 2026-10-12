import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeArea } from './area-summary.ts';
import { attentionRoomCodes, filterCorridorRooms, resolveCorridorRoom, resolveHistoryRoom } from './corridor-room-browser.ts';
import type { AlertTask } from './alert-workflow.ts';
import type { StatusHistoryEntry, TwinAreaEntity, TwinWardEntity } from '../types/twin.ts';

function room(code: string, name: string, beds: string[], occupied = beds.length): TwinWardEntity {
  return { sickroomCode: code, sickroomName: name, sickroomId: code, deviceCode: `door-${code}`,
    beds: beds.map((bedCode, index) => ({ bedCode, bedName: `${index + 1}床`, deviceCode: bedCode,
      isOnline: true, isOccupied: index < occupied, position: { x: 0, z: 0 } })) };
}
function area(): TwinAreaEntity {
  return { areaCode: 'WARD-A', areaName: '病区A', deptName: '测试', rooms: [
    room('R1', 'A101', ['B1', 'B2'], 1), room('R2', 'A102', ['B3']), room('R3', '空房', []),
  ] };
}
function event(overrides: Partial<StatusHistoryEntry> = {}): StatusHistoryEntry {
  return { id: 'E1', time: '12:00:00', category: 'call', areaCode: 'WARD-A', roomCode: 'R2',
    bedCode: 'B3', roomName: '过时的显示名', bedName: '1床', label: '呼叫', ...overrides };
}

test('search matches room/bed labels and codes, preserves source indexes and all physical beds', () => {
  const current = area();
  const summaries = summarizeArea(current.rooms);
  for (const query of [' a 102 ', 'r2', ' b3 ']) {
    const found = filterCorridorRooms(summaries, current, query, 'all', new Set());
    assert.equal(found.length, 1);
    assert.equal(found[0], summaries[1]);
    assert.equal(found[0]!.roomIndex, 1);
  }
  assert.equal(filterCorridorRooms(summaries, current, '2床', 'all', new Set())[0], summaries[0]);
  assert.equal(filterCorridorRooms(summaries, current, '', 'all', new Set()).length, 3);
  assert.equal(filterCorridorRooms(summaries, current, '不存在', 'all', new Set()).length, 0);
  assert.equal(current.rooms[0]!.beds.length, 2);
});

test('vacant filter excludes zero-bed rooms and composes with search', () => {
  const current = area(), summaries = summarizeArea(current.rooms);
  assert.deepEqual(filterCorridorRooms(summaries, current, '', 'vacant', new Set()).map(s => s.sickroomCode), ['R1']);
  assert.equal(filterCorridorRooms(summaries, current, 'A102', 'vacant', new Set()).length, 0);
});

test('attention requires an actual room status or a uniquely associated task, not a guessed room index/name', () => {
  const current = area(), summaries = summarizeArea(current.rooms);
  const task = { roomCode: 'R2', roomIndex: 0, bedCode: 'B3' } as AlertTask;
  const invalid = [{ roomCode: '', roomName: 'A101', roomIndex: 0 }, { ...task, canLocate: false },
    { ...task, roomCode: 'R1' }] as AlertTask[];
  assert.equal(attentionRoomCodes(current, invalid).size, 0);
  const codes = attentionRoomCodes(current, [task]);
  assert.deepEqual(filterCorridorRooms(summaries, current, '', 'attention', codes).map(s => s.sickroomCode), ['R2']);
  for (const patch of [{ callingCount: 1 }, { offlineCount: 1 }, { lowBatteryCount: 1 }, { envAlertLevel: 'warning' as const }]) {
    assert.equal(filterCorridorRooms([{ ...summaries[0]!, ...patch }], current, '', 'attention', new Set()).length, 1);
  }
  assert.equal(filterCorridorRooms([{ ...summaries[0]!, infusingCount: 1 }], current, '', 'attention', new Set()).length, 0);
});

test('history resolves by current identity after room reorder, not historical name/index', () => {
  const current = area();
  assert.equal(resolveHistoryRoom(event(), current), 1);
  current.rooms.reverse();
  assert.equal(resolveHistoryRoom(event(), current), 1);
  current.rooms = [current.rooms[1]!, current.rooms[0]!, current.rooms[2]!];
  assert.equal(resolveHistoryRoom(event(), current), 0);
});

test('missing scope, wrong scope, disabled and conflicting identifiers never locate', () => {
  for (const patch of [{ areaCode: undefined }, { areaCode: 'WARD-B' }, { canLocate: false },
    { roomCode: 'R1' }, { roomCode: 'missing' }, { bedCode: 'missing' }, { roomCode: '', bedCode: '' }]) {
    assert.equal(resolveHistoryRoom(event(patch), area()), null, JSON.stringify(patch));
  }
  assert.equal(resolveHistoryRoom(event(), null), null);
});

test('room-only events and scoped unique bed-only events can locate', () => {
  assert.equal(resolveHistoryRoom(event({ category: 'env', bedCode: '' }), area()), 1);
  assert.equal(resolveHistoryRoom(event({ roomCode: '' }), area()), 1);
});

test('ambiguous rooms/beds and removed targets cannot locate', () => {
  const current = area();
  current.rooms.push(room('R2', '另一个房间', ['B4']));
  assert.equal(resolveHistoryRoom(event(), current), null);
  const duplicate = area();
  duplicate.rooms[0]!.beds.push({ ...duplicate.rooms[1]!.beds[0]! });
  assert.equal(resolveHistoryRoom(event({ roomCode: '' }), duplicate), null);
  duplicate.rooms[1]!.beds.push({ ...duplicate.rooms[1]!.beds[0]! });
  assert.equal(resolveHistoryRoom(event(), duplicate), null);
  assert.equal(resolveCorridorRoom({ ...area(), rooms: [] }, event()), null);
});

test('empty input collections have no false positive results', () => {
  assert.deepEqual(filterCorridorRooms([], null, '', 'all', new Set()), []);
  assert.equal(attentionRoomCodes(null, []).size, 0);
});
