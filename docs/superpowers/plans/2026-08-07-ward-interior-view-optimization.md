# 病房内视角优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让病房点击后的视角可以继续放大，并减少入口墙体、顶棚线条和地面引导线对病床的遮挡。

**Architecture:** 在 `WardScene` 内调整病房内 OrbitControls 的距离边界与默认预设，保持相机目标在床区中心。病房壳体继续保留门框和业务设备，但将入口墙体改为较轻的开放式结构，并降低装饰线条透明度。

**Tech Stack:** Three.js、TypeScript、Node.js 内置测试。

## Global Constraints

- 不修改接口、数据映射、Token 逻辑或模型资源。
- 不允许相机缩放穿过地面、床体或房间边界。
- 保留床头屏、病房状态信息、门口机和护理设备。

### Task 1: 增加病房视角边界测试

**Files:**
- Create: `scripts/ward-scene-view-boundary.test.mjs`

- [ ] **Step 1: 写入失败断言**

读取 `src/core/ward-scene.ts` 和 `src/core/camera-presets.ts`，断言病房内最小距离为 `1.8`、自由视角高度降低、入口墙体透明度和装饰线条透明度符合优化值。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test scripts/ward-scene-view-boundary.test.mjs`
Expected: FAIL，因为当前仍是最小距离 `3.5`、旧自由视角和高遮挡装饰参数。

### Task 2: 调整相机和场景壳体

**Files:**
- Modify: `src/core/ward-scene.ts`
- Modify: `src/core/camera-presets.ts`

- [ ] **Step 1: 调整病房内缩放边界和默认目标**

将 `fitControlsToRoom()` 的最小距离调整为 `1.8`，设置 `minPolarAngle` 与 `maxPolarAngle` 保持合理俯仰范围；将自由视角改为更低、更靠近入口的床区观察角度。

- [ ] **Step 2: 减少入口遮挡和视觉噪声**

将入口墙体材质改为低透明度、低遮挡的结构，保留门框；将顶棚接缝和地面引导线透明度降低，避免出现大面积网格。

- [ ] **Step 3: 运行测试和构建**

Run: `node --test scripts/ward-scene-view-boundary.test.mjs scripts/ward-room-layout.test.ts && npm run build`
Expected: 视角边界测试通过，房间布局测试通过，生产构建成功。

### Task 3: 视觉回归

**Files:**
- No source changes expected.

- [ ] **Step 1: 启动开发服务检查病房视角**

在病房视图中点击病房，验证可以继续放大到床头设备附近；拖动旋转时不穿地、不翻转，入口和顶棚不再大面积遮挡床位。
