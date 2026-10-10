import type { AlertTask } from './alert-workflow.ts';
import type { AlertAckRecordMap } from './alert-ack.ts';

export type AlertTaskFilter = 'active' | 'confirmed' | 'handling' | 'all';

export function alertProgress(task: AlertTask, records: AlertAckRecordMap = {}): Exclude<AlertTaskFilter, 'all'> {
  if (task.status !== 'handling') return 'active';
  const record = records[task.id];
  const sourceManaged = task.source === 'swp-inspection'
    || (task.source === 'swp-call' && (task.type === 'call' || task.type === 'vital'));
  return !sourceManaged && record?.syncState === 'synced' && record.eventStartedAt === task.startedAt
    ? 'handling' : 'confirmed';
}
