# 护士站初始化优化：第一轮

## 范围与行为

本轮只拆除非必要的初始化等待，不减少患者数据、不替换模型、不调整告警口径。

- 初始化文件资源前缀与病区列表并行。列表完成后可恢复病区，不等待资源前缀。
- 远端病区入口仍等待门口设备信息与完整床头患者详情，再提交病区快照。
- 医院基本信息独立加载：合并并发请求、当前会话内缓存成功结果，切换病区不重复获取；页面内刷新强制更新。失败不阻塞病区，面板显示局部提示，已有结果保留。
- 病区入口不再预加载门口机、床头机模板；护士站内隐藏的门口屏也不触发模板查询。走廊和病房可见屏幕继续按需加载。
- 模板解析等待资源前缀就绪；Vue 图片 URL 在前缀请求中暂缓拼接，完成后响应式恢复。前缀失败或空值沿用设备文件主机兜底。前缀成功或兜底结果在当前会话内复用，重新登录或整页刷新可重试。
- 退出登录清除医院信息、前缀及本轮耗时记录。旧请求不能写回新会话状态；旧 token 的 HTTP/JSON 401/403 不会清除不同 token 的当前会话。

## 关键代码

| 文件 | 职责 |
| --- | --- |
| `src/core/area-selection-bootstrap.ts` | 拆分前缀与病区列表等待 |
| `src/stores/twin-store.ts` | 保留患者详情完整性，移除模板预加载，独立管理医院信息 |
| `src/core/use-hospital-info.ts` | 会话缓存、请求合并、错误状态、陈旧结果隔离 |
| `src/api/door-device.ts`、`src/core/area-scene.ts` | 移除初始化及隐藏屏幕模板请求 |
| `src/utils/file-prefix.ts`、`src/utils/file-url.ts` | 资源就绪屏障、响应式 URL 和失败兜底 |
| `src/core/template/template-cache.ts` | 按需模板等待资源前缀 |
| `src/api/http-client.ts` | 按发起请求时的 token 处理身份失效 |
| `src/components/HospitalIntroPanel.vue`、`src/components/workspace/DigitalTwinWorkspace.vue` | 接入医院信息局部错误提示 |
| `src/core/load-timing.ts` | 最多 60 条阶段记录，不含 token、患者信息或请求体 |

## 查看阶段耗时

浏览器控制台可读取最近各阶段 User Timing；这是阶段耗时，不是整个页面或 GLB 首帧耗时：

```js
performance.getEntriesByType('measure')
  .filter(entry => entry.name.startsWith('digital-twin:'))
  .map(({ name, duration }) => ({ name, durationMs: Math.round(duration) }))
```

阶段包括 `area-options`、`area-entry`、`door-details`、`bed-details`、`file-prefix`、`hospital-info`。开发期内部模块另提供 `getLoadTimings()`，包含 ready/error/stale 结果。

## 验证记录（2026-09-20）

- 定向测试 12 项全部通过：

  ```powershell
  node --test src/core/use-hospital-info.test.ts src/core/load-timing.test.ts scripts/area-selection-bootstrap.test.ts scripts/bed-template-preload-timing.test.mjs scripts/initialization-loading.test.mjs scripts/ward-remote-lifecycle.test.mjs
  ```

- `npm run build` 通过，包含 Vue/TypeScript 检查；仍有 `RoomEnvironment` 超过 600 kB 的分包警告。
- `git diff --check` 通过；存在 Git 的 LF/CRLF 提示。
- 全量测试由修改前 531 项（525 通过、6 失败），变为 540 项（534 通过、6 失败）。失败名称与基线相同：
  - 病区走廊隐藏护士站，返回护士站时恢复。
  - `nurse-station-page-presentation-boundary.test.mjs`。
  - all GLB readiness notifications follow GPU preparation and first render。
  - `task-4-concurrency.test.mjs`。
  - corridor viewBounds config uses named floor / walls / ceiling meshes。
  - 病房内优先用外壳/灯网格钳制，缺失时回退房间平移限制。
- 医院信息真实 Vue 组件的合成状态页在 320/768/1024/1440 px 浏览器视口中无横向溢出，覆盖加载、首次失败、失败保留旧结果。截图：`output/initialization-metadata-states.png`；入口：`scripts/fixtures/hospital-metadata-states.html`。
- 独立代码复核通过；认证回归覆盖 HTTP/JSON × 401/403 × 旧会话/当前会话/无鉴权的 12 种组合。

## 性能证据及限制

`scripts/initialization-loading.test.mjs` 用真实 Store/API 代码和合成 fetch，不访问真实医院接口。固定医院信息 250 ms、设备及床头详情各 10 ms、每个模板 100 ms 的输入下，一次前后对比病区入口约 390 ms → 45 ms，模板请求 2 → 0；后续定向运行优化后约 52 ms。医院信息仍在后台完成，患者详情在入口返回时完整。

这些数字只证明等待链拆分生效，不能外推真实环境的提速比例或模型首帧性能。真实后端、实际网络、整页 GLB 首帧及 GPU/FPS 尚未验收。对比基线使用只读加载的 Git HEAD Store/设备 API/启动代码，没有回滚工作区。

下一轮应先采集真实环境的阶段耗时与资源瀑布，再决定是否将模型下载与业务初始化并行；不要为追求首屏速度省略患者详情或伪造业务统计。
