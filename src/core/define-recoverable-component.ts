import { defineComponent, h, type Component } from 'vue';
import AsyncLoadError from '../components/AsyncLoadError.vue';
import { useComponentLoader } from './use-component-loader';

export function defineRecoverableComponent<T extends Component>(loader: () => Promise<{ default: T }>): T {
  let resolved: T | undefined;
  const wrapper = defineComponent({
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const { component, failed, retry } = useComponentLoader(async () => {
        resolved ??= (await loader()).default;
        return resolved;
      }, () => {
        // Scene hosts use the same failure state for JS downloads and GLB loads.
        if (typeof attrs.onModelState === 'function') attrs.onModelState('component-error');
      });
      void retry();
      return () => component.value
        ? h(component.value, attrs, slots)
        : failed.value && typeof attrs.onModelState !== 'function'
          ? h(AsyncLoadError)
          : null;
    },
  });
  // Preserve the loaded SFC's props/events for callers; attrs are forwarded unchanged.
  return wrapper as unknown as T;
}
