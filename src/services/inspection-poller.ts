import { fetchSwpInspectionRecords } from '@/api/inspection';
import {
  createInspectionPollingController,
  type InspectionPollingStore,
} from '@/core/inspection-polling-controller';
import { normalizeInspectionRecords } from '@/core/inspection';
import type { TwinAreaEntity } from '@/types/twin';

type Store = InspectionPollingStore & {
  area: TwinAreaEntity | null;
};

let activeController: ReturnType<typeof createInspectionPollingController> | null = null;

export function startInspectionPoller(store: Store, intervalMs = 60_000) {
  activeController?.stop();
  activeController = createInspectionPollingController({
    async loadRecords(areaId) {
      const area = store.area;
      if (!area)
        return [];
      const records = await fetchSwpInspectionRecords(areaId);
      if (store.area !== area)
        return [];
      return normalizeInspectionRecords(records, area);
    },
  });
  return activeController.start(store, intervalMs);
}

export function stopInspectionPoller() {
  activeController?.stop();
  activeController = null;
}

