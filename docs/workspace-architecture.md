# 工作区职责与恢复约定

- `src/App.vue` 管理认证入口、启动、病区选择和工作区装配。
- `src/components/workspace/DigitalTwinWorkspace.vue` 管理场景与信息面板的组合。工作区卸载时清理自己的监听器和状态刷新定时器。
- `src/core/use-workspace-bootstrap.ts` 管理启动进度、重试、取消和延迟回调。异步步骤使用 `BootstrapContext.isCurrent()` 检查会话是否仍有效。
- `src/core/use-workspace-panels.ts` 保存各视图独立的面板偏好。2.5D 默认隐藏，其他视图默认显示；切换病区后重置，退出后随工作区卸载。
- `src/core/workspace-metrics.ts` 计算展示指标。医院床位容量和病区入住率使用不同标签，已知零值保留，无床位时不计算入住率。
- `NurseStationPanel` 的业务展示数据从 `viewModel` 读取，用户偏好、确认记录和交互事件保持独立。
- 工作区布局样式位于 `src/styles/digital-twin-workspace.scss`，通过工作区 SFC 的 scoped style 引入。

## 场景与资源

保留 `useSceneLoading` 的首次访问加载、已访问场景复用、作用域 key 和旧回调隔离。隐藏的 3D 场景继续接收 `active=false`，避免仅靠 CSS 隐藏。

`defineRecoverableComponent` 负责组件代码下载超时和失败；20 秒仍未完成会显示可恢复状态。组件下载失败通过 `component-error` 通知场景加载器，业务场景内部的模型加载仍使用 `loading / ready / fallback`。

两类失败分别处理：

- **页面代码资源失败**：刷新页面重新获取资源。浏览器可能缓存失败的模块加载结果，重复调用同一 import 不保证恢复。
- **模型加载失败**：更换场景实例 key 后重试，保留当前会话与业务工作区。

登录页和普通信息面板的代码资源失败使用 `AsyncLoadError` 提供刷新入口。

## 回归验证

```sh
npm run typecheck
node --test scripts/workspace-lifecycle.test.mjs scripts/workspace-store-lifecycle.test.mjs src/core/use-scene-loading.test.ts
npm test
npm run build
```

行为测试覆盖旧会话结果隔离、结束动画期间取消、卸载清理、失败恢复、病区加载乱序、面板偏好和统计零值。旧的源码边界测试通过 `scripts/helpers/read-workspace-source.mjs` 读取拆分后的明确文件，不替代行为测试。

浏览器验收需覆盖护士站、走廊、病房、2.5D 往返，深浅主题与窄屏，以及组件下载失败刷新和 GLB 下载失败重试。模拟数据验证不代表真实后端或现场设备验收。
