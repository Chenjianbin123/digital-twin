# Smart Ward Interior Model Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将优化后的 Blender 智慧病房模型接入全部病房内 3D 场景，并按接口床位列表克隆 0–6 张可交互床位。

**Architecture:** Blender 导出脚本将场景整理为建筑、家具和单床原型三个稳定节点，并创建专用动态床头屏承载面。前端独立模块负责 GLB 契约、环境适配和床位克隆，`WardScene` 只负责异步生命周期、现有业务纹理和交互绑定，并保留程序化回退。

**Tech Stack:** Blender 5.1、Python、glTF/GLB、Three.js 0.184、TypeScript、Vue 3、Vite、Node.js assertions、Playwright/in-app browser。

## Global Constraints

- 不覆盖 `smart_ward_scene_highres_optimized.blend`。
- 所有房间优先使用同一个 `smart_ward_interior.glb`。
- 床位数量取 `ward.beds`，空床保留，现有支持范围为 0–6 床。
- 保留 `queryBedDeviceInfo → templateId → loadParsedTemplate() → renderBedTerminalTexture()`。
- 保留床位点击、患者浮签、设备标签、呼叫/输液动画、状态颜色、选中聚焦和相机预设。
- GLB 或节点契约失败时继续使用当前程序化回退。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 导出并验证模块化病房 GLB

**Files:**
- Create: `scripts/export_smart_ward_interior_glb.py`
- Create: `scripts/validate_smart_ward_interior_glb.py`
- Create: `public/models/smart-ward-interior/smart_ward_interior.glb`

**Interfaces:**
- Consumes: 已加载的 `smart_ward_scene_highres_optimized.blend`。
- Produces: `WardArchitecture`、`WardProps`、`BedPrototype`、`BedTerminalSurface` 节点契约。

- [x] **Step 1: 写失败的 Blender 节点契约**

验证脚本断言三个分组和以下节点存在：

```python
REQUIRED_GROUPS = {"WardArchitecture", "WardProps", "BedPrototype"}
REQUIRED_BED_NODES = {
    "BedTerminalSurface",
    "Bed_1_Mattress",
    "SmartBedhead_1_Status",
    "Monitor_1_Screen",
}
```

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background smart_ward_scene_highres_optimized.blend --python-exit-code 1 --python scripts/validate_smart_ward_interior_glb.py
```

Expected: 原始场景缺少 `WardArchitecture`，退出码 1。

- [x] **Step 2: 实现导出脚本并生成 GLB**

导出脚本按对象名将第二套床位移除，将第一套床位归入 `BedPrototype`，其余对象归入 `WardArchitecture` 或 `WardProps`；创建带 UV 的 `BedTerminalSurface`，排除相机和灯光，并调用：

```python
bpy.ops.export_scene.gltf(
    filepath=str(output_path),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)
```

- [x] **Step 3: 重新导入 GLB 并验证节点契约**

Run Blender 空场景导入生成的 GLB，再执行验证脚本。

Expected: 输出 `Smart ward interior GLB contract passed.`，退出码 0。

### Task 2: 增加可测试的模型契约和床位布局

**Files:**
- Create: `src/core/ward-interior-model.ts`
- Create: `src/core/ward-interior-model.test.ts`

**Interfaces:**
- Produces: `WARD_INTERIOR_MODEL_URL`、`configureWardInteriorCanvasTexture()`、`getWardInteriorAssetParts()`、`fitWardInteriorEnvironment()`、`cloneWardInteriorBed()`、`resolveWardInteriorModelBedPose()`、`disposeWardInteriorModel()`。

- [ ] **Step 1: 写失败的 0–6 床、节点和 UV 测试**

测试使用真实 `THREE.Group`/`THREE.Mesh`，验证：缺少节点时抛错；完整原型可克隆且动态材质不共享；床位绑定独立 `bedCode`；0 床返回空布局；1–6 床均位于房间边界内；CanvasTexture 配置为 `flipY=false`。

- [ ] **Step 2: 运行测试确认模块缺失导致失败**

Run: `node --experimental-strip-types src/core/ward-interior-model.test.ts`

Expected: `ERR_MODULE_NOT_FOUND`。

- [ ] **Step 3: 实现最小模型模块**

实现稳定常量：

```ts
export const WARD_INTERIOR_MODEL_URL = '/models/smart-ward-interior/smart_ward_interior.glb?v=20260811-model-v1';
export const WARD_INTERIOR_BASE_SIZE = { width: 12, height: 3.92, depth: 9 } as const;
```

床位克隆仅克隆动态材质，几何保持共享；环境建筑缩放到房间尺寸，家具只按比例移动位置。

- [ ] **Step 4: 运行模型模块测试确认通过**

Run: `node --experimental-strip-types src/core/ward-interior-model.test.ts`

Expected: 全部测试通过，退出码 0。

### Task 3: 将模型接入 WardScene 并保留接口模板与交互

**Files:**
- Modify: `src/core/ward-scene.ts`
- Create: `scripts/ward-interior-model-integration-boundary.test.mjs`

**Interfaces:**
- Consumes: Task 2 的模型模块、现有 `TwinWardEntity` 和床头屏模板渲染函数。
- Produces: 所有病房优先使用 GLB、竞态安全、动态床位和程序化回退。

- [ ] **Step 1: 写失败的加载与模板保留边界测试**

测试锁定 `GLTFLoader`、模型 URL、加载令牌、`roomGroup.visible = false`、模型就绪后 `updateWard()` 与 `syncWardBedTemplates()`、GLB UV 配置和 `catch` 回退日志；同时断言现有 `loadParsedTemplate()` 与 `renderBedTerminalTexture()` 调用仍存在。

- [ ] **Step 2: 运行边界测试确认失败**

Run: `node scripts/ward-interior-model-integration-boundary.test.mjs`

Expected: 缺少 `GLTFLoader` 或模型加载函数的断言失败。

- [ ] **Step 3: 实现异步模型生命周期**

在 `WardScene` 增加模型根节点、资产部件、床位原型和加载令牌；构造时加载 GLB；成功后隐藏静态程序化房间、清空旧床位、按最新 `ward.beds` 重建并重新同步模板；失败保持回退。

- [ ] **Step 4: 实现模型床位适配器**

`createBedMesh()` 在模型就绪时走 `createModelBedMesh()`，把克隆节点适配为现有 `BedMeshGroup`，并为模型床位设置独立屏幕纹理、患者标签、状态指示、呼叫/输液和选择节点。模型纹理调用 `configureWardInteriorCanvasTexture()`。

- [ ] **Step 5: 实现资源释放和迟到结果保护**

房间切换释放旧动态纹理；`dispose()` 递增加载令牌、释放模型材质/几何和当前模型床位资源。

- [ ] **Step 6: 运行边界、现有病房测试和生产构建**

Run:

```bash
node scripts/ward-interior-model-integration-boundary.test.mjs
node --experimental-strip-types src/core/ward-interior-model.test.ts
node --experimental-strip-types scripts/ward-room-layout.test.ts
node --experimental-strip-types scripts/ward-room-size.test.ts
node --test scripts/ward-scene-view-boundary.test.mjs
node --experimental-strip-types scripts/ward-bed-geometry.test.ts
npm run build
```

Expected: 全部退出码为 0。

### Task 4: 浏览器视觉和交互验收

**Files:**
- Create: `docs/superpowers/previews/smart-ward-interior-model-desktop.png`
- Create: `docs/superpowers/previews/smart-ward-interior-model-mobile.png`

**Interfaces:**
- Consumes: Task 3 的完整应用。
- Produces: 桌面和移动端可见、非空、无重叠的模型场景证据。

- [ ] **Step 1: 启动 mock 数据开发服务器**

Run: `npm run dev -- --host 127.0.0.1`

- [ ] **Step 2: 验证桌面端**

在 `1440×900` 打开病房内 3D，确认 GLB 请求 200、房间外壳和床位可见、床头屏非静态占位、点击床位可聚焦、控制台无错误，并保存截图。

- [ ] **Step 3: 验证移动端**

在 `390×844` 检查模型非空、文字和控件无重叠、床位可点击，并保存截图。

- [ ] **Step 4: 最终复跑自动验证**

重新运行 Task 3 Step 6 的完整命令，确认视觉调整未破坏构建和契约。
