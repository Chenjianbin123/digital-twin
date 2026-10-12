import assert from 'node:assert/strict';
import test from 'node:test';
import { assistantTargets, buildAssistantDemoReply, resolveAssistantTarget } from './ai-assistant-demo.ts';
import type { TwinAreaEntity } from '../types/twin';

const area: TwinAreaEntity = {
  areaCode: 'A', areaName: '测试病区', deptName: '测试科室',
  rooms: ['R1', 'R2'].map(code => ({ sickroomCode: code, sickroomId: code, sickroomName: code,
    deviceCode: '', beds: [{ bedCode: 'B1', bedName: '01床', deviceCode: '', isOnline: true,
      isOccupied: false, position: { x: 0, z: 0 } }] })),
};
test('assistant includes empty beds and resolves reused bed codes within their exact room', () => {
  const targets = assistantTargets(area, 'scope-A');
  assert.equal(targets.length, 2);
  assert.equal(resolveAssistantTarget(area, 'scope-A', targets[1]!)?.roomIndex, 1);
});
test('assistant rejects stale scope, missing beds and ambiguous bindings', () => {
  const target = assistantTargets(area, 'scope-A')[0]!;
  assert.equal(resolveAssistantTarget(area, 'scope-B', target), null);
  assert.equal(resolveAssistantTarget({ ...area, rooms: [] }, 'scope-A', target), null);
  assert.equal(resolveAssistantTarget({ ...area, rooms: [area.rooms[0]!, area.rooms[0]!] }, 'scope-A', target), null);
});
test('demo calls disclose simulated status and search does not fabricate targets', () => {
  const targets = assistantTargets(area, 'scope-A');
  const calls = buildAssistantDemoReply('查看未处理呼叫', targets);
  assert.match(calls.text, /不代表/);
  assert.deepEqual(calls.targets, targets);
  assert.equal(buildAssistantDemoReply('查找 R2', targets).targets[0]?.roomCode, 'R2');
  assert.deepEqual(buildAssistantDemoReply('查找 不存在的床位', targets).targets, []);
  assert.deepEqual(buildAssistantDemoReply('查找床位', []).targets, []);
});
