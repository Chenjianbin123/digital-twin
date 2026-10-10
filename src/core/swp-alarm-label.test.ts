import assert from 'node:assert/strict';
import test from 'node:test';
import { swpAlarmLabel } from './swp-alarm-label.ts';
import { normalizeSwpEvents } from './swp-event-normalizer.ts';

test('uses all seven confirmed dictionary names for numeric and string codes', () => {
  const labels = ['低电量报警', '输液即将完成', '输液完成', '输液事件结束', '异常离线报警', '滴速过慢', '滴速过快'];
  [9, 301, 302, 303, 304, 305, 306].forEach((code, index) => {
    assert.equal(swpAlarmLabel(code), labels[index]);
    assert.equal(swpAlarmLabel(` ${code} `), labels[index]);
  });
  assert.equal(swpAlarmLabel('其他报警'), '其他报警');
  assert.equal(swpAlarmLabel(999), '输液报警');
  assert.equal(swpAlarmLabel(undefined), '输液报警');
});

test('alarm name never changes backend event status and unknown codes remain visible', () => {
  const events = normalizeSwpEvents({ areaId: 8, area: { areaName: '合成病区', areaCode: 'T', deptName: '测试', rooms: [] }, calls: [], alarms: [
    { id: 1, areaId: 8, alarmType: '303', eventStatus: '0' },
    { id: 2, areaId: 8, alarmType: '304', eventStatus: '1' },
    { id: 3, areaId: 8, alarmType: '999', eventStatus: '0' },
  ] });
  assert.equal(events.length, 2);
  assert.ok(events.some(item => item.title === '输液事件结束'));
  assert.ok(events.some(item => item.description.includes('报警代码 999')));
});
