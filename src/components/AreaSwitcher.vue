<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { HospAreaRecord } from '@/types/hospital-area';

const props = defineProps<{
  open: boolean;
  areas: HospAreaRecord[];
  currentAreaId: number;
  pendingAreaId: number | null;
  switching: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  close: [];
  switch: [areaId: number];
}>();

const query = ref('');
const candidateAreaId = ref<number | null>(null);
const drawerRef = ref<HTMLElement | null>(null);
const previousActiveElement = ref<HTMLElement | null>(null);

const filteredAreas = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  if (!keyword)
    return props.areas;
  return props.areas.filter(area =>
    [area.areaName, area.areaCode, area.areaOutCode]
      .some(value => value.toLocaleLowerCase().includes(keyword)),
  );
});

const currentArea = computed(() =>
  props.areas.find(area => area.id === props.currentAreaId) ?? null,
);

const candidateArea = computed(() =>
  props.areas.find(area => area.id === candidateAreaId.value) ?? null,
);

const switchingArea = computed(() =>
  props.areas.find(area => area.id === props.pendingAreaId) ?? candidateArea.value,
);

const canConfirm = computed(() =>
  candidateAreaId.value != null
  && candidateAreaId.value !== props.currentAreaId
  && !props.switching,
);

watch(
  () => props.open,
  async (open, wasOpen) => {
    if (!open) {
      if (wasOpen)
        restoreFocus();
      return;
    }
    if (!wasOpen && typeof document !== 'undefined')
      previousActiveElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    query.value = '';
    candidateAreaId.value = props.pendingAreaId ?? props.currentAreaId;
    await nextTick();
    drawerRef.value?.focus();
  },
  { immediate: true },
);

watch(
  () => props.areas,
  (areas) => {
    if (areas.some(area => area.id === candidateAreaId.value))
      return;
    candidateAreaId.value = areas.find(area => area.id === props.currentAreaId)?.id ?? areas[0]?.id ?? null;
  },
);

function requestClose() {
  if (!props.switching)
    emit('close');
}

function confirmSwitch() {
  if (canConfirm.value && candidateAreaId.value != null)
    emit('switch', candidateAreaId.value);
}

function getFocusableElements() {
  if (!drawerRef.value)
    return [];

  return Array.from(drawerRef.value.querySelectorAll<HTMLElement>([
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',')));
}

function restoreFocus() {
  const target = previousActiveElement.value;
  previousActiveElement.value = null;
  if (target?.isConnected)
    target.focus();
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.open)
    return;

  if (event.key === 'Escape' && !props.switching) {
    requestClose();
    return;
  }

  if (event.key === 'Tab') {
    const focusableElements = getFocusableElements();
    if (!focusableElements.length) {
      event.preventDefault();
      drawerRef.value?.focus();
      return;
    }

    const activeIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey ? activeIndex - 1 : activeIndex + 1;
    if (activeIndex < 0 || nextIndex < 0 || nextIndex >= focusableElements.length) {
      event.preventDefault();
      const targetIndex = event.shiftKey ? focusableElements.length - 1 : 0;
      focusableElements[targetIndex]?.focus();
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  restoreFocus();
});
</script>

<template>
  <Transition name="area-switcher">
    <div
      v-if="open"
      class="area-switcher"
      :class="{ 'area-switcher--switching': switching }"
      @click.self="requestClose"
    >
      <aside
        ref="drawerRef"
        class="area-switcher__drawer"
        role="dialog"
        tabindex="-1"
        aria-modal="true"
        aria-labelledby="area-switcher-title"
        :aria-busy="switching"
      >
        <header class="area-switcher__header">
          <div>
            <h2 id="area-switcher-title">切换工作病区</h2>
            <p>当前：{{ currentArea?.areaName ?? '当前病区' }}</p>
          </div>
          <button
            type="button"
            class="area-switcher__close"
            aria-label="关闭病区切换"
            :disabled="switching"
            @click="requestClose"
          >
            ×
          </button>
        </header>

        <label class="area-switcher__search">
          <span aria-hidden="true">⌕</span>
          <span class="area-switcher__sr-only">搜索病区</span>
          <input v-model="query" type="search" placeholder="搜索病区" :disabled="switching">
        </label>

        <div class="area-switcher__body">
          <div v-if="filteredAreas.length" class="area-switcher__list" aria-label="可切换病区">
            <button
              v-for="areaOption in filteredAreas"
              :key="areaOption.id"
              type="button"
              class="area-switcher__row"
              :class="{ 'area-switcher__row--candidate': candidateAreaId === areaOption.id }"
              :aria-pressed="candidateAreaId === areaOption.id"
              :disabled="switching"
              @click="candidateAreaId = areaOption.id"
            >
              <span class="area-switcher__row-copy">
                <strong>{{ areaOption.areaName }}</strong>
                <span>{{ areaOption.areaCode || areaOption.areaOutCode || '未设置编号' }}</span>
              </span>
              <span v-if="areaOption.id === currentAreaId" class="area-switcher__badge">当前</span>
              <span v-else-if="areaOption.id === candidateAreaId" class="area-switcher__check" aria-hidden="true">✓</span>
            </button>
          </div>
          <div v-else class="area-switcher__empty">未找到匹配病区</div>
        </div>

        <footer class="area-switcher__footer">
          <p v-if="error" class="area-switcher__error" role="alert">{{ error }}</p>
          <p class="area-switcher__hint" aria-live="polite">
            <span class="area-switcher__status-dot" aria-hidden="true" />
            <span v-if="switching">正在切换至{{ switchingArea?.areaName ?? '目标病区' }}</span>
            <span v-else>选择目标病区后确认切换</span>
          </p>
          <button
            type="button"
            class="area-switcher__confirm"
            :disabled="!canConfirm"
            @click="confirmSwitch"
          >
            <span v-if="switching" class="area-switcher__spinner" aria-hidden="true" />
            {{ switching ? `正在切换至${switchingArea?.areaName ?? '目标病区'}` : `切换至${candidateArea?.areaName ?? '所选病区'}` }}
          </button>
        </footer>
      </aside>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.area-switcher {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  background: rgba(2, 9, 14, 0.62);
  backdrop-filter: blur(2px);

  &__drawer {
    display: flex;
    width: min(520px, 88vw);
    height: 100%;
    min-width: 0;
    padding: 24px;
    border-left: 1px solid #3c8ba9;
    flex-direction: column;
    color: #e5f6fb;
    background: #081c29;
    box-shadow: -18px 0 42px rgba(0, 0, 0, 0.46);
  }

  &__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;

    h2 {
      margin: 0;
      font-size: 20px;
      line-height: 1.35;
      letter-spacing: 0;
      color: #fff;
    }

    p {
      margin: 6px 0 0;
      overflow-wrap: anywhere;
      color: #789bab;
      font-size: 12px;
    }
  }

  &__close {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    border: 1px solid transparent;
    border-radius: 4px;
    color: #9cbcc9;
    background: transparent;
    font-size: 24px;
    line-height: 1;
    cursor: pointer;

    &:hover:not(:disabled) { color: #fff; background: rgba(77, 208, 255, 0.1); }
    &:focus-visible { outline: 2px solid #8ce4f5; outline-offset: 2px; }
    &:disabled { opacity: 0.4; cursor: not-allowed; }
  }

  &__search {
    display: flex;
    height: 40px;
    margin-bottom: 12px;
    padding: 0 12px;
    border: 1px solid #234b5f;
    border-radius: 5px;
    align-items: center;
    gap: 8px;
    color: #65bad2;
    background: #091f2c;

    &:focus-within {
      border-color: #55c9e9;
      box-shadow: 0 0 0 3px rgba(85, 201, 233, 0.14);
    }

    input {
      width: 100%;
      min-width: 0;
      border: 0;
      outline: 0;
      color: #e8f9fd;
      background: transparent;
      font: inherit;

      &::placeholder { color: #668b9e; }
    }
  }

  &__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  &__body {
    min-height: 0;
    overflow-y: auto;
    flex: 1;
    overscroll-behavior: contain;
  }

  &__list { display: grid; gap: 8px; }

  &__row {
    display: flex;
    width: 100%;
    min-width: 0;
    min-height: 64px;
    padding: 11px 13px;
    border: 1px solid #21485d;
    border-radius: 6px;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    text-align: left;
    color: #f2fcff;
    background: #0a202e;
    cursor: pointer;

    &:hover:not(:disabled) { border-color: rgba(85, 201, 233, 0.7); }

    &:focus-visible {
      outline: 2px solid #8ce4f5;
      outline-offset: 2px;
    }

    &:disabled { cursor: wait; }

    &--candidate {
      border-color: #48c3e5;
      background: #0b2939;
      box-shadow: inset 3px 0 #55d0ef;
    }
  }

  &__row-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;

    strong {
      overflow-wrap: anywhere;
      font-size: 14px;
      line-height: 1.4;
    }

    span {
      overflow-wrap: anywhere;
      color: #789cad;
      font-size: 11px;
    }
  }

  &__badge {
    flex: 0 0 auto;
    padding: 3px 6px;
    border-radius: 3px;
    color: #042330;
    background: #5bd3ef;
    font-size: 10px;
    font-weight: 800;
  }

  &__check {
    flex: 0 0 auto;
    color: #64d9f2;
    font-size: 18px;
  }

  &__empty {
    padding: 38px 16px;
    border: 1px dashed #21485d;
    border-radius: 6px;
    text-align: center;
    color: #789cad;
  }

  &__footer {
    padding-top: 16px;
    border-top: 1px solid rgba(77, 208, 255, 0.15);
  }

  &__hint,
  &__error {
    display: flex;
    margin: 0 0 10px;
    align-items: center;
    gap: 8px;
    overflow-wrap: anywhere;
    color: #8bb0bf;
    font-size: 12px;
  }

  &__error {
    color: #ff9d8f;
  }

  &__status-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #54d693;
    box-shadow: 0 0 8px rgba(84, 214, 147, 0.8);
  }

  &__confirm {
    display: flex;
    width: 100%;
    min-height: 42px;
    padding: 9px 14px;
    border: 0;
    border-radius: 5px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    overflow-wrap: anywhere;
    color: #05212d;
    background: #62d7f1;
    font-weight: 800;
    cursor: pointer;

    &:hover:not(:disabled) { background: #83e3f7; }
    &:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  &__spinner {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
    border: 2px solid rgba(5, 33, 45, 0.2);
    border-top-color: #05212d;
    border-radius: 50%;
    animation: switcher-spin 0.8s linear infinite;
  }

  &--switching { cursor: progress; }

  @include down($bp-sm) {
    &__drawer {
      width: 100%;
      padding: 18px 14px;
    }

    &__header { margin-bottom: 16px; }
    &__header h2 { font-size: 18px; }
    &__row { min-height: 60px; }
  }
}

.area-switcher-enter-active,
.area-switcher-leave-active { transition: opacity 0.18s ease; }
.area-switcher-enter-active .area-switcher__drawer,
.area-switcher-leave-active .area-switcher__drawer { transition: transform 0.18s ease; }
.area-switcher-enter-from,
.area-switcher-leave-to { opacity: 0; }
.area-switcher-enter-from .area-switcher__drawer,
.area-switcher-leave-to .area-switcher__drawer { transform: translateX(100%); }

@keyframes switcher-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .area-switcher-enter-active,
  .area-switcher-leave-active,
  .area-switcher-enter-active .area-switcher__drawer,
  .area-switcher-leave-active .area-switcher__drawer { transition: none; }
  .area-switcher__spinner { animation: none; }
}
</style>
