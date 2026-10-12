// Confirmed alarm_call_mode dictionary snapshot supplied by the integration owner.
// Keep display names separate from eventStatus (0 pending, 1 processed).
const alarmNames: Readonly<Record<string, string>> = Object.freeze({
  '9': '低电量报警',
  '301': '输液即将完成',
  '302': '输液完成',
  '303': '输液事件结束',
  '304': '异常离线报警',
  '305': '滴速过慢',
  '306': '滴速过快',
});

export function swpAlarmLabel(value: unknown): string {
  const code = String(value ?? '').trim();
  return alarmNames[code] ?? (code && !/^\d+$/.test(code) ? code : '输液报警');
}
