<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, toRaw, watch } from 'vue';
import { AreaScene, type AreaCameraDebugState, type AreaModelState, type AreaNodePickInfo } from '@/core/area-scene';
import { buildAreaStructureSignature } from '@/core/area-scene-identity';
import type { RoomSummary } from '@/core/area-summary';
import { resolveAreaPhaseTransition } from '@/core/scene-transition';
import { twinSceneToAreaPhase, type TwinAreaEntity, type TwinSceneType } from '@/types/twin';

const props = defineProps<{
  area: TwinAreaEntity;
  areaId: number | null;
  roomSummaries?: RoomSummary[];
  focusedRoomIndex?: number;
  configuredDeviceCount?: number;
  sceneType?: TwinSceneType;
}>();

const areaPhase = computed(() =>
  twinSceneToAreaPhase(props.sceneType ?? 'nurse-station'),
);
// 开发调试开关：true 显示护士站/病房走廊视角参数面板，false 隐藏。
const CAMERA_DEBUG_PANEL_ENABLED = false;
const cameraDebugEnabled = computed(() =>
  CAMERA_DEBUG_PANEL_ENABLED
  && import.meta.env.DEV
  && (areaPhase.value === 'station' || areaPhase.value === 'corridor'),
);
const cameraDebugTitle = computed(() =>
  areaPhase.value === 'station' ? '护士站视角参数' : '病房走廊视角参数',
);
const cameraDebugOpen = ref(true);
const cameraDebugState = ref<AreaCameraDebugState | null>(null);
const cameraDebugCopied = ref(false);
const corridorModelState = ref<AreaModelState>('loading');
const pickedNode = ref<AreaNodePickInfo | null>(null);

const emit = defineEmits<{
  roomClick: [roomIndex: number];
  focusRoom: [roomIndex: number];
  modelState: [state: AreaModelState];
}>();

const containerRef = ref<HTMLElement | null>(null);
let scene: AreaScene | null = null;
let layoutObserver: ResizeObserver | null = null;
let mountRetryTimer: ReturnType<typeof setTimeout> | null = null;
let mountRetryCount = 0;

function resetStationView() {
  if (areaPhase.value === 'station')
    scene?.resetToNurseStationView();
}

function applyAreaToScene(full = true) {
  if (!scene || !props.area)
    return;
  try {
    if (full)
      scene.updateArea(toRaw(props.area));
    else
      scene.syncAreaData(toRaw(props.area));
  }
  catch (e) {
    console.error('[AreaScene3D] scene update failed', e);
  }
}

function mountScene() {
  const host = containerRef.value;
  if (!host || scene)
    return false;

  const w = host.clientWidth;
  const h = host.clientHeight;
  if (w < 16 || h < 16)
    return false;

  scene = new AreaScene({
    container: host,
    onRoomClick: index => emit('roomClick', index),
    onNodePick: info => (pickedNode.value = info),
    onModelState: state => emit('modelState', state),
    onCorridorState: state => (corridorModelState.value = state),
    onCameraState: state => (cameraDebugState.value = state),
  });
  applyAreaToScene(true);
  scene.setViewPhase(areaPhase.value, false);
  requestAnimationFrame(() => scene?.refreshLayout());
  mountRetryCount = 0;
  return true;
}

function cameraDebugText() {
  const state = cameraDebugState.value;
  if (!state)
    return '';
  return `camera: {\n  target: { x: ${state.target.x}, y: ${state.target.y}, z: ${state.target.z} },\n  initialDistance: ${state.initialDistance},\n  initialAngle: { azimuthDeg: ${state.initialAngle.azimuthDeg}, elevationDeg: ${state.initialAngle.elevationDeg} },\n},\nappearance: { fov: ${state.fov} },`;
}

async function copyCameraDebugText() {
  const text = cameraDebugText();
  if (!text)
    return;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
    else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    cameraDebugCopied.value = true;
    window.setTimeout(() => { cameraDebugCopied.value = false; }, 1200);
  }
  catch {
    // 页面仍显示完整文本，浏览器不允许复制时可手动选中。
    cameraDebugCopied.value = false;
  }
}

function tryMountScene() {
  if (mountScene())
    return;

  if (mountRetryCount >= 8)
    return;

  mountRetryCount++;
  if (mountRetryTimer)
    clearTimeout(mountRetryTimer);
  mountRetryTimer = setTimeout(() => {
    mountRetryTimer = null;
    if (mountScene())
      return;
    tryMountScene();
  }, 120);
}

function bindLayoutObserver(host: HTMLElement) {
  if (layoutObserver)
    return;
  layoutObserver = new ResizeObserver(() => {
    if (!scene)
      tryMountScene();
    else
      scene.refreshLayout();
  });
  layoutObserver.observe(host);
}

onMounted(async () => {
  await nextTick();
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (containerRef.value)
    bindLayoutObserver(containerRef.value);
  tryMountScene();
});

onUnmounted(() => {
  if (mountRetryTimer)
    clearTimeout(mountRetryTimer);
  layoutObserver?.disconnect();
  layoutObserver = null;
  scene?.dispose();
  scene = null;
});

watch(
  () => buildAreaStructureSignature(props.area),
  () => {
    if (!props.area?.rooms?.length)
      return;
    if (!scene)
      tryMountScene();
    else
      applyAreaToScene(true);
  },
);

watch(
  () => props.roomSummaries,
  () => {
    if (!scene || !props.area?.rooms?.length)
      return;
    applyAreaToScene(false);
  },
  { deep: true },
);

watch(() => props.focusedRoomIndex, (index, prev) => {
  if (index === undefined || index < 0) {
    if (prev !== undefined && prev >= 0)
      scene?.resetToNurseStationView();
    return;
  }
  if (areaPhase.value === 'station')
    return;
  if (index === prev)
    return;
  scene?.focusRoom(index);
});

watch(areaPhase, (phase, prev) => {
  if (!scene || phase === prev)
    return;
  const transition = resolveAreaPhaseTransition(prev, phase);
  scene.setViewPhase(phase, transition.animate);
});
</script>

<template>
  <div class="area-scene-3d">
    <div ref="containerRef" class="area-scene-3d__canvas-host" />

    <div
      v-if="areaPhase === 'corridor' && corridorModelState !== 'ready'"
      class="area-scene-3d__model-loading"
      role="status"
      aria-live="polite"
    >
      <span class="area-scene-3d__model-loading-spinner" aria-hidden="true" />
      <strong>正在准备病房走廊模型</strong>
      <small>首次加载需要一点时间，后续切换会直接打开</small>
    </div>

    <div v-if="areaPhase === 'station'" class="area-scene-3d__shade" aria-hidden="true" />

    <button
      v-if="areaPhase === 'station'"
      type="button"
      class="area-scene-3d__reset area-scene-3d__reset--station"
      title="复位视角"
      @click="resetStationView"
    >
      ↺
    </button>

    <button
      v-if="cameraDebugEnabled && !cameraDebugOpen"
      type="button"
      class="area-scene-3d__camera-debug-reopen"
      :title="`显示${cameraDebugTitle}`"
      @click="cameraDebugOpen = true"
    >
      参数
    </button>

    <aside v-if="cameraDebugEnabled && cameraDebugOpen && cameraDebugState" class="area-scene-3d__camera-debug" :aria-label="cameraDebugTitle">
      <header>
        <strong>{{ cameraDebugTitle }}</strong>
        <span>
          <button type="button" title="复制配置参数" @click="copyCameraDebugText">{{ cameraDebugCopied ? '已复制' : '复制' }}</button>
          <button type="button" title="隐藏参数面板" @click="cameraDebugOpen = false">收起</button>
        </span>
      </header>
      <code>target: { x: {{ cameraDebugState.target.x }}, y: {{ cameraDebugState.target.y }}, z: {{ cameraDebugState.target.z }} }</code>
      <code>initialDistance: {{ cameraDebugState.initialDistance }} / 当前距离: {{ cameraDebugState.distance }}</code>
      <code>initialAngle: { azimuthDeg: {{ cameraDebugState.initialAngle.azimuthDeg }}, elevationDeg: {{ cameraDebugState.initialAngle.elevationDeg }} }</code>
      <code>fov: {{ cameraDebugState.fov }}</code>
    </aside>

    <aside v-if="areaPhase === 'corridor' && pickedNode" class="area-scene-3d__node-debug" aria-label="射线命中节点">
      <header>
        <strong>射线命中节点</strong>
        <button type="button" @click="pickedNode = null">关闭</button>
      </header>
      <code>名称：{{ pickedNode.name }}</code>
      <code>类型：{{ pickedNode.type }}</code>
      <code>父节点：{{ pickedNode.parentName }}</code>
      <code>材质：{{ pickedNode.materialNames.join('、') || '无' }}</code>
      <code>坐标：{{ pickedNode.worldPosition.x }}, {{ pickedNode.worldPosition.y }}, {{ pickedNode.worldPosition.z }}</code>
    </aside>
  </div>
</template>

<style scoped lang="scss">
.area-scene-3d {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #0a1218;

  &__canvas-host {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #0a1218;
  }

  &__shade {
    position: absolute;
    inset: 0;
    z-index: 2;
    pointer-events: none;
    background: linear-gradient(
      180deg,
      rgba(6, 14, 26, 0.35) 0%,
      transparent 18%,
      transparent 72%,
      rgba(6, 14, 26, 0.45) 100%
    );
  }

  &__model-loading {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 10px;
    background: radial-gradient(circle at 50% 42%, rgba(15, 77, 91, 0.32), rgba(3, 14, 24, 0.92) 62%);
    color: rgba(220, 250, 250, 0.94);
    text-align: center;
    pointer-events: none;

    strong {
      font-size: 13px;
      letter-spacing: 0.04em;
    }

    small {
      color: rgba(180, 220, 224, 0.7);
      font-size: 10px;
    }
  }

  &__model-loading-spinner {
    width: 28px;
    height: 28px;
    border: 2px solid rgba(157, 245, 235, 0.22);
    border-top-color: #9df5eb;
    border-radius: 50%;
    animation: area-scene-model-spin 0.85s linear infinite;
  }

  &__hud {
    position: absolute;
    right: 14px;
    bottom: 88px;
    z-index: 8;
    display: flex;
    align-items: center;
    gap: 8px;
    pointer-events: none;

    @include down($bp-md) {
      right: 10px;
      bottom: 72px;
    }
  }

  &__reset {
    pointer-events: auto;
    padding: 5px 11px;
    border-radius: 6px;
    border: 1px solid rgba(77, 208, 255, 0.35);
    background: rgba(8, 22, 38, 0.72);
    backdrop-filter: blur(8px);
    color: rgba(200, 230, 255, 0.9);
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;

    &:hover {
      border-color: rgba(129, 212, 250, 0.7);
      background: rgba(12, 32, 52, 0.85);
    }
  }

  &__reset--station {
    right: 14px;
    bottom: 86px;
    position: absolute;
    z-index: 8;
    width: 34px;
    height: 34px;
    padding: 0;
    border-radius: 50%;
    font-size: 16px;
    opacity: 0.32;

    &:hover {
      opacity: 0.85;
    }
  }

  &__hint {
    padding: 4px 9px;
    border-radius: 6px;
    font-size: 10px;
    color: rgba(160, 190, 215, 0.7);
    background: rgba(8, 22, 38, 0.45);
    border: 1px solid rgba(77, 208, 255, 0.12);
    backdrop-filter: blur(4px);
  }

  &__camera-debug {
    position: absolute;
    left: 14px;
    bottom: 14px;
    z-index: 9;
    display: grid;
    gap: 5px;
    width: min(410px, calc(100% - 28px));
    padding: 10px 12px;
    border: 1px solid rgba(157, 245, 235, 0.28);
    border-radius: 6px;
    background: rgba(5, 20, 28, 0.84);
    color: rgba(225, 250, 248, 0.92);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    backdrop-filter: blur(10px);
    pointer-events: auto;

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: #a9fff0;
      font-size: 11px;
    }

    header button {
      border: 1px solid rgba(157, 245, 235, 0.32);
      border-radius: 4px;
      padding: 3px 7px;
      background: rgba(22, 92, 98, 0.42);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    header span {
      display: inline-flex;
      gap: 5px;
    }

    code {
      overflow-wrap: anywhere;
      color: rgba(235, 255, 252, 0.82);
      font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
    }

    @include down($bp-md) {
      left: 8px;
      bottom: 8px;
      width: calc(100% - 16px);
      padding: 8px 9px;
    }
  }

  &__node-debug {
    position: absolute;
    z-index: 8;
    top: 18px;
    right: 18px;
    width: min(340px, calc(100% - 36px));
    padding: 12px;
    border: 1px solid rgba(74, 226, 255, 0.45);
    border-radius: 12px;
    background: rgba(4, 18, 28, 0.9);
    color: #dffaff;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.28);
    pointer-events: auto;

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }

    button {
      border: 0;
      background: transparent;
      color: #8beeff;
      cursor: pointer;
    }

    code {
      display: block;
      margin-top: 4px;
      font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
      white-space: normal;
      word-break: break-all;
    }
  }

  &__camera-debug-reopen {
    position: absolute;
    left: 14px;
    bottom: 14px;
    z-index: 9;
    padding: 5px 8px;
    border: 1px solid rgba(157, 245, 235, 0.28);
    border-radius: 5px;
    background: rgba(5, 20, 28, 0.78);
    color: #a9fff0;
    font: 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
    cursor: pointer;
  }
}

@keyframes area-scene-model-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
