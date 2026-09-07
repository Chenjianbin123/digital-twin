import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const storeSource = readFileSync(new URL('../src/stores/twin-store.ts', import.meta.url), 'utf8');

function functionBody(name) {
  const start = storeSource.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} should exist`);
  const nextFunction = storeSource.indexOf('\n  function ', start + 1);
  const nextAsyncFunction = storeSource.indexOf('\n  async function ', start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter(index => index > start);
  const end = candidates.length ? Math.min(...candidates) : storeSource.length;
  return storeSource.slice(start, end);
}

function asyncFunctionBody(name) {
  const start = storeSource.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} should exist`);
  const nextFunction = storeSource.indexOf('\n  function ', start + 1);
  const nextAsyncFunction = storeSource.indexOf('\n  async function ', start + 1);
  const candidates = [nextFunction, nextAsyncFunction].filter(index => index > start);
  const end = candidates.length ? Math.min(...candidates) : storeSource.length;
  return storeSource.slice(start, end);
}

test('preserved scene restores current ward by stable room identity after refresh reorder', () => {
  assert.match(storeSource, /function collectRoomIdentityKeys/);
  assert.match(storeSource, /function restoreRoomIndexByIdentity/);
  assert.match(storeSource, /function resolvePreservedBedCode/);

  const restoreBody = functionBody('restoreRoomIndexByIdentity');
  assert.match(restoreBody, /collectRoomIdentityKeys\(previousRoom\)/);
  assert.match(restoreBody, /sickroomCode|sickroomId|deviceCode|sickroomName/);
  assert.match(restoreBody, /nextRooms\.findIndex/);

  const refreshBody = asyncFunctionBody('refreshCurrentArea');
  assert.match(refreshBody, /const previousRoom = currentWard\.value/);
  assert.match(refreshBody, /restoreRoomIndexByIdentity\(snapshot\.area\.rooms,\s*previousRoom,\s*previousRoomIndex\)/);
  assert.doesNotMatch(refreshBody, /currentRoomIndex\.value = previousRoomIndex >= 0 && previousRoomIndex < snapshot\.area\.rooms\.length/);
  assert.match(refreshBody, /selectedBedCode\.value = resolvePreservedBedCode/);

  const loadBody = asyncFunctionBody('loadArea');
  assert.match(loadBody, /const previousRoom = currentWard\.value/);
  assert.match(loadBody, /restoreRoomIndexByIdentity\(area\.value\.rooms,\s*previousRoom,\s*previousRoomIndex\)/);
  assert.doesNotMatch(loadBody, /currentRoomIndex\.value = previousRoomIndex >= 0 && previousRoomIndex < area\.value\.rooms\.length/);
  assert.match(loadBody, /selectedBedCode\.value = resolvePreservedBedCode/);
});
