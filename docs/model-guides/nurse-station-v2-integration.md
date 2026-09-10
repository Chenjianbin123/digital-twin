# 第二版护士站正式接入

正式页面 `/` 的护士站默认加载第二版模型。正常登录后进入护士站即可查看，无需从“第二版模型预览”入口进入；原有认证与业务接口不变。预览入口保留为设计参考，使用演示数据。

## 资源与接入边界

- 正式资源：`public/models/smart-ward-nurse-station/nurse-station-design-v2.glb`，28,655,588 字节，与已确认的 `output/nurse-station-reference-v2/nurse-station-design-v2.glb` 一致。
- SHA256：`92676678253E2E4E85A2A0B80E36E858AF741E7A896E3B1CF612232BE3D44FA9`。
- 原模型 `public/models/smart-ward-nurse-station/1-1.glb` 保留，未覆盖。
- `src/config/nurse-station-scene.ts` 管理模型地址、`layout: 'reference-v2'`、初始视角与曝光。
- `src/core/reference-nurse-station.ts` 管理第二版的原始米制尺寸、精确屏幕绑定、圆形时钟和灯光；不把旧模型的包围盒缩放规则套到新模型。
- `src/core/area-scene.ts` 沿用现有业务看板数据、刷新与销毁流程，按 layout 选择适配器；走廊和旧版布局逻辑保留。

## 屏幕映射

| 模型节点 | 现有业务内容 |
| --- | --- |
| Screen_Main | 病区总览 dashboard |
| Screen_Work_01 | 任务队列 taskQueue |
| Screen_Work_02 | 病区状态 wardStatus |
| Screen_Work_03 | 床位监测 bedMonitor |
| Screen_Work_04 | 设备状态 deviceHealth |
| Clock_Display | 浏览器本地时间圆形时钟 |

屏幕独立绑定 UV，刷新时保留 glTF 贴图方向；缺少必要节点或 UV 时明确报错并使用现有加载失败回退，不把信息误贴到家具。数据刷新不重新加载模型。时钟并非服务器校时结果。

## 网页渲染取舍

保持模型几何与设计源文件不变。仅在正式网页运行时将薄窗玻璃改为普通透明材质，避免全场景透射重绘；静态聚光灯阴影首帧初始化，在模型加入后重新生成一次，之后缓存。若未来增加移动几何，需要相应使阴影失效。

同一受控浏览器、1440×900、正式 AreaScene 联调页的 2 秒采样，从约 11 FPS / 1502 次绘制变为约 24 FPS / 757 次绘制。该采样不是目标设备基准，不代表达到 60 FPS。实时光影与参考效果图仍有差距，尚未完成光照烘焙和目标设备性能验收。

## 验证与限制

执行完整测试 `npm test`、类型检查及生产构建 `npm run build`，并验证导出资源：

```sh
node scripts/validate_nurse_station_design.mjs public/models/smart-ward-nurse-station/nurse-station-design-v2.glb --refined
```

`scripts/verify-station-production.pw.js` 在 `output/playwright/station-production-fixture.html` 上调用真正的 AreaScene 与看板构建器，使用明确标注的合成数据，不绕过项目认证。检查六处显示绑定、呼叫变化、时钟刷新、暂停恢复、320/768/1024/1440 像素宽度、模型加载失败回退，以及 JavaScript 异常和 WebGL 非法操作。实际截图在 `output/playwright/station-production-*.png`。

受控浏览器没有项目登录会话，因此未完成登录后的真实后端端到端验收。现有构建仍提示共享 3D 分块超过 600 kB；模型约 28.7 MB，首次加载取决于网络。测试联调 HTML 位于 output，不是生产构建入口，不应作为正式业务页面使用。

## 回退

旧配置快照在 `output/nurse-station-reference-v2/nurse-station-scene.before-replacement.ts`。不要直接用快照覆盖现有配置文件：当前接口新增了 layout 字段。

如需回退，在现有配置结构中设置 `layout: 'legacy'`、恢复旧模型 URL，并从快照恢复旧 camera、appearance、ceilingY 和 viewBounds 值；保留现有类型定义和 layout 字段。旧资源及旧版适配逻辑均保留。回退后重新执行测试、类型检查和页面视觉验收；模型边界测试当前按第二版默认资源断言，应与回退目标同步调整。
