# 病房走廊场景配置化

## 目标

为六门病房走廊建立独立、类型化的配置文件，使模型替换、默认镜头、交互范围和主要场景尺寸可以集中修改，不再分散在 `area-scene.ts`、`ward-corridor-model.ts`、`ward-corridor-camera.ts` 和 `area-corridor-controls.ts`。

## 配置文件

新增 `src/config/ward-corridor-scene.ts`，配置分为：

- `model`：GLB URL、Blender Z-up 到 Three.js Y-up 的旋转、门槽数量、门节点名称、CanvasTexture 的 `flipY`。
- `camera`：GLB 走廊初始位置和观察点的包围盒计算参数、FOV 分段值。
- `controls`：旋转、缩放、拖拽速度和随走廊长度变化的最大视距。
- `appearance`：背景色。
- `fallbackGeometry`：模型加载失败后代码生成走廊使用的主要尺寸，包括走廊半宽、墙厚、层高、门宽高和门脸厚度。

## 代码边界

- `ward-corridor-model.ts` 继续负责模型归一化、六门顺序、门槽和动态屏幕纹理适配，但从配置读取模型契约。
- `ward-corridor-camera.ts` 继续负责基于模型包围盒计算镜头，只把数值系数迁入配置。
- `area-corridor-controls.ts` 继续负责根据走廊长度计算控制范围，只把基础值和倍率迁入配置。
- `area-scene.ts` 读取场景外观和备用几何参数。
- 门口屏模板解析、实时病房绑定、点击进入病房和动态屏幕绘制保持原逻辑。

## 安全约束

- 默认仍严格匹配当前六个物理门节点，修改门节点名称时必须与新 GLB 完全一致。
- 配置改变门槽数量不会自动创造模型门；文档必须说明门槽数应与 `doorNodeNames` 数量一致。
- 不允许配置绕开未授权病区数据，也不改变病房数据映射顺序。
- 配置类型和契约测试必须锁定默认值及核心模块的配置消费关系。

## 文档与验证

新增 `docs/model-guides/ward-corridor-model-configuration.md`，说明模型替换、节点契约、镜头和交互调参方法。更新目录索引。

验证包括走廊模型单元测试、镜头测试、控制器测试、边界测试、完整核心测试和生产构建。
