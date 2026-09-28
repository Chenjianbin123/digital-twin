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
  <header class="dash-header" :data-header-theme="theme || 'dark'">

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
          <span v-if="deptName" class="dash-header__dept" :title="deptName">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3v5a5 5 0 0 0 10 0V3M3 3h4m6 0h4M10 13v3a5 5 0 0 0 10 0v-3"/><circle cx="20" cy="10" r="2"/></svg>
            <span>{{ deptName }}</span>
          </span>
          <span v-if="deptName && dataSource" class="dash-header__dot" aria-hidden="true" />
          <span v-if="dataSource" class="dash-header__tag" :class="`dash-header__tag--${dataSource}`">
            <i aria-hidden="true" />
            {{ dataSource === 'remote' ? '实时' : dataSource === 'database' ? '数据库' : '模拟' }}
          </span>
          <span v-if="dataStatus" class="dash-header__data-status" :class="`dash-header__data-status--${dataStatus}`" role="status">
            <svg v-if="['warning', 'error', 'stale'].includes(dataStatus)" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.5"/></svg>
            <i v-else aria-hidden="true" />
            {{ dataStatusLabel }}
          </span>
        </div>
      </div>
    </div>

    <div class="dash-header__center">
      <svg class="dash-header__plate" viewBox="0 0 640 96" preserveAspectRatio="none" aria-hidden="true">
        <path class="dash-header__plate-surface" d="M32 1H608L639 30V70L613 95H27L1 70V30Z"/>
        <path class="dash-header__plate-inset" d="M35 7H605L632 33M8 34 35 7M8 65v3l23 21h578l23-21v-3"/>
        <path class="dash-header__plate-accent" d="M1 70 27 95h95m396 0h95l26-25M235 94l6-4h158l6 4"/>
      </svg>
      <div class="dash-header__title-wrap">
        <span class="dash-header__wing dash-header__wing--left" aria-hidden="true" />
        <div class="dash-header__title-stack">
          <span class="dash-header__kicker" aria-hidden="true">DIGITAL TWIN COMMAND</span>
          <div class="dash-header__brand">
            <svg class="dash-header__brand-icon" viewBox="0 0 48 48" aria-hidden="true">
              <path class="dash-header__brand-base" d="m3 36 21-10 21 10-21 10Z" />
              <path class="dash-header__brand-front" d="M10 12 25 5v30l-15 7Z" />
              <path class="dash-header__brand-side" d="m25 5 13 7v30l-13-7Z" />
              <path class="dash-header__brand-roof" d="m10 12 15-7 13 7-15 7Z" />
              <path class="dash-header__brand-detail" d="M17 21v10m-4-3 8-4M29 20l5 3m-5 4 5 3m-5 4 5 3" />
            </svg>
            <h1 class="dash-header__title">数字孪生智慧医院管理平台</h1>
          </div>
        </div>
        <span class="dash-header__wing dash-header__wing--right" aria-hidden="true" />
      </div>
      <div class="dash-header__title-glow" aria-hidden="true" />
    </div>

    <div class="dash-header__side dash-header__side--right" :class="{ 'dash-header__side--compact': compact }">
      <div class="dash-header__actions">
        <button type="button" class="dash-header__theme" :aria-label="theme === 'light' ? '切换深色主题' : '切换浅色主题'" :title="theme === 'light' ? '切换深色主题' : '切换浅色主题'" @click="emit('toggleTheme')">
          <svg v-if="theme === 'light'" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11Z"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>
          <span>{{ theme === 'light' ? '深色' : '浅色' }}</span>
        </button>
        <slot name="actions" />
        <div v-if="operatorName" class="dash-header__operator" :title="`${operatorName}${operatorRole ? ` · ${operatorRole}` : ''}`">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2Z"/></svg>
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

<style scoped lang="scss" src="@/components/dashboard/dashboard-header.scss"></style>
