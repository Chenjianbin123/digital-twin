# Nurse Station Model Scale Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端护士站高精度模型整体缩小 10%，并验证桌面与移动端构图。

**Architecture:** 保留现有 GLB 和 `fitNurseStationModel()` 适配算法，只调整统一包围盒上限。场景边界测试锁定新尺寸，生产构建与浏览器截图验证模型仍居中、落地且交互正常。

**Tech Stack:** TypeScript、Three.js、Node.js assertions、Vue 3、Vite、Codex in-app browser。

## Global Constraints

- `NURSE_STATION_MODEL_MAX_SIZE` 固定为 `new THREE.Vector3(9.72, 2.655, 5.265)`。
- 不修改或重新导出 `high_fidelity_nurse_station.glb`。
- 不修改摄像机、OrbitControls、动态屏幕名称、纹理挂载或加载失败回退。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 缩小护士站模型并验证构图

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts:94`
- Verify: `docs/superpowers/previews/high-fidelity-nurse-station-desktop-smaller.png`
- Verify: `docs/superpowers/previews/high-fidelity-nurse-station-mobile-smaller.png`

**Interfaces:**
- Consumes: `fitNurseStationModel(model: THREE.Object3D)` 和现有高精度 GLB。
- Produces: 固定为原尺寸 90% 的 `NURSE_STATION_MODEL_MAX_SIZE`。

- [x] **Step 1: 写入失败的尺寸边界测试**

在模型 URL 断言之后加入：

```javascript
assert.match(
  areaScene,
  /const NURSE_STATION_MODEL_MAX_SIZE = new THREE\.Vector3\(9\.72, 2\.655, 5\.265\);/,
);
```

- [x] **Step 2: 运行测试并确认旧尺寸导致失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: 退出码非零，报告新尺寸正则不匹配，输入仍包含 `new THREE.Vector3(10.8, 2.95, 5.85)`。

- [x] **Step 3: 将模型尺寸上限缩小 10%**

将 `src/core/area-scene.ts` 中常量改为：

```typescript
const NURSE_STATION_MODEL_MAX_SIZE = new THREE.Vector3(9.72, 2.655, 5.265);
```

- [x] **Step 4: 运行代码验证**

Run:

```bash
node scripts/nurse-station-scene-boundary.test.mjs
node scripts/nurse-station-render-output-boundary.test.mjs
npm run build
```

Expected: 两个边界测试和生产构建均退出码为 0。

- [x] **Step 5: 做桌面与移动端浏览器验收**

使用现有 Vite 服务打开 `http://127.0.0.1:5173/`，分别在 `1440x900` 与 `390x844` 视口截图。确认模型相对上一版缩小约 10%，仍居中落地；护士台、门组、导视牌和动态屏幕可见；“进入病房走廊”按钮与底部导航无重叠；控制台没有模型加载或屏幕挂载错误。

- [x] **Step 6: 保存新预览截图**

保存为：

```text
docs/superpowers/previews/high-fidelity-nurse-station-desktop-smaller.png
docs/superpowers/previews/high-fidelity-nurse-station-mobile-smaller.png
```
