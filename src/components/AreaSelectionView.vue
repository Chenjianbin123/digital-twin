<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { HospAreaRecord } from '@/types/hospital-area';

const props = defineProps<{
  areas: HospAreaRecord[];
  preferredAreaId: number | null;
  rememberedAreaId: number | null;
  isListLoading: boolean;
  isEntering: boolean;
  pendingAreaId: number | null;
  error: string | null;
}>();

const emit = defineEmits<{
  enter: [areaId: number];
  retry: [];
}>();

const query = ref('');
const chosenAreaId = ref<number | null>(null);

const filteredAreas = computed(() => {
  const keyword = query.value.trim().toLocaleLowerCase();
  if (!keyword)
    return props.areas;

  return props.areas.filter(area =>
    [area.areaName, area.areaCode, area.areaOutCode]
      .some(value => value.toLocaleLowerCase().includes(keyword)),
  );
});

const chosenArea = computed(() =>
  props.areas.find(area => area.id === chosenAreaId.value) ?? null,
);

watch(
  () => props.areas,
  (areas) => {
    if (areas.some(area => area.id === chosenAreaId.value))
      return;
    chosenAreaId.value = areas.find(area => area.id === props.preferredAreaId)?.id ?? areas[0]?.id ?? null;
  },
  { immediate: true },
);

watch(
  () => props.preferredAreaId,
  (preferredAreaId) => {
    if (preferredAreaId != null && props.areas.some(area => area.id === preferredAreaId))
      chosenAreaId.value = preferredAreaId;
  },
  { immediate: true },
);

function enterChosenArea() {
  if (chosenAreaId.value != null && !props.isEntering)
    emit('enter', chosenAreaId.value);
}
</script>

<template>
  <section class="area-selection" aria-labelledby="area-selection-title">
    <header class="area-selection__header">
      <strong class="area-selection__brand">智慧医院</strong>
      <span class="area-selection__platform">数字孪生智慧医院管理平台</span>
      <span class="area-selection__service">
        <span class="area-selection__status-dot" aria-hidden="true" />
        病区服务待接入
      </span>
    </header>

    <main class="area-selection__main">
      <p class="area-selection__eyebrow">WORK AREA</p>
      <h1 id="area-selection-title" class="area-selection__title">选择工作病区</h1>
      <p class="area-selection__description">选择后将加载对应病区的护士站与设备数据</p>

      <label class="area-selection__search">
        <span class="area-selection__search-mark" aria-hidden="true">⌕</span>
        <span class="area-selection__sr-only">搜索病区</span>
        <input
          v-model="query"
          type="search"
          placeholder="搜索病区名称或编号"
          :disabled="isListLoading || isEntering"
        >
      </label>

      <div v-if="isListLoading" class="area-selection__state" aria-live="polite">
        <span class="area-selection__spinner" aria-hidden="true" />
        <strong>正在获取病区列表</strong>
        <span>请稍候</span>
      </div>

      <div v-else-if="error && !areas.length" class="area-selection__state area-selection__state--error" role="alert">
        <strong>病区列表加载失败</strong>
        <span>{{ error }}</span>
        <button type="button" :disabled="isEntering" @click="emit('retry')">重新加载</button>
      </div>

      <template v-else>
        <p v-if="error" class="area-selection__inline-error" role="alert">
          <strong>进入病区失败：</strong>{{ error }}
        </p>

        <div v-if="filteredAreas.length" class="area-selection__list" aria-label="可用病区">
          <button
            v-for="areaOption in filteredAreas"
            :key="areaOption.id"
            type="button"
            class="area-selection__tile"
            :class="{ 'area-selection__tile--chosen': chosenAreaId === areaOption.id }"
            :aria-pressed="chosenAreaId === areaOption.id"
            :disabled="isEntering"
            @click="chosenAreaId = areaOption.id"
          >
            <span class="area-selection__tile-top">
              <strong>{{ areaOption.areaName }}</strong>
              <span v-if="rememberedAreaId === areaOption.id" class="area-selection__preferred">上次进入</span>
            </span>
            <span class="area-selection__code">
              病区编号 {{ areaOption.areaCode || areaOption.areaOutCode || '未设置' }}
            </span>
          </button>
        </div>

        <div v-else class="area-selection__state" aria-live="polite">
          <strong>{{ areas.length ? '未找到匹配病区' : '暂无可用病区' }}</strong>
          <span>{{ areas.length ? '请尝试其他名称或编号' : '请联系管理员确认病区配置' }}</span>
        </div>
      </template>

      <button
        type="button"
        class="area-selection__enter"
        :disabled="!chosenArea || isListLoading || isEntering"
        @click="enterChosenArea"
      >
        <span v-if="isEntering" class="area-selection__spinner area-selection__spinner--button" aria-hidden="true" />
        {{ isEntering && pendingAreaId === chosenAreaId ? `正在进入${chosenArea?.areaName ?? ''}护士站` : `进入${chosenArea?.areaName ?? '所选病区'}护士站` }}
      </button>
    </main>
  </section>
</template>

<style scoped lang="scss">
.area-selection {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 100svh;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: #e7f7fc;
  background:
    linear-gradient(rgba(77, 208, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(77, 208, 255, 0.035) 1px, transparent 1px),
    #061521;
  background-size: 32px 32px;

  &__header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    min-height: 58px;
    padding: 0 24px;
    border-bottom: 1px solid rgba(77, 208, 255, 0.18);
    background: rgba(5, 18, 29, 0.94);
    backdrop-filter: blur(12px);
  }

  &__brand {
    min-width: 0;
    font-size: 14px;
    color: #ecfbff;
  }

  &__platform {
    font-size: 17px;
    font-weight: 750;
    color: #fff;
  }

  &__service {
    display: inline-flex;
    align-items: center;
    justify-self: end;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
    color: #9bbcc9;
  }

  &__status-dot {
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-radius: 50%;
    background: #e6b85c;
    box-shadow: 0 0 9px rgba(230, 184, 92, 0.6);
  }

  &__main {
    width: min(760px, calc(100% - clamp(32px, 6vw, 96px)));
    margin: 0 auto;
    padding: clamp(44px, 8vh, 92px) 0 48px;
  }

  &__eyebrow {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 800;
    color: #55c9e9;
  }

  &__title {
    margin: 0;
    font-size: 32px;
    line-height: 1.25;
    letter-spacing: 0;
    color: #fff;
  }

  &__description {
    margin: 10px 0 24px;
    font-size: 14px;
    line-height: 1.6;
    color: #83a6b5;
  }

  &__search {
    display: flex;
    align-items: center;
    height: 42px;
    margin-bottom: 12px;
    padding: 0 13px;
    border: 1px solid #234b5f;
    border-radius: 5px;
    background: #091f2c;
    transition: border-color 0.16s, box-shadow 0.16s;

    &:focus-within {
      border-color: #55c9e9;
      box-shadow: 0 0 0 3px rgba(85, 201, 233, 0.15);
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
      &::-webkit-search-cancel-button { filter: invert(0.8); }
    }
  }

  &__search-mark {
    margin-right: 9px;
    color: #65bad2;
    font-size: 18px;
  }

  &__sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  &__inline-error {
    margin: 0 0 12px;
    padding: 10px 12px;
    overflow-wrap: anywhere;
    border: 1px solid rgba(255, 139, 122, 0.45);
    border-radius: 5px;
    color: #ffc3ba;
    background: rgba(102, 34, 32, 0.22);
    font-size: 12px;
    line-height: 1.5;

    strong { color: #ffe6e1; }
  }

  &__tile {
    min-width: 0;
    min-height: 82px;
    padding: 14px;
    overflow: hidden;
    border: 1px solid #21485d;
    border-radius: 6px;
    text-align: left;
    color: inherit;
    background: #0a202e;
    cursor: pointer;
    transition: border-color 0.16s, background 0.16s, box-shadow 0.16s;

    &:hover:not(:disabled) { border-color: rgba(85, 201, 233, 0.7); }

    &:focus-visible {
      outline: 2px solid #8ce4f5;
      outline-offset: 2px;
    }

    &:disabled { cursor: wait; }

    &--chosen {
      border-color: #48c3e5;
      background: #0b2939;
      box-shadow: inset 3px 0 #55d0ef;
    }
  }

  &__tile-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;

    strong {
      min-width: 0;
      overflow-wrap: anywhere;
      font-size: 15px;
      line-height: 1.4;
      color: #f2fcff;
    }
  }

  &__preferred {
    flex: 0 0 auto;
    padding: 3px 6px;
    border-radius: 3px;
    color: #042330;
    background: #5bd3ef;
    font-size: 10px;
    font-weight: 800;
  }

  &__code {
    display: block;
    margin-top: 10px;
    overflow-wrap: anywhere;
    color: #789cad;
    font-size: 12px;
  }

  &__state {
    display: flex;
    min-height: 174px;
    padding: 24px;
    border: 1px solid #21485d;
    border-radius: 6px;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    color: #789cad;
    background: rgba(10, 32, 46, 0.72);

    strong { color: #e6f7fb; }

    button {
      margin-top: 6px;
      padding: 8px 16px;
      border: 1px solid #3e9fba;
      border-radius: 5px;
      color: #aeefff;
      background: #0b2939;
      cursor: pointer;

      &:focus-visible { outline: 2px solid #8ce4f5; outline-offset: 2px; }
    }

    &--error { border-color: rgba(255, 139, 122, 0.45); }
  }

  &__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(98, 215, 241, 0.25);
    border-top-color: #62d7f1;
    border-radius: 50%;
    animation: area-spin 0.8s linear infinite;

    &--button {
      width: 15px;
      height: 15px;
      flex: 0 0 auto;
      border-top-color: #05212d;
    }
  }

  &__enter {
    display: flex;
    width: 100%;
    min-height: 44px;
    margin-top: 14px;
    padding: 10px 18px;
    align-items: center;
    justify-content: center;
    gap: 9px;
    overflow-wrap: anywhere;
    border: 0;
    border-radius: 5px;
    color: #05212d;
    background: #62d7f1;
    font-size: 14px;
    font-weight: 800;
    cursor: pointer;

    &:hover:not(:disabled) { background: #83e3f7; }
    &:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
    &:disabled { opacity: 0.45; cursor: not-allowed; }
  }

  @include down($bp-sm) {
    &__header {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      min-height: 54px;
      padding: 7px 14px;
    }

    &__platform { display: none; }
    &__service { font-size: 11px; }

    &__main {
      width: calc(100% - 28px);
      padding: 36px 0 28px;
    }

    &__title { font-size: 27px; }
    &__description { margin-bottom: 18px; }
    &__list { grid-template-columns: minmax(0, 1fr); }
    &__tile { min-height: 76px; }
  }
}

@media (min-width: 769px) and (max-width: 1023px) {
  .area-selection {
    &__header {
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 14px;
      padding-inline: clamp(16px, 3vw, 28px);
    }

    &__platform {
      min-width: 0;
      overflow: hidden;
      font-size: clamp(14px, 2vw, 17px);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__main {
      width: min(760px, calc(100% - clamp(32px, 7vw, 72px)));
      padding-top: clamp(34px, 7vh, 68px);
    }
  }
}

@media (max-height: 720px) {
  .area-selection {
    &__header {
      min-height: 50px;
    }

    &__main {
      padding-top: 28px;
      padding-bottom: 28px;
    }

    &__title {
      font-size: clamp(26px, 3vw, 32px);
    }

    &__description {
      margin-bottom: 17px;
    }

    &__tile {
      min-height: 70px;
      padding: 11px 13px;
    }

    &__state {
      min-height: 142px;
      padding: 18px;
    }
  }
}

@keyframes area-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .area-selection__spinner { animation: none; }
}
</style>
