import type { NormalizedSwpEvent } from '../types/swp-events.ts';

interface SwpCallNotifierDependencies {
  isEnabled?: () => boolean;
  alert: (events: NormalizedSwpEvent[]) => void | Promise<void>;
}

export interface SwpCallNotifier {
  process: (events: NormalizedSwpEvent[]) => Promise<string[]>;
  reset: () => void;
}

export function createSwpCallNotifier(
  dependencies: SwpCallNotifierDependencies,
): SwpCallNotifier {
  const announcedIds = new Set<string>();

  return {
    async process(events) {
      if (dependencies.isEnabled && !dependencies.isEnabled())
        return [];
      const newCalls = events.filter(event =>
        event.source === 'swp-call'
        && event.taskType === 'call'
        && !announcedIds.has(event.id),
      );
      if (!newCalls.length)
        return [];
      for (const event of newCalls)
        announcedIds.add(event.id);
      await dependencies.alert(newCalls);
      return newCalls.map(event => event.id);
    },
    reset() {
      announcedIds.clear();
    },
  };
}
