# 病房内部模型配置说明

## 1. 放置和切换模型

将病房内部 GLB 放入：

```text
public/models/smart-ward-interior/
```

编辑 `src/config/ward-interior-scene.ts` 的 `model.url`。同名模型重新导出时递增 `?v=` 参数，避免旧缓存：

```ts
model: {
  url: '/models/smart-ward-interior/smart_ward_interior.glb?v=5',
  baseSize: { width: 12, height: 3.92, depth: 9 },
  canvasTextureFlipY: false,
},
```

`baseSize` 是 Blender 模型的基准包围尺寸，程序会按当前病房宽、深和 `room.height` 分别适配建筑和道具位置。模型替换后如果房间比例变化，先更新 `baseSize`，再检查床位是否越界。

## 2. 必须保留的节点

运行时会校验以下节点，缺失会回退到生成式病房：

```text
WardArchitecture
WardProps
BedPrototype
Bed_1_Mattress
SmartBedhead_1_Status
BedTerminalSurface
Monitor_1_Screen
```

`BedPrototype` 用于克隆一至六张床。床旁终端和监护屏的 CanvasTexture 仍由现有模板解析、床位状态和告警逻辑更新，不能把这些节点改成共享动态材质。

## 3. 镜头预设和响应式视距

`camera.initial` 控制首次进入病房的相机位置和目标点；`camera.presets` 保持四个 ID 不变：`free`、`door`、`nurse`、`top`。可以修改每个预设的 `position` 和 `target`，但不要删除或重命名 ID，因为页面按钮按 ID 切换。

`camera.viewportScale` 用于窄屏自动后退，避免手机画面裁切。`presetTransitionDuration` 和 `bedFocusTransitionDuration` 分别控制预设切换、选床聚焦的动画时长。

## 4. 交互、外观和床位排布

- `controls`：开放旋转、缩放范围以及阻尼、旋转和缩放速度。
- `appearance`：背景色、曝光和雾效；雾密度会按房间跨度自动衰减。
- `modelBedLayout`：床模块基准宽度、靠墙偏移、横向边距、缩放上下限和最大床位数。
- `room.height`：生成式房间外壳和 GLB 建筑适配的高度。

当前业务约定是一至六张床，`maxBeds` 不应超过六，除非同时修改病区床位布局和交互验收。

## 5. 验证

```bash
node scripts/ward-interior-scene-config-boundary.test.mjs
node --experimental-strip-types --test src/core/camera-presets.test.ts src/core/ward-interior-model.test.ts src/core/ward-scene-controls.test.ts
node --test scripts/ward-interior-model-integration-boundary.test.mjs scripts/ward-scene-view-boundary.test.mjs
npm run build
```

页面验收至少检查：四个视角均能切换；拖拽、旋转、缩放范围可用；一至六张床都位于房间内且不重叠；床旁终端、监护屏和告警状态仍显示真实数据；模型加载失败时生成式病房仍可用。

