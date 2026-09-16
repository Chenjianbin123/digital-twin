import { watch } from 'vue';
import { fetchDoorEnvData } from '@/api/door-device';
import { createBrowserPollingVisibility } from '@/core/polling-visibility';
import type { useTwinStore } from '@/stores/twin-store';

type TwinStore = ReturnType<typeof useTwinStore>;

let cleanup: (() => void) | null = null;

export function startEnvFetcher(store: TwinStore, intervalMs = 30_000) {
  stopEnvFetcher();
  const visibility = createBrowserPollingVisibility();
  const pending = new Set<string>();
  let active = true;
  let timer: ReturnType<typeof setInterval> | null = null;

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
        && Date.now() - room.envSync.lastSuccessAt < intervalMs) return;
      pending.add(key);
      const isCurrent = () => active && store.selectedAreaId === areaId
        && targetRooms().includes(room);
      try {
        const env = await fetchDoorEnvData(room.sickroomId);
        if (!isCurrent()) return;
        if (env && Object.keys(env).length) {
          store.updateEnv(areaId, sickroomId, env);
          room.envSync = { lastSuccessAt: Date.now(), failed: false };
        }
        else {
          room.envSync = { lastSuccessAt: room.envSync?.lastSuccessAt ?? null, failed: true };
        }
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
  }
  function resume() {
    pause();
    if (!visibility.isVisible()) return;
    void refresh(true);
    timer = setInterval(() => void refresh(true), intervalMs);
  }
  // 同一病房的 3D / 平面切换不改变查询目标；快照替换后重新确认数据。
  const stopWatch = watch(
    () => [store.selectedAreaId, ...targetRooms()],
    () => { void refresh(); },
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
