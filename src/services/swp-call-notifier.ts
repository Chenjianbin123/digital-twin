import { createSwpCallNotifier } from '@/core/swp-call-notifier';
import { runtimeStorageKey } from '@/core/runtime-config';
import { createCallReminderDelivery } from '@/core/call-reminder-delivery';
import { reactive, readonly } from 'vue';
import type { NormalizedSwpEvent } from '@/types/swp-events';

export const SWP_CALL_ALERTS_STORAGE_KEY = 'ward-digital-twin:swp-call-alerts-enabled';

const feedback = reactive({ busy: false, sound: '尚未试听', notification: '未检查权限', delivery: '尚未尝试事件提醒', coordination: '等待检查跨页面去重能力' });
let latestEvents: NormalizedSwpEvent[] = [];
let deliveryGeneration = 0;
export const callReminderFeedback = readonly(feedback);

export function refreshCallNotificationPermission() {
  feedback.notification = !isBrowser() || !('Notification' in window)
    ? '浏览器不支持'
    : ({ granted: '已授权', denied: '已阻止，请在浏览器设置中允许', default: '未授权' })[Notification.permission];
}

export async function requestCallNotificationPermission() {
  try {
    if (isBrowser() && 'Notification' in window && Notification.permission === 'default')
      await Notification.requestPermission();
    refreshCallNotificationPermission();
  }
  catch {
    feedback.notification = '授权失败，请检查浏览器设置';
  }
}

export async function testCallSound(shouldPlay: () => boolean = () => true) {
  try {
    await playCallTone(shouldPlay);
    feedback.sound = '已尝试播放，请确认设备音量';
    return true;
  }
  catch {
    feedback.sound = '播放失败或不支持，请检查浏览器及设备';
    return false;
  }
}

function isBrowser() {
  return typeof window !== 'undefined';
}

export function loadSwpCallAlertsEnabled() {
  return false;
}

export function setSwpCallAlertsEnabled(_enabled: boolean) {
  try {
    if (isBrowser()) window.localStorage.setItem(SWP_CALL_ALERTS_STORAGE_KEY, 'false');
  }
  catch { feedback.coordination = '浏览器禁止本地存储，设置仅当前页面有效'; }
}

async function playCallTone(shouldPlay: () => boolean) {
  if (!isBrowser())
    throw new Error('Audio unavailable');
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor)
    throw new Error('Audio unavailable');
  const context = new AudioContextConstructor();
  try {
    if (context.state === 'suspended') {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([context.resume(), new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error('Audio resume timed out')), 4000);
        })]);
      }
      finally { clearTimeout(timeout); }
    }
    if (!shouldPlay()) throw new Error('Reminder scope changed');
    if (context.state !== 'running')
      throw new Error('Audio blocked');
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.65);
    gain.connect(context.destination);
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, context.currentTime);
    oscillator.frequency.setValueAtTime(660, context.currentTime + 0.28);
    oscillator.connect(gain);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.68);
  }
  finally {
    window.setTimeout(() => { void context.close().catch(() => {}); }, 800);
  }
}

async function showSystemNotification(events: NormalizedSwpEvent[]) {
  if (!isBrowser() || !('Notification' in window) || Notification.permission !== 'granted')
    throw new Error('Notification unavailable');
  const first = events[0];
  const extra = events.length > 1 ? `，另有 ${events.length - 1} 条` : '';
  new Notification('智慧护士站收到患者呼叫', {
    body: `${first.locationLabel}：${first.description}${extra}`,
    tag: `swp-call-${first.id}`,
  });
}

function createChannel(channel: 'sound' | 'notification', send: (events: NormalizedSwpEvent[]) => Promise<void>) {
  const key = runtimeStorageKey(`ward-digital-twin:call-delivery:${channel}`);
  let fallback: unknown = [];
  return createCallReminderDelivery({
    read() {
      try {
        const shared = JSON.parse(window.localStorage.getItem(key) ?? '[]');
        return [...(Array.isArray(fallback) ? fallback : []), ...(Array.isArray(shared) ? shared : [])];
      }
      catch { feedback.coordination = '存储不可用，仅当前页面去重'; return fallback; }
    },
    write(receipts) {
      fallback = receipts;
      try { window.localStorage.setItem(key, JSON.stringify(receipts)); }
      catch { feedback.coordination = '存储不可用，仅当前页面去重'; }
    },
    async lock(run) {
      if (isBrowser() && navigator.locks) {
        feedback.coordination = '同源页面共享去重（24 小时内，最多 4000 条）';
        await navigator.locks.request(key, run);
      }
      else {
        feedback.coordination = '浏览器不支持跨页面锁，请只启用一个提醒页面';
        await run();
      }
    },
    async send(events) {
      if (!loadSwpCallAlertsEnabled() || !events.some(event => latestEvents.includes(event)))
        throw new Error('Reminder scope changed');
      await send(events);
    },
  });
}

const deliverSound = createChannel('sound', async () => {
  const generation = deliveryGeneration;
  if (!await testCallSound(() => generation === deliveryGeneration && loadSwpCallAlertsEnabled())) throw new Error('Sound delivery failed');
});
const deliverNotification = createChannel('notification', showSystemNotification);

const notifier = createSwpCallNotifier({
  isEnabled: loadSwpCallAlertsEnabled,
  async alert(events) {
    const generation = deliveryGeneration;
    refreshCallNotificationPermission();
    const results = await Promise.allSettled([
      deliverSound(events),
      deliverNotification(events),
    ]);
    if (generation !== deliveryGeneration) throw new Error('Reminder scope changed');
    const failures = results.filter(result => result.status === 'rejected').length;
    feedback.delivery = failures ? `${failures} 个提醒通道未成功，将随轮询重试（最多 3 次）；可检查后手动重试` : '提醒请求已提交；实际声音和系统通知仍需现场确认';
    if (failures) throw new Error('Reminder delivery incomplete');
  },
});

export async function enableSwpCallAlerts() {
  disableSwpCallAlerts();
}

export function disableSwpCallAlerts() {
  setSwpCallAlertsEnabled(false);
  resetSwpCallNotifier();
}

export function notifyNewSwpCalls(events: NormalizedSwpEvent[]) {
  latestEvents = events;
  return notifier.process(events);
}

export async function retryFailedCallReminders() {
  notifier.retryFailed();
  await notifier.process(latestEvents);
}

export function resetSwpCallNotifier() {
  deliveryGeneration += 1;
  latestEvents = [];
  notifier.reset();
  feedback.delivery = '尚未尝试事件提醒';
}
