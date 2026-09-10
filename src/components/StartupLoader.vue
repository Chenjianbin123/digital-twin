<script setup lang="ts">
import { computed } from 'vue';
const props = defineProps<{ progress: number; phase: string }>();
const displayProgress = computed(() => Number.isFinite(props.progress) ? Math.min(100, Math.max(0, Math.round(props.progress))) : 0);
</script>

<template>
  <section class="startup-loader" aria-label="系统初始化">
    <img class="startup-loader__background" src="/images/smart-ward-nurse-station/login-bg.jpg" alt="" />
    <div class="startup-loader__shade" aria-hidden="true" />
    <header class="startup-loader__header">
      <span class="startup-loader__brand"><i aria-hidden="true">智</i>智慧病房数字孪生平台</span>
      <span class="startup-loader__caption">空间可视 · 数据互联</span>
    </header>
    <div class="startup-loader__annotations" aria-hidden="true">
      <span class="startup-loader__annotation startup-loader__annotation--ward"><i />病区空间</span>
      <span class="startup-loader__annotation startup-loader__annotation--device"><i />设备联动</span>
      <span class="startup-loader__annotation startup-loader__annotation--care"><i />护理协同</span>
    </div>
    <main class="startup-loader__panel">
      <div class="startup-loader__symbol" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M24 3 43 14v20L24 45 5 34V14Z M5 14l19 11 19-11M24 25v20M15 9l19 11v10" /></svg>
        <span>数字孪生工作空间</span>
      </div>
      <h1>正在准备<br />您的病区工作台</h1>
      <p class="startup-loader__description">连接病区数据，让空间、设备与护理信息在同一视野中呈现。</p>
      <div class="startup-loader__progress-head">
        <span role="status">{{ phase }}</span>
        <strong>{{ displayProgress }}<small>%</small></strong>
      </div>
      <progress :value="displayProgress" max="100" aria-label="系统初始化进度" />
      <p class="startup-loader__hint">初始化完成后自动进入工作空间</p>
      <div class="startup-loader__capabilities"><span>三维空间</span><span>病区态势</span><span>护理协同</span></div>
    </main>
    <footer class="startup-loader__footer"><div><small>智慧医院 · 实时运营</small><strong>让每一处空间，连接每一份关怀。</strong></div><span>WARD DIGITAL TWIN</span></footer>
  </section>
</template>

<style scoped lang="scss">
.startup-loader {
  position: fixed; inset: 0; z-index: 1000; isolation: isolate; overflow: auto; display: flex; flex-direction: column;
  padding: 32px clamp(24px,4vw,80px); min-height: 100dvh; color: #ecf8fc; background: #061621;
  font-family: inherit;
  &__background, &__shade { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: -1; }
  &__background { object-fit: cover; object-position: 42% center; }
  &__shade { background: linear-gradient(90deg,#04192526 10%,#05192377 48%,#041520eb 100%),linear-gradient(0deg,#03111cf5,transparent 45%,#051421a6); }
  &__header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  &__brand { display: flex; align-items: center; gap: 12px; font-size: 16px; font-weight: 600; }
  &__brand i { display: grid; place-items: center; width: 36px; height: 40px; border: 1px solid #80dacf75; border-radius: 4px 12px 4px 4px; color: #acebe4; background: #24596477; font-style: normal; }
  &__caption { color: #abc9d4; font-size: 13px; letter-spacing: .15em; }
  &__panel { position: relative; isolation: isolate; width: clamp(480px, 32vw, 780px); align-self: flex-end; margin: auto 0; padding: clamp(32px, 2.5vw, 64px); border: 1px solid #7ccacb59; border-radius: 12px 32px 12px 12px; background: linear-gradient(135deg, #163b4beb, #081f30f5 65%); box-shadow: 0 20px 70px #00101955; }
  &__panel::before { content: ''; position: absolute; z-index: -1; right: 28px; top: 28px; width: 100px; height: 100px; pointer-events: none; border-top: 1px solid #8cdad533; border-right: 1px solid #8cdad533; border-radius: 0 16px 0 0; }
  &__symbol { display: flex; align-items: center; gap: 12px; color: #94ddd7; font-size: clamp(13px,.75vw,18px); letter-spacing: .12em; }
  &__symbol svg { width: clamp(40px,2.4vw,60px); height: clamp(40px,2.4vw,60px); }
  h1 { margin: clamp(24px,2vw,48px) 0 20px; font-size: clamp(30px,2.4vw,60px); font-weight: 600; line-height: 1.35; letter-spacing: .02em; }
  &__description { margin: 0; color: #aec7d3; font-size: clamp(14px,.8vw,19px); line-height: 1.9; max-width: 34em; }
  &__progress-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-top: clamp(36px,3vw,72px); }
  &__progress-head > span { color: #c7e2e7; font-size: clamp(14px,.8vw,19px); line-height: 1.6; }
  &__progress-head strong { color: #b2f4e7; font-size: clamp(40px,2.6vw,64px); font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
  &__progress-head small { font-size: 16px; margin-left: 4px; }
  progress { display: block; appearance: none; width: 100%; height: 4px; margin-top: 14px; border: 0; border-radius: 4px; overflow: hidden; background: #24414f; color: #8be5d5; }
  progress::-webkit-progress-bar { background: #24414f; }
  progress::-webkit-progress-value { background: #8be5d5; }
  progress::-moz-progress-bar { background: #8be5d5; }
  &__hint { margin: 12px 0 28px; color: #9bbcca; font-size: clamp(12px,.65vw,16px); }
  &__capabilities { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px 24px; padding-top: 24px; border-top: 1px solid #8cbdc12b; color: #a8c8d2; font-size: clamp(12px,.7vw,17px); }
  &__annotations { position: absolute; inset: 0 46% 0 0; pointer-events: none; }
  &__annotation { position: absolute; display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: #092c3aa6; border: 1px solid #82d9d65c; color: #ceeeed; font-size: 14px; }
  &__annotation i { width: 6px; height: 6px; border-radius: 50%; background: #8de8dd; box-shadow: 0 0 12px #72efdf; }
  &__annotation::after { content: ''; position: absolute; top: 100%; left: 18px; width: 1px; height: 48px; background: linear-gradient(#82d9d6,transparent); }
  &__annotation--ward { left: 16%; top: 42%; }
  &__annotation--device { left: 65%; top: 30%; }
  &__annotation--care { left: 54%; top: 62%; }
  &__footer { display: flex; align-items: end; justify-content: space-between; gap: 16px; padding-top: 24px; }
  &__footer div { display: grid; gap: 8px; }
  &__footer small { color: #9cbeca; font-size: 12px; }
  &__footer strong { font-size: 18px; font-weight: 500; }
  &__footer > span { color: #86a8b6; font-size: 12px; letter-spacing: .2em; }
}
@media(max-width: 900px) {
  .startup-loader { padding: 20px; gap: 24px; }
  .startup-loader__caption, .startup-loader__annotations, .startup-loader__footer > span { display: none; }
  .startup-loader__panel { width: 100%; max-width: 480px; align-self: center; padding: 24px; }
  .startup-loader__footer strong { font-size: 15px; }
}
@media(max-height: 720px) {
  .startup-loader { gap: 24px; }
  .startup-loader__panel { margin-block: 24px; }
}
</style>
