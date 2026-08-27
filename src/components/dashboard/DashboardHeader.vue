<script setup lang="ts">
import { computed } from 'vue';
import { useLiveClock } from '@/composables/use-live-clock';

const props = defineProps<{
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
  refresh: [];
  openAreaSwitch: [];
  logout: [];
}>();

const { timeText, dateText } = useLiveClock();

const displayTemp = computed(() => {
  const t = props.envTemp;
  if (!t)
    return null;
  return t.includes('°') ? t : `${t}°C`;
});

const dataStatusLabel = computed(() => ({
  loading: '同步中', ready: '已同步', warning: '有告警', stale: '已过期', error: '同步失败',
}[props.dataStatus ?? 'loading']));
</script>

<template>
  <header class="dash-header">
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
          <span class="dash-header__area-name">{{ areaName }}</span>
          <span class="dash-header__chevron" aria-hidden="true">
            <i />
          </span>
        </button>
        <div class="dash-header__area-meta">
          <span v-if="deptName" class="dash-header__dept">{{ deptName }}</span>
          <span v-if="deptName && dataSource" class="dash-header__dot" aria-hidden="true" />
          <span v-if="dataSource" class="dash-header__tag" :class="`dash-header__tag--${dataSource}`">
            {{ dataSource === 'remote' ? '实时' : dataSource === 'database' ? '数据库' : '模拟' }}
          </span>
          <span v-if="dataStatus" class="dash-header__data-status" :class="`dash-header__data-status--${dataStatus}`">
            {{ dataStatusLabel }}
          </span>
        </div>
      </div>
    </div>

    <div class="dash-header__center">
      <div class="dash-header__title-wrap">
        <span class="dash-header__wing dash-header__wing--left" aria-hidden="true" />
        <h1 class="dash-header__title">数字孪生智慧医院管理平台</h1>
        <span class="dash-header__wing dash-header__wing--right" aria-hidden="true" />
      </div>
      <div class="dash-header__title-glow" aria-hidden="true" />
    </div>

    <div class="dash-header__side dash-header__side--right" :class="{ 'dash-header__side--compact': compact }">
      <div class="dash-header__actions">
        <div v-if="operatorName" class="dash-header__operator" :title="`${operatorName}${operatorRole ? ` · ${operatorRole}` : ''}`">
          <span class="dash-header__operator-dot" aria-hidden="true" />
          <strong>{{ operatorName }}</strong>
          <span v-if="operatorRole && !compact">{{ operatorRole }}</span>
        </div>
        <button
          type="button"
          class="dash-header__refresh"
          :disabled="isLoading || isAreaSwitching"
          aria-label="刷新数据"
          title="刷新数据"
          @click="emit('refresh')"
        >
          <span class="dash-header__action-icon" aria-hidden="true">↻</span>
          <span class="dash-header__action-label">刷新</span>
        </button>
        <button
          type="button"
          class="dash-header__logout"
          aria-label="退出登录"
          title="退出登录"
          @click="emit('logout')"
        >
          <span class="dash-header__action-icon" aria-hidden="true">⎋</span>
          <span class="dash-header__action-label">退出</span>
        </button>
      </div>
      <template v-if="!compact">
        <div class="dash-header__status">
          <span v-if="displayTemp" class="dash-header__temp">{{ displayTemp }}</span>
          <span v-if="displayTemp" class="dash-header__divider" aria-hidden="true" />
          <time class="dash-header__clock">{{ timeText }}</time>
        </div>
        <p class="dash-header__date">{{ dateText }}</p>
      </template>
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
      padding-top: 2px;

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
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 0;
    color: #fff;
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
    display: grid;
    max-width: 140px;
    margin-bottom: 2px;
    text-align: right;

    strong,
    span {
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
      font-size: 9px;
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

    .dash-header__side--right {
      justify-self: end;
      padding-top: 5px;
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
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
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
</style>
