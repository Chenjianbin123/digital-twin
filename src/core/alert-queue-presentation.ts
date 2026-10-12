import type { DataStatus } from './data-status.ts';
import type { AlertTaskFilter } from './alert-progress.ts';

export function buildAlertQueuePresentation(input: {
  status: DataStatus;
  supported: boolean;
  taskCount: number;
  filter: AlertTaskFilter;
  categoryFiltered: boolean;
}) {
  const labels: Record<DataStatus, string> = {
    loading: '告警信息更新中', error: '告警信息暂未更新',
    stale: '告警信息更新延迟', warning: '告警记录不完整', ready: '',
  };
  const notice = !input.supported ? '暂无法查看告警记录' : labels[input.status];
  const detail = notice
    ? `${input.taskCount ? '当前列表可能不完整，' : ''}请结合呼叫设备和现场情况确认是否仍有待办。`
    : '仅显示当前记录，请结合现场情况确认。';
  const emptyTitle = notice || (input.taskCount > 0 || input.categoryFiltered
    ? '当前筛选下暂无事项'
    : input.filter === 'handling' ? '暂无已提交的处理记录'
      : input.filter === 'confirmed' ? '暂无本工作台已确认关注的事项' : '当前记录中暂无待办');
  return { notice, detail, emptyTitle, countsKnown: input.supported && (input.status === 'ready' || input.taskCount > 0) };
}
