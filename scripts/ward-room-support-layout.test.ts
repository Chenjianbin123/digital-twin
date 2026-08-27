import assert from 'node:assert/strict';
import { BED_DEPTH, resolveBedVisualScale } from '../src/core/ward-bed-geometry.ts';
import { resolveWardBedPose } from '../src/core/ward-room-layout.ts';
import {
  resolveWardRoomDataCards,
  resolveWardSupportLayout,
} from '../src/core/ward-room-support-layout.ts';
import { getWardRoomSize } from '../src/types/twin.ts';

const bedCount = 4;
const room = getWardRoomSize(bedCount);
const support = resolveWardSupportLayout(bedCount, room.w, room.d);
const bedScale = resolveBedVisualScale(bedCount);
const frontMostBedZ = Math.max(
  ...Array.from({ length: bedCount }, (_, index) => resolveWardBedPose(index, bedCount, room.w, room.d).z),
);
const bedFootZ = frontMostBedZ + (BED_DEPTH / 2) * bedScale;

assert.ok(support.nursingCart.z > bedFootZ + 0.75, '护理车应放在床尾通道外，避免与病床重叠');
assert.ok(support.familyChair.z > bedFootZ + 0.65, '陪护椅应放在床尾侧边，避免挡住床区');
assert.ok(support.cleanStorage.x < -room.w / 2 + 2.4, '左侧储物柜应贴近左墙，补足左侧空场景');
assert.ok(support.medCabinet.x > room.w / 2 - 2.4, '右侧药品柜应贴近右墙，避免占用中间护理通道');

const cards = resolveWardRoomDataCards({
  occupied: 3,
  total: 4,
  calling: 1,
  temp: '26',
  humidity: '55',
});

assert.deepEqual(
  cards.map(card => card.title),
  ['床位概览', '环境监测', '呼叫状态'],
);
assert.equal(cards[0].value, '3/4');
assert.equal(cards[1].sub, '湿度 55%');
assert.equal(cards[2].sub, '当前待处理');

const zeroCards = resolveWardRoomDataCards({
  occupied: 0,
  total: 1,
  calling: 0,
  temp: 0,
  humidity: 0,
});
assert.equal(zeroCards[1].value, '0C');
assert.equal(zeroCards[1].sub, '湿度 0%');
