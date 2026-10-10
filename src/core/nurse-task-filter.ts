import type { AlertTask } from './alert-workflow.ts';

export type TaskEvidenceFilter = 'all' | 'pending' | 'retained';

export function matchesNurseTask(task: AlertTask, query: string, evidence: TaskEvidenceFilter): boolean {
  if (evidence === 'retained' && !task.retained) return false;
  if (evidence === 'pending' && (task.retained || !['swp-call', 'swp-alarm'].includes(task.source ?? ''))) return false;
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const location = [task.roomName, task.roomCode, task.bedName, task.bedCode].filter(Boolean).join(' ').toLocaleLowerCase();
  return terms.every(term => location.includes(term));
}
