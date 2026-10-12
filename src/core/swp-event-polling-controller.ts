import type { NormalizedSwpEvent, SwpEventSource, SwpEventSyncState } from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';
import { createBrowserPollingVisibility, type PollingVisibility } from './polling-visibility.ts';

export const DEFAULT_SWP_EVENT_INTERVAL_MS = 60_000;

export interface SwpEventRefreshResult {
  status: 'ready' | 'partial' | 'busy' | 'backoff' | 'scope-changed' | 'unavailable' | 'failed';
  retryAt?: number;
}
function didApply(result: SwpEventRefreshResult) {
  return result.status === 'ready' || result.status === 'partial';
}

export interface SwpEventSnapshot {
  coverage?: SwpEventSyncState['coverage'];
  events: NormalizedSwpEvent[];
  resolvedEventIds?: string[];
  refreshedSources?: SwpEventSource[];
  warning?: string;
  syncedAt?: string;
}

export interface SwpEventPollingStore {
  selectedAreaId: number | null;
  area: TwinAreaEntity | null;
  swpEventSync?: Pick<SwpEventSyncState, 'phase'>;
  beginSwpEventSync: (expectedAreaId: number) => boolean;
  applySwpEventSnapshot: (expectedAreaId: number, snapshot: SwpEventSnapshot) => boolean;
  failSwpEventSync: (expectedAreaId: number, message: string) => boolean;
}

interface SwpEventPollingDependencies {
  loadSnapshot: (areaId: number, area: TwinAreaEntity) => Promise<SwpEventSnapshot>;
  schedule?: (callback: () => void, intervalMs: number) => unknown;
  cancelSchedule?: (handle: unknown) => void;
  now?: () => Date;
  visibility?: PollingVisibility;
}

interface PollingRun {
  generation: number;
  store: SwpEventPollingStore;
  areaId: number;
  intervalMs: number;
  refreshing: boolean;
  failureStreak: number;
  retryAfterMs: number;
}

export interface SwpEventPollingController {
  start: (store: SwpEventPollingStore, intervalMs?: number) => Promise<boolean>;
  refreshNow: (expectedAreaId?: number) => Promise<boolean>;
  refreshDetailed: (expectedAreaId?: number) => Promise<SwpEventRefreshResult>;
  stop: () => void;
}

export function createSwpEventPollingController(
  dependencies: SwpEventPollingDependencies,
): SwpEventPollingController {
  const schedule = dependencies.schedule
    ?? ((callback: () => void, intervalMs: number) => setInterval(callback, intervalMs));
  const cancelSchedule = dependencies.cancelSchedule
    ?? ((handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>));
  const now = dependencies.now ?? (() => new Date());
  const visibility = dependencies.visibility ?? createBrowserPollingVisibility();
  let generation = 0;
  let timer: unknown = null;
  let activeRun: PollingRun | null = null;
  let unsubscribeVisibility: (() => void) | null = null;
  let activeIntervalMs = DEFAULT_SWP_EVENT_INTERVAL_MS;
  let backgroundIntervalMs = 60_000;

  function clearTimer() {
    if (timer == null)
      return;
    cancelSchedule(timer);
    timer = null;
  }

  function schedulePolling(run: PollingRun) {
    if (timer != null || !isCurrent(run))
      return;
    timer = schedule(
      () => { void refresh(run); },
      visibility.isVisible() ? activeIntervalMs : backgroundIntervalMs,
    );
  }

  function isCurrent(run: PollingRun): boolean {
    return activeRun === run
      && generation === run.generation
      && run.store.selectedAreaId === run.areaId
      && !!run.store.area;
  }

  async function refresh(run: PollingRun | null): Promise<SwpEventRefreshResult> {
    if (!run) return { status: 'unavailable' };
    if (!isCurrent(run)) return { status: 'scope-changed' };
    if (run.refreshing) return { status: 'busy' };
    if (now().getTime() < run.retryAfterMs)
      return { status: 'backoff', retryAt: run.retryAfterMs };
    if (!run.store.beginSwpEventSync(run.areaId))
      return { status: 'unavailable' };
    const area = run.store.area;
    if (!area)
      return { status: 'unavailable' };

    run.refreshing = true;
    try {
      const snapshot = await dependencies.loadSnapshot(run.areaId, area);
      if (!isCurrent(run) || run.store.area !== area)
        return { status: 'scope-changed' };
      const applied = run.store.applySwpEventSnapshot(run.areaId, {
        ...snapshot,
        syncedAt: now().toISOString(),
      });
      if (applied) {
        run.failureStreak = 0;
        run.retryAfterMs = 0;
      }
      if (!applied) return { status: 'scope-changed' };
      const partial = run.store.swpEventSync?.phase === 'partial'
        || snapshot.warning || snapshot.coverage?.some(page => !page.complete);
      return { status: partial ? 'partial' : 'ready' };
    }
    catch (error) {
      if (!isCurrent(run) || run.store.area !== area)
        return { status: 'scope-changed' };
      run.store.failSwpEventSync(
        run.areaId,
        error instanceof Error ? error.message : 'SWP 事件同步失败',
      );
      run.failureStreak += 1;
      const retryDelayMs = Math.min(
        60_000,
        run.intervalMs * (2 ** Math.min(run.failureStreak, 2)),
      );
      run.retryAfterMs = now().getTime() + retryDelayMs;
      return { status: 'failed', retryAt: run.retryAfterMs };
    }
    finally {
      if (activeRun === run)
        run.refreshing = false;
    }
  }

  function stop(): void {
    generation += 1;
    clearTimer();
    unsubscribeVisibility?.();
    unsubscribeVisibility = null;
    activeRun = null;
  }

  async function start(
    store: SwpEventPollingStore,
    intervalMs = DEFAULT_SWP_EVENT_INTERVAL_MS,
  ): Promise<boolean> {
    stop();
    const areaId = store.selectedAreaId;
    const area = store.area;
    if (areaId == null || !area)
      return false;
    const run: PollingRun = {
      generation,
      store,
      areaId,
      intervalMs,
      refreshing: false,
      failureStreak: 0,
      retryAfterMs: 0,
    };
    activeRun = run;
    activeIntervalMs = intervalMs;
    backgroundIntervalMs = Math.max(60_000, intervalMs * 4);
    unsubscribeVisibility = visibility.subscribe(visible => {
      if (!isCurrent(run))
        return;
      clearTimer();
      schedulePolling(run);
      if (visible)
        void refresh(run);
    });
    schedulePolling(run);
    return didApply(await refresh(run));
  }

  function refreshDetailed(expectedAreaId?: number): Promise<SwpEventRefreshResult> {
    if (activeRun && expectedAreaId != null && activeRun.areaId !== expectedAreaId)
      return Promise.resolve({ status: 'scope-changed' });
    return refresh(activeRun);
  }

  return {
    start,
    refreshNow: async expectedAreaId => didApply(await refreshDetailed(expectedAreaId)),
    refreshDetailed,
    stop,
  };
}
