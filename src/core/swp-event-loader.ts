import { belongsToArea, normalizeSwpEvents, readSwpEventStatus } from './swp-event-normalizer.ts';
import { pageCoverageLabel } from './swp-page-coverage.ts';
import type { SwpEventSnapshot } from './swp-event-polling-controller.ts';
import type {
  SwpAlarmRecord,
  SwpCallRecord,
  SwpRecordPage,
} from '../types/swp-events.ts';
import type { TwinAreaEntity } from '../types/twin.ts';

interface SwpEventLoaderDependencies {
  fetchCalls: (areaId: number) => Promise<SwpRecordPage<SwpCallRecord>>;
  fetchAlarms: (areaId: number) => Promise<SwpRecordPage<SwpAlarmRecord>>;
  fetchProcessedCalls?: (areaId: number, pageNum: number) => Promise<SwpRecordPage<SwpCallRecord>>;
  fetchProcessedAlarms?: (areaId: number, pageNum: number) => Promise<SwpRecordPage<SwpAlarmRecord>>;
}

export function createSwpEventSnapshotLoader(dependencies: SwpEventLoaderDependencies) {
  let reconciliation = { areaId: -1, calls: 1, alarms: 1 };
  let requestGeneration = 0;
  return async (areaId: number, area: TwinAreaEntity): Promise<SwpEventSnapshot> => {
    const generation = ++requestGeneration;
    if (reconciliation.areaId !== areaId) reconciliation = { areaId, calls: 1, alarms: 1 };
    const cursor = reconciliation;
    const requestedPages = { calls: cursor.calls, alarms: cursor.alarms };
    const [callsResult, alarmsResult, processedCallsResult, processedAlarmsResult] = await Promise.allSettled([
      dependencies.fetchCalls(areaId),
      dependencies.fetchAlarms(areaId),
      dependencies.fetchProcessedCalls?.(areaId, requestedPages.calls),
      dependencies.fetchProcessedAlarms?.(areaId, requestedPages.alarms),
    ]);
    const warnings: string[] = [];
    if (callsResult.status === 'rejected') {
      warnings.push(`未处理呼叫同步失败：${callsResult.reason instanceof Error ? callsResult.reason.message : '未知错误'}`);
    }
    if (alarmsResult.status === 'rejected') {
      warnings.push(`输液报警同步失败：${alarmsResult.reason instanceof Error ? alarmsResult.reason.message : '未知错误'}`);
    }
    if (callsResult.status === 'rejected' && alarmsResult.status === 'rejected')
      throw new Error(`SWP 未处理事件同步失败：${warnings.join('；')}`);

    const calls = callsResult.status === 'fulfilled' ? callsResult.value.records : [];
    const alarms = alarmsResult.status === 'fulfilled' ? alarmsResult.value.records : [];
    const processedCalls = processedCallsResult.status === 'fulfilled' ? processedCallsResult.value?.records ?? [] : [];
    const processedAlarms = processedAlarmsResult.status === 'fulfilled' ? processedAlarmsResult.value?.records ?? [] : [];
    for (const [key, label, result] of [['calls', '呼叫', processedCallsResult], ['alarms', '输液报警', processedAlarmsResult]] as const) {
      if (result.status === 'rejected') warnings.push(`${label}已处理状态对账失败；未确认记录保留待复核`);
      else if (result.value) {
        const { coverage } = result.value;
        const pages = coverage.pages ?? (coverage.total != null && coverage.size ? Math.ceil(coverage.total / coverage.size) : null);
        const pageMatches = coverage.current === requestedPages[key];
        if (!pageMatches) warnings.push(`${label}已处理对账页码不符，下次重新核对第一页`);
        else if (!coverage.complete)
          warnings.push(`${label}已处理对账第 ${coverage.current} / ${pages ?? '未知'} 页，每次最多 200 条；后续轮询继续翻页，未命中记录保留待复核`);
        // One bounded page per refresh, cycling through history rather than re-fetching only page one.
        // A response from an obsolete ward cannot advance the current ward's cursor.
        if (reconciliation === cursor && generation === requestGeneration)
          cursor[key] = pageMatches && pages != null && requestedPages[key] < pages ? requestedPages[key] + 1 : 1;
      }
    }
    const foreignCalls = calls.filter(record => !belongsToArea(record.areaId, areaId)).length;
    const foreignAlarms = alarms.filter(record => !belongsToArea(record.areaId, areaId)).length;
    if (foreignCalls) warnings.push(`呼叫返回 ${foreignCalls} 条其他病区记录，本次不能用于确认队列完整性`);
    if (foreignAlarms) warnings.push(`输液报警返回 ${foreignAlarms} 条其他病区记录，本次不能用于确认队列完整性`);
    const unknownCalls = calls.filter(record => readSwpEventStatus(record.eventStatus) === null).length;
    const unknownAlarms = alarms.filter(record => readSwpEventStatus(record.eventStatus) === null).length;
    if (unknownCalls) warnings.push(`呼叫有 ${unknownCalls} 条处理状态缺失或未知，未计入新增待办，请核对来源系统`);
    if (unknownAlarms) warnings.push(`输液报警有 ${unknownAlarms} 条处理状态缺失或未知，未计入新增待办，请核对来源系统`);

    const coverage = [
      ...(callsResult.status === 'fulfilled' ? [{ ...callsResult.value.coverage, label: '未处理呼叫' }] : []),
      ...(alarmsResult.status === 'fulfilled' ? [{ ...alarmsResult.value.coverage, label: '输液报警' }] : []),
    ];
    for (const item of coverage) if (!item.complete) warnings.push(pageCoverageLabel(item.label, item));

    const snapshot: SwpEventSnapshot = {
      events: normalizeSwpEvents({
        areaId,
        area,
        calls,
        alarms,
      }),
      // Explicitly processed records can leave the queue even on a partial page.
      resolvedEventIds: normalizeSwpEvents({ areaId, area, calls: [...calls, ...processedCalls], alarms: [...alarms, ...processedAlarms], eventStatus: '1' }).map(event => event.id),
      refreshedSources: [
        ...(callsResult.status === 'fulfilled' && callsResult.value.coverage.complete && !unknownCalls && !foreignCalls ? ['swp-call' as const] : []),
        ...(alarmsResult.status === 'fulfilled' && alarmsResult.value.coverage.complete && !unknownAlarms && !foreignAlarms ? ['swp-alarm' as const] : []),
      ],
      coverage,
      warning: warnings.join('；') || undefined,
    };
    return snapshot;
  };
}
