import type { NormalizedSwpEvent } from '../types/swp-events.ts';

interface SwpCallNotifierDependencies {
  isEnabled?: () => boolean;
  alert: (events: NormalizedSwpEvent[]) => void | Promise<void>;
}

export interface SwpCallNotifier {
  process: (events: NormalizedSwpEvent[]) => Promise<string[]>;
  reset: () => void;
  retryFailed: () => void;
}

export function createSwpCallNotifier(
  dependencies: SwpCallNotifierDependencies,
): SwpCallNotifier {
  const announcedIds = new Set<string>();
  const attempts = new Map<string, number>();
  const inFlight = new Set<string>();
  let generation = 0;

  return {
    async process(events) {
      if (dependencies.isEnabled && !dependencies.isEnabled())
        return [];
      const newCalls = events.filter(event =>
        event.source === 'swp-call'
        && event.taskType === 'call'
        && !event.retained
        && !announcedIds.has(event.id)
        && !inFlight.has(event.id)
        && (attempts.get(event.id) ?? 0) < 3,
      );
      if (!newCalls.length)
        return [];
      const currentGeneration = generation;
      for (const event of newCalls) {
        inFlight.add(event.id);
        attempts.set(event.id, (attempts.get(event.id) ?? 0) + 1);
      }
      try {
        await dependencies.alert(newCalls);
        if (generation !== currentGeneration) return [];
        for (const event of newCalls) announcedIds.add(event.id);
        while (announcedIds.size > 4000) announcedIds.delete(announcedIds.values().next().value!);
        return newCalls.map(event => event.id);
      }
      catch {
        // Retry on the next poll, never in a tight loop. The delivery layer exposes the error.
        return [];
      }
      finally {
        if (generation === currentGeneration) {
          for (const event of newCalls) inFlight.delete(event.id);
          while (attempts.size > 4000) attempts.delete(attempts.keys().next().value!);
        }
      }
    },
    retryFailed() { attempts.clear(); },
    reset() {
      generation += 1;
      announcedIds.clear();
      attempts.clear();
      inFlight.clear();
    },
  };
}
