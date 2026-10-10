# 石墨灰双床病房模型 v1

## 交付范围

依据本次双床病房参考效果图，用 Blender 4.5.3 LTS 创建可编辑模型、Cycles 离线渲染和独立 GLB 资源。视觉延续护士站的石墨灰、雾银、青色细灯带，并保留暖木与中性临床照明。

本轮是**模型交付与独立验收**，没有替换生产病房场景。正式配置 `src/config/ward-interior-scene.ts` 仍指向 `room-refined-v1.glb` 和 `bed-v2.glb`；不需要通过回退代码恢复旧场景。

单张 AI 效果图不能提供背面、遮挡结构、精确尺寸或全部材质参数，因此本版是参考图驱动的重建，不承诺“百分百还原”。房间使用自行设定的米制尺寸，**不是医院实测模型或施工图**。可见部位重点细化病床护栏、底盘脚轮、床品褶皱、终端外壳、医疗设备带、隐私帘、窗框及墙面分缝；不可见内部结构和背面采用简化处理。

当前版本的电视所在墙面及相对位置、取景机位、布料褶皱和窗外背景与参考图仍有差异。这些差异不能通过“高精度”或测试通过等同于完全还原；后续可基于实渲继续审阅调整。

## 文件与源码

所有路径相对项目根目录 `E:\projects\digital-twin`。

| 内容 | 路径 |
| --- | --- |
| 可编辑 Blender 源 | `output/ward-graphite-v1/ward-graphite-v1.blend` |
| 合并后的导出工作副本 | `output/ward-graphite-v1/ward-graphite-v1-runtime.blend` |
| Cycles 整体实际渲染 | `output/ward-graphite-v1/ward-graphite-hero.png` |
| Cycles 病床近景实际渲染 | `output/ward-graphite-v1/ward-graphite-bed-detail.png` |
| 原始参考图 | `output/ward-graphite-v1/reference.png` |
| 独立房间外壳 GLB | `public/models/smart-ward-interior/ward-graphite-room-v1.glb` |
| 可复用单床单元 GLB | `public/models/smart-ward-interior/ward-graphite-bed-v1.glb` |
| 双床装配预览 GLB | `output/ward-graphite-v1/ward-graphite-scene-v1.glb` |
| 导出清单与统计 | `output/ward-graphite-v1/manifest.json` |
| 材质贴图源 | `output/ward-graphite-v1/textures/` |
| 生成入口 | `scripts/build_ward_graphite_v1.py` |
| 建模模块 | `scripts/ward_graphite_common.py`、`scripts/ward_graphite_room.py`、`scripts/ward_graphite_bed.py`、`scripts/ward_graphite_equipment.py` |
| 导出与 AO 烘焙辅助 | `scripts/ward_graphite_export.py` |
| GLB 契约测试 | `scripts/ward-graphite-model.test.mjs` |
| Three.js 独立验收页 | `scripts/fixtures/ward-graphite-preview.html`、`scripts/fixtures/ward-graphite-preview.js` |
| 浏览器正常路径检查 | `scripts/verify-ward-graphite.pw.js` |
| 浏览器失败与重试检查 | `scripts/verify-ward-graphite-failure.pw.js` |

GLB 内嵌材质贴图，不依赖远程模型资源或医院接口。`output/` 是本地产物目录，交接时需另行保留可编辑 `.blend`、贴图、参考图及清单，不应只交付 `public/` 下的两个 GLB。导出工作副本经过静态几何合并；继续编辑细分部件时使用原始可编辑源。

导出时为病床和房间分别进行隔离自遮蔽 AO 烘焙：病床 1024 × 1024，房间 2048 × 2048。AO 使用独立 UV1，材质颜色与细节贴图保留 UV0；避免预览中的其他模型或外景被错误烘焙进单独复用的床位资源。

## 坐标与装配契约

单位为米。Blender 为 Z 向上；glTF / Three.js 为 Y 向上，坐标转换为：

```text
glTF(x, y, z) = Blender(x, z, -y)
```

| 项目 | Blender | glTF / Three.js |
| --- | --- | --- |
| 名义房间包络 | X[-3.2, 3.2]，Y[0, 4.6]，Z[0, 3.1] | X[-3.2, 3.2]，Y[0, 3.1]，Z[-4.6, 0] |
| 第一床单元原点 | (-1.45, 1.50, 0) | (-1.45, 0, -1.50) |
| 第二床单元原点 | (1.45, 1.50, 0) | (1.45, 0, -1.50) |
| 床头 / 床尾方向 | -Y / +Y | +Z / -Z |
| 床单元装配旋转 | 不追加旋转 | `rotationY: 0` |
| 主相机位置 | (-2.90, 6.60, 1.90) | (-2.90, 1.90, -6.60) |
| 主相机目标 | (-0.05, 1.10, 1.15) | (-0.05, 1.15, -1.10) |

墙板厚度、收边和外侧结构会略超出名义包络；实际包围盒由导出网格测量，不能把上表当作碰撞检测的最终边界。主相机使用 30 mm 镜头，16:9 附近的网页垂直视场角约 37.4°。为了完整审阅双床构图，此机位位于敞开的入口外侧，不是已验证的生产室内相机约束。

房间资产根为 `WardGraphiteRoomV1`，包含供未来相机边界读取的 `外壳`、`灯`；不内置重复病床。单床根为 `BedUnit`，位于原点、缩放为 1，包含：

- `BedBody`：病床本体与至少一个可渲染网格。
- `BedsideCabinet`、`BedTerminal`、`IVStand`：独立功能分组。
- `BedTerminalSurface`：床头屏的独立单材质四边形，不与边框或外壳合并。
- `InfusionEquipment`：独立输液显示分组；项目床单元创建函数默认隐藏它，避免无业务状态时误示为输液中。

### 床头屏与业务数据边界

`BedTerminalSurface` 导出后为局部 YZ 平面，并保留节点旋转，正面朝病床脚端（glTF -Z）。运行时 `createWardBedUnit()` 为每张床克隆屏幕几何和材质，静态病床几何共享；UV 按局部 YZ 规范化，画布使用 `flipY=false`。

独立验收页只生成“演示床位 01 / 02”及四角方向文字，检查屏幕是否镜像、倒置或串用纹理。GLB 不含患者姓名、病历、实时数值，也不包含 Blender 中的 `Preview_*` 演示文字。当前没有绑定真实医院床位或已发布床头屏模板。

墙挂宣教屏保留独立 `WardTVSurface`，供后续接入视频使用；本轮网页验收没有接入宣教视频业务，显示的是模型原有空屏。Blender 渲染中的示意图形仅属于预览，不能作为视频播放已实现的证据。窗外城市布景也仅用于 Blender 离线审阅，没有导出到网页模型；网页不含该城市背景。

## 为什么不能只替换生产 URL

当前生产病房采用旧坐标：床位沿世界 Z 排布，`WardRoomExpansion` 使用固定 `z > 1.3` 分界和约 2.371125 m 的床间距进行伸缩。新房两床沿 X 排布，房间 Z 范围主要为负值，尺寸、床头朝向和相机均不同。因此旧的世界 Z 扩容规则不适用，不能把同名节点等同于完整接入兼容。

后续正式接入至少需要：

1. 新模型布局配置，包括独立 URL、床位槽位、机位和边界策略。
2. 明确 0 / 1 / 2 / 3 床时的空间规则，再实现对应扩容；不直接拉伸病床、设备或旧坐标外壳。
3. 按稳定床位标识绑定真实屏幕模板，并验证切房、空床、呼叫和输液状态。
4. 重新检查明暗主题、目标电脑性能、缩放及室内相机碰撞限制。

当前测试中的 0 / 1 / 2 / 3 床只表示单床资源可独立克隆和释放，**不表示新房已支持所有床数的自动排布**；双床固定槽位另有包络与不相交检查。

## 重建与验收命令

在项目根目录执行，使用已有 Blender 4.5.3 LTS 及其 Python / NumPy，无新增 npm 依赖。重建会重新生成本版命名下的产物；如对 `.blend` 做过手工修改，应先另存版本。

```powershell
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/build_ward_graphite_v1.py -- --width 1920 --samples 64

# 仅重建模型并导出，不生成离线渲染
& 'output/tools/blender/blender-4.5.3-windows-x64/blender.exe' --background --threads 6 --python-exit-code 1 --python scripts/build_ward_graphite_v1.py -- --skip-render

# 读取实际导出的 GLB，解码后验证结构与屏幕契约
node --test scripts/ward-graphite-model.test.mjs

# 启动本地开发服务后打开独立验收页
npm run dev
```

验收地址：`http://localhost:5173/scripts/fixtures/ward-graphite-preview.html`。页面只访问本地模型和 Draco 解码资源；复位、床细节和屏幕检查按钮均可通过键盘使用。“屏幕检查”再次点击切换到另一张床。

Blender Cycles 离线渲染和网页实时光照不是同一个渲染器。前者用于审阅造型和材质目标；后者用于验证 GLB、真实创建函数、纹理方向和交互。不得用离线渲染代替网页最终效果验收。

## 统计与验证记录

以下为最终实际导出的 `manifest.json` 统计：

| 资源 | 字节 | 三角面 |
| --- | ---: | ---: |
| 房间 | 8,076,224 | 131,666 |
| 单床 | 6,261,548 | 136,734 |
| 双床完整预览 | 10,892,824 | 405,134 |

专项预算：房间不超过 10 MiB / 150,000 三角面，单床不超过 10 MiB / 160,000 三角面；两个独立运行资源合计不超过 20 MiB。完整预览可复用同一单床网格，其文件大小不等于“两倍单床文件加房间文件”。

最终验证记录：

- Blender 最终构建成功退出，整体与病床近景均完成 1920 × 1081、64 samples 的真实渲染，并完成目检。构建日志：`output/ward-graphite-v1/final-build.log`。
- 实际 GLB 专项检查 **6 / 6 通过**：含资源预算、米制尺寸、独立终端几何和 UV、两床独立材质、AO 的真实 UV1 解码数据、原生产 URL 未变。首轮发现的屏幕 UV 上下反转已在 Blender 导出源修复并重导出，没有改动运行时翻转规则。
- 关联核心测试 **25 / 25 通过**：`src/core/ward-bed-unit.test.ts`、`src/core/ward-interior-model.test.ts`、`src/core/ward-interior-view-bounds.test.ts`。
- 浏览器正常路径检查通过：两张床独立屏幕资源与演示床号匹配，320 / 390 / 768 / 1024 / 1440 px 视口均无横向溢出，按钮高度不低于 44 px，没有医院接口或外部请求，没有渲染错误。网页首帧静态阴影资源初始化问题已修复并复验。
- 浏览器失败路径检查通过：主动中断模型请求后显示错误及重试入口，操作按钮保持禁用；解除中断并重试后恢复就绪。
- `npm run build` 最终复跑成功，日志：`output/ward-graphite-v1/project-build-final.log`。

网页截图保存在 `output/playwright/ward-graphite-web-hero.png`、`ward-graphite-web-detail.png`、`ward-graphite-screen-1.png`、`ward-graphite-screen-2.png`、`ward-graphite-web-narrow.png` 和 `ward-graphite-load-failure.png`。这些证据来自本地合成数据验收，不代表真实医院数据接入、实际护士工作流程验收或目标低配置电脑的性能验收。本轮未创建 Git 提交或推送。
