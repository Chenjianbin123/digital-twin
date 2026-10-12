# 病房走廊参考图精修版 v2

## 交付与范围

本版按 `output/imagegen/hospital-concepts-20260929/ward-corridor-concept-v1.png` 精修可见细节，并接入正式 `sceneType=ward` 走廊。不是病房内部场景，也不修改护士站模型或护理业务逻辑。

- 运行模型：`public/models/hospital-corridor/corridor-reference-v2.glb`。
- 可编辑 Blender 源：`output/corridor-reference-v2/corridor-reference-v2.blend`，保留分件、倒角与材质节点，贴图已打包。
- 导出工作副本：`output/corridor-reference-v2/corridor-reference-v2-runtime.blend`，合并静态几何并保存 AO UV。
- Blender 实际渲染：`output/corridor-reference-v2/corridor-reference-v2.png`。
- 网页实际截图：`output/playwright/corridor-reference-v2-light-scene.png`、`corridor-reference-v2-dark-scene.png`。
- 制作脚本：`scripts/refine_corridor_reference_v2.py`；测量清单：`output/corridor-reference-v2/manifest.json`。

这是基于单张效果图的设计复刻，不是建筑测绘；深度、隐藏结构及反射效果不能由单张图唯一确定。没有将其声明为真实医院平面布局。

## 本次精修

- 前排四扇门采用更细的倒角，补嵌套门框、止口、合页、锁孔和固定螺钉；远处门保留较低细分。
- 增加金属立柱宽度、护墙分缝、收边与扶手端部回弯。
- 木门使用不规则纵向纤维纹理，避免等间隔条纹；金属与地面保留独立颜色、粗糙度、法线贴图。
- 补吊顶灯槽层次、风口收边、探测器孔，调整导视牌与尽头护士台的比例、层次和绿植落地位置。
- 静态建筑烘焙 2K AO，地板烘焙 1K AO；AO 使用 UV1，PBR 与门口屏保留 UV0。
- 正常场景使用室内面光源和柔和环境光，不套用旧版室外方向光的硬投影。加载失败时恢复原有备用几何及方向光。
- 浅色保留医疗空间的米白、浅木、银灰；深色为冷蓝灰，不清除 PBR 贴图，不改变动态屏幕颜色。

## 模型与业务契约

保留 `门1`–`门10`、`门口机1`–`门口机10`、`DoorScreen_1`–`DoorScreen_10`、`DoorLabel_1`–`DoorLabel_10`、`走廊屏1/2`、`地板/天花板/墙壁/墙壁2`。

门口屏仍为独立 9:16 四边形，两个公共显示面为 16:9。屏幕与房号由运行时数据渲染，GLB 不含 `Preview_*` 示例文字。Blender 源中的预览房号仅用于看效果，不导出到项目。真实房间仍通过现有稳定槽位逻辑绑定，不依赖接口数组顺序。

配置入口为 `src/config/ward-corridor-scene.ts`。`legacyWardCorridorSceneConfig` 和原 `3-v4.glb`、参考 v1 的 GLB/Blender 源均保留。需要回退时可将导出的 `wardCorridorSceneConfig` 改为旧配置，并刷新页面；新材质适配仅识别 `CorridorReferenceV2` 根节点，不污染旧模型。

## 资源与绘制预算

同一合成数据页面、1440×1000、DPR 1、相机 `(0.1, 1.65, 12.8)` 的对比：

| 指标 | 参考 v1 | 精修 v2 |
| --- | ---: | ---: |
| GLB 字节数 | 7,382,976 | 8,050,140 |
| 场景实例三角面（不含运行时附加显示面） | 94,996 | 155,104 |
| 内嵌贴图 | 2 | 10 |
| 实际主视角绘制次数 | 113 | 136 |

v2 增加了细节和贴图，文件相对参考 v1 增加约 9%。使用 Draco 压缩及静态网格合并；没有给每扇门重复制作 AO 图集。测试预算为 12 MiB、150 个实例材质 primitive、24 万场景实例三角面。

表中基线是参考 v1，不是此前正式配置的 `3-v4.glb`。绘制次数不是 FPS，未据此承诺低配置设备帧率，也未在真实医院终端进行性能验收。

## 验收

2026-09-29 本地验收，使用真实 `AreaScene`、生产配置与模板渲染路径，但病房和接口响应为合成数据，不访问医院服务。

- 新旧实际 GLB 解码：十门、十屏、独立房号、两块公共屏、相机边界、UV 正反面、深度与资源预算通过。
- 浏览器十个屏幕采样均为预期模板颜色，未被外壳覆盖；入口第一组左右屏均在视野内。
- 打乱房间顺序、清空/恢复保持屏幕和房间身份；横屏模板等比留边；未配置、请求失败及恢复通过。
- 浅/深主题、320/768/1024/1440 宽度下独立预览页面无横向溢出。未将这一结果等同于整个业务页面或真实终端的适配验收。
- 模拟 GLB 请求失败后切换备用几何与旧灯组；刷新恢复后十屏就绪，只有新参考灯组，无旧灯残留。
- `npm run build`（含类型检查）通过。
- 走廊专项命令：`node --test --test-concurrency=1 src/core/*corridor*.test.ts scripts/*corridor*.test.mjs`，70/71 通过。
- 剩余原有失败：`scripts/ward-corridor-toolbar-states.test.mjs:17` 仍断言“已接入 N 间病房”，当前工具栏显示“N 间病房”。该测试和组件本次均未改动，没有为通过模型验收修改业务文案或削弱该测试。

新增 `src/core/reference-corridor.test.ts` 覆盖新配置、PBR/AO 保留、主题反复切换、旧模型不受影响、灯光数量；模型边界测试读取实际配置，避免仅检查源码单双引号。

可复查脚本：`scripts/verify-corridor-reference.pw.js`、`scripts/verify-corridor-failure.pw.js`、`scripts/measure-corridor-reference.pw.js`、`scripts/capture-corridor-reference.pw.js`。运行输出位于 `output/corridor-reference-v2/`，截图位于 `output/playwright/`。

## 重新生成

使用 Blender 4.5 LTS 自带 Python/NumPy，无新增项目依赖。需先存在 v1 的可编辑源（缺失时运行 `scripts/build_corridor_reference_v1.py`），以及 Windows 微软雅黑字体。

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/refine_corridor_reference_v2.py -- --width 1672 --samples 48
```

只导出、不生成离线渲染时使用 `--skip-render`；仍会保存源文件并烘焙 AO。`output/` 属于本地产物目录，交接可编辑模型时应一并保留 `.blend` 和 `textures/`。本次未创建提交、未推送。
