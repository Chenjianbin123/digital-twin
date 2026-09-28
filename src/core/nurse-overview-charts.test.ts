import assert from 'node:assert/strict';
import test from 'node:test';
import { bedUsageRatio, pendingEventDistribution, usageGaugePoint } from './nurse-overview-charts.ts';

test('bed ratio uses the true denominator and distinguishes no data from empty beds', () => {
  assert.equal(bedUsageRatio(15, 20), 0.75);
  assert.equal(bedUsageRatio(0, 20), 0);
  assert.equal(bedUsageRatio(20, 20), 1);
  for (const [occupied, total] of [[0, 0], [21, 20], [-1, 20], [NaN, 20], [1, Infinity]])
    assert.equal(bedUsageRatio(occupied, total), null);
});

test('pending distribution excludes handling, includes every task type exactly once and uses a common scale', () => {
  const result = pendingEventDistribution([
    { type: 'call', status: 'pending' }, { type: 'call', status: 'pending' },
    { type: 'call', status: 'handling' }, { type: 'infusion', status: 'pending' },
    { type: 'vital', status: 'pending' }, { type: 'env', status: 'pending' },
    { type: 'offline', status: 'pending' }, { type: 'inspection', status: 'pending' },
  ]);
  assert.equal(result.total, 7);
  assert.deepEqual(result.rows.map(row => [row.count, row.ratio]), [[2, 0.5], [1, 0.25], [4, 1]]);
  const empty = pendingEventDistribution([]);
  assert.equal(empty.total, 0);
  assert.ok(empty.rows.every(row => row.count === 0 && row.ratio === 0));
});

test('gauge endpoints and marker follow a clockwise 240 degree sweep', () => {
  const start = usageGaugePoint(0), end = usageGaugePoint(1);
  assert.ok(start.x < 110 && end.x > 110);
  assert.ok(Math.abs(start.y - end.y) < 0.001);
  const middle = usageGaugePoint(0.5);
  assert.ok(Math.abs(middle.x - 110) < 0.001 && Math.abs(middle.y - 30) < 0.001);
  const marker = usageGaugePoint(0.75);
  assert.ok(marker.x > 110 && marker.y < 108);
});
