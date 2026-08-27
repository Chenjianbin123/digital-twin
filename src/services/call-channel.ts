export interface CallMessage {
  bedCode: string;
  calling: boolean;
}

export type CallMessageHandler = (payload: CallMessage) => void;

/** 模拟床位呼叫推送（对齐门口机 do_info / 呼叫事件） */
const CALL_SCENARIOS: CallMessage[] = [
  { bedCode: '90102', calling: true },
  { bedCode: '90102', calling: false },
  { bedCode: '90308', calling: true },
  { bedCode: '90308', calling: false },
  { bedCode: '90412', calling: true },
  { bedCode: '90412', calling: false },
  { bedCode: '90206', calling: true },
  { bedCode: '90206', calling: false },
];

let handlers = new Set<CallMessageHandler>();
let timer: ReturnType<typeof setInterval> | null = null;
let scenarioIndex = 0;

function tick() {
  const payload = CALL_SCENARIOS[scenarioIndex % CALL_SCENARIOS.length];
  scenarioIndex++;
  handlers.forEach(h => h(payload));
}

export function subscribeCallChannel(handler: CallMessageHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function startCallChannel(intervalMs = 6000) {
  stopCallChannel();
  timer = setInterval(tick, intervalMs);
}

export function stopCallChannel() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function isCallChannelRunning() {
  return timer !== null;
}
