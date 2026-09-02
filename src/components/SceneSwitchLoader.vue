<script setup lang="ts">
import type { SceneSwitchFeedback } from '@/core/scene-transition';

const { feedback } = defineProps<{
  feedback: SceneSwitchFeedback | null;
}>();
</script>

<template>
  <Transition name="scene-switch-loader" appear>
    <div
      v-if="feedback"
      class="scene-switch-loader"
      :class="`scene-switch-loader--${feedback.tone}`"
      role="status"
      aria-live="polite"
      aria-busy="true"
      :aria-label="`${feedback.title}，${feedback.subtitle}`"
    >
      <div class="scene-switch-loader__backdrop" aria-hidden="true">
        <span class="scene-switch-loader__scanline" />
        <span class="scene-switch-loader__halo scene-switch-loader__halo--left" />
        <span class="scene-switch-loader__halo scene-switch-loader__halo--right" />
        <span class="scene-switch-loader__spark scene-switch-loader__spark--one" />
        <span class="scene-switch-loader__spark scene-switch-loader__spark--two" />
        <span class="scene-switch-loader__spark scene-switch-loader__spark--three" />
      </div>

      <section class="scene-switch-loader__card" aria-label="场景切换进度">
        <div class="scene-switch-loader__card-head">
          <span class="scene-switch-loader__eyebrow">
            <i aria-hidden="true" />
            SCENE LINK
          </span>
          <span class="scene-switch-loader__status">
            <i aria-hidden="true" />
            SYNCING
          </span>
        </div>

        <div class="scene-switch-loader__hero">
          <div class="scene-switch-loader__orbit" aria-hidden="true">
            <span class="scene-switch-loader__orbit-ring scene-switch-loader__orbit-ring--outer" />
            <span class="scene-switch-loader__orbit-ring scene-switch-loader__orbit-ring--inner" />
            <span class="scene-switch-loader__orbit-core">
              <i />
            </span>
          </div>

          <div class="scene-switch-loader__headline">
            <span class="scene-switch-loader__label">正在切换场景</span>
            <h2>{{ feedback.title }}</h2>
            <p>{{ feedback.subtitle }}</p>
          </div>
        </div>

        <div class="scene-switch-loader__route" aria-label="场景切换路径">
          <div class="scene-switch-loader__route-node">
            <span class="scene-switch-loader__route-dot" aria-hidden="true" />
            <small>当前场景</small>
            <strong>{{ feedback.fromLabel }}</strong>
          </div>
          <div class="scene-switch-loader__route-line" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div class="scene-switch-loader__route-node scene-switch-loader__route-node--target">
            <span class="scene-switch-loader__route-dot" aria-hidden="true" />
            <small>目标场景</small>
            <strong>{{ feedback.toLabel }}</strong>
          </div>
        </div>

        <div class="scene-switch-loader__progress-wrap">
          <div class="scene-switch-loader__progress-meta">
            <span>正在装配空间数据</span>
            <strong>加载中</strong>
          </div>
          <div class="scene-switch-loader__progress" aria-hidden="true">
            <span />
          </div>
        </div>

        <div class="scene-switch-loader__card-foot">
          <span><i aria-hidden="true" />实时视角连接</span>
          <span>请稍候 · 自动完成</span>
        </div>

        <span class="scene-switch-loader__corner scene-switch-loader__corner--tl" aria-hidden="true" />
        <span class="scene-switch-loader__corner scene-switch-loader__corner--tr" aria-hidden="true" />
        <span class="scene-switch-loader__corner scene-switch-loader__corner--bl" aria-hidden="true" />
        <span class="scene-switch-loader__corner scene-switch-loader__corner--br" aria-hidden="true" />
      </section>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.scene-switch-loader {
  --loader-accent: #72e8ff;
  --loader-accent-strong: #1b9cff;
  --loader-accent-soft: rgba(92, 221, 255, 0.16);
  --loader-accent-faint: rgba(92, 221, 255, 0.06);

  position: absolute;
  inset: 56px 0 0;
  z-index: 23;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #edfbff;
  background:
    radial-gradient(circle at 50% 44%, var(--loader-accent-faint), transparent 44%),
    linear-gradient(180deg, rgba(3, 13, 25, 0.72), rgba(3, 12, 23, 0.84));
  backdrop-filter: blur(9px) saturate(116%);
  pointer-events: auto;
  isolation: isolate;

  &--station {
    --loader-accent: #72e8ff;
    --loader-accent-strong: #1b9cff;
    --loader-accent-soft: rgba(92, 221, 255, 0.16);
    --loader-accent-faint: rgba(92, 221, 255, 0.06);
  }

  &--ward {
    --loader-accent: #8bb8ff;
    --loader-accent-strong: #6d6cff;
    --loader-accent-soft: rgba(126, 141, 255, 0.16);
    --loader-accent-faint: rgba(126, 141, 255, 0.065);
  }

  &--interior {
    --loader-accent: #83f1cf;
    --loader-accent-strong: #1eb68f;
    --loader-accent-soft: rgba(91, 230, 184, 0.16);
    --loader-accent-faint: rgba(91, 230, 184, 0.06);
  }

  &__backdrop {
    position: absolute;
    inset: 0;
    z-index: -1;
    overflow: hidden;
    pointer-events: none;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.42;
      background:
        linear-gradient(rgba(145, 225, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(145, 225, 255, 0.04) 1px, transparent 1px);
      background-size: 54px 54px;
      mask-image: radial-gradient(circle at 50% 42%, #000 0%, rgba(0, 0, 0, 0.72) 46%, transparent 86%);
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      opacity: 0.1;
      background: repeating-linear-gradient(
        0deg,
        transparent 0,
        transparent 3px,
        rgba(147, 231, 255, 0.16) 4px,
        transparent 5px
      );
      mix-blend-mode: screen;
    }
  }

  &__scanline {
    position: absolute;
    top: -12%;
    left: 0;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--loader-accent), transparent);
    box-shadow: 0 0 18px 2px var(--loader-accent);
    opacity: 0.52;
    animation: scene-switch-loader-scan 2.6s linear infinite;
  }

  &__halo {
    position: absolute;
    width: min(42vw, 540px);
    aspect-ratio: 1;
    border: 1px solid var(--loader-accent-soft);
    border-radius: 50%;
    opacity: 0.48;
    transform: translate(-50%, -50%);
    animation: scene-switch-loader-halo 5.5s ease-in-out infinite;

    &::before,
    &::after {
      content: '';
      position: absolute;
      inset: 9%;
      border: 1px dashed var(--loader-accent-soft);
      border-radius: inherit;
    }

    &::after {
      inset: 22%;
      border-style: solid;
      opacity: 0.56;
    }

    &--left {
      top: 42%;
      left: 22%;
    }

    &--right {
      top: 65%;
      left: 81%;
      width: min(30vw, 360px);
      animation-delay: -2.2s;
    }
  }

  &__spark {
    position: absolute;
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--loader-accent);
    box-shadow: 0 0 12px 2px var(--loader-accent);
    opacity: 0.64;
    animation: scene-switch-loader-spark 2.8s ease-in-out infinite;

    &--one {
      top: 22%;
      left: 14%;
    }

    &--two {
      top: 74%;
      left: 72%;
      animation-delay: -1.4s;
    }

    &--three {
      top: 31%;
      left: 86%;
      width: 2px;
      height: 2px;
      animation-delay: -0.72s;
    }
  }

  &__card {
    position: relative;
    width: min(560px, calc(100% - 40px));
    padding: 26px 30px 22px;
    border: 1px solid var(--loader-accent-soft);
    border-radius: 18px;
    background:
      linear-gradient(145deg, rgba(10, 30, 48, 0.92), rgba(5, 18, 32, 0.88)),
      rgba(4, 15, 28, 0.9);
    box-shadow:
      0 28px 80px rgba(0, 0, 0, 0.46),
      0 0 0 1px rgba(255, 255, 255, 0.035) inset,
      0 0 48px var(--loader-accent-faint);
    backdrop-filter: blur(18px) saturate(135%);
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        linear-gradient(115deg, rgba(255, 255, 255, 0.07), transparent 24%),
        linear-gradient(180deg, transparent 74%, var(--loader-accent-faint));
      opacity: 0.7;
    }

    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 18%;
      right: 18%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--loader-accent), transparent);
      box-shadow: 0 0 18px var(--loader-accent);
      opacity: 0.66;
    }
  }

  &__card-head,
  &__hero,
  &__route,
  &__progress-wrap,
  &__card-foot {
    position: relative;
    z-index: 1;
  }

  &__card-head,
  &__card-foot,
  &__progress-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__eyebrow,
  &__status,
  &__card-foot {
    color: rgba(183, 222, 238, 0.68);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.16em;
  }

  &__eyebrow,
  &__status,
  &__card-foot span {
    display: inline-flex;
    align-items: center;
    gap: 7px;
  }

  &__eyebrow {
    color: var(--loader-accent);
  }

  &__eyebrow i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--loader-accent);
    box-shadow: 0 0 10px var(--loader-accent);
    animation: scene-switch-loader-blink 1.15s ease-in-out infinite;
  }

  &__status {
    letter-spacing: 0.1em;
  }

  &__status i {
    width: 5px;
    height: 5px;
    border: 1px solid var(--loader-accent);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--loader-accent);
    animation: scene-switch-loader-blink 1.15s ease-in-out infinite reverse;
  }

  &__hero {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    align-items: center;
    gap: 22px;
    margin-top: 25px;
  }

  &__orbit {
    position: relative;
    display: grid;
    place-items: center;
    width: 76px;
    height: 76px;
  }

  &__orbit-ring {
    position: absolute;
    inset: 0;
    border: 1px solid var(--loader-accent-soft);
    border-radius: 50%;

    &--outer {
      border-top-color: var(--loader-accent);
      border-right-color: transparent;
      animation: scene-switch-loader-orbit 2.8s linear infinite;
    }

    &--inner {
      inset: 11px;
      border-right-color: var(--loader-accent);
      border-bottom-color: transparent;
      animation: scene-switch-loader-orbit 1.8s linear infinite reverse;
    }
  }

  &__orbit-core {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 1px solid var(--loader-accent);
    border-radius: 50%;
    background: radial-gradient(circle, var(--loader-accent-soft), rgba(5, 20, 34, 0.8) 66%);
    box-shadow: 0 0 24px var(--loader-accent-soft);

    i {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--loader-accent);
      box-shadow: 0 0 13px 3px var(--loader-accent);
      animation: scene-switch-loader-core 1.4s ease-in-out infinite;
    }
  }

  &__headline {
    min-width: 0;
  }

  &__label {
    display: block;
    color: var(--loader-accent);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.13em;
  }

  h2 {
    margin: 7px 0 0;
    color: #f4fcff;
    font-size: clamp(22px, 3vw, 30px);
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: 0.01em;
    text-shadow: 0 0 24px var(--loader-accent-soft);
  }

  &__headline p {
    margin: 9px 0 0;
    color: rgba(190, 222, 237, 0.76);
    font-size: 13px;
    line-height: 1.5;
  }

  &__route {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(62px, 0.8fr) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    margin-top: 26px;
    padding: 13px 14px;
    border: 1px solid rgba(142, 218, 239, 0.12);
    border-radius: 10px;
    background: rgba(1, 13, 25, 0.34);
  }

  &__route-node {
    display: grid;
    grid-template-columns: 8px minmax(0, 1fr);
    grid-template-rows: auto auto;
    column-gap: 8px;
    min-width: 0;

    small {
      color: rgba(168, 208, 224, 0.54);
      font-size: 10px;
      line-height: 1.25;
    }

    strong {
      min-width: 0;
      overflow: hidden;
      color: #ecfaff;
      font-size: 13px;
      line-height: 1.3;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  &__route-dot {
    grid-row: 1 / span 2;
    width: 7px;
    height: 7px;
    margin-top: 3px;
    border: 1px solid var(--loader-accent);
    border-radius: 50%;
    box-shadow: 0 0 11px var(--loader-accent);
  }

  &__route-node--target {
    justify-self: end;
    text-align: right;
    grid-template-columns: minmax(0, 1fr) 8px;

    .scene-switch-loader__route-dot {
      grid-column: 2;
    }

    small,
    strong {
      grid-column: 1;
    }
  }

  &__route-line {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;

    &::before,
    &::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--loader-accent-soft));
    }

    &::after {
      background: linear-gradient(90deg, var(--loader-accent-soft), transparent);
    }

    i {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--loader-accent);
      box-shadow: 0 0 8px var(--loader-accent);
      animation: scene-switch-loader-route 1.15s ease-in-out infinite;

      &:nth-child(2) {
        animation-delay: 0.16s;
      }

      &:nth-child(3) {
        animation-delay: 0.32s;
      }
    }
  }

  &__progress-wrap {
    margin-top: 22px;
  }

  &__progress-meta {
    color: rgba(174, 212, 228, 0.64);
    font-size: 10px;
    line-height: 1.3;

    strong {
      color: var(--loader-accent);
      font-size: 10px;
      font-weight: 800;
    }
  }

  &__progress {
    position: relative;
    height: 4px;
    margin-top: 9px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(129, 211, 234, 0.1);

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.32), transparent);
      transform: translateX(-100%);
      animation: scene-switch-loader-progress-glint 1.25s ease-in-out infinite;
    }

    span {
      display: block;
      width: 46%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, var(--loader-accent-strong), var(--loader-accent));
      box-shadow: 0 0 13px var(--loader-accent-soft);
      animation: scene-switch-loader-progress 1.25s cubic-bezier(0.32, 0.72, 0.44, 1) infinite;
    }
  }

  &__card-foot {
    margin-top: 18px;
    color: rgba(164, 205, 222, 0.5);
    font-size: 10px;
    letter-spacing: 0.02em;

    span:first-child {
      color: rgba(189, 228, 236, 0.7);
    }

    i {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: #79e9b7;
      box-shadow: 0 0 9px rgba(121, 233, 183, 0.8);
    }
  }

  &__corner {
    position: absolute;
    width: 13px;
    height: 13px;
    border-color: var(--loader-accent);
    opacity: 0.72;
    pointer-events: none;

    &--tl {
      top: 10px;
      left: 10px;
      border-top: 1px solid;
      border-left: 1px solid;
    }

    &--tr {
      top: 10px;
      right: 10px;
      border-top: 1px solid;
      border-right: 1px solid;
    }

    &--bl {
      bottom: 10px;
      left: 10px;
      border-bottom: 1px solid;
      border-left: 1px solid;
    }

    &--br {
      right: 10px;
      bottom: 10px;
      border-right: 1px solid;
      border-bottom: 1px solid;
    }
  }

  @include down($bp-sm) {
    inset: 52px 0 0;

    &__card {
      width: min(520px, calc(100% - 24px));
      padding: 22px 19px 19px;
      border-radius: 15px;
    }

    &__hero {
      grid-template-columns: 62px minmax(0, 1fr);
      gap: 16px;
      margin-top: 22px;
    }

    &__orbit {
      width: 60px;
      height: 60px;
    }

    &__orbit-core {
      width: 23px;
      height: 23px;
    }

    h2 {
      font-size: 22px;
    }

    &__headline p {
      margin-top: 7px;
      font-size: 12px;
    }

    &__route {
      grid-template-columns: minmax(0, 1fr) minmax(38px, 0.5fr) minmax(0, 1fr);
      gap: 8px;
      margin-top: 22px;
      padding: 11px 10px;
    }

    &__route-node strong {
      font-size: 12px;
    }

    &__card-foot {
      margin-top: 15px;
      font-size: 9px;
    }
  }

  @include down($bp-xs) {
    &__status {
      display: none;
    }

    &__hero {
      grid-template-columns: 52px minmax(0, 1fr);
      gap: 12px;
    }

    &__orbit {
      width: 52px;
      height: 52px;
    }

    &__orbit-ring--inner {
      inset: 8px;
    }

    &__route {
      grid-template-columns: 1fr;
      gap: 9px;
    }

    &__route-line {
      transform: rotate(90deg);
    }

    &__route-node--target {
      justify-self: stretch;
    }
  }
}

.scene-switch-loader-enter-active,
.scene-switch-loader-leave-active {
  transition: opacity 0.3s ease, backdrop-filter 0.3s ease;

  .scene-switch-loader__card {
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
}

.scene-switch-loader-enter-from,
.scene-switch-loader-leave-to {
  opacity: 0;

  .scene-switch-loader__card {
    opacity: 0;
    transform: translateY(14px) scale(0.96);
  }
}

@keyframes scene-switch-loader-scan {
  0% {
    transform: translateY(0);
  }

  100% {
    transform: translateY(122vh);
  }
}

@keyframes scene-switch-loader-halo {
  0%,
  100% {
    transform: translate(-50%, -50%) scale(0.96);
    opacity: 0.3;
  }

  50% {
    transform: translate(-50%, -50%) scale(1.04);
    opacity: 0.58;
  }
}

@keyframes scene-switch-loader-spark {
  0%,
  100% {
    transform: scale(0.7);
    opacity: 0.18;
  }

  50% {
    transform: scale(1.5);
    opacity: 0.88;
  }
}

@keyframes scene-switch-loader-orbit {
  to {
    transform: rotate(360deg);
  }
}

@keyframes scene-switch-loader-core {
  0%,
  100% {
    transform: scale(0.72);
    opacity: 0.7;
  }

  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@keyframes scene-switch-loader-route {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.76);
  }

  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

@keyframes scene-switch-loader-progress {
  0% {
    transform: translateX(-125%);
  }

  100% {
    transform: translateX(240%);
  }
}

@keyframes scene-switch-loader-progress-glint {
  0%,
  20% {
    transform: translateX(-100%);
  }

  70%,
  100% {
    transform: translateX(100%);
  }
}

@keyframes scene-switch-loader-blink {
  0%,
  100% {
    opacity: 0.44;
  }

  50% {
    opacity: 1;
  }
}
</style>
