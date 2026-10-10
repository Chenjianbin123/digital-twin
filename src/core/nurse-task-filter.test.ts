import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesNurseTask } from './nurse-task-filter.ts';
import type { AlertTask } from './alert-workflow.ts';

const task: AlertTask = { id: 'synthetic', type: 'call', source: 'swp-call', severity: 'high', status: 'pending',
  roomIndex: 0, roomCode: 'R11', roomName: '11房', bedCode: 'B208', bedName: '208床', patientName: '隐私测试姓名',
  title: '患者呼叫', description: '不作为搜索来源', actionText: '定位' };

test('searches only room/bed names and codes with combined terms, without mutating tasks', () => {
  assert.equal(matchesNurseTask(task, '  r11 208 ', 'all'), true);
  assert.equal(matchesNurseTask(task, '12房', 'all'), false);
  assert.equal(matchesNurseTask(task, '隐私测试姓名', 'all'), false);
  assert.equal(matchesNurseTask(task, '不作为搜索来源', 'all'), false);
  assert.equal(task.status, 'pending');
});

test('separates current backend pending from retained and other-source tasks, including local confirmation', () => {
  assert.equal(matchesNurseTask({ ...task, status: 'handling' }, '', 'pending'), true);
  assert.equal(matchesNurseTask({ ...task, retained: true }, '', 'pending'), false);
  assert.equal(matchesNurseTask({ ...task, retained: true }, '', 'retained'), true);
  assert.equal(matchesNurseTask(task, '', 'retained'), false);
  assert.equal(matchesNurseTask({ ...task, source: undefined }, '', 'pending'), false);
  assert.equal(matchesNurseTask({ ...task, source: 'swp-inspection' }, '', 'pending'), false);
});
