<script setup lang="ts">
import { computed } from 'vue';
import type { DataStatus } from '@/core/data-status';
import type { TwinWardEntity } from '@/types/twin';
import { selectOccupiedWardBeds } from '@/core/ward-interior-beds';
import { wardInteriorSceneConfig } from '@/config/ward-interior-scene';

const props = defineProps<{
  ward: TwinWardEntity;
  status: DataStatus;
  busy: boolean;
  lastSyncedAt?: number | null;
  warnings?: string[];
}>();
defineEmits<{ retry: [] }>();
const occupied = computed(() => selectOccupiedWardBeds(props.ward));
const warnings = computed(() => [...new Set(props.warnings?.filter(Boolean) ?? [])]);
const message = computed(() => {
  if (props.busy) return '正在同步，暂时保留当前画面';
  if (props.status === 'error') return '同步失败，当前为上次数据';
  if (props.status === 'stale') return '数据已过期，请重新同步';
  if (props.status === 'warning') return '部分数据同步失败，请查看异常详情';
  if (!occupied.value.occupiedCount) return '当前病房暂无入住记录';
  return '患者数据已同步';
});
const syncTime = computed(() => props.lastSyncedAt
  ? new Date(props.lastSyncedAt).toLocaleTimeString('zh-CN', { hour12: false }) : '暂无成功记录');
</script>

<template>
  <section class="ward-interior-status" aria-label="病房数据状态" :data-status="busy ? 'loading' : status">
    <div class="ward-interior-status__heading">
      <strong>{{ ward.sickroomName }}</strong>
      <span v-if="occupied.invalidCount">入住记录 {{ occupied.occupiedCount }} 条 · 已展示 {{ occupied.beds.length }} 床</span>
      <span v-else>已入住 {{ occupied.occupiedCount }} 床</span>
      <button type="button" :disabled="busy" @click="$emit('retry')">{{ busy ? '同步中…' : '重新同步' }}</button>
    </div>
    <p role="status">{{ message }}<span class="ward-interior-status__time"> · 病区最近成功同步 {{ syncTime }}</span></p>
    <details v-if="warnings.length || occupied.invalidCount">
      <summary>查看异常详情<span v-if="occupied.invalidCount"> · {{ occupied.invalidCount }} 条入住记录未展示</span></summary>
      <p v-if="occupied.invalidCount">床号缺失或重复，无法准确绑定患者；请核对床位数据后重新同步。</p>
      <ul v-if="warnings.length"><li v-for="warning in warnings" :key="warning">{{ warning }}</li></ul>
    </details>
    <small v-if="occupied.beds.length > wardInteriorSceneConfig.modular.slots.length">房间按入住数量扩展，尺寸为展示示意。</small>
  </section>
</template>

<style scoped lang="scss">
.ward-interior-status {
  position: relative;
  top: 0;
  left: 0;
  z-index: 12;
  box-sizing: border-box;
  width: 100%;
  max-height: 260px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid #416274;
  border-radius: 10px;
  background: rgba(10, 29, 43, .95);
  color: #eaf5f8;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
  &__heading { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; }
  &__heading strong { font-size: 15px; }
  &__heading button { margin-left: auto; }
  p { margin: 6px 0 0; }
  &__time, small { color: #b9cbd7; }
  button { flex-shrink: 0; min-height: 36px; padding: 4px 10px; color: #eaf5f8; background: #20475c; border: 1px solid #719bb0; border-radius: 5px; cursor: pointer; font: inherit; }
  button:disabled { opacity: .6; cursor: wait; }
  :focus-visible { outline: 2px solid #8ad8ff; outline-offset: 2px; }
  summary { padding-top: 6px; color: #ffdca5; cursor: pointer; }
  ul { margin: 6px 0; padding-left: 20px; }
  &[data-status='error'], &[data-status='warning'], &[data-status='stale'] { border-color: #b28e5b; }
  @media (max-width: 600px) {
    top: 0; left: 0; width: 100%; padding: 8px 10px;
    &__time { display: block; }
  }
}
</style>
