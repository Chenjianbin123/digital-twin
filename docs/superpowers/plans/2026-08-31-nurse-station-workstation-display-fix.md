# 护士站四屏适配与主屏布局修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让当前护士站 `1-1.glb` 模型中的四台电脑屏幕分别显示实时模板信息，并修复主屏标题、指标和卡片重叠。

**Architecture:** 保留真实接口和现有数据统计链路，仅调整 GLB 屏幕识别与 Canvas 覆盖层生成。新模型优先按 `Workstation_01`～`Workstation_04` 适配；当四个屏幕被合并到 `Keyboard_04.001` 时，按网格材质/空间分区创建四个独立覆盖平面。主屏继续使用动态 Canvas，但重新规划安全边距、列宽、字体和卡片间距，避免静态占位内容与动态内容叠加。

**Tech Stack:** Vue 3, TypeScript, Three.js, CanvasTexture, Node test runner, Vite.

## Global Constraints

- 不改变真实接口、数据源和病区切换逻辑。
- 不删除旧模型文件或用户已有改动。
- 每个行为先添加能失败的边界测试，再修改生产代码。
- 修改后必须运行目标测试、完整 `npm test`、`npm run typecheck` 和 `npm run build`。
- 四台电脑屏幕绑定顺序固定为 `taskQueue`、`wardStatus`、`bedMonitor`、`deviceHealth`。

---

### Task 1: 新模型四台电脑屏幕识别测试

**Files:**
- Create: `scripts/nurse-station-workstation-display-boundary.test.mjs`
- Modify: `src/core/area-scene.ts`（仅在实现阶段）

**Interfaces:**
- 生产代码需要提供可由源码边界测试识别的四屏适配入口。
- 适配结果必须包含四个 kind：`taskQueue`、`wardStatus`、`bedMonitor`、`deviceHealth`。

- [x] **Step 1: 写失败测试**

测试读取 `src/core/area-scene.ts`，要求存在：

```js
assert.match(areaScene, /resolveNurseStationWorkstationDisplays/);
assert.match(areaScene, /Keyboard_04\.001/);
assert.match(areaScene, /Workstation_01/);
assert.match(areaScene, /taskQueue/);
assert.match(areaScene, /wardStatus/);
assert.match(areaScene, /bedMonitor/);
assert.match(areaScene, /deviceHealth/);
```

- [x] **Step 2: 运行目标测试确认失败**

运行：

```bash
node --test scripts/nurse-station-workstation-display-boundary.test.mjs
```

预期：因适配函数尚未存在而失败。

- [x] **Step 3: 保持测试失败，完成模型证据确认**

确认 `1-1.glb` 中 `Workstation_01`～`Workstation_04` 是父节点，`Keyboard_04.001` 是包含四块屏幕区域的合并网格；记录屏幕分区的局部坐标和材质索引，作为下一任务的唯一适配依据。

### Task 2: 四台电脑屏幕独立覆盖层与动态绑定

**Files:**
- Modify: `src/core/area-scene.ts:2040-2160`
- Modify: `scripts/nurse-station-workstation-display-boundary.test.mjs`

**Interfaces:**
- 新增 `resolveNurseStationWorkstationDisplays(model)`，返回四个 `{ kind, mesh, root }` 适配项。
- 新增合并网格分区覆盖层生成逻辑，覆盖层沿模型屏幕面法线偏移，`depthTest` 与 `renderOrder` 保持当前门框遮挡修复策略。

- [x] **Step 1: 先扩展失败测试**

测试要求源码包含：

```js
assert.match(areaScene, /createMergedWorkstationDisplayOverlays/);
assert.match(areaScene, /displayRegion/);
assert.match(areaScene, /renderOrder\s*=\s*10000/);
assert.match(areaScene, /frustumCulled\s*=\s*false/);
```

- [x] **Step 2: 运行目标测试确认仍失败**

```bash
node --test scripts/nurse-station-workstation-display-boundary.test.mjs
```

- [x] **Step 3: 实现最小适配**

实现顺序：

1. 保留旧独立屏节点匹配，保证旧模型不回归。
2. 新模型发现 `Workstation_01`～`Workstation_04` 后，优先为前三个工作台从父节点子网格中选择屏幕面。
3. 发现 `Keyboard_04.001` 时，读取其 `深蓝`/`UI_Cyan`/`UI_Blue` 材质组的顶点边界，按四个连续屏幕区域拆分为四个局部 `Box3`，分别创建 `PlaneGeometry` 覆盖层。
4. 四个覆盖层分别生成 `createNurseWorkScreenTexture(kind)`，并加入 `nurseStationBoardDisplays`，刷新和销毁逻辑沿用现有链路。
5. 每个绑定输出 `kind`、模型节点、材质、宽高、深度轴和世界坐标日志，便于浏览器控制台核对。

- [x] **Step 4: 运行目标测试与类型检查**

```bash
node --test scripts/nurse-station-workstation-display-boundary.test.mjs
npm run typecheck
```

预期：目标测试通过，类型检查无错误。

### Task 3: 主屏 Canvas 布局去重叠和视觉优化

**Files:**
- Modify: `src/core/area-scene.ts:1570-1710`
- Modify: `scripts/nurse-station-workstation-display-boundary.test.mjs`

**Interfaces:**
- `createNurseRearDashboardTexture()` 仍返回 `THREE.CanvasTexture`，不改变外部调用。
- 主屏内容保持三栏：病区概览、患者动态、设备状态；只调整布局参数、字体和溢出裁剪。

- [x] **Step 1: 先扩展失败测试**

测试要求主屏源码包含明确布局常量和裁剪：

```js
assert.match(areaScene, /const dashboardPadding/);
assert.match(areaScene, /ctx\.save\(\)/);
assert.match(areaScene, /ctx\.clip\(\)/);
assert.match(areaScene, /patientCardHeight/);
```

- [x] **Step 2: 运行目标测试确认失败**

```bash
node --test scripts/nurse-station-workstation-display-boundary.test.mjs
```

- [x] **Step 3: 实现最小视觉修复**

调整主屏 Canvas：

1. 顶部标题、病区名和时间使用独立安全区，不让标题穿透到中栏。
2. 三栏增加统一内边距和列间距；标题基线固定。
3. 患者动态卡片使用固定高度、内容裁剪和左右两列对齐，状态标签不覆盖病房名。
4. 设备状态数值统一右对齐，长文本使用 `drawTruncatedText`。
5. 所有列绘制在自己的裁剪区域中，避免 Canvas 绘制越界。

- [x] **Step 4: 运行完整验证**

```bash
node --test scripts/nurse-station-workstation-display-boundary.test.mjs
npm test
npm run typecheck
npm run build
```

预期：全部通过，构建产物包含当前 `1-1.glb` URL。
