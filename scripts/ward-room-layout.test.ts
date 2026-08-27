import assert from 'node:assert/strict';
import { resolveWardBedPose } from '../src/core/ward-room-layout.ts';
import { BED_WIDTH, MIN_BED_CLEARANCE } from '../src/core/ward-bed-geometry.ts';

const threeBed = [0, 1, 2].map(index => resolveWardBedPose(index, 3, 16, 13));

assert.deepEqual(
  threeBed.map(pose => Number(pose.z.toFixed(2))),
  [-4.15, -4.15, -4.15],
);
assert.deepEqual(
  threeBed.map(pose => Number(pose.x.toFixed(2))),
  [-2.95, 0, 2.95],
);
assert.deepEqual(
  threeBed.map(pose => pose.rotationY),
  [0, 0, 0],
);

const sixBed = [0, 1, 2, 3, 4, 5].map(index => resolveWardBedPose(index, 6, 20, 18));

assert.equal(new Set(sixBed.map(pose => Number(pose.z.toFixed(2)))).size, 1);
assert.ok(sixBed[0].x < sixBed[1].x);
assert.ok(sixBed[4].x < sixBed[5].x);
assert.ok(sixBed[0].x > -8.2);
assert.ok(sixBed[5].x < 8.2);
for (let i = 1; i < sixBed.length; i++) {
  const clearGap = sixBed[i].x - sixBed[i - 1].x - BED_WIDTH;
  assert.ok(clearGap >= MIN_BED_CLEARANCE, `第 ${i} 与第 ${i + 1} 床之间需要保留护理通道`);
}

const singleBed = resolveWardBedPose(0, 1, 13, 11);
assert.equal(singleBed.x, 0);
assert.equal(Number(singleBed.z.toFixed(2)), -3.07);
