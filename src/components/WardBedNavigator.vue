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
  --ward-nav-surface: rgba(14, 54, 68, 0.72);
  --ward-nav-glow: rgba(139, 224, 229, 0.09);
  --ward-nav-control: rgba(8, 43, 58, 0.72);
  --ward-nav-control-hover: rgba(18, 68, 82, 0.78);
  --ward-nav-ink: #e5f2f5;
  --ward-nav-muted: #a5bec8;
  --ward-nav-btn: #c7e7ec;
  --ward-nav-btn-hover: #f1feff;
  --ward-nav-btn-disabled: #76909a;
  --ward-nav-disabled-bg: rgba(7, 28, 40, 0.42);
  --ward-nav-border: rgba(112, 192, 207, 0.32);
  --ward-nav-border-hover: rgba(139, 224, 229, 0.58);
  --ward-nav-border-disabled: rgba(112, 192, 207, 0.14);
  --ward-nav-accent: #8be0e5;
  --ward-nav-rail: rgba(145, 236, 238, 0.72);
  --ward-nav-shadow: rgba(0, 10, 20, 0.2);
  --ward-nav-inset: rgba(196, 242, 247, 0.08);
  position: sticky; top: 0; z-index: 3; overflow: hidden;
  padding: 14px; margin-bottom: 14px;
  color: var(--ward-nav-ink);
  background:
    linear-gradient(145deg, var(--ward-nav-surface), var(--ward-nav-bg)),
    radial-gradient(circle at 10% 0, var(--ward-nav-glow), transparent 44%);
  border: 1px solid var(--ward-nav-border); border-radius: 10px;
  box-shadow: inset 0 1px 0 var(--ward-nav-inset), 0 8px 18px var(--ward-nav-shadow);
  backdrop-filter: blur(16px) saturate(112%);
  -webkit-backdrop-filter: blur(16px) saturate(112%);

  &::before {
    content: "";
    position: absolute; top: 0; left: 10%; right: 36%; height: 1px;
    background: linear-gradient(90deg, transparent, var(--ward-nav-rail), transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--ward-nav-accent) 40%, transparent);
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
    color: var(--ward-nav-btn); white-space: nowrap;
  }
  button:not(:disabled):hover {
    color: var(--ward-nav-btn-hover); border-color: var(--ward-nav-border-hover);
    background-color: var(--ward-nav-control-hover);
    box-shadow: inset 0 1px 0 var(--ward-nav-inset), 0 0 12px color-mix(in srgb, var(--ward-nav-accent) 18%, transparent);
  }
  button:disabled {
    color: var(--ward-nav-btn-disabled); border-color: var(--ward-nav-border-disabled);
    background-color: var(--ward-nav-disabled-bg); cursor: default;
  }
  select {
    min-width: 0; width: 100%; padding: 5px 36px 5px 12px;
    appearance: none; cursor: pointer; color-scheme: dark;
    background-image:
      linear-gradient(45deg, transparent 50%, var(--ward-nav-accent) 50%),
      linear-gradient(135deg, var(--ward-nav-accent) 50%, transparent 50%);
    background-position: calc(100% - 16px) 18px, calc(100% - 11px) 18px;
    background-size: 5px 5px, 5px 5px;
    background-repeat: no-repeat;
  }
  select:hover { border-color: var(--ward-nav-border-hover); background-color: var(--ward-nav-control-hover); }
  select option, select optgroup { color: #173744; background: #f7fbfd; }
  :focus-visible {
    outline: 2px solid var(--ward-nav-accent); outline-offset: 2px;
    border-color: var(--ward-nav-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ward-nav-accent) 18%, transparent);
  }
  p { font-size: 12px; line-height: 1.55; margin: 9px 0 0; color: var(--ward-nav-muted); }
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav) {
  --ward-nav-bg: #e8f0f4;
  --ward-nav-surface: #f2f8fa;
  --ward-nav-glow: rgba(61, 117, 133, 0.08);
  --ward-nav-control: #eef4f7;
  --ward-nav-control-hover: #e2eaee;
  --ward-nav-ink: #243944;
  --ward-nav-muted: #5a717c;
  --ward-nav-btn: #2a4d5a;
  --ward-nav-btn-hover: #1e3642;
  --ward-nav-btn-disabled: #8aa0aa;
  --ward-nav-disabled-bg: #d5e0e5;
  --ward-nav-border: #9aafb8;
  --ward-nav-border-hover: #3d7585;
  --ward-nav-border-disabled: #b7c7ce;
  --ward-nav-accent: #3d7585;
  --ward-nav-rail: #5aa8b8;
  --ward-nav-shadow: rgba(35, 68, 84, 0.08);
  --ward-nav-inset: rgba(255, 255, 255, 0.85);
  color: #243944;
  color-scheme: light;
  background:
    linear-gradient(145deg, #f2f8fa, #e8f0f4),
    radial-gradient(circle at 10% 0, rgba(61, 117, 133, 0.08), transparent 44%);
  border-color: #9aafb8;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 6px 14px rgba(35, 68, 84, 0.08);
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav button) {
  color: #2a4d5a;
  background-color: #eef4f7;
  border-color: #9aafb8;
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav button:not(:disabled):hover) {
  color: #1e3642;
  background-color: #e2eaee;
  border-color: #3d7585;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav button:disabled) {
  color: #8aa0aa;
  background-color: #d5e0e5;
  border-color: #b7c7ce;
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav select) {
  color: #243944;
  color-scheme: light;
  background-color: #eef4f7;
  border-color: #9aafb8;
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav select:hover) {
  background-color: #e2eaee;
  border-color: #3d7585;
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav label),
:global(.digital-twin[data-theme='light'] .ward-bed-nav p) {
  color: #5a717c;
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav label::before) {
  background: #3d7585;
  box-shadow: 0 0 8px rgba(61, 117, 133, 0.35);
}

:global(.digital-twin[data-theme='light'] .ward-bed-nav select option),
:global(.digital-twin[data-theme='light'] .ward-bed-nav select optgroup) {
  color: #243944;
  background: #f7fbfd;
}

@media (prefers-reduced-motion: reduce) {
  .ward-bed-nav button, .ward-bed-nav select { transition: none; }
}
</style>
