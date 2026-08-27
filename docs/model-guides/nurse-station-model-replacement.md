# 护士站模型替换说明

## 1. 放置模型

将新的 `.glb` 文件放到：

```text
public/models/smart-ward-nurse-station/
```

例如：

```text
public/models/smart-ward-nurse-station/nurse_station_v4.glb
```

## 2. 修改模型配置

编辑：

```text
src/config/nurse-station-scene.ts
```

修改 `model.url` 和 `model.maxSize`：

```ts
model: {
  url: '/models/smart-ward-nurse-station/nurse_station_v4.glb?v=1',
  maxSize: { x: 11.04, y: 2.3895, z: 5.102 },
},
```

同名模型重新导出后，需要递增 URL 的版本参数，例如从 `?v=1` 改成 `?v=2`，避免浏览器使用旧缓存。

`maxSize` 分别表示模型允许的最大宽度、高度和深度。程序会保持模型原始比例，在该范围内自动缩放、居中并落到地面。

## 3. 旧模型清理规则（必须执行）

每次替换当前护士站场景模型时，验证新模型加载成功后，必须删除不再被当前页面引用的旧护士站 GLB，避免模型目录长期保留多个正式版本。

清理范围仅限旧的发布产物：

- 可以删除不再使用的旧 `.glb` 文件。
- 不要删除当前 `model.url` 指向的 GLB。
- 不要删除 `high_fidelity_nurse_station.blend` 等可编辑 Blender 源文件。
- `.blend1` 备份文件也不要作为正式模型发布；是否保留由模型编辑备份策略决定。

删除前先确认没有其他页面、预览或脚本引用旧文件；确认后再删除，并在构建后检查 `dist/models/` 中只保留当前正式模型产物。

## 4. 调整默认视角

在同一个配置文件中修改：

```ts
camera: {
  target: { x: 1, y: 0.55, z: -0.05 },
  initialDistance: 1.8,
  initialAngle: { azimuthDeg: 0, elevationDeg: 0 },
},
```

- 模型看起来太小：减小 `initialDistance`。
- 模型看起来太大：增大 `initialDistance`。
- 观察中心偏高或偏低：调整 `target.y`。
- 观察中心偏左或偏右：调整 `target.x`。
- 前后焦点不合适：调整 `target.z`。
- 水平角度不合适：调整 `initialAngle.azimuthDeg`；正值从模型右侧观察，负值从左侧观察。
- 上下角度不合适：调整 `initialAngle.elevationDeg`；正值提高机位，负值降低机位。
- 首屏看到的环境太多或模型太小：减小 `appearance.deskFov`；模型太满时增大它。
- 修改 `camera.pan.yMin` 时要保证它低于 `target.y`，否则首屏目标点会被平移边界自动抬高。
- `target.x`、`target.y` 会受 `pan.xLimit`、`pan.yMin`、`pan.yMax` 限制；超出范围时页面显示的是被钳制后的实际值。
- `initialDistance` 会受 `distance.min`、`distance.max` 限制；超出范围时页面显示的是被钳制后的实际值。

角度单位是“度”，例如 `azimuthDeg: 8` 表示向右侧偏 8 度，`elevationDeg: 4` 表示机位向上抬 4 度。每次建议只调整 2-5 度，保存后用浏览器强制刷新查看。只有重新导出并覆盖同名 GLB 时才需要递增模型 URL 后面的 `?v=` 版本号，单纯修改相机参数不需要改模型版本。

### 页面实时打印参数（开发环境）

运行开发服务后进入护士站页面，左下角会显示“护士站视角参数”面板。直接拖动模型旋转、滚轮缩放或双指缩放，面板会实时刷新：

- `target`：当前观察中心。
- `initialDistance`：建议写回配置的初始距离。
- `initialAngle.azimuthDeg`：水平角。
- `initialAngle.elevationDeg`：上下角。
- `deskFov`：视野角。

调到满意构图后点击“复制”，把复制出的配置文本发给开发者，或直接回填到 `src/config/nurse-station-scene.ts`。面板只在 `npm run dev` 的开发页面显示，点击“收起”后可用“参数”按钮重新打开。

缩放、旋转和平移范围也在该配置文件的 `camera` 节点中调整。

## 5. 保留动态屏幕节点

为了继续使用现有动态数据，新模型应包含以下独立 Mesh：

```text
Screen_Main
Screen_Work_01
Screen_Work_02
Screen_Work_03
Screen_Work_04
Clock_Display
```

这些屏幕 Mesh 需要具备正确的尺寸、朝向和 UV。

推荐直接在 Blender 中使用以上名称。这样更换模型后可以继续使用现有屏幕解析和业务数据逻辑，不需要修改 `area-scene.ts`。

如果新模型的节点名称不同，必须同步修改运行时屏幕映射，并重新验证所有动态屏幕。

## 6. 验证

运行：

```bash
node scripts/nurse-station-scene-config-boundary.test.mjs
node --experimental-strip-types --test src/core/*.test.ts
node --test scripts/*.test.mjs
npm run build
```

然后启动项目并检查：

1. 模型能够正常加载。
2. 模型比例、位置和默认镜头正确。
3. 拖拽、缩放和旋转正常。
4. 六块动态显示区域正确显示实时内容。
5. 从护士站切换到六门病房走廊，再返回护士站，模型状态正常。

## 最小替换流程

新模型遵守现有屏幕节点命名契约时，通常只需要：

1. 把 GLB 放入模型目录。
2. 修改 `model.url`。
3. 递增 URL 缓存版本号。
4. 按需调整 `model.maxSize` 和默认镜头。
5. 运行验证和构建，确认新模型加载成功。
6. 删除不再引用的旧正式 GLB。
7. 再次确认当前页面只请求新模型，并完成桌面端与移动端视觉验收。
