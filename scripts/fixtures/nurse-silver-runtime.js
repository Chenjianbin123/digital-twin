import { createApp, h, ref } from 'vue';
import { createPinia } from 'pinia';
import { nurseStationSceneConfig } from '/src/config/nurse-station-scene.ts';
import '/src/styles/global.scss';
import '/src/styles/dashboard-theme.scss';

// Test hooks live only in this fixture; the production model/camera profile is unchanged.
const videoUrl = new URLSearchParams(location.search).get('video');
if (videoUrl !== null) nurseStationSceneConfig.educationVideoUrl = videoUrl;
const { AreaScene } = await import('/src/core/area-scene.ts');
const { useTwinStore } = await import('/src/stores/twin-store.ts');
const { default: Workspace } = await import('/src/components/workspace/DigitalTwinWorkspace.vue');
const scenes = new Set();
const originalTheme = AreaScene.prototype.setTheme;
AreaScene.prototype.setTheme = function(theme) { scenes.add(this); return originalTheme.call(this, theme); };
const pinia = createPinia(), store = useTwinStore(pinia), theme = ref('light'), mounted = ref(true);
store.dataSource = 'mock';
store.selectedAreaId = 999999;
store.area = { areaCode: 'SILVER-TEST', areaName: '合成验收病区', deptName: '非真实患者数据', rooms: [] };
store.dataPhase = 'ready';
store.lastFetchedAtMs = Date.now();
function setCalls(count) {
  const now = new Date().toISOString();
  store.swpEvents = Array.from({ length: count }, (_, i) => ({ id: `silver-call-${i}`, source: 'swp-call', areaId: 999999,
    taskType: 'call', severity: 'critical', startedAt: now, title: '合成患者呼叫', description: '仅模型验收', location: undefined }));
  store.swpEventSync = { phase: 'ready', lastSyncedAt: now, error: null, warning: null };
  store.swpResponseSync = { ...store.swpEventSync };
  store.inspectionSync = { ...store.swpEventSync };
}
setCalls(12);
const app = createApp({ setup() { return () => mounted.value ? h(Workspace, { theme: theme.value,
  operatorName: '验收账号', operatorRole: '合成测试', onToggleTheme: () => theme.value = theme.value === 'light' ? 'dark' : 'light' }) : null; } });
app.use(pinia); app.mount('#app');
window.silverRuntime = {
  get scene() { return [...scenes].find(scene => scene.modelKind === 'station' && scene.hasLoadedNurseStationModel); },
  get scenes() { return [...scenes]; }, store, setCalls,
  setTheme: value => theme.value = value,
  setMounted: value => mounted.value = value,
};
