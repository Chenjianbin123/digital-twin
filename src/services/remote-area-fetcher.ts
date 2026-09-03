import type { useTwinStore } from '@/stores/twin-store';

type TwinStore = ReturnType<typeof useTwinStore>;

let timer: ReturnType<typeof setInterval> | null = null;
let runGeneration = 0;
let activeRun: { generation: number; isRefreshing: boolean } | null = null;

async function refreshArea(store: TwinStore, run: NonNullable<typeof activeRun>) {
  if (activeRun !== run || run.isRefreshing || (store.dataSource !== 'remote' && store.dataSource !== 'database'))
    return;

  run.isRefreshing = true;
  try {
    await store.refreshCurrentArea({ preserveScene: true, silent: true });
  }
  finally {
    if (activeRun === run)
      run.isRefreshing = false;
  }
}

export function startRemoteAreaFetcher(store: TwinStore, intervalMs = 300_000) {
  stopRemoteAreaFetcher();
  const run = { generation: runGeneration, isRefreshing: false };
  activeRun = run;
  timer = setInterval(() => refreshArea(store, run), intervalMs);
}

export function stopRemoteAreaFetcher() {
  runGeneration += 1;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  activeRun = null;
}
