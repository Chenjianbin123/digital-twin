# 医院外部 → 楼层总览 → 护士站

2026-10-10。医院外部和病区总览均使用真实 Blender 几何导出的 GLB，接入现有 Vue / Three.js 项目。默认医院外部，直接点击任一楼层进入病区总览，点击护士站模型或标志进入现有护理场景。

## 已接入

- 启动首屏为医院外部 V3，保留停车场、门诊入口、急救通道、绿化及原效果图的城市楼群、河道、河岸树林和远山。已移除悬浮“楼层总览”入口及青色框。主楼 10 层、西侧楼翼 5 层、东侧楼翼 7 层、门诊裙楼 2 层，共 24 个模型楼层均支持直接点击；通过真实网格射线命中和源窗格生成的楼层空间范围共同判定，远景不作为入口。聚焦视口后按 Enter 也可进入。
- 医院外部使用 Blender 参考透视机位与水平视场角，避免使用正交远景取景导致医院变小、天空消失。原生城市 HDR 用作玻璃反射，保留医院玻璃透光；天空为实时渐变与云层，背景几何带大气雾。远景不参与近处阴影，透视相机近裁面为 10，防止远处窗格出现深度冲突。
- 病区总览使用楼层 V4 的真实几何，含 8 间病房、16 张床、护士站、治疗辅助区域和候诊设施。按三维包围盒在相机平面的投影自动适配视口，完整显示模型，限制轴占可用视口的 95%。
- 医院和病区总览均无顶部标题栏、底部提示栏或工具栏，三维视口铺满页面。左键拖动旋转、右键或方向键平移、滚轮缩放（病区总览 65%–400%，医院外部为透视相机前后移动）；病区总览按 Esc 返回医院外部。护士站标志保留原生文字几何，入口跟随三维节点投影；也支持键盘操作。
- 护士站入口打开原有 `nurse-station` 场景，使用现有 `nurse-station-silver-v2.glb`、临床数据和底部导航。首次点击才加载该场景。
- 返回病区保留旋转、缩放和平移。已进入的场景保留实例，隐藏时通过 `active` 暂停渲染；再次进入不重复下载模型。
- 浅色、深色共用几何，跟随现有护士站或启动页的全局主题设置，切换背景、光照与发光材质。模型按需加载，本地 Draco 解码，静止时不持续重绘。
- 总览支持焦点转移、减少动态效果偏好、模型失败重试、WebGL 上下文丢失重试和启动失败重试。
- 医院和楼层总览复用护士站切换病房的 `SceneSwitchLoader` 加载卡片、路径、字体和动画。总览加载层覆盖完整视口，并展示真实资源百分比；失败时保留统一重试样式，楼层可返回医院外部。临床场景未提供百分比时继续使用原来的活动进度动画。`scripts/hospital-loading.browser-check.cjs` 对比实际组件样式并验证浅深色、窄屏、进度、返回及失败重试。

## 资源及边界

| 场景 | 网页模型 | 实际三角面 | 合并网格 | 文件字节 |
| --- | --- | ---: | ---: | ---: |
| 医院外部 V3 | `hospital-exterior-v3.glb` | 2,304,898 | 81 | 27,973,744 |
| 病区总览 V4 | `hospital-floor-v4.glb` | 1,883,013 | 45 | 13,946,072 |

源文件为 `output/hospital-exterior-reference-v3/hospital-exterior-reference-v3.blend` 和 `output/hospital-floor-reference-v4/hospital-floor-reference-v4.blend`。`scripts/export_hospital_navigation_models.py` 只处理内存中的导出副本：合并同材质静态网格、保留法线 / UV / 文字几何及全部远景背景、降低倒角细分和外部植被密度、移除无效三角形，再导出单场景 Draco GLB。源文件 SHA-256 在导出前后核对，均未改变。

补回背景增加 190,920 个三角面、13 个合并网格；没有把远景几何纳入主体取景范围。原场景中的 `hospital-daylight.exr` 及其许可文件随网页资源发布，不依赖外部请求。网页实时渲染与 Blender 离线路径追踪的柔和阴影、折射和后期处理仍有差异，不声称逐像素一致。

`public/models/hospital-navigation/manifest.json` 记录资源与切换关系；`exterior-3d.json`、`floor-3d.json` 记录源哈希、尺寸、三角面、相机方向与导航范围。外部元数据的 `floorTargets` 按源模型窗格生成 24 个空间范围与可见窗格测试点，仅用于交互和验收，不作为业务楼层 ID。旧 WebP 仅保留为比较参考，应用不加载；`prepare-hospital-navigation.py` 仅生成参考图及 `reference-manifest.json`。

两份高精度模型应依次导出，避免同时展开原始场景造成内存不足：

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 4 --python-exit-code 1 --python scripts/export_hospital_navigation_models.py -- exterior
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 4 --python-exit-code 1 --python scripts/export_hospital_navigation_models.py -- floor
```

接口尚无楼栋—楼层—病区映射，因此当前可点击楼层关联已选病区，没有编造楼层编号。8 房 16 床为通用模型布局，不将模型房号或容量当作实时病区数据；真实床位继续在临床工作空间展示。这些模型用于场景展示，不代表现场测绘或 BIM 数据。

## 实现位置

- `src/components/hospital/HospitalWorkspaceShell.vue`：医院层级、临床入口、返回和全屏场景布局。
- `src/components/hospital/HospitalModelScene.vue`：三维视口、资源状态、投影入口和键盘焦点。
- `src/core/hospital-navigation.ts`：GLB 资源与切换目标。
- `src/core/hospital-3d-assets.ts`：下载、解码、校验、取消与资源释放。
- `src/core/hospital-3d-scene.ts`：相机、光照、主题、射线点击与渲染生命周期。
- `src/core/hospital-3d-camera.ts`：按模型三维范围取景。
- `src/core/hospital-exterior-sky.ts`：医院外部实时天空与主题。
- `src/core/use-hospital-navigation.ts`：医院层级状态，保留临床路由契约。
- `src/App.vue`：使用医院导航容器；`DigitalTwinWorkspace.vue` 增加外层激活状态。

## 验证

相关单元及生命周期测试：

```sh
node --test src/core/hospital-navigation.test.ts src/core/use-scene-loading.test.ts scripts/startup-scene-handoff.test.mjs scripts/workspace-lifecycle.test.mjs scripts/app-auth-boundary.test.mjs scripts/hospital-navigation-model.test.mjs
npm run build
```

专项测试 41/41 通过，`npm run build`（含类型检查）通过，有 Three.js 相关包体积提示。真实浏览器验收脚本：`scripts/hospital-navigation-3d.browser-check.cjs`。使用已安装的 Playwright 和 Edge，`LOCAL_MOCK_PLAYWRIGHT` 可指定模块路径，`HOSPITAL_NAV_ORIGIN` 可指定本机地址（默认端口 5197）。已逐层验证 24 个真实网格点击入口、外部无悬浮提示、空白处点击不进入、视口 Enter 入口、完整导航、真实旋转与缩放、返回视角保留、浅深色、模型复用、隐藏渲染暂停、320/768/1024/1440 宽度、减少动态效果、WebGL 上下文丢失恢复及模型失败重试。页面无 JavaScript 异常，不请求旧总览图片或外部接口。截图和报告位于 `output/playwright/hospital-navigation-3d/`。

当前性能证据来自本机 Edge 的专项浏览器检查，不能代表所有移动设备的流畅度；两份总览约 419 万三角面，后续低配置设备需单独测量。

本轮全量 `npm test` 未通过：测试集中有远程 API 与本地模拟分支的冲突、旧界面结构断言和 HMR 端口冲突，并有任务未退出；停止该全量运行，未修改这些无关逻辑。本次更新的启动文案断言及相关专项检查通过。没有声称全项目回归通过。
