import { normalizeSwpEvents } from './swp-event-normalizer.ts';
import type { SwpEventSnapshot } from './swp-event-polling-controller.ts';
import type {
  SwpAlarmRecord,
  SwpCallRecord,
} from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

interface SwpEventLoaderDependencies {
  fetchCalls: (areaId: number) => Promise<SwpCallRecord[]>;
  fetchAlarms: (areaId: number) => Promise<SwpAlarmRecord[]>;
}

export function createSwpEventSnapshotLoader(dependencies: SwpEventLoaderDependencies) {
  return async (areaId: number, area: TwinAreaEntity): Promise<SwpEventSnapshot> => {
    const [callsResult, alarmsResult] = await Promise.allSettled([
      dependencies.fetchCalls(areaId),
      dependencies.fetchAlarms(areaId),
    ]);
    const warnings: string[] = [];
    if (callsResult.status === 'rejected') {
      warnings.push(`活动呼叫同步失败：${callsResult.reason instanceof Error ? callsResult.reason.message : '未知错误'}`);
    }
    if (alarmsResult.status === 'rejected') {
      warnings.push(`输液报警同步失败：${alarmsResult.reason instanceof Error ? alarmsResult.reason.message : '未知错误'}`);
    }
    if (callsResult.status === 'rejected' && alarmsResult.status === 'rejected')
      throw new Error(`SWP 活动事件同步失败：${warnings.join('；')}`);

    const snapshot: SwpEventSnapshot = {
      events: normalizeSwpEvents({
        areaId,
        area,
        calls: callsResult.status === 'fulfilled' ? callsResult.value : [],
        alarms: alarmsResult.status === 'fulfilled' ? alarmsResult.value : [],
      }),
      refreshedSources: [
        ...(callsResult.status === 'fulfilled' ? ['swp-call' as const] : []),
        ...(alarmsResult.status === 'fulfilled' ? ['swp-alarm' as const] : []),
      ],
      warning: warnings.join('；') || undefined,
    };
    return snapshot;
  };
}
