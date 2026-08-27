import { resolveBedStatus } from '@/core/bed-status';
import { startStatusChannel, stopStatusChannel, subscribeStatusChannel } from '@/services/status-channel';
import type { useTwinStore } from '@/stores/twin-store';
import type { StatusBarInfo } from '@/types/ward';

type TwinStore = ReturnType<typeof useTwinStore>;

let unsubscribe: (() => void) | null = null;

function handleStatusMessage(store: TwinStore, payload: StatusBarInfo) {
  store.updateBedStatus(store.selectedAreaId, payload.bedCode, payload);

  for (const room of store.area?.rooms ?? []) {
    const bed = room.beds.find(b => b.bedCode === payload.bedCode);
    if (bed) {
      const meta = resolveBedStatus({ ...bed, statusBarInfo: payload });
      store.pushHistory({
        category: 'infusion',
        bedCode: payload.bedCode,
        bedName: bed.bedName,
        label: meta.label,
        roomName: room.sickroomName,
      });
      break;
    }
  }
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
