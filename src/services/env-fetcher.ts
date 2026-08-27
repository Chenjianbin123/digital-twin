import { fetchDoorEnvData } from '@/api/door-device';
import type { useTwinStore } from '@/stores/twin-store';

type TwinStore = ReturnType<typeof useTwinStore>;

let timer: ReturnType<typeof setInterval> | null = null;
let runGeneration = 0;
const roomRequestSequence = new Map<string, number>();

async function refreshEnv(store: TwinStore, generation: number) {
  const areaId = store.selectedAreaId;
  const rooms = store.area?.rooms ?? [];

  await Promise.all(rooms.map(async (room) => {
    if (!room.sickroomId)
      return;
    const sickroomId = String(room.sickroomId);
    const requestSequence = (roomRequestSequence.get(sickroomId) ?? 0) + 1;
    roomRequestSequence.set(sickroomId, requestSequence);

    try {
      const env = await fetchDoorEnvData(room.sickroomId);
      if (
        generation === runGeneration
        && store.selectedAreaId === areaId
        && roomRequestSequence.get(sickroomId) === requestSequence
        && env
        && Object.keys(env).length
      )
        store.updateEnv(areaId, sickroomId, env);
    }
    catch {
      // 环境接口可能无数据，忽略
    }
  }));
}

export function startEnvFetcher(store: TwinStore, intervalMs = 30_000) {
  stopEnvFetcher();
  const generation = runGeneration;
  void refreshEnv(store, generation);
  timer = setInterval(() => refreshEnv(store, generation), intervalMs);
}

export function stopEnvFetcher() {
  runGeneration += 1;
  roomRequestSequence.clear();
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
