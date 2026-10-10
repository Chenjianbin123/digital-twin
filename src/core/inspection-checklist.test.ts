import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInspectionChecklist } from './inspection-checklist.ts';

test('exports only allowlisted diagnostics and declares incomplete scope', () => {
  const association = { received: 73, matched: 12, unmatched: 61, omittedIssueCount: 2,
    issues: [{ roomName: '11房', bedName: '208床', reason: '房床不一致', count: 59,
      currentBeds: ['007床', '206'], otherRooms: ['其他房'], sickName: '禁止导出姓名', carNo: '禁止导出卡号', doorUserRealname: '禁止导出巡视人' }] };
  const output = buildInspectionChecklist({ areaName: '合成病区', syncedAt: null, association });
  assert.ok(output.startsWith('\uFEFF'));
  assert.match(output, /当前可见 1 组；另有 2 条未展开/);
  assert.match(output, /007床、206/);
  assert.match(output, /尚无成功同步记录/);
  assert.doesNotMatch(output, /禁止导出/);
});

test('quotes CSV delimiters and neutralizes formula prefixes including leading whitespace', () => {
  const output = buildInspectionChecklist({ areaName: '=1+1', syncedAt: '2026-09-30', association: {
    received: 1, matched: 0, unmatched: 1, issues: [{ roomName: ' +SUM(1,2)', bedName: '@bad', reason: '包含"引号",逗号\n换行' }],
  } });
  assert.ok(output.includes('"\'=1+1"'));
  assert.ok(output.includes('"\' +SUM(1,2)"'));
  assert.ok(output.includes('"\'@bad"'));
  assert.ok(output.includes('"包含""引号"",逗号\n换行"'));
});
