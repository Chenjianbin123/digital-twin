import {
  fetchActiveSwpAlarms,
  fetchActiveSwpCalls,
  fetchSwpResponseTimeliness,
} from '@/api/swp-events';
import {
  createSwpEventPollingController,
  type SwpEventPollingStore,
} from '@/core/swp-event-polling-controller';
import {
  createSwpEventSnapshotLoader,
} from '@/core/swp-event-loader';
import { summarizeSwpResponseMetrics } from '@/core/swp-event-normalizer';
import { createSwpResponsePollingController } from '@/core/swp-response-polling-controller';

const loadSnapshot = createSwpEventSnapshotLoader({
  fetchCalls: fetchActiveSwpCalls,
  fetchAlarms: fetchActiveSwpAlarms,
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
  eventIntervalMs = 15_000,
  responseIntervalMs = 60_000,
) {
  void responseController.start(store, responseIntervalMs);
  return eventController.start(store, eventIntervalMs);
}

export function refreshSwpEventsNow() {
  return eventController.refreshNow();
}

export function stopSwpEventPoller() {
  eventController.stop();
  responseController.stop();
}
