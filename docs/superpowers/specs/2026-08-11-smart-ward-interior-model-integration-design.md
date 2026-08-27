# Smart Ward Interior Model Integration Design

## Goal

将 `smart_ward_scene_highres_optimized.blend` 的视觉模型接入项目全部病房内 3D 场景，同时保留现有床位数据、床头屏 JSON 模板解析和全部交互能力。

## Asset Contract

- 从优化版 Blender 文件导出单个 `smart_ward_interior.glb`，不修改源 `.blend`。
- GLB 根节点包含 `WardArchitecture`、`WardProps` 和 `BedPrototype`。
- `BedPrototype` 使用第一套 Blender 床位、床头设备、床旁柜和监护仪组成可克隆床位模块。
- 床头屏动态承载面命名为 `BedTerminalSurface`；床垫、状态指示器和监护仪屏幕继续使用稳定节点名称供前端绑定。
- Blender 相机和灯光不导出，Web 场景继续使用 Three.js 相机与灯光。

## Runtime Architecture

- 新增 `ward-interior-model.ts`，集中负责模型 URL、节点名称解析、GLB 加载、节点契约验证、环境尺寸适配和床位克隆。
- `WardScene` 启动时保留当前程序化场景作为即时回退，并异步加载 GLB。
- GLB 加载成功且节点契约完整后，隐藏程序化静态房间并使用模型环境；加载失败时继续显示当前程序化场景。
- 模型加载与接口请求允许任意顺序。`WardScene` 始终保存最新 `ward`，模型就绪后重新构建床位并同步床头屏模板。
- 通过加载令牌阻止已销毁场景接受迟到的模型结果。

## Dynamic Beds

- 床位数量严格使用接口映射后的 `ward.beds` 数量；空床仍显示，患者入住状态不决定床位是否存在。
- 支持项目现有 0–6 床边界；0 床时显示模型房间外壳但不创建床位。
- 每张床克隆独立 `BedPrototype`，复用不可变几何，但为床垫、状态指示器、床头屏和监护仪屏幕创建独立材质。
- 床位继续使用 `getWardRoomSize()` 和安全间距规则排布，并绑定独立 `bedCode`。

## Dynamic Data And Interaction

- 床头屏保留现有数据链路：`queryBedDeviceInfo → templateId → loadParsedTemplate() → renderBedTerminalTexture()`。
- `BedTerminalSurface` 仅作为 CanvasTexture 承载面，GLB 不固化患者或模板内容。
- 保留床位点击、患者浮签、设备标签、呼叫/输液动画、状态颜色、选中高亮、床位聚焦和全部相机预设。
- GLB CanvasTexture 使用 glTF UV 方向设置，避免床头屏和监护仪画面倒置。

## Materials And Layout

- 保留可直接导出的 Blender PBR 材质；动态屏幕材质由 Three.js 替换。
- 房间建筑节点根据 `getWardRoomSize()` 调整宽度和纵深；家具节点按基准房间比例重新定位但不拉伸自身尺寸。
- 模型环境使用当前 Three.js 灯光、阴影、色调映射和环境预警背景。

## Error Handling And Cleanup

- GLB 请求失败或缺少 `WardArchitecture`、`WardProps`、`BedPrototype`、`BedTerminalSurface`、床垫或状态指示器时记录警告并保持程序化回退。
- 房间切换时释放旧的动态 CanvasTexture 和独立材质。
- 场景销毁时使加载令牌失效、移除模型并释放模型资源，避免重复进入病房造成 GPU 资源泄漏。

## Verification

- Blender 验证脚本检查 GLB 所需分组和动态节点。
- 单元测试覆盖节点名称解析、0–6 床布局、床位克隆契约和 glTF CanvasTexture 方向。
- 边界测试覆盖 GLB URL、异步加载令牌、模板重同步和程序化回退。
- 运行现有病房布局、床位几何、模板、交互测试及生产构建。
- 使用 mock 数据在桌面和移动端验证 1、2、3、6 床布局、空床、患者床、点击聚焦和床头屏画面。

## Non-Goals

- 不修改后端接口、JSON 模板格式、Pinia 数据模型或 2.5D 平面视图。
- 不在 GLB 内保存患者隐私数据。
- 不删除程序化病房回退实现。
