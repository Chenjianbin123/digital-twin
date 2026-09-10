<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AreaSelectionIcon from './AreaSelectionIcon.vue';
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
      <strong class="area-selection__brand"><i aria-hidden="true">智</i>智慧医院</strong>
      <span class="area-selection__platform">数字孪生智慧医院管理平台</span>
      <span class="area-selection__service">
        <span class="area-selection__status-dot" aria-hidden="true" />
        病区服务待接入
      </span>
    </header>

    <main class="area-selection__main">
      <div class="area-selection__intro">
        <div>
          <p class="area-selection__eyebrow">数字孪生 / 工作空间</p>
          <h1 id="area-selection-title" class="area-selection__title"><span class="area-selection__title-icon"><AreaSelectionIcon name="layers" /></span>选择工作病区</h1>
          <p class="area-selection__description">选择后将加载对应病区的护士站与设备数据</p>

        </div>
        <div class="area-selection__step" aria-hidden="true"><span class="is-current">选择病区</span><i>→</i><span>进入三维工作台</span></div>
      </div>

      <div class="area-selection__workspace">
        <div class="area-selection__toolbar">
          <div class="area-selection__list-heading"><AreaSelectionIcon name="hospital" /><h2>可用病区</h2><span v-if="!isListLoading" role="status">{{ query.trim() ? filteredAreas.length + ' / ' + areas.length : areas.length }} 个</span></div>
          <label class="area-selection__search">
            <AreaSelectionIcon name="search" class="area-selection__search-mark" />
            <span class="area-selection__sr-only">搜索病区</span>
            <input
              v-model="query"
              type="search"
              placeholder="搜索病区名称或编号"
              :disabled="isListLoading || isEntering"
            >
          </label>
        </div>

        <div class="area-selection__results" role="region" aria-label="病区列表" tabindex="0" :aria-busy="isListLoading">
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
                <span class="area-selection__tile-icon"><AreaSelectionIcon name="hospital" /></span>
                <span class="area-selection__tile-content">
                <span class="area-selection__tile-top">
                  <strong>{{ areaOption.areaName }}</strong>
                  <span v-if="rememberedAreaId === areaOption.id" class="area-selection__preferred"><AreaSelectionIcon name="history" />上次进入</span>
                </span>
                <span class="area-selection__code">
                  病区编号 {{ areaOption.areaCode || areaOption.areaOutCode || '未设置' }}
                </span>
                </span>
                <span class="area-selection__selection-mark" aria-hidden="true"><AreaSelectionIcon v-if="chosenAreaId === areaOption.id" name="check" /></span>
              </button>
            </div>

            <div v-else class="area-selection__state" aria-live="polite">
              <strong>{{ areas.length ? '未找到匹配病区' : '暂无可用病区' }}</strong>
              <span>{{ areas.length ? '请尝试其他名称或编号' : '请联系管理员确认病区配置' }}</span>
            </div>
          </template>

        </div>
        <footer class="area-selection__footer">
          <div class="area-selection__chosen-summary">
            <AreaSelectionIcon name="pin" class="area-selection__chosen-icon" />
            <span>{{ isListLoading ? '正在获取病区' : '当前选择' }}</span>
            <strong>{{ isListLoading ? '请稍候' : chosenArea?.areaName || '请选择工作病区' }}</strong>
            <small v-if="chosenArea && !isListLoading">编号 {{ chosenArea.areaCode || chosenArea.areaOutCode || '未设置' }}</small>
          </div>
          <button
            type="button"
            class="area-selection__enter"
            :disabled="!chosenArea || isListLoading || isEntering"
            @click="enterChosenArea"
          >
            <span v-if="isEntering" class="area-selection__spinner area-selection__spinner--button" aria-hidden="true" />
            <span>{{ isEntering ? '正在加载病区…' : '进入护士站' }}</span>
            <AreaSelectionIcon v-if="!isEntering" name="arrow" />
          </button>
        </footer>
      </div>
    </main>
  </section>
</template>

<style scoped lang="scss">
.area-selection {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  color: #e7f7fc;
  background: radial-gradient(ellipse at 10% 0%, #16475766, transparent 55%), #061521;
  &::before { content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none; opacity: .12; background: url('/images/smart-ward-nurse-station/login-bg.jpg') center / cover; }

  &__header {
    position: sticky;
    top: 0;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    flex: 0 0 auto;
    min-height: 76px;
    gap: 20px;
    padding: 12px 4vw;
    border-bottom: 1px solid #80d7df26;
    background: #061724e8;
    backdrop-filter: blur(16px);
  }
  &__brand { display: flex; align-items: center; gap: 12px; font-size: 16px; white-space: nowrap; }
  &__brand i { display: grid; place-items: center; width: 36px; height: 36px; border: 1px solid #66c7c966; border-radius: 3px 10px; background: #28536066; color: #9eefe4; font-style: normal; }
  &__platform { font-size: clamp(16px, 1vw, 24px); font-weight: 600; letter-spacing: .08em; }
  &__service { display: flex; align-items: center; gap: 8px; justify-self: end; color: #adc5d0; font-size: 12px; }
  &__status-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: #e6bd72; }
  &__main { display: flex; flex-direction: column; flex: 1; min-height: 0; width: min(2200px, calc(100% - clamp(32px, 8vw, 192px))); margin: 0 auto; padding: clamp(24px, 4vh, 56px) 0 clamp(20px, 3vh, 40px); }
  &__intro { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-shrink: 0; margin-bottom: 28px; }
  &__eyebrow { margin-bottom: 10px; color: #7cd7d4; font-size: 12px; letter-spacing: .12em; }
  &__title { display: flex; align-items: center; gap: 16px; font-size: clamp(28px, 2vw, 44px); font-weight: 600; line-height: 1.3; }
  &__description { margin-top: 12px; color: #aac4d1; font-size: clamp(13px, .85vw, 17px); line-height: 1.6; }
  &__title-icon { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border: 1px solid #78dad84d; border-radius: 8px 18px 8px 8px; background: linear-gradient(135deg, #34708088, #12334499); color: #9df0e6; font-size: 32px; box-shadow: 0 8px 24px #00000026; }
  &__list-heading > .area-icon { color: #8fe0d8; font-size: 22px; }
  &__chosen-icon { color: #8fe5dc; font-size: 22px; }
  &__enter > .area-icon { font-size: 22px; }
  &__step { display: flex; align-items: center; gap: 16px; color: #96b0bf; font-size: 13px; white-space: nowrap; }
  &__step .is-current { color: #a5f3e6; }
  &__step i { color: #658e9c; font-style: normal; }
  // 搜索和确认栏占据固定空间，仅病区列表滚动。
  &__workspace { display: flex; flex-direction: column; flex: 1; min-height: 0; border: 1px solid #75c5d033; border-radius: 5px 20px 5px 20px; background: #081e2cec; box-shadow: 0 24px 60px #00000026; overflow: hidden; }
  &__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-shrink: 0; padding: 20px 24px; border-bottom: 1px solid #8ecbd51c; }
  &__list-heading { display: flex; align-items: center; gap: 12px; white-space: nowrap; }
  &__list-heading h2 { font-size: 16px; font-weight: 600; }
  &__list-heading > span { padding: 4px 10px; border: 1px solid #72c9d233; border-radius: 4px; color: #91d9d5; background: #183b474d; font-size: 12px; font-variant-numeric: tabular-nums; }
  &__search { display: flex; align-items: center; gap: 12px; width: min(400px, 50%); min-height: 46px; padding: 0 14px; border: 1px solid #426578; border-radius: 6px; background: #061925; }
  &__search:focus-within { border-color: #8ce6db; box-shadow: 0 0 0 3px #74e4d51c; }
  &__search input { width: 100%; min-width: 0; border: 0; outline: 0; color: #e8f9fd; background: transparent; font: inherit; font-size: 14px; color-scheme: dark; }
  &__search input::placeholder { color: #99b4c2; }
  &__search-mark { width: 20px; height: 20px; color: #9dced6; }
  &__sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); }
  &__results { flex: 1; min-height: 0; padding: 24px; overflow: auto; overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: #386779 transparent; }
  &__results:focus-visible { outline: 2px solid #8ce6db; outline-offset: -4px; }
  &__list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
  &__tile { position: relative; display: flex; align-items: flex-start; gap: 16px; min-width: 0; min-height: 124px; padding: 24px 40px 22px 22px; border: 1px solid #416476; border-radius: 10px; color: inherit; background: radial-gradient(ellipse at 0 0, #36778933, transparent 70%), linear-gradient(130deg, #163545, #0c2332); box-shadow: inset 0 1px #b4f7ff08, 0 6px 18px #00000012; text-align: left; cursor: pointer; transition: border-color .18s, background .18s; }
  &__tile:hover:not(:disabled) { border-color: #7cc6cc; background: #1c4050; box-shadow: 0 6px 24px #03111e55, inset 0 1px #b4f7ff18; }
  &__tile:disabled { cursor: wait; opacity: .65; }
  &__tile--chosen { border-color: #79e3d7; background: linear-gradient(115deg, #1c4d55, #123440); box-shadow: inset 3px 0 #79e3d7, inset 0 0 32px #6ee5d20a, 0 0 0 1px #7de7db18; }
  &__tile-icon { display: grid; place-items: center; width: 48px; height: 52px; border: 1px solid #78b8c34d; border-radius: 6px 14px 6px 6px; flex-shrink: 0; color: #a3d5df; background: linear-gradient(135deg, #3e859345, #1a425030); font-size: 28px; box-shadow: inset 0 1px #b5edff14; }
  &__tile--chosen &__tile-icon { color: #9cf4e4; background: #5de3d01a; }
  &__tile-content { min-width: 0; flex: 1; }
  &__tile-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  &__tile-top strong { min-width: 0; font-size: clamp(15px, .8vw, 18px); font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
  &__preferred { display: inline-flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid #8be0d63d; border-radius: 3px; color: #a0e7dd; background: #60c9bd12; font-size: 11px; white-space: nowrap; }
  &__code { display: block; margin-top: 10px; color: #a7c1cd; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
  &__selection-mark { position: absolute; top: 14px; right: 14px; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid #658b9b; border-radius: 50%; font-size: 12px; }
  &__tile--chosen &__selection-mark { border-color: #83e6d9; color: #092c36; background: #83e6d9; }
  &__footer { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-shrink: 0; padding: 20px 24px; border-top: 1px solid #8ecbd529; background: #102b38; }
  &__chosen-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
  &__chosen-summary > span { color: #9ebcc9; font-size: 12px; }
  &__chosen-summary strong { font-size: 16px; font-weight: 600; overflow-wrap: anywhere; }
  &__chosen-summary small { color: #98bbc7; font-size: 12px; overflow-wrap: anywhere; }
  &__enter { display: flex; align-items: center; justify-content: center; gap: 24px; flex: 0 0 auto; min-width: 200px; min-height: 48px; padding: 12px 24px; border: 1px solid #acf5e7; border-radius: 6px; color: #072c35; background: linear-gradient(110deg, #97ecda, #60d7d2); font-size: 15px; font-weight: 700; cursor: pointer; }
  &__enter > i { font-size: 20px; font-weight: 400; font-style: normal; }
  &__enter:hover:not(:disabled) { filter: brightness(1.08); }
  &__enter:disabled { opacity: .45; cursor: not-allowed; }
  button:focus-visible { outline: 2px solid #bafff2; outline-offset: 3px; }
  &__inline-error { margin-bottom: 16px; padding: 12px 16px; border: 1px solid #cb8d7d66; border-radius: 5px; background: #73362a33; color: #ffd1c2; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
  &__state { display: flex; min-height: 200px; height: 100%; padding: 24px; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: #a1bfcd; text-align: center; line-height: 1.6; overflow-wrap: anywhere; }
  &__state strong { font-size: 18px; color: #e7f7fc; }
  &__state--error > strong { color: #ffcbba; }
  &__state button { min-height: 44px; margin-top: 8px; padding: 8px 20px; border: 1px solid #71c4cc; border-radius: 5px; color: #b4f6ec; background: #17404e; cursor: pointer; }
  &__spinner { width: 22px; height: 22px; border: 2px solid #82dbd63b; border-top-color: #82dbd6; border-radius: 50%; animation: area-spin .8s linear infinite; }
  &__spinner--button { width: 16px; height: 16px; flex-shrink: 0; border-color: #12495533; border-top-color: #124955; }
}
@media (max-width: 1000px) {
  .area-selection {
    &__header { grid-template-columns: 1fr auto; min-height: 64px; }
    &__platform { display: none; }
    &__step { display: none; }
    &__main { width: calc(100% - 48px); padding-block: 24px; }
    &__intro { margin-bottom: 20px; }
    &__list { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    &__tile { padding-left: 14px; gap: 10px; }
    &__tile-icon { width: 36px; height: 40px; font-size: 23px; }
  }
}
@media (max-width: 600px) {
  .area-selection {
    &__header { min-height: 56px; padding: 8px 16px; gap: 8px; }
    &__brand { font-size: 14px; gap: 8px; }
    &__service { font-size: 11px; }
    &__main { width: calc(100% - 24px); padding: 16px 0 max(12px, env(safe-area-inset-bottom)); }
    &__intro { padding-inline: 4px; margin-bottom: 16px; }
    &__eyebrow { margin-bottom: 6px; font-size: 11px; }
    &__title { font-size: 26px; gap: 12px; }
    &__title-icon { width: 40px; height: 40px; font-size: 25px; }
    &__description { margin-top: 8px; font-size: 12px; }
    &__toolbar { flex-wrap: wrap; gap: 12px; padding: 16px; }
    &__search { width: 100%; min-height: 44px; }
    &__results { padding: 12px; }
    &__list { grid-template-columns: minmax(0, 1fr); gap: 10px; }
    &__tile { min-height: 90px; padding-block: 16px; }
    &__footer { padding: 12px 16px; gap: 12px; flex-wrap: wrap; }
    &__chosen-summary { width: 100%; gap: 4px 8px; }
    &__chosen-summary strong { font-size: 14px; }
    &__chosen-summary small { font-size: 11px; }
    &__enter { width: 100%; min-width: 0; min-height: 44px; }
  }
}
@media (max-height: 720px) {
  .area-selection {
    &__main { padding-block: 16px; }
    &__intro { margin-bottom: 16px; }
    &__eyebrow { display: none; }
    &__title { font-size: 26px; }
    &__toolbar { padding-block: 12px; }
    &__footer { padding-block: 12px; }
    &__results { min-height: 110px; }
  }
}
@media (max-height: 540px) {
  .area-selection {
    &__main { flex: 0 0 auto; min-height: 440px; }
    &__results { max-height: 240px; }
    &__description { display: none; }
  }
}
@keyframes area-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .area-selection__spinner { animation: none; }
  .area-selection__tile { transition: none; }
}
</style>
