# 初始化与屏幕刷新优化：第二轮

2026-09-20。范围：启动遮罩收尾、当前护士站六块屏幕按变化更新、病房首帧 ready。未改模型外观、临床数据口径、接口鉴权或模型资产；未创建提交。

## 修改

- `src/core/use-workspace-bootstrap.ts`：任务完成后直接进入完成状态，仅保留最短 180 ms 防闪动和完成后至少 80 ms 短暂收尾，不再等待模拟进度跑满。慢请求仍持续显示 loading；取消、销毁、旧会话、失败重试保护保留。既有 CSS 离场动画不变。
- `src/core/nurse-station-board-signatures.ts`：对当前 reference 模型各屏实际使用的字段生成签名，不因仅同步时间变化而重复绘制。时钟按秒更新，四块工作屏的 HH:mm 按分钟更新；数据变动仍立即检查并更新对应屏。
- `src/core/area-scene.ts`、`src/core/reference-nurse-station.ts`：复用 CanvasTexture、canvas、材质和 UV；隐藏时不重绘，恢复显示时补齐最新数据。原有非 reference 布局保持原刷新路径，不进行本轮之外的迁移。
- `src/core/ward-scene.ts`：ready 移至 GPU 准备、陈旧请求检查及显式 render 之后；床位装配异常保留原有外壳恢复行为，GPU/render 失败仍进入 fallback。

## 实测

浏览器使用实际模型与渲染器、合成业务数据、本地 Vite、1440×900、Intel UHD Graphics 730；不是已登录真实医院页面。资源等待和模型解析时间没有被算成下面的启动控制器耗时。

| 指标 | 修改前 | 修改后 |
| --- | --- | --- |
| 立即完成数据任务时，启动 visible 变 false | 约 2050–2054 ms | 约 197–202 ms |
| 每 3.5 秒新建屏幕纹理（最新 A/B/B/A 样本） | 每段 18 次 | 每段 0 次 |
| 每 3.5 秒屏幕绘制（最新样本，未跨分钟） | 每段 18 次 | 每段 2–4 次，仅时钟 |
| 每帧绘制数 / 三角形 | 946 / 561384 | 946 / 561384，不修改模型复杂度 |

以上控制器时间不含原有 CSS 离场动画。帧率受机器其他负载和浏览器影响，第一轮 A/B/B/A 样本为旧逻辑 16.2/13.1 FPS、新逻辑 20.3/21.6 FPS；最后复测旧逻辑 14.8/8.6、新逻辑 17.6/11.4。只能确认纹理分配消除和无效绘制减少，不能据此承诺固定 FPS、固定提升比例或达到流畅度上线标准。正式部署与实际终端仍需独立性能验收。

## 验证

- 32 项定向测试全部通过，包括快速/慢速/失败启动、取消重试、签名字段、秒/分钟刷新、模型显示契约和旧布局断言。
- `npm run build` 通过（包含类型检查），`git diff --check` 通过。构建仍有大分包/插件耗时提示。
- 浏览器 `scripts/verify-station-refresh.pw.js` 通过：相同数据不上传、呼叫只更新主屏/任务/病区屏、主屏像素变化、纹理与画布身份复用、材质和 UV 保留、隐藏不绘制、返回补齐数据、秒/分钟、主题切换。320/768/1024/1440 视口无横向溢出，截图已检查。检查页面为 `scripts/fixtures/station-refresh.html`。
- `scripts/verify-ward-first-frame.pw.js` 使用真实病房模型，人为挂起 GPU 准备：期间只有 loading；释放后 GPU 完成、render frame 增加，再发出 ready。
- 独立审查通过；初次发现的测试 fixture 必填字段缺失已修复并重新运行类型检查。

全量最终 548 项，542 通过、6 失败，不是全绿。上一轮的病房首帧时序失败已修复，剩余为：

1. `app-auth-boundary.test.mjs`：工作区已有的医院介绍入口使旧 `SwpLoginGate v-if` 文本断言失效；本轮未修改 `App.vue` 或该入口，不修改此断言。
2. 病区走廊隐藏护士站，返回护士站时恢复（原有）。
3. `nurse-station-page-presentation-boundary.test.mjs`（原有）。
4. `task-4-concurrency.test.mjs`（原有）。
5. corridor viewBounds config uses named floor / walls / ceiling meshes（原有）。
6. 病房内优先用外壳/灯网格钳制，缺失时回退房间平移限制（原有）。

## 复现与证据

```powershell
node --test scripts/workspace-lifecycle.test.mjs scripts/scene-lazy-loading-boundary.test.mjs src/core/nurse-station-board-signatures.test.ts src/core/reference-nurse-station.test.ts scripts/nurse-station-dashboard-alignment-boundary.test.mjs scripts/nurse-station-dashboard-content-fit-boundary.test.mjs scripts/nurse-station-dashboard-full-bleed-boundary.test.mjs scripts/nurse-station-main-screen-layout-boundary.test.mjs
npm test
npm run build
```

开发服务器启动于 5173 后，使用 Playwright CLI 的 `run-code --filename scripts/verify-station-refresh.pw.js` 与 `run-code --filename scripts/verify-ward-first-frame.pw.js`。脚本仅操作测试页，GPU 屏障和旧刷新函数只用于临时对照，结束后恢复。

结果：`output/initialization-round2-focused.log`、`output/initialization-round2-tests.log`、`output/initialization-round2-build.log`、`output/playwright/startup-timing-round2.log`、`output/playwright/station-refresh-round2.log`、`output/playwright/ward-first-frame-round2.log`。截图：`output/playwright/station-refresh-1440.png`、`station-refresh-320.png` 等。

剩余验收边界：真实医院接口加载瀑布、已登录整页耗时及目标设备持续帧率尚未验证。本轮不会借减少患者详情、停止时钟或冻结业务屏幕来获取性能数字。
