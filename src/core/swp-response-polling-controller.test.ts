import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwpResponsePollingController } from './swp-response-polling-controller.ts';
import type { PollingVisibility } from './polling-visibility.ts';
import type { SwpResponseMetrics } from '../types/swp-events.ts';

test('loads response metrics independently and rejects stale area results', async () => {
  let resolveMetrics!: (value: SwpResponseMetrics) => void;
  const applied: number[] = [];
  const store = {
    selectedAreaId: 8 as number | null,
    beginSwpResponseSync: () => true,
    applySwpResponseMetrics: (_areaId: number, metrics: SwpResponseMetrics) => {
      applied.push(metrics.callCount);
      return true;
    },
    failSwpResponseSync: () => true,
  };
  const controller = createSwpResponsePollingController({
    loadMetrics: () => new Promise(resolve => { resolveMetrics = resolve; }),
    schedule: () => 1,
    cancelSchedule: () => {},
  });

  const running = controller.start(store);
  store.selectedAreaId = 9;
  resolveMetrics({
    callCount: 3,
    arrivedCallCount: 2,
    unattendedCallCount: 1,
    arrivalCount: 2,
    averageResponseSeconds: 30,
    latestCallAt: '2026-08-21 10:00:00',
  });
  assert.equal(await running, false);
  assert.deepEqual(applied, []);
  controller.stop();
});

test('pauses hidden response metrics and refreshes once after visibility returns', async () => {
  let visible = false;
  const listeners = new Set<(nextVisible: boolean) => void>();
  const visibility: PollingVisibility & { setVisible: (nextVisible: boolean) => void } = {
    isVisible: () => visible,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVisible(nextVisible) {
      visible = nextVisible;
      for (const listener of listeners)
        listener(nextVisible);
    },
  };
  let loadCount = 0;
  const controller = createSwpResponsePollingController({
    loadMetrics: async () => {
      loadCount += 1;
      return {
        callCount: 0,
        arrivedCallCount: 0,
        unattendedCallCount: 0,
        arrivalCount: 0,
        averageResponseSeconds: null,
        latestCallAt: null,
      };
    },
    schedule: () => 'timer',
    cancelSchedule: () => {},
    visibility,
  });
  const store = {
    selectedAreaId: 8 as number | null,
    beginSwpResponseSync: () => true,
    applySwpResponseMetrics: () => true,
    failSwpResponseSync: () => true,
  };

  assert.equal(await controller.start(store), false);
  assert.equal(loadCount, 0);
  visibility.setVisible(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 1);
  controller.stop();
});
