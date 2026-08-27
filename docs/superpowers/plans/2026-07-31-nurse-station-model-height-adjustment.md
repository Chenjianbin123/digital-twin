# Nurse Station Model Height Adjustment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保持护士站当前左右尺寸不变，将模型纵向拉高 10%。

**Architecture:** 在现有统一包围盒缩放完成后增加独立 Y 轴倍率，并继续使用缩放后的包围盒执行居中和落地。边界测试同时锁定当前整体尺寸、纵向倍率和倍率应用位置。

**Tech Stack:** TypeScript、Three.js、Node.js assertions、Vue 3、Vite、Codex in-app browser。

## Global Constraints

- 保留 `NURSE_STATION_MODEL_MAX_SIZE = new THREE.Vector3(8.748, 2.3895, 4.7385)`。
- 新增 `NURSE_STATION_MODEL_HEIGHT_SCALE = 1.1`。
- 不修改 GLB、摄像机、OrbitControls、动态屏幕或加载回退。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 增加纵向缩放并验证

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts:94-95`
- Modify: `src/core/area-scene.ts:1905-1907`
- Verify: `docs/superpowers/previews/high-fidelity-nurse-station-desktop-taller.png`
- Verify: `docs/superpowers/previews/high-fidelity-nurse-station-mobile-taller.png`

**Interfaces:**
- Consumes: `fitNurseStationModel(model: THREE.Object3D)`。
- Produces: `NURSE_STATION_MODEL_HEIGHT_SCALE` 和纵向缩放后的模型包围盒。

- [x] **Step 1: 写入失败的纵向缩放边界测试**

将旧尺寸断言更新为当前尺寸，并增加：

```javascript
assert.match(areaScene, /const NURSE_STATION_MODEL_HEIGHT_SCALE = 1\.1;/);
assert.match(areaScene, /model\.scale\.y \*= NURSE_STATION_MODEL_HEIGHT_SCALE;/);
```

- [x] **Step 2: 运行测试确认缺少纵向缩放导致失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: 新尺寸断言通过，纵向倍率断言失败。

- [x] **Step 3: 实现纵向缩放**

新增：

```typescript
const NURSE_STATION_MODEL_HEIGHT_SCALE = 1.1;
```

并在统一缩放后加入：

```typescript
model.scale.y *= NURSE_STATION_MODEL_HEIGHT_SCALE;
```

- [x] **Step 4: 运行代码验证**

Run:

```bash
node scripts/nurse-station-scene-boundary.test.mjs
node scripts/nurse-station-render-output-boundary.test.mjs
npm run build
```

Expected: 两个边界测试和生产构建退出码均为 0。

- [ ] **Step 5: 重新进行视觉验收**

在 `1440x900` 和 `390x844` 视口确认模型纵向更高、左右尺寸不变、仍然贴地，并保存两张新预览图。浏览器控制台不得出现模型加载或动态屏幕挂载错误。

> 当前阻塞：病区选择页请求远程接口时返回 token 失效，即使使用 mock 数据源也会调用该接口，因此暂未生成新的桌面端和移动端预览图。本次不改动病区加载架构。
