<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { HospitalIntroScene } from '@/core/hospital-exterior/hospital-intro-scene';

const emit = defineEmits<{ complete: [reason: 'finished' | 'skipped' | 'unavailable' | 'reduced-motion'] }>();
const host = ref<HTMLElement | null>(null);
const skipButton = ref<HTMLButtonElement | null>(null);
const seconds = ref(0);
const ready = ref(false);
const paused = ref(false);
const shot = computed(() => !ready.value ? '正在准备医院外景…' : seconds.value < 2.8
  ? '01 / 医院全景' : seconds.value < 5.8 ? '02 / 掠过建筑立面' : '03 / 抵达主入口');
let scene: HospitalIntroScene | undefined;
let closed = false;
let timeout: ReturnType<typeof setTimeout> | undefined;
let motion: MediaQueryList | undefined;

function finish(reason: 'finished' | 'skipped' | 'unavailable' | 'reduced-motion') {
  if (closed) return;
  closed = true;
  clearTimeout(timeout);
  scene?.setPaused(true);
  emit('complete', reason);
}
function togglePause() {
  paused.value = !paused.value;
  scene?.setPaused(paused.value);
}
function motionChanged() { if (motion?.matches) finish('reduced-motion'); }
onMounted(async () => {
  motion = matchMedia('(prefers-reduced-motion: reduce)');
  motion.addEventListener('change', motionChanged);
  if (motion.matches) { finish('reduced-motion'); return; }
  skipButton.value?.focus({ preventScroll: true });
  // An optional introduction must never prevent access to the login form.
  timeout = setTimeout(() => finish('unavailable'), 12000);
  try {
    const { createHospitalIntroScene } = await import('@/core/hospital-exterior/hospital-intro-scene');
    if (closed || !host.value) return;
    const created = createHospitalIntroScene(host.value, {
      onProgress(value) { seconds.value = value; },
      onComplete() { finish('finished'); },
      onError() { finish('unavailable'); },
    });
    if (closed) { created.dispose(); return; }
    scene = created;
    ready.value = true;
    clearTimeout(timeout);
  } catch { finish('unavailable'); }
});
onBeforeUnmount(() => {
  closed = true; clearTimeout(timeout);
  motion?.removeEventListener('change', motionChanged);
  scene?.dispose();
});
</script>

<template>
  <main class="hospital-opening" aria-label="医院外景开场动画">
    <div ref="host" class="hospital-opening__scene" aria-hidden="true" />
    <div class="hospital-opening__shade" aria-hidden="true" />
    <header class="hospital-opening__brand">智慧病房<span>DIGITAL TWIN</span></header>
    <div class="hospital-opening__controls">
      <button v-if="ready" type="button" @click="togglePause">{{ paused ? '继续播放' : '暂停动画' }}</button>
      <button ref="skipButton" type="button" @click="finish('skipped')">跳过动画 <span aria-hidden="true">↗</span></button>
    </div>
    <section class="hospital-opening__caption">
      <p class="hospital-opening__eyebrow">A CLOSER LOOK AT CARE</p>
      <h1>从这里，走进智慧医疗。</h1>
      <p role="status">{{ shot }}</p>
    </section>
    <footer class="hospital-opening__footer">
      <span>通用医院示意模型</span>
      <div class="hospital-opening__timeline" aria-hidden="true">
        <span>{{ String(Math.floor(seconds)).padStart(2, '0') }} / 08</span>
        <div><i :style="{ width: `${seconds / 8 * 100}%` }" /></div>
      </div>
    </footer>
  </main>
</template>

<style scoped lang="scss">
.hospital-opening {
  position: relative; isolation: isolate; width: 100%; height: 100dvh; overflow: hidden;
  background: #d4e1e7; color: #173a49; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  &__scene, &__shade { position: absolute; inset: 0; }
  &__scene :deep(canvas) { display: block; width: 100%; height: 100%; }
  &__shade { pointer-events: none; background: linear-gradient(180deg, #eef7f899, transparent 22%, transparent 66%, #e7f0f1f2); }
  &__brand { position: absolute; top: 36px; left: 48px; padding-left: 16px; border-left: 3px solid #176f78; font-size: 22px; font-weight: 650; letter-spacing: 4px; }
  &__brand span { display: block; margin-top: 6px; font-size: 9px; letter-spacing: 3px; }
  &__controls { position: absolute; top: max(36px, env(safe-area-inset-top)); right: max(48px, env(safe-area-inset-right)); display: flex; gap: 12px; }
  button { min-height: 44px; padding: 0 22px; border: 1px solid #96adb5; border-radius: 24px; background: #f8fcfcd1; color: inherit; font: inherit; font-size: 13px; cursor: pointer; backdrop-filter: blur(10px); }
  button:hover { background: #fff; }
  button:focus-visible { outline: 3px solid #007d90; outline-offset: 4px; }
  button span { margin-left: 16px; }
  &__caption { position: absolute; left: 48px; bottom: calc(106px + env(safe-area-inset-bottom)); }
  &__eyebrow { font-size: 10px; letter-spacing: 3px; color: #41717d; }
  h1 { font-size: clamp(24px, 2.7vw, 44px); font-weight: 500; letter-spacing: 2px; margin: 16px 0; }
  &__caption > p:last-child { font-size: 12px; color: #506b74; letter-spacing: 2px; }
  &__footer { position: absolute; bottom: calc(36px + env(safe-area-inset-bottom)); left: 48px; right: 48px; display: flex; justify-content: space-between; align-items: center; gap: 16px; font-size: 10px; color: #526d77; letter-spacing: 1px; }
  &__timeline { display: flex; align-items: center; gap: 18px; font-variant-numeric: tabular-nums; }
  &__timeline > div { width: 160px; height: 2px; background: #a9bfc4; }
  &__timeline i { display: block; height: 100%; background: #176f78; }
  @media (max-width: 700px) {
    &__brand { top: max(24px, env(safe-area-inset-top)); left: 24px; font-size: 17px; }
    &__controls { top: calc(96px + env(safe-area-inset-top)); right: max(24px, env(safe-area-inset-right)); gap: 8px; }
    button { padding: 0 16px; }
    &__caption { left: 24px; right: 24px; bottom: calc(110px + env(safe-area-inset-bottom)); }
    h1 { font-size: 22px; line-height: 1.5; letter-spacing: 1px; }
    &__footer { left: 24px; right: 24px; bottom: calc(28px + env(safe-area-inset-bottom)); align-items: flex-start; flex-direction: column; }
    &__timeline > div { width: 120px; }
  }
  @media (max-height: 500px) and (orientation: landscape) {
    &__brand { top: 20px; left: 24px; font-size: 17px; }
    &__controls { top: 20px; right: max(24px, env(safe-area-inset-right)); }
    &__caption { left: 24px; bottom: 62px; }
    &__eyebrow { display: none; }
    h1 { font-size: 22px; margin: 8px 0; }
    &__footer { left: 24px; right: 24px; bottom: max(18px, env(safe-area-inset-bottom)); flex-direction: row; }
  }
}
</style>
