import assert from 'node:assert/strict';
import test from 'node:test';
import { MOCK_DOOR_DEVICE_LIST } from '../mock/door-device-list.ts';
import { startCallChannel, stopCallChannel, subscribeCallChannel } from '../services/call-channel.ts';
import { startStatusChannel, stopStatusChannel, subscribeStatusChannel } from '../services/status-channel.ts';

test('local call and status channels update occupied beds in the current fixtures', async () => {
  const occupiedBeds = new Set(MOCK_DOOR_DEVICE_LIST.data.flatMap(room => room.doorSickInfoList.map(patient => patient.bedCode)));
  const calls: string[] = [], statuses: string[] = [];
  const unsubCall = subscribeCallChannel(message => calls.push(message.bedCode));
  const unsubStatus = subscribeStatusChannel(message => statuses.push(message.bedCode));
  try {
    startCallChannel(2);
    startStatusChannel(2);
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.ok(calls.length > 0 && statuses.length > 0);
    assert.ok([...calls, ...statuses].every(code => occupiedBeds.has(code)));
  } finally {
    stopCallChannel(); stopStatusChannel(); unsubCall(); unsubStatus();
  }
  const total = calls.length + statuses.length;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls.length + statuses.length, total);
});
