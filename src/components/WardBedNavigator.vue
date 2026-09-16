<script setup lang="ts">
import { computed } from 'vue';
import { selectOccupiedWardBeds } from '@/core/ward-interior-beds';
import type { TwinBedEntity, TwinWardEntity } from '@/types/twin';
const props = defineProps<{ ward: TwinWardEntity; selectedBed: TwinBedEntity | null }>();
const emit = defineEmits<{ select: [bed: TwinBedEntity] }>();
const groups = computed(() => {
  const counts = new Map<string, number>();
  for (const bed of props.ward.beds) counts.set(bed.bedCode.trim(), (counts.get(bed.bedCode.trim()) ?? 0) + 1);
  const valid = props.ward.beds.filter(b => b.bedCode.trim() && counts.get(b.bedCode.trim()) === 1)
    .sort((a, b) => a.bedName.localeCompare(b.bedName, 'zh-CN', { numeric: true }) || a.bedCode.localeCompare(b.bedCode));
  return { occupied: valid.filter(b => b.isOccupied), empty: valid.filter(b => !b.isOccupied), invalid: props.ward.beds.length - valid.length };
});
const beds = computed(() => [...groups.value.occupied, ...groups.value.empty]);
const index = computed(() => beds.value.findIndex(b => b.bedCode === props.selectedBed?.bedCode));
const displayed = computed(() => selectOccupiedWardBeds(props.ward).beds.some(b => b.bedCode === props.selectedBed?.bedCode));
function move(delta: number) {
  const bed = beds.value[index.value + delta];
  if (bed) emit('select', bed);
}
function choose(event: Event) {
  const bed = beds.value.find(b => b.bedCode === (event.target as HTMLSelectElement).value);
  if (bed) emit('select', bed);
}
</script>
<template>
  <nav class="ward-bed-nav" aria-label="病房床位切换">
    <label for="ward-bed-picker">床位 · 已入住 {{ groups.occupied.length }} / 空床 {{ groups.empty.length }}</label>
    <div class="ward-bed-nav__controls">
      <button type="button" :disabled="index <= 0" @click="move(-1)">上一床</button>
      <select id="ward-bed-picker" :value="selectedBed?.bedCode ?? ''" @change="choose">
        <option value="" disabled>选择床位查看</option>
        <optgroup v-if="groups.occupied.length" label="已入住">
          <option v-for="bed in groups.occupied" :key="bed.bedCode" :value="bed.bedCode">{{ bed.bedName || bed.bedCode }} · 已入住{{ bed.isCalling ? ' · 呼叫中' : '' }}</option>
        </optgroup>
        <optgroup v-if="groups.empty.length" label="空床（不在 3D 展示）">
          <option v-for="bed in groups.empty" :key="bed.bedCode" :value="bed.bedCode">{{ bed.bedName || bed.bedCode }} · 空床</option>
        </optgroup>
      </select>
      <button type="button" :disabled="!beds.length || index >= beds.length - 1" @click="move(1)">下一床</button>
    </div>
    <p v-if="groups.invalid" role="status">{{ groups.invalid }} 条床位记录缺少唯一床号，暂不可选择。</p>
    <p v-if="selectedBed && !displayed">{{ selectedBed.isOccupied ? '该入住床位暂未在 3D 展示，可查看下方资料。' : '当前为空床，不在 3D 展示；镜头保持原位。' }}</p>
    <p v-else-if="!beds.length">当前暂无可选择的床位。</p>
  </nav>
</template>
<style scoped lang="scss">
.ward-bed-nav {
  position: sticky; top: 0; z-index: 3; padding: 12px; margin-bottom: 14px;
  background: var(--ward-nav-bg, #173343); color: var(--ward-nav-ink, #e5f2f5);
  border: 1px solid var(--ward-nav-border, #456271); border-radius: 8px;
  label { display: block; font-size: 13px; margin-bottom: 8px; }
  &__controls { display: flex; gap: 6px; }
  button, select { min-height: 40px; border: 1px solid var(--ward-nav-border, #456271); border-radius: 5px; color: inherit; background: var(--ward-nav-bg, #173343); font: inherit; font-size: 13px; }
  button { flex-shrink: 0; padding: 4px 8px; cursor: pointer; }
  button:disabled { opacity: .45; cursor: default; }
  select { flex: 1; min-width: 0; width: 0; padding: 4px; }
  :focus-visible { outline: 2px solid #409eb4; outline-offset: 2px; }
  p { font-size: 12px; line-height: 1.5; margin: 8px 0 0; }
}
:global(.digital-twin[data-theme='light']) .ward-bed-nav { --ward-nav-bg: #f4f9fc; --ward-nav-ink: #294b59; --ward-nav-border: #bdd5df; }
</style>
