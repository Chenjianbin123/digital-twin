import type { StatusBarInfo } from '@/types/ward';
import { MOCK_DOOR_DEVICE_LIST } from '../mock/door-device-list.ts';

export type StatusMessageHandler = (payload: StatusBarInfo) => void;

/** 模拟 WebSocket 推送通道（对齐 JSBridge.setBedDeviceStatus 事件驱动） */
const PUSH_SCENARIOS: StatusBarInfo[] = MOCK_DOOR_DEVICE_LIST.data.flatMap(room =>
  room.bedDeviceList.filter(bed => room.doorSickInfoList.some(patient => patient.bedCode === bed.bedCode))
    .flatMap(bed => (['300', '302', '304', ''] as const).map(status => ({
      bedCode: bed.bedCode, deviceCode: bed.deviceCode, status,
    }))));

let handlers = new Set<StatusMessageHandler>();
let timer: ReturnType<typeof setInterval> | null = null;
let scenarioIndex = 0;

function tick() {
  const payload = PUSH_SCENARIOS[scenarioIndex % PUSH_SCENARIOS.length];
  scenarioIndex++;
  if (!payload?.bedCode)
    return;
  const message = payload as StatusBarInfo;
  handlers.forEach(h => h(message));
}

export function subscribeStatusChannel(handler: StatusMessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function startStatusChannel(intervalMs = 3500) {
  stopStatusChannel();
  scenarioIndex = 0;
  timer = setInterval(tick, intervalMs);
}

export function stopStatusChannel() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function isStatusChannelRunning() {
  return timer !== null;
}

export function getChannelScenarioCount() {
  return PUSH_SCENARIOS.length;
}
