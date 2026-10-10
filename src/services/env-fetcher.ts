import { watch } from 'vue';
import { fetchDoorEnvData } from '@/api/door-device';
import { createBrowserPollingVisibility } from '@/core/polling-visibility';
import { ENV_ROOM_POLL_MS, ENV_AREA_POLL_MS, ENV_MAX_CONCURRENT_REQUESTS } from '@/core/environment-state';
import type { useTwinStore } from '@/stores/twin-store';

type TwinStore = ReturnType<typeof useTwinStore>;

let cleanup: (() => void) | null = null;
let activeRequests = 0;
const requestQueue: Array<{
  isCurrent: () => boolean;
  run: () => Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

function drainRequests() {
  // 切场景或停止后立即移除未发出的旧任务，在途请求继续占用全局并发名额。
  for (let index = requestQueue.length - 1; index >= 0; index--) {
    if (!requestQueue[index].isCurrent())
      requestQueue.splice(index, 1)[0].resolve();
  }
  while (activeRequests < ENV_MAX_CONCURRENT_REQUESTS && requestQueue.length) {
    const request = requestQueue.shift()!;
    activeRequests++;
    void request.run().then(request.resolve, request.reject).finally(() => {
      activeRequests--;
      drainRequests();
    });
  }
}

function queueRequest(isCurrent: () => boolean, run: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    requestQueue.push({ isCurrent, run, resolve, reject });
    drainRequests();
  });
}

export function startEnvFetcher(store: TwinStore, intervalOverrideMs?: number) {
  stopEnvFetcher();
  const visibility = createBrowserPollingVisibility();
  const pending = new Set<string>();
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

  const intervalMs = () => intervalOverrideMs
    ?? (store.sceneType === 'ward-interior' ? ENV_ROOM_POLL_MS : ENV_AREA_POLL_MS);

  function targetRooms() {
    const rooms = store.area?.rooms ?? [];
    return store.sceneType === 'ward-interior'
      ? rooms.filter((_, index) => index === store.currentRoomIndex)
      : rooms;
  }

  async function refresh(force = false) {
    if (!active || !visibility.isVisible()) return;
    const areaId = store.selectedAreaId;
    await Promise.all(targetRooms().map(async (room) => {
      if (!room.sickroomId) return;
      const sickroomId = String(room.sickroomId);
      const key = JSON.stringify([areaId, sickroomId]);
      if (pending.has(key)) return;
      if (!force && !room.envSync?.failed && room.envSync?.lastSuccessAt
        && Date.now() - room.envSync.lastSuccessAt < intervalMs()) return;
      pending.add(key);
      const isCurrent = () => active && store.selectedAreaId === areaId
        && targetRooms().includes(room);
      try {
        await queueRequest(() => isCurrent() && visibility.isVisible(), async () => {
          const env = await fetchDoorEnvData(room.sickroomId);
          if (!isCurrent()) return;
          if (env && Object.keys(env).length) {
            const fields = ['temp', 'relativeHumid', 'airQuality', 'noiseLevel'] as const;
            if (fields.some(field => String(room.doorEnvData?.[field] ?? '').trim() !== String(env[field] ?? '').trim()))
              store.updateEnv(areaId, sickroomId, env);
            room.envSync = { lastSuccessAt: Date.now(), failed: false };
          }
          else {
            room.envSync = { lastSuccessAt: room.envSync?.lastSuccessAt ?? null, failed: true };
          }
        });
      }
      catch {
        if (isCurrent())
          room.envSync = { lastSuccessAt: room.envSync?.lastSuccessAt ?? null, failed: true };
      }
      finally {
        pending.delete(key);
        // 快照替换期间同房间请求被合并，旧响应结束后为新对象补查。
        if (active && store.selectedAreaId === areaId
          && targetRooms().some(current => current !== room && String(current.sickroomId) === sickroomId))
          void refresh();
      }
    }));
  }

  function pause() {
    if (timer !== null) clearInterval(timer);
    timer = null;
    drainRequests();
  }
  function resetTimer() {
    pause();
    if (visibility.isVisible())
      timer = setInterval(() => void refresh(true), intervalMs());
  }
  function resume() {
    resetTimer();
    if (!visibility.isVisible()) return;
    void refresh(true);
  }
  // 同一病房的 3D / 平面切换不改变查询目标；快照替换后重新确认数据。
  const stopWatch = watch(
    () => ({ areaId: store.selectedAreaId, roomMode: store.sceneType === 'ward-interior', rooms: [...targetRooms()] }),
    (current, previous) => {
      const roomChanged = current.roomMode && (!previous.roomMode
        || current.rooms[0]?.sickroomId !== previous.rooms[0]?.sickroomId);
      const areaChanged = current.areaId !== previous.areaId;
      if (current.roomMode !== previous.roomMode || roomChanged || areaChanged)
        resetTimer();
      drainRequests();
      void refresh(areaChanged || roomChanged);
    },
  );
  const unsubscribe = visibility.subscribe(visible => visible ? resume() : pause());
  cleanup = () => {
    active = false;
    pause();
    stopWatch();
    unsubscribe();
  };
  resume();
}

export function stopEnvFetcher() {
  cleanup?.();
  cleanup = null;
}
