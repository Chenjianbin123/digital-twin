# Nurse Station Hospital Integration Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建护士站医院融合版 V4 真实 Three.js 预览，并输出桌面端与移动端效果图。

**Architecture:** 从 V3 预览复制独立入口，继续加载同一高精度 GLB，并用单独的 Three.js 分组补充医院化顶棚、材质、导视、工作设备和 Canvas 信息屏。正式场景与 GLB 保持不变，视觉确认通过后再决定是否迁移。

**Tech Stack:** JavaScript、Three.js、GLTFLoader、CanvasTexture、HTML/CSS、Vite、Codex in-app browser。

## Global Constraints

- 使用 `high_fidelity_nurse_station.glb`。
- 模型尺寸上限保持 `8.748 × 2.3895 × 4.7385`。
- 纵向倍率保持 `Y × 1.1`。
- 保留 V3 的真实透视构图和两侧门组位置。
- 本阶段不修改正式场景代码和 GLB 文件。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 创建医院融合版 V4 场景

**Files:**
- Create: `docs/superpowers/previews/station-modeler-v4.html`
- Create: `docs/superpowers/previews/station-modeler-v4.js`

**Interfaces:**
- Consumes: `/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`、Three.js import map、V3 相机和模型适配参数。
- Produces: `window.__previewReady: boolean`、`window.__previewError: string | undefined`、`canvas.dataset.pixelSamples: string`。

- [x] **Step 1: 复制 V3 独立预览入口**

复制 V3 HTML 和 JavaScript 为 V4 文件，并将页面标题、模块路径和画布标签改为“护士站医院融合版预览”。保持：

```javascript
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 100);
camera.position.set(0, 1.46, 5.45);
const target = new THREE.Vector3(0, 0.62, -0.2);
```

- [x] **Step 2: 保持模型适配参数不变**

在 GLB 加载完成后继续使用：

```javascript
const scale = Math.min(8.748 / initialSize.x, 2.3895 / initialSize.y, 4.7385 / initialSize.z);
model.scale.multiplyScalar(scale);
model.scale.y *= 1.1;
```

- [x] **Step 3: 调整为医院环境光和材质**

设置浅灰绿色空间背景、柔和中性主光、低强度青色轮廓光和浅灰弹性地板。顶棚保留浅层回折、三组灯具和墙顶收口，不新增大块悬浮结构。

```javascript
scene.background = new THREE.Color(0xdde7e3);
renderer.toneMappingExposure = 1.0;
scene.add(new THREE.HemisphereLight(0xf7fbf8, 0x71847d, 1.05));
scene.add(new THREE.AmbientLight(0xffffff, 0.42));
```

- [x] **Step 4: 增加可读信息屏和少量使用细节**

新增 `createInfoTexture(title, rows, accent)`，使用 `CanvasTexture` 绘制床位状态、护理呼叫和今日排班；将贴图挂到三块薄面板并放在原屏幕前方。另增两把低背办公椅和一个文件架，全部放入 `hospitalDetails` 分组，避免遮挡柜台和通道。

```javascript
function createInfoTexture(title, rows, accent) {
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 640;
  infoCanvas.height = 360;
  const context = infoCanvas.getContext('2d');
  context.fillStyle = '#10343c';
  context.fillRect(0, 0, infoCanvas.width, infoCanvas.height);
  context.fillStyle = accent;
  context.font = '700 34px sans-serif';
  context.fillText(title, 36, 54);
  context.font = '24px sans-serif';
  rows.forEach((row, index) => context.fillText(row, 36, 112 + index * 58));
  const texture = new THREE.CanvasTexture(infoCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
```

- [x] **Step 5: 增加克制的医院导视**

在上墙区域加入“护士站 NURSE STATION”和“请保持安静”的平面 Canvas 导视，不在 UI 覆盖层重复说明模型功能。

- [x] **Step 6: 启动本地预览并检查加载信号**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出本地地址；打开 `/docs/superpowers/previews/station-modeler-v4.html` 后 `window.__previewReady === true`，`window.__previewError` 未定义。

---

### Task 2: 视觉验收并输出效果图

**Files:**
- Create: `docs/superpowers/previews/station-modeler-v4-hospital-desktop.png`
- Create: `docs/superpowers/previews/station-modeler-v4-hospital-mobile.png`
- Verify: `docs/superpowers/previews/station-modeler-v4.html`
- Verify: `docs/superpowers/previews/station-modeler-v4.js`

**Interfaces:**
- Consumes: V4 预览的 `preview-ready` 事件和 9 点像素采样。
- Produces: 两张可供用户评审的 PNG 效果图。

- [x] **Step 1: 桌面端视觉检查**

在 `1440 × 900` 视口打开 V4 页面，等待 `window.__previewReady === true`。确认模型完整、顶部没有黑色空洞、三块信息屏可读、办公细节不遮挡主体，然后保存桌面截图。

- [x] **Step 2: 移动端视觉检查**

在 `390 × 844` 视口重载页面，等待就绪。确认标题、模型和底部导航互不遮挡，最长中文文本完整换行或隐藏，然后保存移动端截图。

- [x] **Step 3: 验证 WebGL 画布非空**

读取 `canvas.dataset.pixelSamples`，确认 9 个采样点不是全部相同且至少一个采样点 RGB 不是背景色；控制台不得出现 WebGL、GLB 加载或纹理错误。

- [x] **Step 4: 构建回归检查**

Run: `npm run build`

Expected: `vue-tsc --noEmit` 和 `vite build` 退出码均为 0；现有 chunk-size 提示不视为失败。

