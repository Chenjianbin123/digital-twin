import type { AlertTask } from './alert-workflow.ts';
/** Only use a structured location when it has actually matched the scene. */
export function taskDisplayTitle(task: AlertTask): string {
  if (task.canLocate !== false && task.roomName?.trim()) {
    return [task.roomName.trim(), task.bedName?.trim()].filter(Boolean).join(' · ');
  }
  return task.type === 'call' && task.source === 'swp-call' ? '患者呼叫' : task.title;
}
export function taskPriorityLabel(task: AlertTask): string {
  return task.severity === 'critical' ? '高优先级' : task.severity === 'high' ? '需关注' : '提示';
}
