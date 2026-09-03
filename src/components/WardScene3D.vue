<script setup lang="ts">

import { onMounted, onUnmounted, ref, watch } from 'vue';

import { WardScene } from '@/core/ward-scene';

import type { EnvAlertLevel } from '@/core/env-alert';

import type { CameraPresetId, TwinBedEntity, TwinWardEntity } from '@/types/twin';




const props = defineProps<{

  ward: TwinWardEntity;

  cameraPreset: CameraPresetId;

  envAlertLevel: EnvAlertLevel;

  selectedBedCode?: string | null;

  active?: boolean;

}>();



const emit = defineEmits<{

  bedClick: [bed: TwinBedEntity];

}>();



const containerRef = ref<HTMLElement | null>(null);

let scene: WardScene | null = null;




onMounted(() => {

  if (!containerRef.value)

    return;

  scene = new WardScene({

    container: containerRef.value,

    onBedClick: bed => emit('bedClick', bed),

  });

  scene.updateWard(props.ward);

  void scene.syncWardBedTemplates(props.ward);

  scene.setCameraPreset(props.cameraPreset);

  scene.setEnvAlertLevel(props.envAlertLevel);

  scene.setSelectedBedCode(props.selectedBedCode ?? null);

  scene.setActive(props.active !== false);

});



watch(() => props.ward, (newWard) => {

  scene?.updateWard(newWard);

  void scene?.syncWardBedTemplates(newWard);

}, { deep: true });



watch(() => props.cameraPreset, (preset, prev) => {

  if (preset !== prev)

    scene?.setCameraPreset(preset);

});



watch(() => props.envAlertLevel, (level) => {

  scene?.setEnvAlertLevel(level);

});

watch(() => props.selectedBedCode, (bedCode) => {

  scene?.setSelectedBedCode(bedCode ?? null);

});

watch(() => props.active, (active) => {

  scene?.setActive(active !== false);

});



onUnmounted(() => {

  scene?.dispose();

  scene = null;

});

</script>



<template>

  <div class="ward-scene-3d">

    <div ref="containerRef" class="ward-scene-3d__canvas-host" />



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

      radial-gradient(ellipse at center, transparent 52%, rgba(0, 0, 0, 0.18) 100%),

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

    color: #fff;

    font-size: 10px;

    line-height: 1.35;

    text-align: left;

    pointer-events: none;

    transform: translate(-50%, -100%);

    transform-origin: center bottom;

    box-shadow:

      0 4px 20px rgba(0, 0, 0, 0.5),

      0 0 16px rgba(79, 195, 247, 0.08);

    backdrop-filter: blur(8px);

    overflow: hidden;

  }



  :deep(.bed-label-3d__accent) {

    display: block;

    height: 3px;

    background: linear-gradient(90deg, var(--nursing-accent, #1565c0), color-mix(in srgb, var(--nursing-accent, #4fc3f7) 65%, #fff));

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

      0 8px 26px rgba(0, 0, 0, 0.56),

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
