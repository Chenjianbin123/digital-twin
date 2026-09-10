<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { createStationPreview, type PreviewView } from './station-preview';

const host = ref<HTMLDivElement>();
const state = ref('正在加载第二版模型…');
const ready = ref(false);
const failed = ref(false);
const activeView = ref<PreviewView>('front');
const exposure = ref(1);
const stats = ref('');
let preview: ReturnType<typeof createStationPreview> | undefined;
const views: { id: PreviewView; label: string }[] = [
  { id: 'front', label: '正面全景' }, { id: 'detail', label: '柜台细节' },
  { id: 'workstation', label: '护士工作侧' }, { id: 'wall', label: '信息屏' },
];
function setView(view: PreviewView) {
  activeView.value = view;
  preview?.setView(view);
}
function reload() { window.location.reload(); }
onMounted(async () => {
  try {
    if (!host.value) throw new Error('预览容器不可用');
    preview = createStationPreview(host.value);
    await preview.load(percent => { state.value = `正在加载第二版模型… ${percent}%`; });
    ready.value = true;
    state.value = '第二版模型已加载 · 屏幕为演示内容';
    stats.value = preview.stats();
  }
  catch {
    preview?.dispose();
    preview = undefined;
    failed.value = true;
    state.value = '模型加载失败，请检查浏览器 WebGL 支持及模型资源后重试。';
  }
});
onBeforeUnmount(() => preview?.dispose());
</script>

<template>
  <main class="preview">
    <header>
      <div><h1>护士站 <span>V2 模型预览</span></h1><p>设计效果参考 · 屏幕为演示数据</p></div>
      <a href="/">返回正式页面 ↗</a>
    </header>
    <section class="viewport" aria-label="护士站三维模型预览" :aria-busy="!ready && !failed">
      <div ref="host" class="canvas-host" />
      <div v-if="!ready" class="loading" role="status">
        <p>{{ state }}</p><button v-if="failed" @click="reload">重新加载</button>
      </div>
      <div v-else class="model-note">设计评审版 · 非实时医疗数据</div>
    </section>
    <footer>
      <nav aria-label="模型观察视角">
        <button v-for="view in views" :key="view.id" :disabled="!ready" :aria-pressed="activeView === view.id" @click="setView(view.id)">{{ view.label }}</button>
      </nav>
      <label class="exposure">亮度 <input v-model.number="exposure" :disabled="!ready" type="range" min="0.6" max="1.6" step="0.05" @input="preview?.setExposure(exposure)"><output>{{ exposure.toFixed(2) }}</output></label>
      <p class="help">拖动旋转 · 右键平移 · 滚轮缩放 · 聚焦画布后方向键平移</p>
      <p class="status" role="status">{{ state }}<span v-if="stats"> · {{ stats }}</span></p>
    </footer>
  </main>
</template>

<style>
:root { font-family: "Microsoft YaHei", sans-serif; color: #e5eff0; background: #101d24; color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; }
.preview { height: 100dvh; min-height: 480px; display: flex; flex-direction: column; }
header { padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; gap: 16px; border-bottom: 1px solid #35464e; }
h1 { font-size: 20px; margin: 0; } h1 span { font-size: 14px; font-weight: 400; margin-left: 12px; color: #aac3ca; }
header p { margin: 6px 0 0; font-size: 12px; color: #aac3ca; }
a { color: #a5e7e9; font-size: 13px; white-space: nowrap; }
.viewport { position: relative; flex: 1; min-height: 180px; background: #dbe2e2; overflow: hidden; }
.canvas-host { position: absolute; inset: 0; } canvas { display: block; touch-action: none; }
.loading { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 24px; background: #101d24e8; }
.model-note { position: absolute; top: 12px; left: 16px; padding: 6px 10px; background: #101d24d9; border-radius: 4px; font-size: 12px; pointer-events: none; }
footer { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center; padding: 12px 24px; }
nav { display: flex; flex-wrap: wrap; gap: 8px; }
button { min-height: 40px; padding: 8px 14px; border: 1px solid #566d76; background: #1a2c35; color: #e5eff0; border-radius: 4px; font: inherit; font-size: 13px; cursor: pointer; }
button[aria-pressed="true"] { background: #cee9e7; border-color: #cee9e7; color: #142a2c; }
button:disabled { opacity: .5; cursor: wait; }
:focus-visible { outline: 3px solid #77d9ef; outline-offset: 3px; }
.exposure { display: flex; align-items: center; gap: 8px; font-size: 13px; } input { width: 120px; min-height: 32px; accent-color: #a5e7e9; } output { min-width: 34px; }
.help, .status { margin: 0; font-size: 12px; color: #aac3ca; } .status { flex-basis: 100%; }
@media (max-width: 600px) { header, footer { padding: 12px; } header { align-items: flex-start; } h1 span { display: block; margin: 4px 0 0; } header p { max-width: 180px; line-height: 1.5; } footer { gap: 8px; } nav { width: 100%; gap: 4px; } nav button { flex: 1; padding: 8px 5px; font-size: 12px; } .help { display: none; } }
</style>
