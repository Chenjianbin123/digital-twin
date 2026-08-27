import assert from 'node:assert/strict';
import test from 'node:test';

import { summarizeRoom } from './area-summary.ts';
import type { TwinWardEntity } from '../types/twin.ts';

function roomWithStatuses(statuses: Array<'304' | '307' | '9'>): TwinWardEntity {
  return {
    sickroomName: '601病房',
    sickroomCode: '601',
    sickroomId: '601',
    deviceCode: 'door-601',
    beds: statuses.map((status, index) => ({
      bedCode: `bed-${index + 1}`,
      bedName: String(index + 1),
      deviceCode: `terminal-${index + 1}`,
      position: { x: index, z: 0 },
      isOccupied: true,
      isOnline: true,
      statusBarInfo: {
        bedCode: `bed-${index + 1}`,
        deviceCode: `terminal-${index + 1}`,
        status,
      },
    })),
  };
}

test('labels low-battery beds separately from offline beds in room summaries', () => {
  const summary = summarizeRoom(roomWithStatuses(['304', '9']), 0);

  assert.equal(summary.offlineCount, 2);
  assert.equal(summary.lowBatteryCount, 1);
  assert.match(summary.statusText, /离线 1/);
  assert.match(summary.statusText, /低电量 1/);
});
