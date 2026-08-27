import { startCallChannel, stopCallChannel, subscribeCallChannel } from '@/services/call-channel';
import type { useTwinStore } from '@/stores/twin-store';

type TwinStore = ReturnType<typeof useTwinStore>;

let unsubscribe: (() => void) | null = null;

export function startCallPusher(store: TwinStore, intervalMs = 6000) {
  stopCallPusher();
  unsubscribe = subscribeCallChannel(payload => store.setBedCalling(store.selectedAreaId, payload.bedCode, payload.calling));
  startCallChannel(intervalMs);
}

export function stopCallPusher() {
  unsubscribe?.();
  unsubscribe = null;
  stopCallChannel();
}

export function isCallPusherRunning() {
  return unsubscribe !== null;
}
