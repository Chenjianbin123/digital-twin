import { resolveDataStatus, type DataPhase, type DataStatus } from './data-status.ts';
import type { BedDeviceIssue } from '../services/bed-device-loader';

export function resolveWardInteriorDataStatus(input: {
  phase: DataPhase;
  lastFetchedAtMs: number | null;
  nowMs: number;
  busy: boolean;
  issues: BedDeviceIssue[];
  snapshotRetained?: boolean;
}): DataStatus {
  // Global warnings may belong to other rooms; only freshness/failure is shared.
  const base = resolveDataStatus({ ...input, hasWarnings: false });
  if (base === 'error' || base === 'stale') return base;
  if (input.busy || base === 'loading') return 'loading';
  return input.issues.length || input.snapshotRetained ? 'warning' : base;
}

export function buildWardIssueSummary(issues: BedDeviceIssue[]): string {
  const key = (issue: BedDeviceIssue) => issue.bedCode || issue.bedName;
  const total = new Set(issues.map(key)).size;
  if (!total) return '';
  const unbound = new Set(issues.filter(issue => issue.kind === 'unbound').map(key)).size;
  const failed = new Set(issues.filter(issue => issue.kind === 'request-failed' || issue.kind === 'response-mismatch').map(key)).size;
  const conflicts = new Set(issues.filter(issue => issue.kind === 'occupancy-conflict').map(key)).size;
  if (!failed && !conflicts) return `本病房 ${total} 个床位未关联床头机`;
  if (!unbound && !conflicts) return `本病房 ${total} 个床位信息同步异常`;
  if (!unbound && !failed) return `本病房 ${total} 个床位入住数据需核对`;
  const details = [unbound ? `${unbound} 个未关联设备` : '', failed ? `${failed} 个同步异常` : '', conflicts ? `${conflicts} 个入住数据待核对` : ''].filter(Boolean);
  return `本病房 ${total} 个床位需关注（${details.join('，')}）`;
}
