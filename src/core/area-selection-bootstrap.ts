export interface AreaSelectionBootstrapOptions {
  useRemoteDeviceApi: boolean;
  useAreaSelection?: boolean;
  assertRuntimeConfigured: () => void;
  initializeFilePrefix: () => Promise<void>;
  loadAreaOptions: () => Promise<void>;
  loadLocalArea: () => Promise<string | null>;
  getRememberedAreaId: () => number | null;
  enterRememberedArea: (areaId: number) => Promise<unknown>;
  onPhase: (progress: number, label: string) => void;
  isCurrent?: () => boolean;
}

export async function prepareAreaSelection(options: AreaSelectionBootstrapOptions): Promise<string | null> {
  try {
    if (options.isCurrent?.() === false) return null;
    const useAreaSelection = options.useAreaSelection ?? options.useRemoteDeviceApi;
    options.onPhase(18, '校验设备运行环境');
    if (options.useRemoteDeviceApi)
      options.assertRuntimeConfigured();

    if (!useAreaSelection) {
      options.onPhase(34, '加载病区文件资源');
      options.onPhase(58, '加载本地病区数据');
      return await options.loadLocalArea();
    }

    options.onPhase(34, '加载病区文件资源');
    const filePrefixTask = options.initializeFilePrefix();
    options.onPhase(58, '同步可用病区');
    const [, areaResult] = await Promise.allSettled([
      filePrefixTask,
      options.loadAreaOptions(),
    ]);
    // A stale list request must not resume a remembered area in a newer login.
    if (options.isCurrent?.() === false) return null;
    if (areaResult.status === 'rejected')
      throw areaResult.reason;

    const rememberedAreaId = options.getRememberedAreaId();
    if (rememberedAreaId != null) {
      options.onPhase(74, '恢复上次工作病区');
      const entered = await options.enterRememberedArea(rememberedAreaId);
      if (options.isCurrent?.() === false) return null;
      if (entered === false)
        return '恢复上次工作病区失败，请重新选择病区';
    }
    return null;
  }
  catch (error) {
    return error instanceof Error ? error.message : '初始化失败';
  }
}
