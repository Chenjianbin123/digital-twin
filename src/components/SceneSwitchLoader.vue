<script setup lang="ts">
import type { SceneSwitchFeedback } from '@/core/scene-transition';

const { feedback } = defineProps<{
  feedback: SceneSwitchFeedback | null;
}>();
defineEmits<{ retry: []; returnStation: [] }>();
function reloadPage() { window.location.reload(); }
</script>

<template>
  <Transition name="scene-switch-loader" appear>
    <div
      v-if="feedback"
      class="scene-switch-loader"
      :class="`scene-switch-loader--${feedback.tone}`"
      :data-state="feedback.status ?? 'loading'"
      role="status"
      aria-live="polite"
      :aria-busy="feedback.status !== 'fallback'"
      :aria-label="`${feedback.title}，${feedback.subtitle}`"
    >
      <div class="scene-switch-loader__backdrop" aria-hidden="true" />
      <section class="scene-switch-loader__card" aria-label="场景切换进度">
        <header class="scene-switch-loader__card-head">
          <span class="scene-switch-loader__eyebrow">数字孪生 <span>/</span> 三维工作空间</span>
          <span class="scene-switch-loader__status">
            <i aria-hidden="true" />{{ feedback.status === 'fallback' ? '暂未就绪' : '场景加载中' }}
          </span>
        </header>

        <div class="scene-switch-loader__hero">
          <div class="scene-switch-loader__visual" aria-hidden="true">
            <span class="scene-switch-loader__visual-plane" />
            <div class="scene-switch-loader__icon">
              <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <template v-if="feedback.tone === 'station'">
                  <path d="M10 35h44v18H10zM7 53h50M17 35V16h30v19M22 21h20v10H22zM27 35v-4m10 4v-4M24 44h16M32 40v8" />
                </template>
                <template v-else-if="feedback.tone === 'ward'">
                  <path d="M8 9h48v46H8zM24 21h16v22H24zM8 9l16 12m32-12L40 21M8 55l16-12m32 12L40 43M13 26l6 2v14l-6 4V26Zm38 0-6 2v14l6 4V26ZM29 16h6" />
                </template>
                <template v-else>
                  <path d="M9 25v29m46-17v17M9 46h46M9 38h46M30 38V27h18a7 7 0 0 1 7 7v4M16 30h8v8h-8zM38 10v10m-5-5h10" />
                </template>
              </svg>
            </div>
            <span class="scene-switch-loader__visual-caption">{{ feedback.toLabel }}</span>
          </div>
          <div class="scene-switch-loader__headline">
            <h2>{{ feedback.title }}</h2>
            <span class="scene-switch-loader__label">{{ feedback.status === 'fallback' ? '场景暂时无法打开' : '正在准备您的工作空间' }}</span>
            <p>{{ feedback.subtitle }}</p>
          </div>
        </div>

        <div class="scene-switch-loader__route" aria-label="场景切换路径">
          <div v-if="feedback.fromLabel !== feedback.toLabel" class="scene-switch-loader__route-node">
            <small>当前场景</small><strong>{{ feedback.fromLabel }}</strong>
          </div>
          <svg v-if="feedback.fromLabel !== feedback.toLabel" class="scene-switch-loader__route-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 12h18m-6-6 6 6-6 6" /></svg>
          <div class="scene-switch-loader__route-node scene-switch-loader__route-node--target">
            <small>{{ feedback.fromLabel === feedback.toLabel ? '目标工作空间' : '即将进入' }}</small><strong>{{ feedback.toLabel }}</strong>
          </div>
          <span v-if="feedback.fromLabel === feedback.toLabel" class="scene-switch-loader__route-note">三维场景</span>
        </div>

        <div class="scene-switch-loader__progress-wrap">
          <div class="scene-switch-loader__progress-meta">
            <span>{{ feedback.recovery === 'reload' ? '页面资源未就绪，请刷新页面' : feedback.status === 'fallback' ? '模型加载未完成，请重试' : '正在加载模型与场景资源' }}</span>
            <span v-if="feedback.status !== 'fallback'" class="scene-switch-loader__activity" aria-hidden="true"><i /><i /><i /></span>
          </div>
          <div v-if="feedback.status !== 'fallback'" class="scene-switch-loader__progress" aria-hidden="true"><span /></div>
        </div>

        <footer class="scene-switch-loader__card-foot">
          <p>{{ feedback.recovery === 'reload' ? '刷新后将重新进入工作空间。' : feedback.status === 'fallback' ? '业务数据仍可使用，可重新尝试加载场景。' : '首次进入需加载三维资源，请稍候。' }}</p>
          <div v-if="feedback.status === 'fallback' || feedback.tone !== 'station'" class="scene-switch-loader__actions">
            <button v-if="feedback.tone !== 'station'" type="button" @click="$emit('returnStation')">返回护士站</button>
            <button v-if="feedback.status === 'fallback' && feedback.recovery === 'reload'" type="button" @click="reloadPage">刷新页面</button>
            <button v-if="feedback.status === 'fallback' && feedback.recovery !== 'reload'" type="button" class="scene-switch-loader__retry" @click="$emit('retry')">重试加载 <span aria-hidden="true">↻</span></button>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.scene-switch-loader {
  --loader-accent: #82e8dd;
  --loader-soft: #82e8dd24;
  --loader-glow: #82e8dd0d;
  position: absolute;
  inset: 56px 0 0;
  z-index: 23;
  display: flex;
  padding: 24px;
  overflow: auto;
  color: #eaf6fb;
  background: #03121ddd;
  backdrop-filter: blur(10px);
  isolation: isolate;
  pointer-events: auto;

  &--ward { --loader-accent: #a3c6ff; --loader-soft: #a3c6ff24; --loader-glow: #a3c6ff0d; }
  &--interior { --loader-accent: #9de7bb; --loader-soft: #9de7bb24; --loader-glow: #9de7bb0d; }
  &[data-state='fallback'] { --loader-accent: #f0c489; --loader-soft: #f0c48924; --loader-glow: #f0c4890d; }
  &__backdrop { position: absolute; inset: 0; z-index: -1; pointer-events: none; background: radial-gradient(ellipse at 50% 45%, var(--loader-soft), transparent 65%); }
  &__card { position: relative; width: min(640px, 100%); flex: 0 0 auto; margin: auto; padding: 28px 32px; border: 1px solid #89b7ca40; border-radius: 6px 24px 6px 24px; background: radial-gradient(ellipse at 0 0, var(--loader-soft), transparent 60%), linear-gradient(135deg, #0f2839, #081b2a); box-shadow: 0 28px 80px #00000055, inset 0 1px #e5ffff12; }
  &__card::before { content: ''; position: absolute; top: -1px; left: 32px; width: 72px; height: 2px; background: var(--loader-accent); box-shadow: 0 0 18px var(--loader-soft); }
  &__card-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
  &__eyebrow { color: #8eacb9; font-size: 11px; letter-spacing: .08em; font-weight: 500; }
  &__eyebrow > span { padding: 0 8px; color: var(--loader-accent); }
  &__status {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 10px; border: 1px solid color-mix(in srgb, var(--loader-accent) 36%, transparent);
    border-radius: 999px; color: var(--loader-accent); background: var(--loader-soft);
    font-size: 12px; font-weight: 700; letter-spacing: .04em; white-space: nowrap;
  }
  &__status i {
    width: 6px; height: 6px; background: currentColor; border-radius: 50%;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--loader-accent) 22%, transparent);
    animation: scene-status-pulse 1.4s ease-in-out infinite;
  }
  &__hero { display: grid; grid-template-columns: 128px minmax(0, 1fr); align-items: center; gap: 28px; margin: 28px 0 30px; }
  &__visual { position: relative; display: flex; flex-direction: column; align-items: center; gap: 12px; padding-top: 4px; }
  &__visual-plane { position: absolute; top: 56px; width: 108px; height: 64px; border: 1px solid var(--loader-soft); border-radius: 6px; transform: rotateX(55deg) rotateZ(-35deg); background: var(--loader-glow); box-shadow: 0 8px 0 -1px #102938, 0 9px 0 var(--loader-soft); }
  &__icon {
    position: relative; display: grid; place-items: center;
    width: 92px; height: 92px;
    border: 1.5px solid color-mix(in srgb, var(--loader-accent) 55%, transparent);
    border-radius: 16px; color: var(--loader-accent);
    background: linear-gradient(145deg, color-mix(in srgb, var(--loader-accent) 22%, #0d2536), #0a1f2e);
    box-shadow:
      inset 0 1px #ffffff14,
      0 0 0 4px var(--loader-glow),
      0 14px 28px #00000030;
  }
  &__icon svg { width: 64px; height: 64px; }
  &__visual-caption {
    position: relative; color: var(--loader-accent); font-size: 12px; font-weight: 700;
    letter-spacing: .12em; line-height: 1.5; text-align: center;
  }
  &__headline { min-width: 0; }
  h2 {
    margin: 0;
    color: var(--loader-accent);
    font-family: "Bahnschrift", "Microsoft YaHei UI", sans-serif;
    font-size: clamp(30px, 2.8vw, 40px);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: .02em;
    overflow-wrap: anywhere;
    text-shadow: 0 0 28px var(--loader-soft);
  }
  &__label {
    display: inline-block; margin-top: 12px;
    color: #b0c6d4; font-size: 13px; font-weight: 600; letter-spacing: .02em;
  }
  &__headline p { margin-top: 8px; color: #8eacb9; font-size: 13px; line-height: 1.7; overflow-wrap: anywhere; }
  &__route {
    display: flex; align-items: center; gap: 20px;
    padding: 14px 16px 14px 18px;
    border: 1px solid color-mix(in srgb, var(--loader-accent) 18%, #8bb8c51c);
    border-radius: 10px;
    background: linear-gradient(105deg, #03152270, color-mix(in srgb, var(--loader-accent) 8%, #03152270));
  }
  &__route-node { display: grid; gap: 5px; min-width: 0; flex: 1; }
  &__route-node small { color: #7f9aab; font-size: 11px; font-weight: 600; letter-spacing: .04em; }
  &__route-node strong { font-size: 15px; font-weight: 600; color: #c5d8e2; overflow-wrap: anywhere; }
  &__route-node--target {
    padding: 8px 12px; border-radius: 8px;
    background: var(--loader-soft);
    box-shadow: inset 3px 0 0 var(--loader-accent);
  }
  &__route-node--target small { color: color-mix(in srgb, var(--loader-accent) 78%, #9bb9c9); }
  &__route-node--target strong {
    color: var(--loader-accent); font-size: 17px; font-weight: 800;
    font-family: "Bahnschrift", "Microsoft YaHei UI", sans-serif;
  }
  &__route-arrow { width: 30px; height: 24px; flex-shrink: 0; color: var(--loader-accent); opacity: .72; }
  &__route-note { color: #8baaba; font-size: 12px; }
  &__progress-wrap { margin-top: 22px; }
  &__progress-meta {
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    color: #a8c0cc; font-size: 12px; font-weight: 600; line-height: 1.6;
  }
  &__activity { display: flex; gap: 4px; }
  &__activity i { width: 4px; height: 4px; border-radius: 50%; background: var(--loader-accent); animation: scene-activity-dot 1.2s ease-in-out infinite; }
  &__activity i:nth-child(2) { animation-delay: .15s; }
  &__activity i:nth-child(3) { animation-delay: .3s; }
  &__progress {
    position: relative; height: 6px; margin-top: 12px; border-radius: 999px; overflow: hidden;
    background: #7cbbd026; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--loader-accent) 12%, transparent);
  }
  &__progress span {
    display: block; width: 42%; height: 100%; border-radius: inherit;
    background: linear-gradient(90deg, transparent, var(--loader-accent) 40%, #ffffffaa);
    box-shadow: 0 0 12px var(--loader-soft);
    animation: scene-resource-flow 1.8s ease-in-out infinite;
  }
  &__card-foot { display: flex; align-items: center; flex-wrap: wrap; justify-content: space-between; gap: 16px; margin-top: 22px; padding-top: 16px; border-top: 1px solid #92bac91c; }
  &__card-foot p { flex: 1 1 220px; font-size: 12px; line-height: 1.65; color: #7f9aab; }
  &__actions { display: flex; gap: 10px; flex-wrap: wrap; }
  &__actions button { min-height: 40px; padding: 8px 14px; border: 1px solid #729eb450; border-radius: 5px; color: #cce0eb; background: #133044; font: inherit; font-size: 12px; cursor: pointer; }
  &__actions button:hover { border-color: var(--loader-accent); }
  &__actions button:focus-visible { outline: 2px solid var(--loader-accent); outline-offset: 3px; }
  &__actions .scene-switch-loader__retry { border-color: var(--loader-accent); color: #1e2b32; background: var(--loader-accent); font-weight: 600; }
  &__retry span { padding-left: 8px; font-size: 16px; }
}
.scene-switch-loader-enter-active, .scene-switch-loader-leave-active { transition: opacity .2s ease; }
.scene-switch-loader-enter-from, .scene-switch-loader-leave-to { opacity: 0; }
@keyframes scene-resource-flow { from { transform: translateX(-100%); } to { transform: translateX(350%); } }
@keyframes scene-status-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: .55; transform: scale(.85); }
}
@keyframes scene-activity-dot {
  0%, 80%, 100% { opacity: .35; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-2px); }
}
@media (max-width: 600px) {
  .scene-switch-loader {
    padding: 16px;
    &__card { padding: 22px; }
    &__hero { grid-template-columns: 76px minmax(0, 1fr); gap: 16px; margin: 26px 0; }
    &__icon { width: 72px; height: 72px; border-radius: 12px; }
    &__icon svg { width: 50px; height: 50px; }
    &__visual-plane { width: 84px; height: 48px; }
    &__visual-caption { font-size: 11px; }
    &__eyebrow { font-size: 11px; }
    &__eyebrow > span { padding: 0 4px; }
    &__status { font-size: 11px; padding: 4px 8px; }
    &__headline p { font-size: 13px; }
    h2 { font-size: 28px; }
    &__route { padding: 14px; gap: 14px; }
    &__route-node--target strong { font-size: 15px; }
  }
}
@media (max-width: 380px) {
  .scene-switch-loader {
    padding: 12px;
    &__card { padding: 20px 16px; }
    &__hero { grid-template-columns: minmax(0, 1fr); gap: 18px; margin: 20px 0; }
    &__visual { display: none; }
    &__card-head { gap: 8px; }
    &__eyebrow { letter-spacing: 0; }
    &__route { gap: 10px; }
    &__route-node strong { font-size: 14px; }
  }
}
@media (prefers-reduced-motion: reduce) {
  .scene-switch-loader__progress span { animation: none; width: 100%; opacity: .6; }
  .scene-switch-loader__status i,
  .scene-switch-loader__activity i { animation: none; }
  .scene-switch-loader-enter-active, .scene-switch-loader-leave-active { transition: none; }
}
@media (prefers-reduced-transparency: reduce) {
  .scene-switch-loader { backdrop-filter: none; background: #061521; }
}
</style>
