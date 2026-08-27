<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { PlanRenderer } from '@/core/plan-renderer';
import type { TwinBedEntity, TwinWardEntity } from '@/types/twin';

const props = defineProps<{
  ward: TwinWardEntity;
  selectedBed?: TwinBedEntity | null;
}>();

const emit = defineEmits<{
  bedClick: [bed: TwinBedEntity];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
let renderer: PlanRenderer | null = null;

onMounted(() => {
  if (!canvasRef.value)
    return;
  renderer = new PlanRenderer({
    canvas: canvasRef.value,
    onBedClick: bed => emit('bedClick', bed),
  });
  renderer.updateWard(props.ward);
  renderer.setSelectedBed(props.selectedBed ?? null);
});

watch(() => props.ward, (ward) => {
  renderer?.updateWard(ward);
}, { deep: true });

watch(() => props.selectedBed, (bed) => {
  renderer?.setSelectedBed(bed ?? null);
});

onUnmounted(() => {
  renderer?.dispose();
  renderer = null;
});
</script>

<template>
  <div class="ward-plan-view">
    <canvas ref="canvasRef" />
  </div>
</template>

<style scoped lang="scss">
.ward-plan-view {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
  overflow: hidden;
  background: #121a24;

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
