import { API_FAILURE_INFO, type ApiFailureKind } from './api-failure.ts';

export interface SafeApiRequestRecord {
  path: string;
  startedAt: string;
  durationMs: number;
  status?: number;
  businessCode?: number;
  ok: boolean;
  kind?: ApiFailureKind;
  error?: string;
}

// Only static endpoint names are exported. Unknown/dynamic paths, query strings and hosts are never retained.
const SAFE_PATHS = [
  'system/sysUser/login', 'system/sysUser/roleConfirm',
  'swp/swpCallInfo/querySwpCallInfo', 'swp/swpCallInfo/queryCallEventResponseTimeliness',
  'swp/swpAlarmInfo/querySwpAlarmInfo', 'swp/swpSwipeInspectionRecord/querySwpSwipeInspectionRecord',
  'swp/swpDeviceInfo/querySwpDeviceInfo', 'swp/swpTemplateInfo/querySwpTemplateInfoById',
  'device/commonDevice/queryHospHospitalInfo', 'hosp/hospAreaInfo/queryHospAreaInfo',
  'device/bedDevice/queryBaseDeviceInfo', 'device/doorDevice/queryBaseDeviceInfo',
  'iot/app/deviceIotControl/queryRecentEnvRecordById',
];
export function safeApiPath(url: string): string {
  try {
    const path = new URL(url, 'http://local.invalid').pathname;
    const known = SAFE_PATHS.find(item => path.endsWith(`/${item}`));
    return known ? `/${known}` : '/[其他接口]';
  }
  catch { return '/[其他接口]'; }
}

export function sanitizeApiRecord(record: SafeApiRequestRecord): SafeApiRequestRecord {
  const kind = record.kind && Object.hasOwnProperty.call(API_FAILURE_INFO, record.kind) ? record.kind : undefined;
  const timestamp = Date.parse(record.startedAt);
  return {
    path: safeApiPath(record.path),
    startedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '',
    durationMs: Number.isFinite(record.durationMs) ? Math.max(0, Math.round(record.durationMs)) : 0,
    status: Number.isInteger(record.status) && record.status! >= 100 && record.status! <= 599 ? record.status : undefined,
    businessCode: Number.isSafeInteger(record.businessCode) ? record.businessCode : undefined,
    ok: record.ok === true,
    kind,
    error: kind ? API_FAILURE_INFO[kind].title : undefined,
  };
}

export function buildApiDiagnosticReport(records: readonly SafeApiRequestRecord[], now = new Date()): string {
  return JSON.stringify({ schemaVersion: 1, exportedAt: now.toISOString(), scope: '本页公共请求层最近60次请求；不代表全系统日志',
    privacy: '仅含白名单接口路径、时间、耗时及状态码；不含地址参数、请求正文、响应正文、账号或令牌',
    records: records.slice(0, 60).map(sanitizeApiRecord) }, null, 2);
}
