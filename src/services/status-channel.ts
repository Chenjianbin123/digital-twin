import type { StatusBarInfo } from '@/types/ward';

export type StatusMessageHandler = (payload: StatusBarInfo) => void;

/** 模拟 WebSocket 推送通道（对齐 JSBridge.setBedDeviceStatus 事件驱动） */
const PUSH_SCENARIOS: Partial<StatusBarInfo>[] = [
  { bedCode: '90101', deviceCode: 'SN1001', status: '300' },
  { bedCode: '90101', deviceCode: 'SN1001', status: '302' },
  { bedCode: '90102', deviceCode: 'SN1002', status: '300' },
  { bedCode: '90102', deviceCode: 'SN1002', status: '302' },
  { bedCode: '90103', deviceCode: 'SN1003', status: '' },
  { bedCode: '90104', deviceCode: 'SN1004', status: '304' },
  { bedCode: '90104', deviceCode: 'SN1004', status: '9' },
  { bedCode: '90205', deviceCode: 'SN1005', status: '300' },
  { bedCode: '90206', deviceCode: 'SN1006', status: '302' },
  { bedCode: '90307', deviceCode: 'SN1007', status: '300' },
  { bedCode: '90308', deviceCode: 'SN1008', status: '' },
  { bedCode: '90309', deviceCode: 'SN1009', status: '304' },
  { bedCode: '90410', deviceCode: 'SN1010', status: '300' },
  { bedCode: '90411', deviceCode: 'SN1011', status: '302' },
  { bedCode: '90412', deviceCode: 'SN1012', status: '9' },
];

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
