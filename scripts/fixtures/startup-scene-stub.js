// Browser checks substitute only the renderer; the workspace/loading owners stay real.
import { defineComponent, h, onMounted, onBeforeUnmount } from 'vue';
export default defineComponent({
  inheritAttrs: false,
  emits: ['modelState'],
  setup(_, { emit }) {
    const control = window.startupSceneStub ??= { mounts: [], active: null };
    const onState = state => emit('modelState', state);
    onMounted(() => { control.mounts.push(onState); control.active = onState; });
    onBeforeUnmount(() => { if (control.active === onState) control.active = null; });
    return () => h('div', { class: 'synthetic-renderer' }, '三维渲染替身 · 非实际模型');
  },
});
