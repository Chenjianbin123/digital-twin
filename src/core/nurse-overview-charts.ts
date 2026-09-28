import type { AlertTask } from './alert-workflow.ts';

/** Null means the denominator is unavailable, not zero occupancy. */
export function bedUsageRatio(occupied: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(occupied) || occupied < 0 || occupied > total)
    return null;
  return occupied / total;
}

export function pendingEventDistribution(tasks: readonly Pick<AlertTask, 'type' | 'status'>[]) {
  const counts = { call: 0, infusion: 0, other: 0 };
  for (const task of tasks) {
    if (task.status !== 'pending') continue;
    const key = task.type === 'call' || task.type === 'infusion' ? task.type : 'other';
    counts[key]++;
  }
  const maximum = Math.max(...Object.values(counts), 1);
  const rows = [
    { key: 'call', label: '患者呼叫', count: counts.call },
    { key: 'infusion', label: '输液事项', count: counts.infusion },
    { key: 'other', label: '其他事件', count: counts.other },
  ].map(row => ({ ...row, ratio: row.count / maximum }));
  return { rows, total: counts.call + counts.infusion + counts.other };
}

// 240° sweep, opening downwards. The marker and active path use the same ratio.
export function usageGaugePoint(ratio: number, radius = 78) {
  const angle = (150 + 240 * ratio) * Math.PI / 180;
  return { x: 110 + radius * Math.cos(angle), y: 108 + radius * Math.sin(angle) };
}
