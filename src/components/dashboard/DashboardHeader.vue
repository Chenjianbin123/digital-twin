<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  theme?: 'light' | 'dark';
  areaName?: string;
  deptName?: string;
  envTemp?: string;
  isLoading?: boolean;
  canSwitchArea?: boolean;
  isAreaSwitching?: boolean;
  dataSource?: 'mock' | 'remote' | 'database';
  dataStatus?: 'loading' | 'ready' | 'warning' | 'stale' | 'error';
  operatorName?: string;
  operatorRole?: string;
  /** 护士站模式：隐藏右侧时钟，避免与侧栏重复 */
  compact?: boolean;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  refresh: [];
  openAreaSwitch: [];
  logout: [];
}>();

const dataStatusLabel = computed(() => ({
  loading: '同步中', ready: '已同步', warning: '有告警', stale: '已过期', error: '同步失败',
}[props.dataStatus ?? 'loading']));
</script>

<template>
  <header class="dash-header">
    <span class="dash-header__rail" aria-hidden="true" />
    <span class="dash-header__sheen" aria-hidden="true" />
    <span class="dash-header__corner dash-header__corner--tl" aria-hidden="true" />
    <span class="dash-header__corner dash-header__corner--tr" aria-hidden="true" />

    <div class="dash-header__side dash-header__side--left">
      <div class="dash-header__area-cluster" :class="{ 'dash-header__area-cluster--compact': compact }">
        <button
          v-if="areaName"
          type="button"
          class="dash-header__area-trigger"
          :disabled="!canSwitchArea || isAreaSwitching"
          :aria-label="`切换病区，当前为${areaName}`"
          :title="canSwitchArea ? `切换病区，当前为${areaName}` : areaName"
          @click="emit('openAreaSwitch')"
        >
          <span class="dash-header__area-mark" aria-hidden="true" />
          <svg class="dash-header__area-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 21V4h12v17M2 21h20M8 8h4M8 12h4M17 9h3v12"/></svg>
          <span class="dash-header__area-name">{{ areaName }}</span>
          <span class="dash-header__chevron" aria-hidden="true">
            <i />
          </span>
        </button>
        <div class="dash-header__area-meta">
          <span v-if="deptName" class="dash-header__dept">{{ deptName }}</span>
          <span v-if="deptName && dataSource" class="dash-header__dot" aria-hidden="true" />
          <span v-if="dataSource" class="dash-header__tag" :class="`dash-header__tag--${dataSource}`">
            <i aria-hidden="true" />
            {{ dataSource === 'remote' ? '实时' : dataSource === 'database' ? '数据库' : '模拟' }}
          </span>
          <span v-if="dataStatus" class="dash-header__data-status" :class="`dash-header__data-status--${dataStatus}`">
            <i aria-hidden="true" />
            {{ dataStatusLabel }}
          </span>
        </div>
      </div>
    </div>

    <div class="dash-header__center">
      <div class="dash-header__title-wrap">
        <span class="dash-header__wing dash-header__wing--left" aria-hidden="true" />
        <div class="dash-header__title-stack">
          <span class="dash-header__kicker" aria-hidden="true">DIGITAL TWIN COMMAND</span>
          <h1 class="dash-header__title">数字孪生智慧医院管理平台</h1>
        </div>
        <span class="dash-header__wing dash-header__wing--right" aria-hidden="true" />
      </div>
      <div class="dash-header__title-glow" aria-hidden="true" />
    </div>

    <div class="dash-header__side dash-header__side--right" :class="{ 'dash-header__side--compact': compact }">
      <div class="dash-header__actions">
        <button type="button" class="dash-header__theme" :aria-label="theme === 'light' ? '切换深色主题' : '切换浅色主题'" :title="theme === 'light' ? '切换深色主题' : '切换浅色主题'" @click="emit('toggleTheme')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 5v14"/><path d="M12 5a7 7 0 0 1 0 14Z" fill="currentColor"/></svg>
          <span>{{ theme === 'light' ? '深色' : '浅色' }}</span>
        </button>
        <slot name="actions" />
        <div v-if="operatorName" class="dash-header__operator" :title="`${operatorName}${operatorRole ? ` · ${operatorRole}` : ''}`">
          <span class="dash-header__operator-dot" aria-hidden="true" />
          <strong>{{ operatorName }}</strong>
        </div>
        <button
          type="button"
          class="dash-header__refresh"
          :disabled="isLoading || isAreaSwitching"
          aria-label="刷新数据"
          title="刷新数据"
          @click="emit('refresh')"
        >
          <svg class="dash-header__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 0-2 6M20 7l-3-3"/></svg>
          <span class="dash-header__action-label">刷新</span>
        </button>
        <button
          type="button"
          class="dash-header__logout"
          aria-label="退出登录"
          title="退出登录"
          @click="emit('logout')"
        >
          <svg class="dash-header__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H4v16h6M9 12h12m-4-4 4 4-4 4"/></svg>
          <span class="dash-header__action-label">退出</span>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped lang="scss">
.dash-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 10px 20px 8px;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(6, 16, 32, 0.92) 0%, rgba(6, 16, 32, 0.55) 70%, transparent 100%);

  &__side {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    pointer-events: auto;

    &--left {
      align-items: flex-start;
      padding-top: 6px;
    }

    &--right {
      align-items: flex-end;

      &.dash-header__side--compact {
        flex-direction: row;
        align-items: center;
        justify-content: flex-end;
        padding-top: 8px;
      }
    }
  }

  &__area-cluster {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  &__area-meta {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  &__dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: rgba(125, 219, 242, 0.52);
    flex: 0 0 auto;
  }

  &__dept {
    margin: 0;
    max-width: min(280px, 100%);
    overflow-wrap: anywhere;
    font-size: 12px;
    color: rgba(190, 220, 245, 0.88);
    letter-spacing: 0;
  }

  &__area-trigger {
    display: inline-flex;
    max-width: min(320px, 100%);
    min-height: 30px;
    padding: 5px 9px;
    border: 1px solid rgba(77, 208, 255, 0.34);
    border-radius: 4px;
    align-items: center;
    gap: 7px;
    color: #e4faff;
    background: rgba(8, 39, 55, 0.84);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;

    &:hover:not(:disabled) {
      border-color: rgba(77, 208, 255, 0.72);
      background: rgba(11, 55, 75, 0.92);
      box-shadow: 0 0 12px rgba(77, 208, 255, 0.18);
    }

    &:focus-visible {
      outline: 2px solid #a2edfa;
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.58;
      cursor: not-allowed;
    }
  }

  &__area-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 700;
  }

  &__chevron {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 10px;
    height: 10px;

    i {
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-top: 5px solid #5bd3ef;
      transform: translateY(1px);
    }
  }

  &__tag {
    padding: 2px 8px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 3px;
    border: 1px solid rgba(77, 208, 255, 0.3);

    &--remote {
      color: #81c784;
      background: rgba(76, 175, 80, 0.12);
      border-color: rgba(129, 199, 132, 0.35);
    }

    &--mock {
      color: #ffb74d;
      background: rgba(255, 152, 0, 0.1);
      border-color: rgba(255, 183, 77, 0.35);
    }

    &--database {
      color: #4deaff;
      background: rgba(77, 208, 255, 0.12);
      border-color: rgba(77, 208, 255, 0.35);
    }
  }

  &__data-status {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    padding: 0 7px;
    border: 1px solid rgba(126, 223, 210, 0.28);
    border-radius: 4px;
    color: #9fe5d8;
    font-size: 11px;
    font-weight: 700;
    background: rgba(40, 142, 133, 0.12);

    &--loading { color: #bdeff7; border-color: rgba(123, 223, 242, 0.3); background: rgba(79, 195, 247, 0.12); }
    &--warning { color: #ffcf8a; border-color: rgba(255, 183, 77, 0.34); background: rgba(255, 183, 77, 0.12); }
    &--stale, &--error { color: #ffb4a3; border-color: rgba(255, 123, 100, 0.36); background: rgba(255, 92, 80, 0.12); }
  }

  &__center {
    position: relative;
    min-width: 0;
    text-align: center;
    padding-top: 2px;
  }

  &__title-wrap {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  &__title {
    margin: 0;
    min-width: 0;
    font-size: dash-font(22);
    font-weight: 800;
    letter-spacing: 0;
    color: #f7fbfd;
    white-space: normal;
    text-shadow:
      0 0 20px rgba(77, 208, 255, 0.65),
      0 0 40px rgba(0, 140, 255, 0.35);
  }

  &__title-glow {
    position: absolute;
    left: 50%;
    bottom: -4px;
    transform: translateX(-50%);
    width: min(420px, 60vw);
    height: 3px;
    background: linear-gradient(90deg, transparent, #4deaff, transparent);
    opacity: 0.75;
    filter: blur(1px);
  }

  &__wing {
    width: 48px;
    flex: 0 1 48px;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(77, 208, 255, 0.8));
    position: relative;

    &::before {
      content: '';
      position: absolute;
      top: -3px;
      width: 8px;
      height: 8px;
      border: 1px solid rgba(77, 208, 255, 0.6);
      transform: rotate(45deg);
    }

    &--left {
      background: linear-gradient(90deg, transparent, rgba(77, 208, 255, 0.8));

      &::before { right: 0; }
    }

    &--right {
      background: linear-gradient(90deg, rgba(77, 208, 255, 0.8), transparent);

      &::before { left: 0; }
    }
  }

  &__operator {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: min(220px, 22vw);
    min-width: 0;
    margin-bottom: 0;
    text-align: right;

    strong,
    span {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      letter-spacing: 0;
    }

    strong {
      color: #e8f8ff;
      font-size: 11px;
    }

    span {
      color: #7fcfd7;
      font-size: 10px;
    }

    strong + span {
      padding-left: 6px;
      border-left: 1px solid rgba(127, 207, 215, 0.3);
    }
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }

  &__operator-dot {
    display: none;
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__temp,
  &__clock {
    font-size: 14px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    @include dash-glow-text;
  }

  &__divider {
    width: 1px;
    height: 14px;
    background: rgba(77, 208, 255, 0.35);
  }

  &__date {
    margin: 2px 0 0;
    font-size: 11px;
    color: rgba(180, 210, 235, 0.75);
  }

  &__refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 1px solid rgba(77, 208, 255, 0.35);
    background: rgba(0, 80, 140, 0.25);
    color: #4deaff;
    font-size: 16px;
    cursor: pointer;
    transition: background 0.15s, box-shadow 0.15s;

    &:hover:not(:disabled) {
      background: rgba(0, 120, 200, 0.35);
      box-shadow: 0 0 12px rgba(77, 208, 255, 0.3);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  }

  &__logout {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
    width: 28px;
    height: 28px;
    border: 1px solid rgba(255, 183, 77, 0.38);
    border-radius: 50%;
    color: #ffd08a;
    font-size: 16px;
    background: rgba(115, 72, 18, 0.24);
    cursor: pointer;

    &:hover {
      background: rgba(145, 91, 24, 0.38);
      box-shadow: 0 0 12px rgba(255, 183, 77, 0.22);
    }

    &:focus-visible {
      outline: 2px solid #ffe0ac;
      outline-offset: 2px;
    }
  }

  &__action-icon {
    line-height: 1;
  }

  &__action-label {
    display: none;
  }

  &:has(.dash-header__side--compact) {
    padding-top: 6px;
    padding-bottom: 3px;
    background:
      linear-gradient(180deg, rgba(6, 15, 27, 0.84) 0%, rgba(6, 15, 27, 0.38) 58%, transparent 100%);

    &::after {
      left: 30%;
      right: 30%;
      opacity: 0.38;
    }

    .dash-header__side--left {
      padding-top: 2px;
      gap: 0;
    }

    .dash-header__center {
      padding-top: 0;
    }

    .dash-header__title {
      font-size: 19px;
      text-shadow:
        0 0 14px rgba(77, 208, 255, 0.44),
        0 0 24px rgba(0, 140, 255, 0.2);
    }

    .dash-header__title-glow {
      width: min(300px, 44vw);
      opacity: 0.42;
    }

    .dash-header__wing {
      width: 32px;
      flex-basis: 32px;
      opacity: 0.5;
    }

    .dash-header__area-trigger {
      min-height: 28px;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(8, 39, 55, 0.58);
      box-shadow: 0 0 12px rgba(77, 208, 255, 0.06);
    }

    .dash-header__area-name {
      max-width: 86px;
      font-size: 12px;
    }

    .dash-header__dept {
      display: inline;
      max-width: 112px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 700;
      color: rgba(206, 232, 248, 0.82);
    }

    .dash-header__tag {
      padding: 0;
      border: none;
      background: transparent;
      color: rgba(138, 230, 176, 0.9);
      font-size: 13px;
      font-weight: 800;
      white-space: nowrap;
    }

    .dash-header__area-cluster {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      max-width: min(340px, 32vw);
      padding: 6px 10px;
      border: 1px solid rgba(77, 208, 255, 0.16);
      border-radius: 10px;
      background:
        linear-gradient(180deg, rgba(10, 38, 54, 0.5), rgba(5, 23, 36, 0.3)),
        rgba(4, 22, 33, 0.18);
      box-shadow: inset 0 1px 0 rgba(247, 251, 253, 0.035);
      backdrop-filter: blur(5px);
    }

    .dash-header__area-meta {
      gap: 6px;
      padding-left: 0;
      white-space: nowrap;
    }

    .dash-header__chevron {
      width: 10px;
      height: 10px;

      i {
        transform: translateY(1px);
      }
    }

    .dash-header__refresh,
    .dash-header__logout {
      width: auto;
      min-width: 58px;
      height: 30px;
      gap: 5px;
      padding: 0 10px;
      margin-top: 0;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 800;
      background: rgba(0, 80, 140, 0.16);
    }

    .dash-header__logout {
      background: rgba(115, 72, 18, 0.18);
    }

    .dash-header__action-icon {
      font-size: 14px;
    }

    .dash-header__action-label {
      display: inline;
      line-height: 1;
    }

    .dash-header__operator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: 150px;
      min-height: 30px;
      margin: 0 2px 0 0;
      padding: 0 10px;
      border: 1px solid rgba(118, 222, 255, 0.14);
      border-radius: 999px;
      background: rgba(7, 30, 45, 0.24);
      text-align: left;

      strong {
        min-width: 0;
        font-size: 12px;
        font-weight: 800;
        color: rgba(232, 248, 255, 0.92);
      }
    }

    .dash-header__operator-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #7ee7c5;
      box-shadow: 0 0 9px rgba(126, 231, 197, 0.52);
      flex: 0 0 auto;
    }

    .dash-header__actions {
      margin-left: auto;
    }
  }

  @include down($bp-md) {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 5px 10px;
    text-align: center;
    padding: 8px 12px;

    &__center {
      grid-column: 1 / -1;
      grid-row: 1;
      padding-top: 0;
    }

    &__side--left {
      grid-column: 1;
      grid-row: 2;
      padding-top: 0;
    }

    &__side--right {
      display: flex;
      grid-column: 2;
      grid-row: 2;
      padding-top: 0;

      &.dash-header__side--compact {
        padding-top: 0;
      }
    }

    &__title {
      letter-spacing: 0;
      white-space: normal;
      font-size: 16px;
      line-height: 1.25;
    }

    &__status,
    &__date,
    &__dept,
    &__tag { display: none; }

    &__area-trigger { max-width: 100%; }
    &__area-name { font-size: 12px; }
    &__refresh,
    &__logout { margin-top: 0; }
    &__operator { display: none; }
    &__wing { display: none; }

    &:has(.dash-header__side--compact) {
      padding-top: 7px;
      padding-bottom: 7px;

      .dash-header__title {
        font-size: 15px;
      }
    }
  }
}

@media (min-width: 1024px) and (max-width: 1199px) {
  .dash-header {
    grid-template-columns: minmax(0, 1fr) minmax(250px, 1.15fr) minmax(0, 1fr);
    gap: 8px;
    padding: 8px 14px 6px;

    &__title {
      font-size: clamp(17px, 1.8vw, 20px);
    }

    &__title-wrap {
      gap: 8px;
    }

    &__wing {
      width: 24px;
      flex-basis: 24px;
    }

    &__area-name {
      max-width: min(220px, 24vw);
    }

    &__operator {
      max-width: min(180px, 18vw);
    }

    &__status,
    &__date {
      display: none;
    }

    &:has(.dash-header__side--compact) {
      .dash-header__action-label {
        display: none;
      }

      .dash-header__refresh,
      .dash-header__logout {
        min-width: 32px;
        width: 32px;
        padding: 0;
      }
    }
  }
}

/* 保持桌面头部高度，与场景顶部预留空间一致；青绿指挥台语言强化科技层级。 */
.dash-header.dash-header {
  --hdr-ink: #e8f6fb;
  --hdr-muted: #9fc3d0;
  --hdr-cyan: #7fe7df;
  --hdr-cyan-soft: #67d5e8;
  --hdr-line: #7eb6c655;
  --hdr-panel: linear-gradient(155deg, #16384799, #0d273488 58%, #0b223080);
  --hdr-chip: linear-gradient(160deg, #1a4456aa, #12354588);
  height: 60px;
  box-sizing: border-box;
  padding: 0 22px;
  align-items: center;
  isolation: isolate;
  overflow: hidden;
  background:
    radial-gradient(ellipse at 50% -40%, #4ecfe028, transparent 55%),
    linear-gradient(180deg, #102b39b8 0%, #0c223098 72%, #0a1d2970 100%);
  border-bottom: 1px solid #7eb8c944;
  box-shadow:
    inset 0 1px 0 #c8eef218,
    inset 0 -1px 0 #06141f55,
    0 10px 28px #020d1866,
    0 1px 0 #7fd7e312;
  backdrop-filter: blur(28px) saturate(140%);
  -webkit-backdrop-filter: blur(28px) saturate(140%);

  .dash-header__rail {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 0;
    height: 2px;
    border-radius: 0 0 2px 2px;
    background: linear-gradient(90deg, transparent, #7fe7df, #67c8e8, #7fe7df, transparent);
    box-shadow: 0 0 16px #67e0f266;
    pointer-events: none;
    z-index: 2;
  }

  .dash-header__sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    background:
      linear-gradient(115deg, transparent 18%, #9ef3ff0c 42%, transparent 58%),
      repeating-linear-gradient(90deg, transparent 0 31px, #84dce908 32px);
    mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
    opacity: .7;
  }

  .dash-header__corner {
    position: absolute;
    top: 8px;
    width: 14px;
    height: 14px;
    pointer-events: none;
    z-index: 2;
    border-color: #7fe7df99;
    border-style: solid;
    opacity: .85;
    &--tl { left: 10px; border-width: 2px 0 0 2px; }
    &--tr { right: 10px; border-width: 2px 2px 0 0; }
  }

  .dash-header__side--left,
  .dash-header__side--right,
  .dash-header__center {
    position: relative;
    z-index: 1;
    padding-top: 0;
  }

  .dash-header__area-cluster {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    max-width: 100%;
    padding: 4px 6px 4px 4px;
    border: 1px solid #7eb6c638;
    border-radius: 10px;
    background:
      linear-gradient(120deg, #173e4f77, #102b3966),
      #0d253255;
    box-shadow: inset 0 1px 0 #d8f6ff0c, 0 6px 16px #02101833;
    backdrop-filter: blur(12px);
  }

  .dash-header__area-trigger {
    position: relative;
    min-height: 36px;
    max-width: 220px;
    padding: 6px 12px 6px 10px;
    border: 1px solid #7fcad348;
    border-radius: 8px;
    background: var(--hdr-chip);
    box-shadow: inset 0 1px 0 #d7f8ff14, 0 0 0 1px #06182044;
    color: var(--hdr-ink);
    transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
  }

  .dash-header__area-mark {
    position: absolute;
    left: 0;
    top: 8px;
    bottom: 8px;
    width: 2px;
    border-radius: 2px;
    background: linear-gradient(180deg, #9af3ea, #4db8d0);
    box-shadow: 0 0 8px #67e8df88;
  }

  .dash-header__area-icon {
    width: 17px;
    height: 17px;
    flex-shrink: 0;
    color: var(--hdr-cyan);
    filter: drop-shadow(0 0 6px #67e8df55);
  }

  .dash-header__area-name {
    max-width: 170px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: .02em;
    color: #f2fbff;
  }

  .dash-header__chevron i {
    border-top-color: #7fe7df;
  }

  .dash-header__area-meta { gap: 7px; }

  .dash-header__dept {
    max-width: 90px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--hdr-muted);
    font-size: 12px;
    font-weight: 500;
  }

  .dash-header__tag,
  .dash-header__data-status {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 22px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: .04em;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid #7fcad345;
    background: #12364588;
    color: #b7e7ef;
    i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 8px currentColor;
      flex: 0 0 auto;
    }
  }

  .dash-header__tag--remote { color: #8eebc2; border-color: #70d3a848; background: #16463b88; }
  .dash-header__tag--mock { color: #efc889; border-color: #d2a35a48; background: #4a372088; }
  .dash-header__tag--database { color: #7fe7df; border-color: #67d5e848; background: #13445588; }
  .dash-header__data-status--loading { color: #9adcf0; }
  .dash-header__data-status--warning { color: #efc889; border-color: #d2a35a48; background: #4a372088; }
  .dash-header__data-status--stale,
  .dash-header__data-status--error { color: #f0a8b0; border-color: #d48a9648; background: #4a243088; }

  .dash-header__title-stack {
    display: grid;
    gap: 2px;
    justify-items: center;
    min-width: 0;
  }

  .dash-header__kicker {
    font-family: "Bahnschrift", "Segoe UI", sans-serif;
    font-size: 9px;
    font-weight: 500;
    letter-spacing: .28em;
    line-height: 1;
    color: #7fcad3;
    text-indent: .28em;
  }

  .dash-header__title {
    font-family: "Bahnschrift", "Microsoft YaHei UI", "PingFang SC", sans-serif;
    font-size: clamp(18px, 1.15vw, 24px);
    font-weight: 600;
    letter-spacing: .12em;
    color: #f4fbff;
    line-height: 1.2;
    text-shadow:
      0 0 18px #67d5e855,
      0 0 36px #2aa7c433;
  }

  .dash-header__title-glow {
    display: block;
    width: min(360px, 42vw);
    height: 2px;
    bottom: -2px;
    opacity: .9;
    background: linear-gradient(90deg, transparent, #7fe7df, #67c8e8, #7fe7df, transparent);
    box-shadow: 0 0 12px #67e0f266;
    filter: none;
  }

  .dash-header__wing {
    width: 42px;
    flex-basis: 42px;
    height: 1px;
    opacity: .95;
    background: linear-gradient(90deg, transparent, #7fe7dfcc);
  }

  .dash-header__wing::before {
    display: block;
    width: 7px;
    height: 7px;
    top: -3px;
    border-color: #7fe7dfaa;
    box-shadow: 0 0 8px #67e8df55;
  }

  .dash-header__wing--right {
    background: linear-gradient(90deg, #7fe7dfcc, transparent);
  }

  .dash-header__actions {
    gap: 8px;
    padding: 4px;
    border: 1px solid #7eb6c638;
    border-radius: 10px;
    background: linear-gradient(160deg, #15384977, #102b3966);
    box-shadow: inset 0 1px 0 #d8f6ff0c;
    backdrop-filter: blur(12px);
  }

  .dash-header__operator {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 160px;
    min-height: 34px;
    margin: 0;
    padding: 0 11px;
    border: 1px solid #7fcad338;
    border-radius: 999px;
    background: #12364577;
  }

  .dash-header__operator strong {
    font-size: 12px;
    font-weight: 600;
    color: #eaf8ff;
  }

  .dash-header__operator-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    flex-shrink: 0;
    background: #7ee7c5;
    border-radius: 50%;
    box-shadow: 0 0 10px #7ee7c5aa;
  }

  .dash-header__theme,
  .dash-header__refresh,
  .dash-header__logout {
    display: inline-flex;
    margin: 0;
    width: auto;
    min-width: 36px;
    height: 34px;
    padding: 0 11px;
    gap: 6px;
    border-radius: 8px;
    border: 1px solid #7eb6c648;
    background: linear-gradient(165deg, #1a455799, #12354477);
    color: #c5e8ef;
    font-size: 12px;
    font-weight: 600;
    box-shadow: inset 0 1px 0 #d7f8ff10;
    transition: border-color .18s ease, background .18s ease, box-shadow .18s ease, color .18s ease;
  }

  .dash-header__logout {
    color: #efd2a4;
    border-color: #d2a35a48;
    background: linear-gradient(165deg, #4a372499, #35271877);
  }

  .dash-header__action-icon {
    display: block;
    width: 15px;
    height: 15px;
    flex-shrink: 0;
  }

  .dash-header__action-label { display: inline; line-height: 1; }

  .dash-header__theme svg { width: 15px; height: 15px; }

  button:hover:not(:disabled) {
    border-color: #8eebf0aa;
    background: linear-gradient(165deg, #215668bb, #16415299);
    box-shadow: 0 0 14px #67d5e833, inset 0 1px 0 #d7f8ff22;
    color: #f2fcff;
  }

  .dash-header__logout:hover:not(:disabled) {
    border-color: #efc889aa;
    background: linear-gradient(165deg, #5a4328bb, #40301c99);
    box-shadow: 0 0 14px #efc88933, inset 0 1px 0 #ffe7c222;
  }

  button:focus-visible {
    outline: 2px solid #94dfd4;
    outline-offset: 2px;
  }

  .dash-header__area-trigger:hover:not(:disabled) {
    border-color: #8eebf0aa;
    box-shadow: 0 0 16px #67d5e833, inset 0 1px 0 #d7f8ff22;
  }

  /* 护士站 compact：覆盖上方桌面规则，保留边界测试约定的布局契约 */
  &:has(.dash-header__side--compact) {
    height: 60px;
    padding: 0 18px;

    .dash-header__area-cluster {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      max-width: min(360px, 34vw);
      padding: 4px 8px 4px 4px;
    }

    .dash-header__dept {
      display: inline;
      max-width: 112px;
      font-size: 13px;
      font-weight: 700;
      color: #b7d5e0;
    }

    .dash-header__tag {
      padding: 0;
      border: none;
      background: transparent;
      color: #8ae6b0;
      font-size: 13px;
      font-weight: 800;
      i { display: none; }
    }

    .dash-header__data-status {
      min-height: 20px;
      padding: 0 7px;
      font-size: 11px;
    }

    .dash-header__kicker {
      letter-spacing: .22em;
      font-size: 8px;
    }

    .dash-header__title {
      font-size: 19px;
      letter-spacing: .1em;
    }

    .dash-header__actions {
      margin-left: auto;
    }

    .dash-header__refresh,
    .dash-header__logout,
    .dash-header__theme {
      height: 30px;
      min-width: 58px;
      border-radius: 999px;
      font-weight: 700;
    }
  }
}

@media (prefers-reduced-motion: no-preference) {
  .dash-header.dash-header .dash-header__sheen {
    animation: dash-header-sheen 7.5s linear infinite;
  }
  .dash-header.dash-header .dash-header__operator-dot {
    animation: dash-header-pulse 2.4s ease-in-out infinite;
  }
}

@keyframes dash-header-sheen {
  from { transform: translateX(-8%); }
  to { transform: translateX(8%); }
}

@keyframes dash-header-pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px #7ee7c5aa; }
  50% { opacity: .55; box-shadow: 0 0 14px #7ee7c5; }
}

@media(max-width: 1400px) {
  .dash-header.dash-header .dash-header__dept,
  .dash-header.dash-header .dash-header__dot { display: none; }
  .dash-header.dash-header .dash-header__wing { width: 28px; flex-basis: 28px; }
  .dash-header.dash-header .dash-header__kicker { letter-spacing: .18em; }
}

@media(max-width: 1100px) {
  .dash-header.dash-header .dash-header__area-meta,
  .dash-header.dash-header .dash-header__action-label,
  .dash-header.dash-header .dash-header__kicker { display: none; }
}

@media(max-width: 767px) {
  .dash-header.dash-header {
    height: auto;
    min-height: 92px;
    padding: 10px 12px;
    grid-template-columns: minmax(0,1fr) auto;
    gap: 8px;
  }
  .dash-header.dash-header .dash-header__title { font-size: 15px; letter-spacing: .06em; }
  .dash-header.dash-header .dash-header__operator { display: none; }
  .dash-header.dash-header .dash-header__area-name { max-width: 140px; }
  .dash-header.dash-header .dash-header__corner,
  .dash-header.dash-header .dash-header__wing { display: none; }
  .dash-header.dash-header .dash-header__actions { padding: 3px; gap: 5px; }
}

.dash-header__theme {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  flex-shrink: 0;
  height: 34px;
  padding: 0 11px;
  border: 1px solid #7eb6c648;
  border-radius: 8px;
  background: linear-gradient(165deg, #1a455799, #12354477);
  color: #c5e8ef;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.dash-header__theme svg { width: 15px; height: 15px; }

@media(max-width: 1200px) {
  .dash-header__theme span { display: none; }
}

@media (prefers-reduced-transparency: reduce) {
  .dash-header.dash-header {
    background: #0c2431;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .dash-header.dash-header .dash-header__area-cluster,
  .dash-header.dash-header .dash-header__actions {
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dash-header.dash-header .dash-header__sheen,
  .dash-header.dash-header .dash-header__operator-dot {
    animation: none;
  }
}
</style>
