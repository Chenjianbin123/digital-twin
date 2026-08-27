<script setup lang="ts">
import { CAMERA_PRESETS } from '@/core/camera-presets';
import type { CameraPresetId, TwinWardEntity, ViewMode } from '@/types/twin';

defineProps<{
  rooms: TwinWardEntity[];
  currentRoomIndex: number;
  viewMode: ViewMode;
  cameraPreset: CameraPresetId;
  isSimulating: boolean;
  isLoading: boolean;
  dataSource: 'mock' | 'remote' | 'database';
  areaName?: string;
  deptName?: string;
}>();

const emit = defineEmits<{
  toggleSimulation: [];
  reset: [];
  setRoom: [index: number];
  setViewMode: [mode: ViewMode];
  setCameraPreset: [preset: CameraPresetId];
}>();
</script>

<template>
  <header class="ward-toolbar">
    <div class="ward-toolbar__brand">
      <h1>智慧病房</h1>
      <p v-if="areaName || deptName" class="ward-toolbar__subtitle">
        {{ [deptName, areaName].filter(Boolean).join(' · ') }}
      </p>
    </div>

    <div class="ward-toolbar__controls">
      <div class="view-toggle">
        <button
          class="btn"
          :class="{ 'btn--active': viewMode === 'area' }"
          @click="emit('setViewMode', 'area')"
        >
          病区
        </button>
        <button
          class="btn"
          :class="{ 'btn--active': viewMode === '3d' }"
          @click="emit('setViewMode', '3d')"
        >
          3D
        </button>
        <button
          class="btn"
          :class="{ 'btn--active': viewMode === 'plan' }"
          @click="emit('setViewMode', 'plan')"
        >
          2.5D
        </button>
      </div>

      <select
        v-if="viewMode !== 'area'"
        class="select"
        :value="currentRoomIndex"
        :disabled="isLoading"
        @change="emit('setRoom', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="(room, i) in rooms" :key="room.sickroomCode" :value="i">
          {{ room.sickroomName }}
        </option>
      </select>

      <select
        v-if="viewMode === '3d'"
        class="select"
        :value="cameraPreset"
        @change="emit('setCameraPreset', ($event.target as HTMLSelectElement).value as CameraPresetId)"
      >
        <option v-for="p in CAMERA_PRESETS" :key="p.id" :value="p.id">
          {{ p.label }}
        </option>
      </select>
    </div>

    <div class="ward-toolbar__actions">
      <template v-if="dataSource === 'mock'">
        <button
          class="btn btn--ghost"
          :class="{ 'btn--active': isSimulating }"
          :disabled="isLoading"
          @click="emit('toggleSimulation')"
        >
          {{ isSimulating ? '停止模拟' : '模拟推送' }}
        </button>
      </template>
      <button
        class="btn btn--ghost"
        :disabled="isLoading"
        @click="emit('reset')"
      >
        {{ dataSource === 'mock' ? '重置' : '刷新' }}
      </button>
    </div>
  </header>
</template>

<style scoped lang="scss">
.ward-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: linear-gradient(180deg, rgba(10, 25, 41, 0.88), rgba(8, 20, 36, 0.82));
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(77, 208, 255, 0.18);
  flex-wrap: wrap;
  flex-shrink: 0;

  @include down($bp-md) {
    padding: 10px 14px;
    gap: 10px;
  }

  @include down($bp-sm) {
    padding: 8px 10px;
    gap: 8px;
  }

  &__brand {
    flex: 1;
    min-width: 140px;

    h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #e0e6ed;
      line-height: 1.3;
    }

    @include down($bp-sm) {
      min-width: 0;
      width: 100%;

      h1 { font-size: 15px; }
    }
  }

  &__subtitle {
    margin: 2px 0 0;
    font-size: 12px;
    color: #6b8299;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;

    @include down($bp-sm) {
      white-space: normal;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  }

  &__controls,
  &__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  &__controls {
    @include down($bp-md) {
      flex: 1;
      min-width: 0;
    }

    @include down($bp-sm) {
      width: 100%;
      justify-content: space-between;
    }
  }

  &__actions {
    @include down($bp-sm) {
      width: 100%;
      justify-content: flex-end;
    }
  }

  .view-toggle {
    display: flex;
    padding: 3px;
    gap: 2px;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 8px;
    flex-shrink: 0;
  }

  .select {
    padding: 6px 10px;
    font-size: 13px;
    color: #c5d0db;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    cursor: pointer;
    max-width: 160px;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    @include down($bp-sm) {
      flex: 1;
      min-width: 0;
      max-width: none;
      font-size: 12px;
      padding: 6px 8px;
    }
  }

  .btn {
    padding: 6px 14px;
    font-size: 13px;
    color: #8fa3b8;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s, background 0.15s;

    &:hover:not(:disabled) {
      color: #c5d0db;
      background: rgba(255, 255, 255, 0.06);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &--active {
      color: #4fc3f7;
      background: rgba(79, 195, 247, 0.15);
    }

    &--ghost {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.08);

      &:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.1);
      }
    }

    @include down($bp-sm) {
      padding: 6px 10px;
      font-size: 12px;
    }
  }
}
</style>
