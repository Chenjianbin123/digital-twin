import assert from 'node:assert/strict';
import { getWardRoomSize } from '../src/types/twin.ts';

const fourBedRoom = getWardRoomSize(4);
assert.ok(fourBedRoom.w <= 16.5, '四人间宽度不应过大，避免床位显得过小');
assert.ok(fourBedRoom.d <= 12.5, '四人间深度不应过大，避免前景地面过空');
assert.ok(fourBedRoom.w > getWardRoomSize(3).w, '四人间仍需比三人间更宽');
assert.ok(getWardRoomSize(6).w > fourBedRoom.w, '六人间仍需按床位数放大');
