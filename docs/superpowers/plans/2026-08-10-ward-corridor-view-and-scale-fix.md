# Ward Corridor View And Scale Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复病房走廊初始化镜头与门口屏遮挡，并将走廊净宽/层高调整为 5.2m/3.8m。

**Architecture:** Blender 脚本负责正确的几何尺寸与动态显示面位置，`AreaScene` 负责内部初始镜头和交互边界。现有模板解析、GLB 回退和门位映射保持不变。

**Tech Stack:** Blender Python、Vue 3、Three.js、TypeScript、Vite

## Global Constraints

- 走廊净宽固定为 5.2m，层高固定为 3.8m。
- 不改默认 `VITE_DATA_SOURCE=remote`。
- 门口屏继续使用现有接口模板解析逻辑。
- 保留程序化走廊作为 GLB 加载失败或病房超过 10 间时的回退。

---

### Task 1: 修复 Blender 尺寸与动态显示面

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`
- Generate: `public/models/smart-ward-corridor/smart_ward_corridor.glb`

**Interfaces:**
- Consumes: `add_door_module(side, y, index, mats)`
- Produces: 10 个名称保持不变的 `Room XX live screen surface` 和 `Room XX live room label surface`

- [ ] 将 `corridor_width` 改为 `5.2`，`ceiling_height` 改为 `3.8`，所有依附墙面的对象使用统一半宽坐标。
- [ ] 将动态门口屏面放到外壳朝走廊表面之外至少 0.006m，避免深度遮挡。
- [ ] 更新 Blender 验收断言，校验宽度、高度和显示面相对外壳的位置。
- [ ] 后台运行 Blender 脚本重新生成 PNG、Blend 和 GLB。
- [ ] 读取导出文件包围盒与对象名称，确认尺寸和 10 组动态面。

### Task 2: 修复 Three.js 初始化镜头

**Files:**
- Modify: `src/core/area-scene.ts`
- Test: `src/core/ward-corridor-camera.test.ts`

**Interfaces:**
- Produces: `getWardCorridorCameraView(bounds)` 返回走廊内部的 `{ position, target }`

- [ ] 添加失败测试，断言相机 X 位于走廊宽度内、Y 低于天花板、目标沿长轴远端。
- [ ] 提取纯函数计算 GLB 走廊内部相机位置。
- [ ] 在 `getNurseStationCameraView()` 的 GLB 分支调用该函数，并收紧最小/最大观察距离。
- [ ] 运行聚焦测试及现有门位测试。

### Task 3: 构建与视觉验证

**Files:**
- Verify: `src/core/area-scene.ts`
- Verify: `public/models/smart-ward-corridor/smart_ward_corridor.glb`

**Interfaces:**
- Consumes: 新 GLB 与内部相机计算
- Produces: 可交付的病房走廊预览

- [ ] 运行 `npm run build`，期望退出码 0。
- [ ] 用 `VITE_DATA_SOURCE=mock` 启动 Vite 预览。
- [ ] 浏览器切换到病房场景并检查首帧、门口屏纹理和控制台。
- [ ] 截取桌面视口预览，确认画布非空且走廊内部构图正确。

### Task 4: 修复墙面挂件坐标

**Files:**
- Modify: `scripts/render_smart_ward_corridor_concept.py`
- Generate: `public/models/smart-ward-corridor/smart_ward_corridor.glb`

**Interfaces:**
- Consumes: `WALL_X`, `DOOR_X`, `PANEL_X`, `HANDRAIL_X`
- Produces: 墙面贴合的门牌、提示语、扶手和座椅

- [ ] 在 `validate_safety_seating_layout()` 增加门牌、提示语和扶手到墙面的距离断言，并先运行 Blender 使旧坐标失败。
- [ ] 定义 `WALL_OFFSET = CORRIDOR_HALF_WIDTH - 2.0`，将墙面挂件从旧坐标统一加上该偏移，门口屏和门保持现有相对位置。
- [ ] 重新运行 Blender 脚本，确认断言通过并导出新 GLB。
- [ ] 运行 `npm run build` 与 4 个聚焦测试，确认代码和模型接入均正常。
