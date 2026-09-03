import assert from 'node:assert/strict';
import test from 'node:test';

import { createInspectionPollingController } from './inspection-polling-controller.ts';
import type { NormalizedInspectionRecord } from '../types/inspection.ts';

function inspection(id: string): NormalizedInspectionRecord {
  return {
    id,
    roomIndex: 0,
    roomCode: '18_03',
    roomName: '18_03病房',
    bedCode: 'bed-1',
    bedName: '1',
    state: 'normal',
    stateLabel: '已巡视',
    occurredAt: '2026-09-03 10:00:00',
    timestampMs: 1,
  };
}

test('loads immediately and rejects a stale area inspection response', async () => {
  let resolveLoad!: (records: NormalizedInspectionRecord[]) => void;
  const applied: string[] = [];
  const store = {
    selectedAreaId: 8 as number | null,
    beginInspectionSync: (areaId: number) => areaId === 8,
    applyInspectionSnapshot: (areaId: number, records: NormalizedInspectionRecord[]) => {
      applied.push(`${areaId}:${records[0]?.id}`);
      return true;
    },
    failInspectionSync: () => true,
  };
  const controller = createInspectionPollingController({
    loadRecords: async () => new Promise(resolve => { resolveLoad = resolve; }),
    schedule: () => 1,
    cancelSchedule: () => {},
    visibility: { isVisible: () => true, subscribe: () => () => {} },
  });

  const startPromise = controller.start(store, 60_000);
  store.selectedAreaId = 9;
  resolveLoad([inspection('old-area')]);

  assert.equal(await startPromise, false);
  assert.deepEqual(applied, []);
  controller.stop();
});

test('prevents overlapping inspection refreshes and refreshes after visibility returns', async () => {
  let visible = true;
  let visibilityListener: (visible: boolean) => void = () => {};
  let loadCount = 0;
  let release!: () => void;
  const store = {
    selectedAreaId: 8 as number | null,
    beginInspectionSync: () => true,
    applyInspectionSnapshot: () => true,
    failInspectionSync: () => true,
  };
  const controller = createInspectionPollingController({
    loadRecords: async () => {
      loadCount += 1;
      if (loadCount === 1)
        await new Promise<void>(resolve => { release = resolve; });
      return [];
    },
    schedule: () => 1,
    cancelSchedule: () => {},
    visibility: {
      isVisible: () => visible,
      subscribe: listener => {
        visibilityListener = listener;
        return () => {};
      },
    },
  });

  const first = controller.start(store, 60_000);
  assert.equal(await controller.refreshNow(), false);
  release();
  assert.equal(await first, true);
  visible = false;
  visibilityListener(false);
  assert.equal(await controller.refreshNow(), false);
  visible = true;
  visibilityListener(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 2);
  controller.stop();
});
