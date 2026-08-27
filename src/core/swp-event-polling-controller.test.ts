import assert from 'node:assert/strict';
import test from 'node:test';

import { createSwpEventPollingController } from './swp-event-polling-controller.ts';
import type { SwpEventPollingStore, SwpEventSnapshot } from './swp-event-polling-controller.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

function makeArea(name = '一病区'): TwinAreaEntity {
  return { areaName: name, areaCode: 'A1', deptName: '内科', rooms: [] };
}

function makeSnapshot(): SwpEventSnapshot {
  return {
    events: [],
    refreshedSources: ['swp-call', 'swp-alarm'],
  };
}

function makeStore(): SwpEventPollingStore & {
  phases: string[];
  snapshots: SwpEventSnapshot[];
  failures: string[];
} {
  return {
    selectedAreaId: 8,
    area: makeArea(),
    phases: [],
    snapshots: [],
    failures: [],
    beginSwpEventSync(expectedAreaId) {
      if (this.selectedAreaId !== expectedAreaId)
        return false;
      this.phases.push('loading');
      return true;
    },
    applySwpEventSnapshot(expectedAreaId, snapshot) {
      if (this.selectedAreaId !== expectedAreaId)
        return false;
      this.snapshots.push(snapshot);
      this.phases.push('ready');
      return true;
    },
    failSwpEventSync(expectedAreaId, message) {
      if (this.selectedAreaId !== expectedAreaId)
        return false;
      this.failures.push(message);
      this.phases.push('error');
      return true;
    },
  };
}

function makeVisibility(initial = true) {
  let visible = initial;
  const listeners = new Set<(nextVisible: boolean) => void>();
  return {
    isVisible: () => visible,
    subscribe(listener: (nextVisible: boolean) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
      for (const listener of listeners)
        listener(nextVisible);
    },
  };
}

test('loads immediately, writes a current-area snapshot, and clears its interval on stop', async () => {
  const store = makeStore();
  const cleared: unknown[] = [];
  const controller = createSwpEventPollingController({
    loadSnapshot: async (areaId, area) => {
      assert.equal(areaId, 8);
      assert.equal(area.areaName, '一病区');
      return makeSnapshot();
    },
    schedule: () => 'timer',
    cancelSchedule: handle => cleared.push(handle),
    now: () => new Date('2026-08-21T10:10:00+08:00'),
  });

  assert.equal(await controller.start(store, 15_000), true);
  assert.deepEqual(store.phases, ['loading', 'ready']);
  assert.equal(store.snapshots.length, 1);
  assert.equal(store.snapshots[0].syncedAt, '2026-08-21T02:10:00.000Z');

  controller.stop();
  assert.deepEqual(cleared, ['timer']);
});

test('prevents overlapping refreshes and ignores a response after the selected area changes', async () => {
  const store = makeStore();
  let resolveSnapshot!: (snapshot: SwpEventSnapshot) => void;
  let loadCount = 0;
  const controller = createSwpEventPollingController({
    loadSnapshot: () => {
      loadCount += 1;
      return new Promise(resolve => { resolveSnapshot = resolve; });
    },
    schedule: () => 1,
    cancelSchedule: () => {},
  });

  const firstRun = controller.start(store);
  assert.equal(await controller.refreshNow(), false);
  assert.equal(loadCount, 1);

  store.selectedAreaId = 9;
  store.area = makeArea('二病区');
  resolveSnapshot(makeSnapshot());
  assert.equal(await firstRun, false);
  assert.equal(store.snapshots.length, 0);
  assert.equal(store.failures.length, 0);
  controller.stop();
});

test('continues polling when the current area receives a refreshed room snapshot', async () => {
  const store = makeStore();
  const loadedAreaNames: string[] = [];
  const controller = createSwpEventPollingController({
    loadSnapshot: async (_areaId, area) => {
      loadedAreaNames.push(area.areaName);
      return makeSnapshot();
    },
    schedule: () => 1,
    cancelSchedule: () => {},
  });

  assert.equal(await controller.start(store), true);
  store.area = makeArea('一病区刷新快照');
  assert.equal(await controller.refreshNow(), true);
  assert.deepEqual(loadedAreaNames, ['一病区', '一病区刷新快照']);
  controller.stop();
});

test('reports current-area failures without discarding the last good snapshot', async () => {
  const store = makeStore();
  store.snapshots.push(makeSnapshot());
  const controller = createSwpEventPollingController({
    loadSnapshot: async () => { throw new Error('接口不可用'); },
    schedule: () => 1,
    cancelSchedule: () => {},
  });

  assert.equal(await controller.start(store), false);
  assert.deepEqual(store.failures, ['接口不可用']);
  assert.equal(store.snapshots.length, 1);
  controller.stop();
});

test('backs off repeated failed requests and resumes normal polling after recovery', async () => {
  const store = makeStore();
  let currentMs = 1_000;
  let shouldFail = true;
  let scheduledRefresh: (() => void) | undefined;
  let loadCount = 0;
  const controller = createSwpEventPollingController({
    loadSnapshot: async () => {
      loadCount += 1;
      if (shouldFail)
        throw new Error('接口暂时不可用');
      return makeSnapshot();
    },
    schedule: callback => {
      scheduledRefresh = callback;
      return 'timer';
    },
    cancelSchedule: () => {},
    now: () => new Date(currentMs),
  });

  assert.equal(await controller.start(store, 15_000), false);
  assert.equal(loadCount, 1);

  currentMs += 15_000;
  scheduledRefresh?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 1);

  currentMs += 15_000;
  scheduledRefresh?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 2);

  shouldFail = false;
  currentMs += 60_000;
  scheduledRefresh?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 3);
  assert.equal(store.snapshots.length, 1);
  controller.stop();
});

test('uses low-frequency polling while hidden and refreshes immediately when visible again', async () => {
  const store = makeStore();
  const visibility = makeVisibility(false);
  let loadCount = 0;
  let scheduledRefresh: (() => void) | undefined;
  const scheduledIntervals: number[] = [];
  const controller = createSwpEventPollingController({
    loadSnapshot: async () => {
      loadCount += 1;
      return makeSnapshot();
    },
    schedule: (callback, intervalMs) => {
      scheduledRefresh = callback;
      scheduledIntervals.push(intervalMs);
      return 'timer';
    },
    cancelSchedule: () => {
      scheduledRefresh = undefined;
    },
    visibility,
  });

  assert.equal(await controller.start(store, 15_000), true);
  assert.equal(loadCount, 1);
  assert.deepEqual(scheduledIntervals, [60_000]);

  const backgroundRefresh = scheduledRefresh;
  backgroundRefresh?.();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 2);

  visibility.setVisible(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(loadCount, 3);
  assert.equal(scheduledIntervals[scheduledIntervals.length - 1], 15_000);

  visibility.setVisible(false);
  assert.equal(scheduledIntervals[scheduledIntervals.length - 1], 60_000);
  controller.stop();
});
