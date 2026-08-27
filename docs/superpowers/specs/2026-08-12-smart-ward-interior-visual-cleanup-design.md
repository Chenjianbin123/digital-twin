# Smart Ward Interior Visual Cleanup Design

## Goal

修复病房内模型的文字、动态床头屏与静态预览层重叠，并降低床旁监护仪遮挡，同时完整保留床位数量、患者数据、床头屏 JSON 模版解析和交互链路。

## Asset Cleanup

- 保留墙面唯一标题 `TWO-BED SMART ROOM`，移除容易与动态内容混淆的 `SMART CARE`、`BED HUB`、`VITALS` 字体对象。
- 动态床头屏继续使用 `BedTerminalSurface`；导出前移除原始 `SmartBedhead_1_Screen`、屏幕玻璃及静态预览图元，避免和 CanvasTexture 叠加。
- 动态床旁监护仪继续使用 `Monitor_1_Screen`；移除静态波形和标签，但保留机身、支架、传感器及动态承载面。
- 床旁监护仪组件相对床位原点缩放为 85%，并向床头外侧和后方移动，减少近景遮挡。
- 床头背板材质提高粗糙度、降低镜面反射，消除墙面标题在背板上的明显镜像。

## Export And Runtime

- 修改现有 Blender 导出脚本，在临时 Blender 会话中完成清理，不覆盖源 `.blend`。
- 重新生成 `public/models/smart-ward-interior/smart_ward_interior.glb`。
- 更新 GLB URL 版本参数，避免浏览器继续使用旧缓存。
- 不修改 `queryBedDeviceInfo -> templateId -> loadParsedTemplate() -> renderBedTerminalTexture()` 数据链路。

## Verification

- Blender 验证脚本检查必须节点存在、静态预览节点不存在、墙面标题唯一。
- TypeScript 测试和边界测试继续验证动态材质、床位布局和 JSON 模版渲染链路。
- 使用项目 mock 数据在桌面端检查双床房：无重复文字、无屏幕叠层、监护仪不遮挡床体主体。

