# 病房走廊模型配置说明

## 1. 放置和切换模型

将走廊 GLB 放入：

```text
public/models/hospital-corridor/
```

编辑 `src/config/ward-corridor-scene.ts` 的 `model.url`：

```ts
model: {
  url: '/models/hospital-corridor/hospital-in.glb?v=2',
  // ...
}
```

同名模型重新导出时递增 `?v=`，避免浏览器继续使用旧缓存。

模型加载后会执行 Blender Z-up 到 Three.js Y-up 的 `rotationX` 旋转，并自动居中、落地。默认值是 `-Math.PI / 2`，除非新模型明确使用不同坐标轴，否则不要修改。

## 2. 六门节点契约

当前病区按六扇门绑定，`model.slotCount` 必须保持为 `6`，`model.doorNodeNames` 必须按业务顺序包含：

```text
门1、门2、门2.001、门3、门4、门5
```

这些节点只负责确定门的空间位置和病房绑定顺序。门口屏模板解析、实时数据渲染、点击进入病房和房间权限逻辑仍由 `area-scene.ts` 保持，不要移入配置文件。

`canvasTextureFlipY` 控制动态 CanvasTexture 的 UV 方向。模型导出方式未改变时保持 `false`。

## 3. 镜头和交互

`camera.overviewFov` 控制病房数量对应的走廊总览 FOV。`camera.modelBoundsView` 控制加载 GLB 后根据包围盒计算的初始位置：

- `xOffset`：相机横向偏移及走廊宽度系数。
- `y`：相机高度和地面安全距离。
- `zInset`：相机距离走廊末端的范围。
- `targetY`、`targetZLengthFactor`：观察目标点。

`controls` 控制 OrbitControls 的旋转、缩放范围和速度。当前走廊已开放水平旋转、俯仰和较大的缩放距离，替换模型后如需改变交互只修改此处。

## 4. 备用几何

GLB 加载失败时，系统会使用 `fallbackGeometry` 生成走廊外壳和门脸。它不会替代成功加载的高清 GLB，也不包含门口屏业务逻辑。新模型验证期间可以暂时保留默认值，以便观察加载失败时的可用状态。

## 5. 验证

```bash
node scripts/ward-corridor-scene-config-boundary.test.mjs
node --experimental-strip-types --test src/core/ward-corridor-model.test.ts src/core/ward-corridor-camera.test.ts src/core/area-corridor-controls.test.ts
node --test scripts/area-scene-zoom-boundary.test.mjs scripts/area-scene-visibility-boundary.test.mjs
npm run build
```

页面验收至少检查：模型加载完成后六扇门均可识别；门口屏内容仍随真实病区数据更新；走廊可拖拽、旋转和缩放；加载失败时能回退到备用几何；护士站与走廊切换后显示状态正确。

