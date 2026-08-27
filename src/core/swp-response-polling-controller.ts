import type { SwpResponseMetrics } from '../types/swp-events.ts';
import { createBrowserPollingVisibility, type PollingVisibility } from './polling-visibility.ts';

export interface SwpResponsePollingStore {
  selectedAreaId: number | null;
  beginSwpResponseSync: (expectedAreaId: number) => boolean;
  applySwpResponseMetrics: (
    expectedAreaId: number,
    metrics: SwpResponseMetrics,
    syncedAt: string,
  ) => boolean;
  failSwpResponseSync: (expectedAreaId: number, message: string) => boolean;
}

interface Dependencies {
  loadMetrics: (areaId: number) => Promise<SwpResponseMetrics>;
  schedule?: (callback: () => void, intervalMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  now?: () => Date;
  visibility?: PollingVisibility;
}

interface Run {
  generation: number;
  store: SwpResponsePollingStore;
  areaId: number;
  refreshing: boolean;
}

export function createSwpResponsePollingController(dependencies: Dependencies) {
  const schedule = dependencies.schedule
    ?? ((callback: () => void, intervalMs: number) => setInterval(callback, intervalMs));
  const cancelSchedule = dependencies.cancelSchedule
    ?? ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
  const now = dependencies.now ?? (() => new Date());
  const visibility = dependencies.visibility ?? createBrowserPollingVisibility();
  let generation = 0;
  let timer: unknown = null;
  let activeRun: Run | null = null;
  let unsubscribeVisibility: (() => void) | null = null;
  let activeIntervalMs = 60_000;

  function clearTimer() {
    if (timer == null)
      return;
    cancelSchedule(timer);
    timer = null;
  }

  function schedulePolling(run: Run) {
    if (timer != null || !isCurrent(run) || !visibility.isVisible())
      return;
    timer = schedule(() => { void refresh(run); }, activeIntervalMs);
  }

  function isCurrent(run: Run) {
    return activeRun === run
      && generation === run.generation
      && run.store.selectedAreaId === run.areaId;
  }

  async function refresh(run: Run | null): Promise<boolean> {
    if (
      !run
      || !isCurrent(run)
      || run.refreshing
      || !visibility.isVisible()
      || !run.store.beginSwpResponseSync(run.areaId)
    )
      return false;
    run.refreshing = true;
    try {
      const metrics = await dependencies.loadMetrics(run.areaId);
      if (!isCurrent(run))
        return false;
      return run.store.applySwpResponseMetrics(run.areaId, metrics, now().toISOString());
    }
    catch (error) {
      if (!isCurrent(run))
        return false;
      run.store.failSwpResponseSync(
        run.areaId,
        error instanceof Error ? error.message : '呼叫响应指标同步失败',
      );
      return false;
    }
    finally {
      if (activeRun === run)
        run.refreshing = false;
    }
  }

  function stop() {
    generation += 1;
    clearTimer();
    unsubscribeVisibility?.();
    unsubscribeVisibility = null;
    activeRun = null;
  }

  async function start(store: SwpResponsePollingStore, intervalMs = 60_000) {
    stop();
    const areaId = store.selectedAreaId;
    if (areaId == null)
      return false;
    const run: Run = { generation, store, areaId, refreshing: false };
    activeRun = run;
    activeIntervalMs = intervalMs;
    unsubscribeVisibility = visibility.subscribe(visible => {
      if (!isCurrent(run))
        return;
      if (!visible) {
        clearTimer();
        return;
      }
      schedulePolling(run);
      void refresh(run);
    });
    schedulePolling(run);
    return refresh(run);
  }

  return { start, refreshNow: () => refresh(activeRun), stop };
}
