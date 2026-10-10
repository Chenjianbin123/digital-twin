import {
  fetchActiveSwpAlarms,
  fetchActiveSwpCalls,
  fetchProcessedSwpCalls,
  fetchProcessedSwpAlarms,
  fetchSwpResponseTimeliness,
} from '@/api/swp-events';
import {
  createSwpEventPollingController,
  DEFAULT_SWP_EVENT_INTERVAL_MS,
  type SwpEventPollingStore,
} from '@/core/swp-event-polling-controller';
import {
  createSwpEventSnapshotLoader,
} from '@/core/swp-event-loader';
import { summarizeSwpResponseMetrics } from '@/core/swp-event-normalizer';
import { createSwpResponsePollingController } from '@/core/swp-response-polling-controller';
import { resetSwpCallNotifier } from '@/services/swp-call-notifier';

const loadSnapshot = createSwpEventSnapshotLoader({
  fetchCalls: fetchActiveSwpCalls,
  fetchAlarms: fetchActiveSwpAlarms,
  fetchProcessedCalls: fetchProcessedSwpCalls,
  fetchProcessedAlarms: fetchProcessedSwpAlarms,
});
const eventController = createSwpEventPollingController({
  loadSnapshot,
});
const responseController = createSwpResponsePollingController({
  async loadMetrics(areaId) {
    return summarizeSwpResponseMetrics(await fetchSwpResponseTimeliness(areaId));
  },
});

type PollingStore = SwpEventPollingStore
  & Parameters<typeof responseController.start>[0];

export function startSwpEventPoller(
  store: PollingStore,
  eventIntervalMs = DEFAULT_SWP_EVENT_INTERVAL_MS,
  responseIntervalMs = 60_000,
) {
  resetSwpCallNotifier();
  void responseController.start(store, responseIntervalMs);
  return eventController.start(store, eventIntervalMs);
}

export function refreshSwpEventsNow(expectedAreaId?: number) {
  return eventController.refreshNow(expectedAreaId);
}

export function refreshSwpEventsDetailed(expectedAreaId: number) {
  return eventController.refreshDetailed(expectedAreaId);
}

export function stopSwpEventPoller() {
  resetSwpCallNotifier();
  eventController.stop();
  responseController.stop();
}
