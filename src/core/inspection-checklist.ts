import type { InspectionAssociation } from '../types/inspection.ts';

// Allowlisted location diagnostics only; never serialize the original patient/inspection records.
export function buildInspectionChecklist(input: {
  areaName: string;
  syncedAt: string | null;
  association: InspectionAssociation;
}): string {
  const { association } = input;
  const rows: unknown[][] = [
    ['巡视房床关联核对清单'],
    ['病区', input.areaName],
    ['数据同步时间', input.syncedAt || '尚无成功同步记录'],
    ['本次返回', association.received, '已关联', association.matched, '未关联', association.unmatched],
    ['导出范围', `当前可见 ${association.issues.length} 组；另有 ${association.omittedIssueCount ?? 0} 条未展开，不代表完整后台记录`],
    ['说明', '仅供核对，不自动修改房床归属；未关联不代表已巡视。'],
    ['病房', '床位', '记录数', '关联失败原因', '该房当前床位', '其他同名床所在病房'],
    ...association.issues.map(issue => [issue.roomName, issue.bedName, issue.count ?? 1, issue.reason,
      issue.currentBeds?.join('、') ?? '', issue.otherRooms?.join('、') ?? '']),
  ];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: unknown): string {
  let text = String(value ?? '');
  // Quoting alone does not prevent spreadsheet formula execution.
  if (/^[\s\uFEFF]*[=+@-]/u.test(text) || /^[\t\r\n]/u.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}
