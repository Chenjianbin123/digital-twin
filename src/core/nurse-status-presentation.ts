import type { NurseStationViewModel } from './nurse-station-view-model.ts';
import type { DataStatus } from './data-status.ts';
import { NURSING_STATUS_LABELS, nursingInformationNotice } from './nursing-copy.ts';

export const SYNC_STATUS_LABELS: Record<DataStatus, string> = NURSING_STATUS_LABELS;

export function buildNurseStatusPresentation(vm: NurseStationViewModel, wardWarnings: readonly string[] = []) {
  const syncs = { events: vm.swpEventSync, response: vm.swpResponseSync, inspection: vm.inspectionSync };
  return {
    eventLabel: vm.metrics.vitalWarnings > 0 ? '有体征预警，需关注'
      : vm.metrics.calling > 0 ? '有患者呼叫，待处理' : vm.state.label,
    sources: vm.dataFreshnessItems.map(item => {
      const sync = item.key === 'ward' ? null : syncs[item.key];
      const reasons = item.key === 'ward' ? wardWarnings : [sync?.error, sync?.warning].filter((value): value is string => Boolean(value));
      return { ...item, coverage: sync?.coverage ?? [], statusLabel: SYNC_STATUS_LABELS[item.status], notice: nursingInformationNotice(item.status, item.syncedAt), reasons: item.status === 'ready' ? [] : [...new Set(reasons)] };
    }),
  };
}
