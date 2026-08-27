import type { useTwinStore } from '@/stores/twin-store';
import type { StatusBarInfo } from '@/types/ward';

type TwinStore = ReturnType<typeof useTwinStore>;

interface RealtimeEnvelope {
  areaId?: number | string;
  type?: 'bed-status' | 'bed-call' | 'area-refresh';
  payload?: unknown;
}

let socket: WebSocket | null = null;
let events: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let runGeneration = 0;

function getRealtimeUrl() {
  return import.meta.env.VITE_REALTIME_URL?.trim() || '';
}

function scopedRealtimeUrl(url: string, areaId: number) {
  const baseUrl = typeof window !== 'undefined' ? window.location?.href : undefined;
  const parsed = new URL(url, baseUrl || 'http://localhost');
  parsed.searchParams.set('areaId', String(areaId));
  parsed.hash = '';
  return parsed.toString();
}

function isCurrentRun(store: TwinStore, areaId: number, generation: number) {
  return generation === runGeneration && store.selectedAreaId === areaId;
}

function scheduleReconnect(store: TwinStore, areaId: number, generation: number) {
  if (!isCurrentRun(store, areaId, generation) || retryTimer)
    return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (isCurrentRun(store, areaId, generation))
      connectRealtimeChannel(store, areaId, generation);
  }, 5_000);
}

function normalizeEnvelope(raw: unknown): RealtimeEnvelope | null {
  if (!raw || typeof raw !== 'object')
    return null;
  return raw as RealtimeEnvelope;
}

function applyRealtimeMessage(store: TwinStore, areaId: number, generation: number, raw: unknown) {
  if (!isCurrentRun(store, areaId, generation))
    return;
  const envelope = normalizeEnvelope(raw);
  if (!envelope?.type || Number(envelope.areaId) !== areaId)
    return;

  if (envelope.type === 'bed-status') {
    const payload = envelope.payload as StatusBarInfo | undefined;
    if (payload?.bedCode || payload?.deviceCode)
      store.updateBedStatus(areaId, payload.bedCode, payload);
  }
  else if (envelope.type === 'bed-call') {
    const payload = envelope.payload as { bedCode?: string; calling?: boolean } | undefined;
    if (payload?.bedCode)
      store.setBedCalling(areaId, payload.bedCode, payload.calling !== false);
  }
  else if (envelope.type === 'area-refresh') {
    if (store.dataSource === 'remote')
      void store.refreshCurrentArea({ preserveScene: true, silent: true });
    else
      void store.loadArea({ preserveScene: true, silent: true });
  }
}

function parseAndApply(store: TwinStore, areaId: number, generation: number, data: string) {
  try {
    applyRealtimeMessage(store, areaId, generation, JSON.parse(data));
  }
  catch {
    // 忽略不符合约定的推送消息，避免中断通道
  }
}

function connectRealtimeChannel(store: TwinStore, areaId: number, generation: number) {
  const url = getRealtimeUrl();
  if (!url || !isCurrentRun(store, areaId, generation))
    return false;
  const scopedUrl = scopedRealtimeUrl(url, areaId);

  if (url.startsWith('ws')) {
    const currentSocket = new WebSocket(scopedUrl);
    socket = currentSocket;
    currentSocket.addEventListener('message', event => parseAndApply(store, areaId, generation, event.data));
    currentSocket.addEventListener('close', () => scheduleReconnect(store, areaId, generation));
    currentSocket.addEventListener('error', () => {
      if (isCurrentRun(store, areaId, generation))
        currentSocket.close();
    });
    return true;
  }

  const currentEvents = new EventSource(scopedUrl);
  events = currentEvents;
  currentEvents.addEventListener('message', event => parseAndApply(store, areaId, generation, event.data));
  currentEvents.addEventListener('error', () => {
    if (!isCurrentRun(store, areaId, generation))
      return;
    currentEvents.close();
    if (events === currentEvents)
      events = null;
    scheduleReconnect(store, areaId, generation);
  });
  return true;
}

export function startRealtimeChannel(store: TwinStore) {
  stopRealtimeChannel();
  const areaId = store.selectedAreaId;
  if (areaId == null)
    return false;
  const generation = runGeneration;
  return connectRealtimeChannel(store, areaId, generation);
}

export function stopRealtimeChannel() {
  runGeneration += 1;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  socket?.close();
  socket = null;
  events?.close();
  events = null;
}

export function isRealtimeChannelConfigured() {
  return !!getRealtimeUrl();
}
