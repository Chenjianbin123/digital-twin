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
        <option value="" disabled>选择床位</option>
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
  --ward-nav-bg: rgba(7, 34, 48, 0.76);
  --ward-nav-control: rgba(8, 43, 58, 0.72);
  --ward-nav-control-hover: rgba(18, 68, 82, 0.78);
  --ward-nav-ink: #e5f2f5;
  --ward-nav-muted: #a5bec8;
  --ward-nav-border: rgba(112, 192, 207, 0.32);
  --ward-nav-accent: #8be0e5;
  position: sticky; top: 0; z-index: 3; overflow: hidden;
  padding: 14px; margin-bottom: 14px;
  color: var(--ward-nav-ink);
  background:
    linear-gradient(145deg, rgba(14, 54, 68, 0.72), var(--ward-nav-bg)),
    radial-gradient(circle at 10% 0, rgba(139, 224, 229, 0.09), transparent 44%);
  border: 1px solid var(--ward-nav-border); border-radius: 10px;
  box-shadow: inset 0 1px 0 rgba(196, 242, 247, 0.08), 0 8px 18px rgba(0, 10, 20, 0.2);
  backdrop-filter: blur(16px) saturate(112%);
  -webkit-backdrop-filter: blur(16px) saturate(112%);

  &::before {
    content: "";
    position: absolute; top: 0; left: 10%; right: 36%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(145, 236, 238, 0.72), transparent);
    box-shadow: 0 0 10px rgba(111, 221, 226, 0.28);
    pointer-events: none;
  }

  label {
    display: flex; align-items: center; gap: 7px;
    margin-bottom: 10px; color: var(--ward-nav-muted);
    font-size: 12px; font-weight: 600; letter-spacing: .025em;
  }
  label::before {
    content: ""; width: 4px; height: 4px; flex: 0 0 4px;
    border-radius: 50%; background: var(--ward-nav-accent);
    box-shadow: 0 0 8px var(--ward-nav-accent);
  }

  &__controls { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 8px; }
  button, select {
    min-height: 42px;
    border: 1px solid var(--ward-nav-border); border-radius: 7px;
    color: inherit; background-color: var(--ward-nav-control);
    font: inherit; font-size: 13px;
    transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease, color 160ms ease;
  }
  button {
    min-width: 54px; padding: 5px 10px; cursor: pointer;
    color: #c7e7ec; white-space: nowrap;
  }
  button:not(:disabled):hover {
    color: #f1feff; border-color: rgba(139, 224, 229, 0.58);
    background-color: var(--ward-nav-control-hover);
    box-shadow: inset 0 1px 0 rgba(206, 249, 251, 0.08), 0 0 12px rgba(111, 221, 226, 0.1);
  }
  button:disabled {
    color: #76909a; border-color: rgba(112, 192, 207, 0.14);
    background-color: rgba(7, 28, 40, 0.42); cursor: default;
  }
  select {
    min-width: 0; width: 100%; padding: 5px 36px 5px 12px;
    appearance: none; cursor: pointer; color-scheme: light;
    background-image:
      linear-gradient(45deg, transparent 50%, var(--ward-nav-accent) 50%),
      linear-gradient(135deg, var(--ward-nav-accent) 50%, transparent 50%);
    background-position: calc(100% - 16px) 18px, calc(100% - 11px) 18px;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
  }
  select:hover { border-color: rgba(139, 224, 229, 0.52); background-color: var(--ward-nav-control-hover); }
  select option, select optgroup { color: #173744; background: #f7fbfd; }
  :focus-visible {
    outline: 2px solid var(--ward-nav-accent); outline-offset: 2px;
    border-color: var(--ward-nav-accent);
    box-shadow: 0 0 0 3px rgba(139, 224, 229, 0.12);
  }
  p { font-size: 12px; line-height: 1.55; margin: 9px 0 0; color: var(--ward-nav-muted); }
}
:global(.digital-twin[data-theme='light']) .ward-bed-nav {
  --ward-nav-bg: rgba(244, 249, 252, 0.78);
  --ward-nav-control: rgba(255, 255, 255, 0.74);
  --ward-nav-control-hover: rgba(237, 247, 250, 0.92);
  --ward-nav-ink: #294b59;
  --ward-nav-muted: #597582;
  --ward-nav-border: #bdd5df;
  --ward-nav-accent: #2f899a;
  color-scheme: light;
  select { color-scheme: light; }
  select option, select optgroup { color: #294b59; background: #f7fbfd; }
}
@media (prefers-reduced-motion: reduce) {
  .ward-bed-nav button, .ward-bed-nav select { transition: none; }
}
</style>
