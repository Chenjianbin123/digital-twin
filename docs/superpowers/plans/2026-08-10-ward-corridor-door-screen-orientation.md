# 病房走廊门口屏横竖屏适配 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 根据设备 `director` 正确显示横屏或竖屏门口机，并保证模板内容等比完整显示。

**Architecture:** 在纯函数层计算 glTF 节点轴向缩放和目标 Canvas 尺寸；模板渲染层将原始模板 Canvas 按 contain 规则合成到目标方向 Canvas；场景层只应用计算结果。

**Tech Stack:** TypeScript、Three.js、Canvas 2D、Node test、Vite。

## Global Constraints

- `director = "0"` 使用横屏，`director = "1"` 使用竖屏。
- 模板内容不得拉伸，方向冲突时居中留边。
- 不修改接口调用、空床回退和点击逻辑。
- 不新增依赖。

---

### Task 1: glTF 横竖屏轴向缩放

**Files:**
- Modify: `src/core/ward-corridor-model.ts`
- Modify: `src/core/ward-corridor-model.test.ts`
- Modify: `src/core/area-scene.ts`

**Interfaces:**
- Produces: `getWardCorridorScreenNodeScale(isHorizontal)`，返回显示面和外壳的 X/Y/Z 缩放。

- [ ] **Step 1: Write the failing test**

验证横屏扩大显示面 X 轴、缩小 Z 轴；竖屏缩小 X 轴、扩大 Z 轴；外壳宽度使用 Z 轴、高度使用 Y 轴。

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test src/core/ward-corridor-model.test.ts`
Expected: FAIL because `getWardCorridorScreenNodeScale` is missing.

- [ ] **Step 3: Implement the scale helper**

```ts
export function getWardCorridorScreenNodeScale(isHorizontal: boolean) {
  const p = getWardCorridorScreenPresentation(isHorizontal);
  return {
    screen: { x: p.width / 0.51, y: 1, z: p.height / 0.68 },
    shell: { x: 1, y: p.shellHeight / 0.82, z: p.shellWidth / 0.62 },
  };
}
```

- [ ] **Step 4: Apply the helper in AreaScene**

Use `screen.scale.set(x, y, z)` and `screenShell.scale.set(x, y, z)` inside `applyWardCorridorScreenPresentation`.

- [ ] **Step 5: Run focused tests**

Run: `node --experimental-strip-types --test src/core/ward-corridor-model.test.ts`
Expected: all tests pass.

### Task 2: 模板等比适配目标方向 Canvas

**Files:**
- Modify: `src/core/template/door-screen-orientation.ts`
- Create: `src/core/template/door-screen-orientation.test.ts`
- Modify: `src/core/template/door-terminal-texture.ts`

**Interfaces:**
- Produces: `fitDoorTemplateCanvas(source, isHorizontal, background)`，返回 16:9 或 2:3 CanvasTexture 图像源。

- [ ] **Step 1: Write failing orientation tests**

验证有模板时保留设备 `director`；横屏目标比例为 16:9，竖屏目标比例为 2:3；contain 计算不会裁剪源模板。

- [ ] **Step 2: Run tests to verify failure**

Run: `node --experimental-strip-types --test src/core/template/door-screen-orientation.test.ts`
Expected: FAIL because contain layout helper is missing.

- [ ] **Step 3: Implement contain layout**

```ts
export function getContainedDoorTemplateRect(sourceW: number, sourceH: number, targetW: number, targetH: number) {
  const scale = Math.min(targetW / sourceW, targetH / sourceH);
  const width = sourceW * scale;
  const height = sourceH * scale;
  return { x: (targetW - width) / 2, y: (targetH - height) / 2, width, height };
}
```

- [ ] **Step 4: Compose the rendered template into the target Canvas**

Render the parsed template to a source Canvas using its native aspect ratio, then draw it into a `960×540` horizontal Canvas or `480×720` vertical Canvas using the contain rectangle and template background.

- [ ] **Step 5: Run all focused tests and build**

Run: `node --experimental-strip-types --test src/core/ward-corridor-model.test.ts src/core/ward-corridor-camera.test.ts src/core/template/door-screen-orientation.test.ts && npm run build`
Expected: all tests and build pass.

### Task 3: Visual verification and cleanup

**Files:**
- Temporary: `ward-corridor-debug.html` (remove after verification)

- [ ] **Step 1: Render mock horizontal and vertical devices**

Load the existing 10-room mock area in `AreaScene` without the login gate.

- [ ] **Step 2: Inspect screen bindings and screenshot**

Confirm all 10 bindings have a texture map; verify at least one horizontal shell and one vertical shell, with content contained inside each screen.

- [ ] **Step 3: Remove the temporary diagnostic page**

Delete `ward-corridor-debug.html` after visual verification.

- [ ] **Step 4: Final verification**

Run the focused tests and `npm run build` once more after cleanup.

No commit step is included because `/Users/chenjianbin/Projects/3D/digital-twin` is not a Git repository.
