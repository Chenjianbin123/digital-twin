import { analyzeEnvAlert } from '@/core/env-alert';
import type { useTwinStore } from '@/stores/twin-store';
import type { DoorEnvParams } from '@/types/ward';

type TwinStore = ReturnType<typeof useTwinStore>;

let timer: ReturnType<typeof setInterval> | null = null;
const lastAlertSummary = new Map<number, string>();

function fluctuate(value: number, range: number, min: number, max: number) {
  const next = value + (Math.random() - 0.5) * range;
  return Math.min(max, Math.max(min, next));
}

function nextEnv(current?: DoorEnvParams, roomIndex = 0): DoorEnvParams {
  const baseTemp = roomIndex >= 3 ? 27 : 24;
  const temp = fluctuate(Number(current?.temp ?? baseTemp), 0.6, 20, 32);
  const humid = fluctuate(Number.parseInt(String(current?.relativeHumid ?? '55'), 10), 3, 40, 78);
  const noise = fluctuate(Number.parseInt(String(current?.noiseLevel ?? '40'), 10), 4, 30, 58);
  const qualities = ['优', '良', '中'] as const;
  const airQuality = temp > 28.5 || humid > 66 ? '中' : qualities[Math.floor(Math.random() * 2)];

  return {
    temp: temp.toFixed(1),
    relativeHumid: `${Math.round(humid)}%`,
    airQuality,
    noiseLevel: `${Math.round(noise)}dB`,
  };
}

function checkAndRecordAlert(store: TwinStore, roomIndex: number, env: DoorEnvParams) {
  const room = store.area?.rooms[roomIndex];
  if (!room)
    return;

  const alert = analyzeEnvAlert(env);
  const prev = lastAlertSummary.get(roomIndex);

  if (alert.level !== 'normal' && alert.summary !== prev) {
    lastAlertSummary.set(roomIndex, alert.summary);
    store.pushHistory({
      category: 'env',
      bedCode: '',
      bedName: '-',
      label: alert.summary,
      roomName: room.sickroomName,
    });
  }
  else if (alert.level === 'normal') {
    lastAlertSummary.delete(roomIndex);
  }
}

export function startEnvSimulator(store: TwinStore, intervalMs = 5000) {
  stopEnvSimulator();
  timer = setInterval(() => {
    if (!store.area)
      return;

    store.area.rooms.forEach((room, index) => {
      const next = nextEnv(room.doorEnvData, index);
      store.updateEnv(store.selectedAreaId, room.sickroomId || room.deviceCode, next);
      if (index === store.currentRoomIndex)
        checkAndRecordAlert(store, index, next);
    });
  }, intervalMs);
}

export function stopEnvSimulator() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  lastAlertSummary.clear();
}
