import type { NormalizedSwpEvent } from '../types/swp-events.ts';
import type { SwpEventSnapshot } from './swp-event-polling-controller.ts';

export const MAX_RETAINED_EVENTS = 2000;

export function mergeSwpEventSnapshot(previous: NormalizedSwpEvent[], snapshot: SwpEventSnapshot) {
  const completeSources = new Set(snapshot.refreshedSources ?? ['swp-call', 'swp-alarm']);
  const currentIds = new Set(snapshot.events.map(event => event.id));
  const resolvedIds = new Set(snapshot.resolvedEventIds ?? []);
  // Absence from a partial page is not recovery. Keep the last known event, explicitly marked.
  const retained = previous.filter(event => !completeSources.has(event.source) && !currentIds.has(event.id) && !resolvedIds.has(event.id))
    .map(event => ({ ...event, retained: true }));
  const current = [...new Map(snapshot.events.map(event => [event.id, { ...event, retained: false }])).values()];
  return [...current, ...retained.sort((a, b) => b.timestampMs - a.timestampMs)].slice(0, MAX_RETAINED_EVENTS);
}
