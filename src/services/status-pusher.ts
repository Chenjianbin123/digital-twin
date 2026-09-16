import { findUniqueStatusBed } from '@/core/ward-data-binding';
import { resolveBedStatus } from '@/core/bed-status';
import { startStatusChannel, stopStatusChannel, subscribeStatusChannel } from '@/services/status-channel';
import type { useTwinStore } from '@/stores/twin-store';
import type { StatusBarInfo } from '@/types/ward';

type TwinStore = ReturnType<typeof useTwinStore>;

let unsubscribe: (() => void) | null = null;

function handleStatusMessage(store: TwinStore, payload: StatusBarInfo) {
  if (!store.area) return;
  const match = findUniqueStatusBed(store.area, payload.bedCode, payload.deviceCode);
  if (!match || !store.updateBedStatus(store.selectedAreaId, payload.bedCode, payload)) return;
  const meta = resolveBedStatus(match.bed);
  store.pushHistory({
    category: 'infusion', bedCode: match.bed.bedCode, bedName: match.bed.bedName,
    label: meta.label, roomName: match.room.sickroomName,
  });
}

export function startStatusPusher(store: TwinStore, intervalMs = 3500) {
  stopStatusPusher();
  unsubscribe = subscribeStatusChannel(payload => handleStatusMessage(store, payload));
  startStatusChannel(intervalMs);
}

export function stopStatusPusher() {
  unsubscribe?.();
  unsubscribe = null;
  stopStatusChannel();
}

export function isStatusPusherRunning() {
  return unsubscribe !== null;
}
