import { createSwpCallNotifier } from '@/core/swp-call-notifier';
import type { NormalizedSwpEvent } from '@/types/swp-events';

export const SWP_CALL_ALERTS_STORAGE_KEY = 'ward-digital-twin:swp-call-alerts-enabled';

function isBrowser() {
  return typeof window !== 'undefined';
}

export function loadSwpCallAlertsEnabled() {
  if (!isBrowser())
    return false;
  return window.localStorage.getItem(SWP_CALL_ALERTS_STORAGE_KEY) === 'true';
}

export function setSwpCallAlertsEnabled(enabled: boolean) {
  if (isBrowser())
    window.localStorage.setItem(SWP_CALL_ALERTS_STORAGE_KEY, String(enabled));
}

async function playCallTone() {
  if (!isBrowser())
    return;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor)
    return;
  const context = new AudioContextConstructor();
  try {
    if (context.state === 'suspended')
      await context.resume();
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
    window.setTimeout(() => { void context.close(); }, 800);
  }
}

async function showSystemNotification(events: NormalizedSwpEvent[]) {
  if (!isBrowser() || !('Notification' in window) || Notification.permission !== 'granted')
    return;
  const first = events[0];
  const extra = events.length > 1 ? `，另有 ${events.length - 1} 条` : '';
  new Notification('智慧护士站收到患者呼叫', {
    body: `${first.locationLabel}：${first.description}${extra}`,
    tag: `swp-call-${first.id}`,
  });
}

const notifier = createSwpCallNotifier({
  isEnabled: loadSwpCallAlertsEnabled,
  async alert(events) {
    await Promise.allSettled([
      playCallTone(),
      showSystemNotification(events),
    ]);
  },
});

export async function enableSwpCallAlerts() {
  setSwpCallAlertsEnabled(true);
  await playCallTone();
  if (isBrowser() && 'Notification' in window && Notification.permission === 'default')
    await Notification.requestPermission();
}

export function disableSwpCallAlerts() {
  setSwpCallAlertsEnabled(false);
}

export function notifyNewSwpCalls(events: NormalizedSwpEvent[]) {
  return notifier.process(events);
}

export function resetSwpCallNotifier() {
  notifier.reset();
}
