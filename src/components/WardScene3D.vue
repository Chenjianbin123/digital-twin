<script setup lang="ts">

import WardLegend from '@/components/WardLegend.vue';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { wardInteriorRoomKey, selectOccupiedWardBeds } from '@/core/ward-interior-beds';
import { wardInteriorSceneConfig } from '@/config/ward-interior-scene';
import type { DataStatus } from '@/core/data-status';

import { WardScene, type WardInteriorModelState } from '@/core/ward-scene';

import type { EnvAlertLevel } from '@/core/env-alert';

import type { CameraPresetId, TwinBedEntity, TwinWardEntity } from '@/types/twin';




const props = defineProps<{

  ward: TwinWardEntity;
  theme?: 'light' | 'dark';

  cameraPreset: CameraPresetId;

  envAlertLevel: EnvAlertLevel;

  selectedBedCode?: string | null;

  vitalWarningBedCodes?: string[];

  active?: boolean;
  dataStatus?: DataStatus;
  sharedStatus?: boolean;

}>();



const emit = defineEmits<{

  bedClick: [bed: TwinBedEntity];
  requestPlan: [];
  modelState: [state: WardInteriorModelState];

}>();



const containerRef = ref<HTMLElement | null>(null);

let scene: WardScene | null = null;
function resetCamera() { scene?.setCameraPreset('door'); }
const occupied = computed(() => selectOccupiedWardBeds(props.ward));
const capacity = wardInteriorSceneConfig.modular.slots.length;
const expanded = computed(() => occupied.value.beds.length > capacity);
const terminalDialog = ref<HTMLDialogElement | null>(null);
const terminalCanvas = ref<HTMLCanvasElement | null>(null);
const terminalBedCode = ref('');
const terminalWaiting = ref(false);
let terminalTimer: ReturnType<typeof setInterval> | null = null;
let lastTerminalSource: HTMLCanvasElement | null = null;
function drawTerminal() {
  const canvas = terminalCanvas.value;
  if (!canvas) return;
  const source = scene?.getBedTerminalCanvas(terminalBedCode.value);
  terminalWaiting.value = !source;
  if (source === lastTerminalSource) return;
  lastTerminalSource = source ?? null;
  if (!source) { canvas.width = 512; canvas.height = 300; return; }
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d')?.drawImage(source, 0, 0);
}
function stopTerminalPreview() {
  if (terminalTimer) clearInterval(terminalTimer);
  terminalTimer = null;
  lastTerminalSource = null;
}
function closeTerminal() { terminalDialog.value?.close(); stopTerminalPreview(); }
async function openTerminal() {
  if (props.selectedBedCode && !occupied.value.beds.some(b => b.bedCode === props.selectedBedCode)) return;
  terminalBedCode.value = occupied.value.beds.some(b => b.bedCode === props.selectedBedCode)
    ? props.selectedBedCode! : occupied.value.beds[0]?.bedCode ?? '';
  if (!terminalBedCode.value) return;
  const selected = occupied.value.beds.find(b => b.bedCode === terminalBedCode.value);
  if (selected) emit('bedClick', selected);
  await nextTick();
  terminalDialog.value?.showModal();
  stopTerminalPreview();
  drawTerminal();
  terminalTimer = setInterval(drawTerminal, 400);
}
function inspectTerminalBed() {
  lastTerminalSource = null;
  drawTerminal();
  const bed = occupied.value.beds.find(b => b.bedCode === terminalBedCode.value);
  if (bed) emit('bedClick', bed);
}
watch(() => wardInteriorRoomKey(props.ward), closeTerminal);
watch(() => occupied.value.beds.map(b => b.bedCode), codes => {
  if (terminalDialog.value?.open && !codes.includes(terminalBedCode.value)) closeTerminal();
});
const selectionNotShown = computed(() => props.selectedBedCode
  && !occupied.value.beds.some(bed => bed.bedCode === props.selectedBedCode));
const dataNotice = computed(() => {
  if (props.dataStatus === 'loading') return '患者数据同步中，当前画面可能为上次结果';
  if (props.dataStatus && props.dataStatus !== 'ready') return '患者数据未完整同步，当前画面仅供参考';
  if (occupied.value.invalidCount && !occupied.value.beds.length) return '入住数据缺少有效床号，暂无法生成床位';
  return occupied.value.beds.length ? '' : '当前病房暂无已入住床位';
});




onMounted(() => {

  if (!containerRef.value)

    return;

  try {
    scene = new WardScene({

      container: containerRef.value,
      theme: props.theme,

      onBedClick: bed => emit('bedClick', bed),
      onModelState: state => emit('modelState', state),

    });
  }
  catch (error) {
    emit('modelState', 'fallback');
    console.warn('[WardScene3D] renderer initialization failed', error);
    return;
  }

  scene.updateWard(props.ward);



  scene.setCameraPreset(props.cameraPreset);

  scene.setEnvAlertLevel(props.envAlertLevel);

  scene.setSelectedBedCode(props.selectedBedCode ?? null);

  scene.setVitalWarningBedCodes(props.vitalWarningBedCodes ?? []);

  scene.setActive(props.active !== false);

});



watch(() => props.theme, theme => scene?.setTheme(theme ?? 'dark'));

watch(() => props.ward, (newWard) => {

  scene?.updateWard(newWard);
  if (terminalDialog.value?.open) drawTerminal();

  scene?.setSelectedBedCode(props.selectedBedCode ?? null);

}, { deep: true });



watch(() => props.cameraPreset, (preset, prev) => {

  if (preset !== prev)

    scene?.setCameraPreset(preset);

});



watch(() => props.envAlertLevel, (level) => {

  scene?.setEnvAlertLevel(level);

});

watch(() => props.selectedBedCode, (bedCode) => {
  if (terminalDialog.value?.open) {
    if (!bedCode || !occupied.value.beds.some(b => b.bedCode === bedCode)) closeTerminal();
    else { terminalBedCode.value = bedCode; lastTerminalSource = null; drawTerminal(); }
  }

  scene?.setSelectedBedCode(bedCode ?? null);

});

watch(() => props.vitalWarningBedCodes, (codes) => {

  scene?.setVitalWarningBedCodes(codes ?? []);

}, { deep: true });

watch(() => props.active, (active) => {

  scene?.setActive(active !== false);
  if (active === false) closeTerminal();

});



onUnmounted(() => {
  stopTerminalPreview();

  scene?.dispose();

  scene = null;

});

</script>



<template>

  <div
    class="ward-scene-3d"
    :data-vital-warning="vitalWarningBedCodes?.length ? 'active' : 'idle'"
  >

    <div ref="containerRef" class="ward-scene-3d__canvas-host" />
    <Teleport to="#ward-tools-host" :disabled="!sharedStatus">
    <div v-show="active !== false" class="ward-scene-3d__occupancy" aria-label="病房展示状态">
      <div v-if="!sharedStatus" aria-live="polite">
        <strong>入住记录 {{ occupied.occupiedCount }} 条 · 已展示 {{ occupied.beds.length }} 床</strong>
        <p v-if="dataNotice">{{ dataNotice }}</p>
        <p v-if="expanded">房间按入住数量扩展，尺寸为展示示意。</p>
        <p v-if="occupied.invalidCount">{{ occupied.invalidCount }} 条入住床位数据缺少唯一床号，暂未展示。</p>
        <p v-if="selectionNotShown">当前选择的床位未在 3D 展示，可通过详情面板或平面图查看。</p>
      </div>
      <p v-if="sharedStatus && selectionNotShown">当前选择的床位未在 3D 展示，可通过详情面板查看。</p>
      <p v-if="occupied.beds.length > 2" class="ward-scene-3d__narrow-notice">窄屏可逐床查看，入住平面图可查看全貌。</p>
      <div class="ward-scene-3d__actions">
        <button type="button" @click="resetCamera">复位视角</button>
        <button type="button" :disabled="!occupied.beds.length || !!selectionNotShown" @click="openTerminal">查看床头屏</button>
        <WardLegend embedded />
      </div>
    </div>



    </Teleport>
    <dialog ref="terminalDialog" class="ward-terminal-dialog" aria-label="床头屏放大查看" @close="stopTerminalPreview">
      <header>
        <label>床头屏
          <select v-model="terminalBedCode" aria-label="查看哪个床位的床头屏" @change="inspectTerminalBed">
            <option v-for="bed in occupied.beds" :key="bed.bedCode" :value="bed.bedCode">{{ bed.bedName || bed.bedCode }}</option>
          </select>
        </label>
        <button type="button" autofocus @click="closeTerminal">关闭</button>
      </header>
      <p v-if="dataNotice">{{ dataNotice }}</p>
      <p v-if="terminalWaiting" role="status">床头屏信息加载中</p>
      <canvas ref="terminalCanvas" aria-label="当前床位的床头屏模板" />
    </dialog>

    <div class="ward-scene-3d__overlay">

      <div class="ward-scene-3d__scanlines" aria-hidden="true" />

      <div class="ward-scene-3d__vignette" aria-hidden="true" />

      <div class="ward-scene-3d__frame" aria-hidden="true">

        <span class="ward-scene-3d__corner ward-scene-3d__corner--tl" />

        <span class="ward-scene-3d__corner ward-scene-3d__corner--tr" />

        <span class="ward-scene-3d__corner ward-scene-3d__corner--bl" />

        <span class="ward-scene-3d__corner ward-scene-3d__corner--br" />

      </div>



    </div>

  </div>

</template>



<style scoped lang="scss">
.ward-terminal-dialog {
  box-sizing: border-box;
  width: min(880px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  padding: 18px;
  border: 1px solid #bacbd0;
  border-radius: 12px;
  background: #f3f7f7;
  color: #173d45;
  box-shadow: 0 16px 60px #10293255;
  &::backdrop { background: #10232d99; }
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  label { display: flex; align-items: center; gap: 12px; font-weight: 600; }
  select, button { min-height: 40px; max-width: 45vw; padding: 6px 12px; border: 1px solid #9ab7bc; border-radius: 6px; background: white; color: inherit; font: inherit; }
  button { cursor: pointer; }
  :focus-visible { outline: 2px solid #287e92; outline-offset: 3px; }
  canvas { display: block; width: 100%; height: auto; background: white; }
}
.ward-scene-3d__occupancy {
  box-sizing: border-box;
  position: absolute;
  z-index: 3;
  bottom: 112px;
  left: 16px;
  max-width: min(460px, calc(100% - 32px));
  padding: 12px 16px;
  border: 1px solid rgba(100, 164, 191, .45);
  border-radius: 8px;
  background: rgba(8, 28, 42, .92);
  color: #e7f5fc;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  strong { font-weight: 600; }
  p { margin: 6px 0 0; color: #c9dce7; }
}
.ward-scene-3d__narrow-notice { display: none; }
@media (max-width: 600px) { .ward-scene-3d__narrow-notice { display: block; margin: 0 0 6px; } }
.ward-scene-3d__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 0;
  button {
    min-height: 36px;
    padding: 6px 12px;
    border: 1px solid #527e96;
    border-radius: 10px;
    color: #e6f7ff;
    background: #173e54;
    cursor: pointer;
    &:focus-visible { outline: 2px solid #8ad8ff; outline-offset: 2px; }
    &:hover { background: #24566e; }
  }
}


.ward-scene-3d {

  position: relative;

  width: 100%;

  height: 100%;

  min-height: 0;

  border-radius: 0;

  overflow: hidden;

  background:

    radial-gradient(ellipse 65% 50% at 50% 100%, rgba(21, 101, 192, 0.12) 0%, transparent 55%),

    radial-gradient(ellipse 45% 35% at 20% 20%, rgba(79, 195, 247, 0.08) 0%, transparent 70%),

    linear-gradient(180deg, #e8f0ec 0%, #dce8e2 55%, #d0dcd6 100%);



  &__canvas-host {

    position: absolute;

    inset: 0;

    z-index: 1;

    overflow: hidden;

    pointer-events: auto;

  }



  &__overlay {

    position: absolute;

    inset: 0;

    z-index: 2;

    pointer-events: none;

  }



  &__scanlines {

    position: absolute;

    inset: 0;

    opacity: 0.04;

    background: repeating-linear-gradient(

      0deg,

      transparent,

      transparent 2px,

      rgba(79, 195, 247, 0.5) 2px,

      rgba(79, 195, 247, 0.5) 3px

    );

    pointer-events: none;

  }



  &__vignette {

    position: absolute;

    inset: 0;

    pointer-events: none;

    background:

      radial-gradient(ellipse at center, transparent 52%, rgba(20, 40, 48, 0.18) 100%),

      linear-gradient(180deg, rgba(4, 10, 20, 0.12) 0%, transparent 14%, transparent 86%, rgba(4, 10, 20, 0.16) 100%);

  }



  &__frame {

    position: absolute;

    inset: 10px;

    pointer-events: none;

  }



  &__corner {

    position: absolute;

    width: 20px;

    height: 20px;

    border-color: rgba(79, 195, 247, 0.45);

    border-style: solid;

    border-width: 0;



    &--tl {

      top: 0;

      left: 0;

      border-top-width: 2px;

      border-left-width: 2px;

    }



    &--tr {

      top: 0;

      right: 0;

      border-top-width: 2px;

      border-right-width: 2px;

    }



    &--bl {

      bottom: 0;

      left: 0;

      border-bottom-width: 2px;

      border-left-width: 2px;

    }



    &--br {

      bottom: 0;

      right: 0;

      border-bottom-width: 2px;

      border-right-width: 2px;

    }

  }



  /* ── 床位标签 ── */

  :deep(.bed-label-3d) {

    position: relative;

    min-width: 88px;

    max-width: 118px;

    padding: 0 0 8px;

    background: linear-gradient(160deg, rgba(6, 18, 34, 0.95) 0%, rgba(10, 24, 42, 0.9) 100%);

    border: 1px solid rgba(79, 195, 247, 0.35);

    border-radius: 10px;

    color: #f7fbfd;

    font-size: 10px;

    line-height: 1.35;

    text-align: left;

    pointer-events: none;

    transform: translate(-50%, -100%);

    transform-origin: center bottom;

    box-shadow:

      0 4px 20px rgba(20, 40, 48, 0.5),

      0 0 16px rgba(79, 195, 247, 0.08);

    backdrop-filter: blur(8px);

    overflow: hidden;

  }



  :deep(.bed-label-3d__accent) {

    display: block;

    height: 3px;

    background: linear-gradient(90deg, var(--nursing-accent, #1565c0), color-mix(in srgb, var(--nursing-accent, #4fc3f7) 65%, #f7fbfd));

    box-shadow: none;

  }



  :deep(.bed-label-3d__head) {

    display: flex;

    align-items: center;

    gap: 5px;

    padding: 6px 10px 4px;

  }



  :deep(.bed-label-3d__dot) {

    width: 7px;

    height: 7px;

    border-radius: 50%;

    background: #4fc3f7;

    flex-shrink: 0;

    opacity: 0.9;

  }



  :deep(.bed-label-3d__num) {

    font-weight: 700;

    font-size: 12px;

    color: #4fc3f7;

    flex: 1;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

  }



  :deep(.bed-label-3d__status) {

    font-size: 8px;

    font-weight: 600;

    padding: 1px 5px;

    color: rgba(79, 195, 247, 0.9);

    background: rgba(79, 195, 247, 0.12);

    border-radius: 6px;

    flex-shrink: 0;

  }



  :deep(.bed-label-3d__name) {

    padding: 0 10px;

    font-size: 12px;

    font-weight: 600;

    color: #e3f2fd;

    overflow: hidden;

    text-overflow: ellipsis;

    white-space: nowrap;

  }



  :deep(.bed-label-3d__meta) {

    display: flex;

    flex-wrap: wrap;

    gap: 4px;

    padding: 4px 10px 0;

  }



  :deep(.bed-label-3d__selected-extra) {

    display: grid;

    gap: 2px;

    margin: 6px 8px 0;

    padding: 6px 7px;

    border: 1px solid rgba(129, 212, 250, 0.24);

    border-radius: 7px;

    background: rgba(79, 195, 247, 0.1);

    span {

      min-width: 0;

      overflow: hidden;

      color: rgba(224, 247, 255, 0.9);

      font-size: 9px;

      font-weight: 700;

      text-overflow: ellipsis;

      white-space: nowrap;

    }

  }



  :deep(.bed-label-3d__level) {

    display: inline-block;

    padding: 2px 7px;

    font-size: 9px;

    font-weight: 600;

    color: #ffb74d;

    background: rgba(255, 183, 77, 0.14);

    border: 1px solid rgba(255, 183, 77, 0.25);

    border-radius: 6px;

  }



  :deep(.bed-label-3d__badge) {

    display: inline-block;

    padding: 2px 7px;

    font-size: 9px;

    font-weight: 600;

    color: #90caf9;

    background: rgba(79, 195, 247, 0.12);

    border: 1px solid rgba(79, 195, 247, 0.22);

    border-radius: 6px;

  }



  :deep(.bed-label-3d--empty) {

    border-color: rgba(120, 144, 156, 0.4);

    background: linear-gradient(160deg, rgba(20, 28, 36, 0.9) 0%, rgba(30, 38, 48, 0.85) 100%);



    .bed-label-3d__accent {

      background: linear-gradient(90deg, #455a64, #78909c, #455a64);

      box-shadow: none;

    }



    .bed-label-3d__dot {

      background: #78909c;

      box-shadow: none;

    }



    .bed-label-3d__num { color: #90a4ae; }

    .bed-label-3d__name { color: #b0bec5; font-weight: 400; }

    .bed-label-3d__status { color: #78909c; background: rgba(120, 144, 156, 0.15); }

  }



  :deep(.bed-label-3d--calling) {

    border-color: rgba(233, 30, 99, 0.5);

    .bed-label-3d__accent {

      background: linear-gradient(90deg, #c2185b, #f48fb1);

      box-shadow: 0 0 8px rgba(233, 30, 99, 0.35);

    }



    .bed-label-3d__dot {

      background: #e91e63;

      animation: dot-soft 2.5s ease-in-out infinite;

    }



    .bed-label-3d__num { color: #f48fb1; }

    .bed-label-3d__status { color: #f48fb1; background: rgba(233, 30, 99, 0.15); }

  }



  :deep(.bed-label-3d--device-alert) {

    border-color: rgba(255, 183, 77, 0.48);

    .bed-label-3d__accent {

      background: linear-gradient(90deg, #f57c00, #ffe082);

      box-shadow: 0 0 8px rgba(255, 183, 77, 0.32);

    }

    .bed-label-3d__dot {

      background: #ffb74d;

      animation: dot-soft 2.8s ease-in-out infinite;

    }

    .bed-label-3d__num { color: #ffcc80; }

    .bed-label-3d__status { color: #ffcc80; background: rgba(255, 183, 77, 0.16); }

  }



  :deep(.bed-label-3d--selected) {

    min-width: 132px;

    max-width: 174px;

    border-color: rgba(129, 212, 250, 0.86);

    box-shadow:

      0 8px 26px rgba(20, 40, 48, 0.56),

      0 0 24px rgba(79, 195, 247, 0.3);

    .bed-label-3d__accent {

      height: 4px;

      box-shadow: 0 0 12px rgba(79, 195, 247, 0.46);

    }

    .bed-label-3d__num {

      font-size: 13px;

      color: #b3f5ff;

    }

  }



  :deep(.bed-label-3d--infusing) {

    border-color: rgba(255, 152, 0, 0.45);



    .bed-label-3d__dot {

      background: #ff9800;

      animation: dot-soft 3s ease-in-out infinite;

    }

  }



  :deep(.bed-label-3d--compact) {

    min-width: 72px;

    max-width: 96px;

    padding-bottom: 6px;



    .bed-label-3d__head {

      padding: 4px 8px 2px;

    }



    .bed-label-3d__num {

      font-size: 11px;

    }



    .bed-label-3d__name {

      padding: 0 8px;

      font-size: 11px;

    }



    .bed-label-3d__status {

      display: none;

    }



    .bed-label-3d__meta {

      padding: 2px 8px 0;

    }



    .bed-label-3d__level,

    .bed-label-3d__badge {

      font-size: 8px;

      padding: 1px 5px;

    }

  }


}



@keyframes dot-soft {

  0%, 100% { opacity: 0.85; transform: scale(1); }

  50% { opacity: 1; transform: scale(1.08); }

}
</style>
