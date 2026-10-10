import { fetchSwpInspectionRecords } from '@/api/inspection';
import {
  createInspectionPollingController,
  type InspectionPollingStore,
} from '@/core/inspection-polling-controller';
import { associateInspectionRecords } from '@/core/inspection';
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
        throw new Error('当前病区未就绪');
      const page = await fetchSwpInspectionRecords(areaId);
      if (store.area !== area)
        throw new Error('病区已切换，忽略旧巡视结果');
      return { ...page, ...associateInspectionRecords(page.records, area, areaId) };
    },
  });
  return activeController.start(store, intervalMs);
}

export function stopInspectionPoller() {
  activeController?.stop();
  activeController = null;
}

