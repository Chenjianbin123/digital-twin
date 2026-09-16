import test from 'node:test';
import assert from 'node:assert/strict';
import { taskDisplayTitle, taskPriorityLabel } from './task-presentation.ts';
import type { AlertTask } from './alert-workflow.ts';
const task: AlertTask = { id: 'a', type: 'call', severity: 'critical', status: 'pending', roomIndex: 0, roomName: 'A101', roomCode: '101', bedName: 'A03床', title: '正常呼叫', description: '原始设备描述', actionText: '定位', source: 'swp-call', canLocate: true };
test('matched task promotes its structured location', () => {
 assert.equal(taskDisplayTitle(task), 'A101 · A03床');
 assert.equal(taskPriorityLabel(task), '高优先级');
 assert.equal(task.title, '正常呼叫');
});
test('unmatched event does not present a guessed room as its location', () => {
 assert.equal(taskDisplayTitle({...task, canLocate:false}), '患者呼叫');
 assert.equal(taskDisplayTitle({...task, roomName:'', canLocate:false, type:'vital', title:'心率预警'}), '心率预警');
 assert.equal(taskDisplayTitle({...task, bedName:undefined}), 'A101');
});
