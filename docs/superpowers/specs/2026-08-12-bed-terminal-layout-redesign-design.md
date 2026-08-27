# Bed Terminal Layout Redesign Design

## Goal

优化病房床头终端的视觉层级，使动态患者屏幕、控制按钮和装饰元素形成清晰的一体式设备，同时保留 JSON 模版渲染链路。

## Layout

- 动态屏幕宽高缩小约 8%，相对现有位置左移，放入独立深色屏框。
- 右侧新增窄控制栏底板，将状态灯、呼叫按钮和五个扬声器孔统一垂直对齐。
- 屏幕与控制栏之间保留明确间距，不允许几何重叠。
- 新增屏幕下方短青色装饰条，弱化床头墙板长横条对终端视觉的干扰。
- 白色机身保持现有安装位置，只收紧终端内部组件，不修改床位或墙板结构。

## Data Contract

- `BedTerminalSurface` 继续承载 CanvasTexture。
- 保留 `queryBedDeviceInfo -> templateId -> loadParsedTemplate() -> renderBedTerminalTexture()`。
- 不修改接口、JSON 模版、患者字段或床位数量逻辑。
- 不修改 Blender 源文件，只通过导出脚本生成新的项目 GLB。

## Verification

- Blender 契约验证屏幕尺寸、屏框中心、控制栏节点、屏幕与控制栏间距及装饰条位置。
- 使用 mock 双床房进行桌面端放大截图验收。
- 运行模型单测、集成测试、类型检查和生产构建。

