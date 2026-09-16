import assert from 'node:assert/strict';
import test from 'node:test';
import { WardCorridorLayout } from './ward-corridor-layout.ts';

const doors = ['门1', '门2'];
const devices = ['门口机1', '门口机2'];
test('remote rooms without roomCode use stable room IDs in schematic mode', () => {
  const layout = new WardCorridorLayout(doors, devices);
  const remote = [
    { sickroomCode: '', sickroomName: '301房', sickroomId: '101', deviceCode: 'SN-A' },
    { sickroomCode: '', sickroomName: '302房', sickroomId: '102', deviceCode: 'SN-B' },
  ];
  assert.deepEqual(layout.resolve(remote).slots.map(s => s.roomIndex), [0, 1]);
  assert.deepEqual(layout.resolve([...remote].reverse()).slots.map(s => s.roomIndex), [1, 0]);
  remote[0].sickroomCode = '301';
  assert.equal(layout.resolve(remote).pageCount, 1, 'late roomCode must not allocate a new slot');
  assert.deepEqual(layout.resolve(remote).slots.map(s => s.roomIndex), [0, 1]);
  const physical = new WardCorridorLayout(doors, devices, []);
  assert.ok(physical.resolve(remote).slots.every(s => !s.interactive), 'physical mapping must never guess');
});
test('device ID fallback is stable and ambiguous IDs are rejected', () => {
  const layout = new WardCorridorLayout(doors, devices);
  const room = { sickroomCode: '', sickroomName: '测试', deviceCode: 'SN-A' };
  assert.equal(layout.resolve([room]).slots[0]?.roomIndex, 0);
  assert.ok(layout.resolve([room, { ...room }]).slots.every(s => !s.interactive));
});
const rooms = (...codes: string[]) => codes.map(sickroomCode => ({ sickroomCode, sickroomName: sickroomCode }));
test('stable slots survive reorder, removal and additions without changing existing door identities', () => {
  const layout = new WardCorridorLayout(doors, devices);
  assert.deepEqual(layout.resolve(rooms('302', '301')).slots.map(s => s.roomCode), ['301', '302']);
  const reordered = layout.resolve(rooms('301', '302'));
  assert.deepEqual(reordered.slots.map(s => s.roomIndex), [0, 1]);
  assert.deepEqual(layout.resolve(rooms('302', '300')).slots.map(s => s.roomIndex), [null, 0]);
  const next = layout.resolve(rooms('302', '300'), 1);
  assert.equal(next.pageCount, 2);
  assert.equal(next.slots[0]?.roomCode, '300');
  assert.equal(layout.resolve(rooms('302', '300'), 0, 1).page, 1);
  assert.ok(layout.resolve([]).slots.every(slot => !slot.interactive));
});
test('physical layouts are scoped to an instance and reject duplicate or invalid bindings', () => {
  const a = new WardCorridorLayout(doors, devices, [{ roomCode: '301', doorNode: '门2', deviceNode: '门口机2' }]);
  const b = new WardCorridorLayout(doors, devices, [{ roomCode: '301', doorNode: '门1', deviceNode: '门口机1' }]);
  assert.equal(a.resolve(rooms('301')).slots[1]?.roomIndex, 0);
  assert.equal(b.resolve(rooms('301')).slots[0]?.roomIndex, 0);
  const bad = new WardCorridorLayout(doors, devices, [
    { roomCode: '301', doorNode: '门1', deviceNode: '门口机1' },
    { roomCode: '302', doorNode: '门1', deviceNode: '门口机2' },
  ]).resolve(rooms('301', '302'));
  assert.ok(bad.issues.length);
  assert.ok(bad.slots.every(slot => !slot.interactive));
});
test('ambiguous or missing room codes never become clickable; unconfigured physical rooms remain reported', () => {
  const layout = new WardCorridorLayout(doors, devices);
  const result = layout.resolve(rooms('', '301', '301'));
  assert.equal(result.issues.length, 2);
  assert.ok(result.slots.every(slot => !slot.interactive));
  const physical = new WardCorridorLayout(doors, devices, []).resolve(rooms('999'));
  assert.match(physical.issues[0]!, /999/);
});
