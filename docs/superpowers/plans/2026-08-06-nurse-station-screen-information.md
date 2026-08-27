# Nurse Station Screen Information Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将护士站前台四台电脑和后墙三块信息屏改为职责明确、方向正确、远距离可读的 B「分工指挥台」方案。

**Architecture:** 保留 GLB 屏幕盒体作为边框和暗色底面，在其可视面前创建标准 UV 的独立 Three.js 平面承载 Canvas 纹理。`area-scene.ts` 继续从现有病区状态生成纹理，但每块前台电脑绑定独立职责，后墙三块集成屏绑定值班、概览和重点事件。

**Tech Stack:** Vue 3、TypeScript、Three.js、Canvas 2D、Node.js 边界测试

## Global Constraints

- 不修改 GLB、Blend 源文件或护士站模型比例。
- 不调整相机旋转、缩放和边界限制。
- 不修改右侧业务面板、病房走廊或病房内部。
- 不新增接口、依赖、动画或可点击的 3D 屏幕交互。
- 当前目录不是 Git 仓库，因此跳过提交步骤。

---

### Task 1: 修复实体屏幕纹理方向和裁切

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: GLB 中 `Screen_Main`、`Screen_Work_01..04`、`Clock_Display` 网格。
- Produces: `attachNurseStationTextureOverlay(screen, texture, kind): THREE.Mesh`，返回标准 0-1 UV 的覆盖平面并将原网格设置为暗色底面。

- [ ] **Step 1: 写入失败边界测试**

```js
assert.match(areaScene, /private attachNurseStationTextureOverlay\(/);
assert.match(areaScene, /new THREE\.PlaneGeometry\(overlayWidth, overlayHeight\)/);
assert.match(areaScene, /overlay\.name = `nurse-station-screen-overlay-\$\{kind\}`/);
assert.match(areaScene, /depthWrite: false/);
assert.doesNotMatch(areaScene, /this\.replaceMeshMaterialWithTexture\(object, texture\)/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: FAIL，提示缺少 `attachNurseStationTextureOverlay`。

- [ ] **Step 3: 实现独立覆盖平面**

在 `area-scene.ts` 增加方法：

```ts
private attachNurseStationTextureOverlay(
  screen: THREE.Mesh,
  texture: THREE.Texture,
  kind: NurseStationBoardKind,
) {
  screen.geometry.computeBoundingBox();
  const bounds = screen.geometry.boundingBox;
  const size = bounds?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(1, 0.02, 0.55);
  const overlayWidth = Math.max(size.x, size.y, size.z) * 0.94;
  const overlayHeight = [size.x, size.y, size.z].sort((a, b) => b - a)[1] * 0.9;
  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(overlayWidth, overlayHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    }),
  );
  overlay.name = `nurse-station-screen-overlay-${kind}`;
  overlay.renderOrder = 24;
  screen.add(overlay);
  return overlay;
}
```

实现时根据包围盒最薄轴设置覆盖平面的旋转和偏移：薄轴为 `z` 时使用 XY 平面；薄轴为 `y` 时绕 X 轴旋转 `-Math.PI / 2`；薄轴为 `x` 时绕 Y 轴旋转 `Math.PI / 2`。原屏幕网格材质改为 `0x07131b` 暗色底面。

- [ ] **Step 4: 让所有实体屏使用覆盖平面**

`attachNurseStationBoardDisplays()` 中使用返回的覆盖平面保存到 `nurseStationBoardDisplays`，包括视频宣教屏和时钟。刷新纹理时只更新覆盖平面的 `MeshBasicMaterial.map`。

- [ ] **Step 5: 运行测试确认通过**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: PASS。

### Task 2: 重做前台四屏职责

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: `getAreaBoardStats()`、`summaries`、`getNurseStationDisplayInfo()`。
- Produces: `taskQueue`、`wardStatus`、`bedMonitor`、`deviceHealth` 四种 `NurseStationBoardKind` 和对应 Canvas 纹理。

- [ ] **Step 1: 写入失败职责映射测试**

```js
assert.match(areaScene, /\['taskQueue', 'Screen_Work_01'\]/);
assert.match(areaScene, /\['wardStatus', 'Screen_Work_02'\]/);
assert.match(areaScene, /\['bedMonitor', 'Screen_Work_03'\]/);
assert.match(areaScene, /\['deviceHealth', 'Screen_Work_04'\]/);
assert.match(areaScene, /'任务队列'/);
assert.match(areaScene, /'病房状态'/);
assert.match(areaScene, /'床位监测'/);
assert.match(areaScene, /'设备与环境'/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: FAIL，旧映射仍为 `workLeft/workRight/dashboard/roomStatus`。

- [ ] **Step 3: 实现统一前台画布**

新增 `createNurseWorkScreenTexture(kind)`，画布固定为 `960x520`。共同头部高度 `92px`，标题字号 `42px`，正文最小字号 `26px`；背景 `#071521`，正常 `#7bdff2`，提醒 `#ffb74d`，紧急 `#ff5c8a`。

内容固定为：

```ts
const titles = {
  taskQueue: '任务队列',
  wardStatus: '病房状态',
  bedMonitor: '床位监测',
  deviceHealth: '设备与环境',
};
```

- `taskQueue`：紧急数、待办数、最高优先级任务。
- `wardStatus`：前三个重点病房，显示房号、短状态、占用床位。
- `bedMonitor`：在床、空床、输液中、待巡视。
- `deviceHealth`：设备在线率、离线设备、环境预警。

- [ ] **Step 4: 替换 GLB 映射并删除旧入口**

```ts
const boards: Array<[NurseStationBoardKind, string]> = [
  ['education', 'Screen_Main'],
  ['taskQueue', 'Screen_Work_01'],
  ['wardStatus', 'Screen_Work_02'],
  ['bedMonitor', 'Screen_Work_03'],
  ['deviceHealth', 'Screen_Work_04'],
  ['clock', 'Clock_Display'],
];
```

`createNurseStationBoardTexture()` 将四种职责路由到 `createNurseWorkScreenTexture()`，不再让前台电脑复用后墙纹理。

- [ ] **Step 5: 运行测试确认通过**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: PASS。

### Task 3: 简化后墙三屏信息

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: 已有 `whiteboard`、`dashboard`、`roomStatus` 纹理生成器。
- Produces: 左侧值班公告、中央病区概览、右侧重点事件三块后墙显示。

- [ ] **Step 1: 写入失败映射测试**

```js
assert.match(areaScene, /createIntegrationDisplay\(-1\.25, 'whiteboard', 0\.9\)/);
assert.match(areaScene, /createIntegrationDisplay\(0, 'dashboard', 1\.2\)/);
assert.match(areaScene, /createIntegrationDisplay\(1\.25, 'roomStatus', 0\.9\)/);
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: FAIL，中、右屏仍复用前台 `workLeft/workRight`。

- [ ] **Step 3: 简化三种后墙纹理**

- `whiteboard`：值班护士长、责任医生、静音时段和单条公告。
- `dashboard`：在床、呼叫、输液、设备在线率与时间，不再显示下方重复房态列表。
- `roomStatus`：最多三条重点事件；无事件时显示“暂无重点事件”。

保持深色背景和统一色义，每块屏幕最多三个内容块。

- [ ] **Step 4: 更新后墙映射并验证**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: PASS。

### Task 4: 构建与视觉验收

**Files:**
- Create: `docs/superpowers/previews/nurse-station-screen-information-b.png`

**Interfaces:**
- Consumes: Tasks 1-3 的屏幕纹理与覆盖平面。
- Produces: 正式桌面效果图和可运行页面。

- [ ] **Step 1: 运行相关测试**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Run: `node scripts/nurse-station-controls-panel-toggle-boundary.test.mjs`

Expected: 两项均 PASS。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 与 Vite 构建通过；允许项目现有 Sass legacy API 和 chunk-size 提示。

- [ ] **Step 3: 浏览器桌面视觉验收**

打开 `http://127.0.0.1:5173/`，确认：

- 四台电脑内容均为横向正立，无镜像、旋转和裁切。
- 后墙三屏分别为值班、概览、重点事件，无前后台重复。
- 红色只用于紧急事件，文字在主视角可辨认。
- 模型旋转、缩放、复位和面板总开关保持可用。
- 控制台无新增错误。

- [ ] **Step 4: 保存正式效果图**

将桌面截图保存为 `docs/superpowers/previews/nurse-station-screen-information-b.png`，供用户直接查看。
