import type { NormalizedSwpEvent } from '../types/swp-events.ts';

type Receipt = [string, number];
interface Dependencies {
  read: () => unknown;
  write: (receipts: Receipt[]) => void;
  lock: (run: () => Promise<void>) => Promise<void>;
  send: (events: NormalizedSwpEvent[]) => Promise<void>;
  now?: () => number;
}

// Each channel owns its receipts: retrying sound must not duplicate a successful notification.
export function createCallReminderDelivery(dependencies: Dependencies) {
  return (events: NormalizedSwpEvent[]) => dependencies.lock(async () => {
    const now = (dependencies.now ?? Date.now)();
    const raw = dependencies.read();
    const receipts = new Map<string, number>();
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'number'
          && item[1] > now - 86_400_000 && item[1] <= now) receipts.set(item[0], item[1]);
      }
    }
    const key = (event: NormalizedSwpEvent) => `${event.areaId}:${event.id}:${event.timestampMs}`;
    const pending = events.filter(event => !receipts.has(key(event)));
    if (!pending.length) return;
    await dependencies.send(pending);
    for (const event of pending) receipts.set(key(event), now);
    dependencies.write([...receipts].slice(-4000));
  });
}
