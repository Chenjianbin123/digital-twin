export interface PollingVisibility {
  isVisible: () => boolean;
  subscribe: (listener: (visible: boolean) => void) => () => void;
}

export function createBrowserPollingVisibility(): PollingVisibility {
  return {
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    subscribe(listener) {
      if (typeof document === 'undefined')
        return () => {};
      const handleVisibilityChange = () => {
        listener(document.visibilityState !== 'hidden');
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}
