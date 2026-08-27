# High-Fidelity Nurse Station Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Blender Cycles 生成接近参考图的固定视角护士站背景，并在 Vue 中精确叠加动态视频、时钟、真实病房浮标和现有导航交互。

**Architecture:** Blender 文件是写实空间、材质和灯光的唯一源，输出 4K PNG 与网页 WebP。`NurseStationVisualScene.vue` 使用统一的 16:9 cover 画布合成背景和动态 DOM 图层；原有 `AreaScene3D` 仅在背景加载失败时回退，病房走廊和病房内部渲染分支不变。

**Tech Stack:** Blender 5.1 Python API、Cycles、Vue 3、TypeScript、SCSS、HTML video、Vite、Node.js assertion tests。

## Global Constraints

- 仅修改护士站首屏，不修改病房走廊和病房内部的模型、相机或交互。
- 固定主视角，不增加自由旋转、缩放或漫游。
- 保留真实接口、病区切换、刷新记忆、病房点击、进入走廊和电视播放。
- 背景不得包含患者姓名、固定病区统计、固定时间或设备状态。
- 4K 主渲染尺寸固定为 `3840x2160`，网页资源保持同一 `16:9` 坐标系。
- 背景加载失败时回退到现有 `AreaScene3D` 护士站。
- 视频失败时显示实时病区概览，接口失败时不切换到模拟数据。
- 当前目录不是 Git 仓库；任务检查点以测试通过和可重复生成产物为准，不能创建提交。

---

## File Structure

- `src/core/nurse-station-composite.ts`: 16:9 cover 画布、归一化区域和浮标锚点的纯函数契约。
- `scripts/nurse-station-composite.test.ts`: 画布缩放、裁切和动态区域定位测试。
- `scripts/render_high_fidelity_nurse_station.py`: 创建原创高精度 Blender 场景、保存 `.blend` 并输出 4K PNG/WebP。
- `scripts/validate_high_fidelity_nurse_station.py`: 验证相机、关键对象、材质、灯光和渲染尺寸。
- `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`: 可编辑高精度源场景。
- `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png`: 4K 兼容背景。
- `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp`: 4K 浏览器优先背景。
- `src/components/NurseStationVisualScene.vue`: 背景、视频、时钟、浮标、实时概览和回退 3D 的合成容器。
- `scripts/nurse-station-scene-boundary.test.mjs`: 护士站专用边界、资源和回退行为契约。

### Task 1: 锁定混合画布坐标契约

**Files:**
- Create: `src/core/nurse-station-composite.ts`
- Create: `scripts/nurse-station-composite.test.ts`

**Interfaces:**
- Produces: `getCoverFrame(containerWidth, containerHeight, aspectRatio?) -> CompositeFrame`。
- Produces: `mapCompositeRegion(frame, region) -> CompositeFrame`。
- Produces: `NURSE_STATION_REGIONS` 与 `NURSE_STATION_MARKER_ANCHORS`。

- [ ] **Step 1: 写画布缩放与坐标映射失败测试**

```ts
import assert from 'node:assert/strict';
import {
  getCoverFrame,
  mapCompositeRegion,
  NURSE_STATION_REGIONS,
} from '../src/core/nurse-station-composite.ts';

assert.deepEqual(getCoverFrame(1920, 1080), {
  width: 1920, height: 1080, left: 0, top: 0,
});

const square = getCoverFrame(1000, 1000);
assert.equal(square.height, 1000);
assert.ok(Math.abs(square.width - 1777.7777777778) < 0.001);
assert.ok(Math.abs(square.left + 388.8888888889) < 0.001);

const screen = mapCompositeRegion(
  { width: 1920, height: 1080, left: 0, top: 0 },
  NURSE_STATION_REGIONS.mainScreen,
);
assert.deepEqual(screen, { left: 758.4, top: 298.08, width: 403.2, height: 202.5 });
```

- [ ] **Step 2: 运行测试并确认模块缺失**

Run:

```bash
node --experimental-strip-types scripts/nurse-station-composite.test.ts
```

Expected: FAIL，提示 `src/core/nurse-station-composite.ts` 不存在。

- [ ] **Step 3: 实现统一 cover 画布与归一化区域**

```ts
export interface CompositeFrame {
  width: number;
  height: number;
  left: number;
  top: number;
}

export interface CompositeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NURSE_STATION_REGIONS = {
  mainScreen: { x: 0.395, y: 0.276, width: 0.21, height: 0.1875 },
  clock: { x: 0.854, y: 0.279, width: 0.075, height: 0.044 },
} as const;

export const NURSE_STATION_MARKER_ANCHORS = [
  { x: 0.19, y: 0.17 },
  { x: 0.38, y: 0.15 },
  { x: 0.61, y: 0.15 },
  { x: 0.81, y: 0.17 },
  { x: 0.30, y: 0.31 },
  { x: 0.70, y: 0.31 },
] as const;

export function getCoverFrame(
  containerWidth: number,
  containerHeight: number,
  aspectRatio = 16 / 9,
): CompositeFrame {
  const width = Math.max(containerWidth, containerHeight * aspectRatio);
  const height = width / aspectRatio;
  return {
    width,
    height,
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
  };
}

export function mapCompositeRegion(frame: CompositeFrame, region: CompositeRegion): CompositeFrame {
  return {
    left: frame.left + frame.width * region.x,
    top: frame.top + frame.height * region.y,
    width: frame.width * region.width,
    height: frame.height * region.height,
  };
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `node --experimental-strip-types scripts/nurse-station-composite.test.ts`

Expected: 输出 `Nurse-station composite tests passed.`。

### Task 2: 建立高精度 Blender 场景契约

**Files:**
- Create: `scripts/validate_high_fidelity_nurse_station.py`
- Create: `scripts/render_high_fidelity_nurse_station.py`

**Interfaces:**
- Produces: 对象 `Reference_Camera`、`Nurse_Counter`、`Screen_Main`、`Clock_Display`、`Corridor_Left`、`Corridor_Right`。
- Produces: 材质 `White_Stone`、`Blue_Floor`、`Wood_Door`、`Wall_Paint`、`Screen_Glass`。
- Produces: `3840x2160`、Cycles、透明关闭的固定渲染配置。

- [ ] **Step 1: 写 Blender 场景契约检查**

```python
import bpy

required_objects = {
    "Reference_Camera", "Nurse_Counter", "Screen_Main", "Clock_Display",
    "Corridor_Left", "Corridor_Right",
}
required_materials = {
    "White_Stone", "Blue_Floor", "Wood_Door", "Wall_Paint", "Screen_Glass",
}
missing_objects = required_objects - set(bpy.data.objects.keys())
missing_materials = required_materials - set(bpy.data.materials.keys())
assert not missing_objects, f"missing objects: {sorted(missing_objects)}"
assert not missing_materials, f"missing materials: {sorted(missing_materials)}"
assert bpy.context.scene.camera.name == "Reference_Camera"
assert bpy.context.scene.render.engine == "BLENDER_EEVEE_NEXT" or bpy.context.scene.render.engine == "CYCLES"
assert bpy.context.scene.render.resolution_x == 3840
assert bpy.context.scene.render.resolution_y == 2160
assert bpy.data.objects["Corridor_Left"].location.x < -3.0
assert bpy.data.objects["Corridor_Right"].location.x > 3.0
assert bpy.data.objects["Nurse_Counter"].dimensions.x >= 6.0
print("High-fidelity nurse station contract passed.")
```

- [ ] **Step 2: 运行契约并确认高精度场景不存在**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: FAIL，报告关键对象和材质缺失。

- [ ] **Step 3: 在渲染脚本中建立可重复的场景基础**

渲染脚本必须先清空场景，再设置 `3840x2160`、100% 比例、Cycles GPU 可用时优先、256 samples、OpenImageDenoise、AgX Medium High Contrast 和透明关闭。相机固定为约 `50mm`，位于护士台正前方并指向中央信息墙，禁止广角畸变。

```python
scene.render.resolution_x = 3840
scene.render.resolution_y = 2160
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.render.engine = "CYCLES"
scene.cycles.samples = 256
scene.cycles.use_denoising = True
scene.view_settings.look = "AgX - Medium High Contrast"
```

- [ ] **Step 4: 建立稳定 PBR 材质辅助函数**

```python
def pbr_material(name, base_color, roughness, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material
```

- [ ] **Step 5: 保存初始 Blend 并通过基础契约**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_high_fidelity_nurse_station.py -- --build-only
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: 两个命令退出码均为 0，契约打印通过信息。

### Task 3: 重建参考构图、材质与灯光

**Files:**
- Modify: `scripts/render_high_fidelity_nurse_station.py`
- Modify: `scripts/validate_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: Task 2 的对象、材质和相机契约。
- Produces: 对称双走廊、弧形护士台、四台工作显示器、信息墙、储物柜、绿植、打印机、电话、吊顶灯和电子时钟。

- [ ] **Step 1: 扩展契约到关键细节和灯光密度**

```python
for name in [
    "Workstation_01", "Workstation_02", "Workstation_03", "Workstation_04",
    "Cabinet_Wall", "Printer_Left", "Printer_Right", "Nurse_Station_Sign",
]:
    assert name in bpy.data.objects, f"missing detail: {name}"
assert sum(obj.type == "LIGHT" for obj in bpy.data.objects) >= 8
assert len([obj for obj in bpy.data.objects if obj.name.startswith("Ward_Door_")]) >= 6
```

- [ ] **Step 2: 建立建筑空间与模块化吊顶**

以护士台中心为原点，后墙约 `y=4.8m`、吊顶约 `z=3.2m`，左右走廊锚点位于 `x=-5m` 与 `x=5m`。每侧至少三扇木色病房门，包含观察窗、门框、蓝色扶手、踢脚线和纵深灯盘。灯盘使用发光网格配合 Area Light，避免当前场景密集重复的白色方块。

- [ ] **Step 3: 建立弧形护士台和近景办公设备**

护士台使用 96 段曲面与独立台面，宽度至少 `6m`；前面板为白色人造石，底部保留浅蓝阴影槽，中央增加原创“护士站 / NURSE STATION”标牌。四组工作站分别包含显示器外壳、屏幕、支架、键盘和鼠标，并增加双侧打印机、电话与座椅。

- [ ] **Step 4: 建立中央信息墙和细节层次**

后墙中央设置暗色 `Screen_Main`，下方为连续白色储物柜与台面；增加文件夹、不同高度的绿植和少量医疗办公物件。右侧 `Clock_Display` 使用黑色外框和暗色空白屏幕，供网页时钟覆盖。

- [ ] **Step 5: 完成灯光和材质校准**

顶灯采用中性冷白，护士台前方增加大面积柔光，走廊加入低强度补光，World 使用低强度中性环境色。人造石保持柔和反射，地面反射低于护士台，墙面高粗糙，木门保留暖色对比，避免整体只有蓝白单色。

- [ ] **Step 6: 生成 Blend、4K PNG 与 WebP**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_high_fidelity_nurse_station.py
```

Expected: 生成以下三个非空文件：

```text
public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend
public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png
public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp
```

- [ ] **Step 7: 运行场景契约并人工检查渲染图**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: 输出 `High-fidelity nurse station contract passed.`；渲染图中央护士台、信息墙和左右走廊完整可见，无明显过曝、穿模或黑块。

### Task 4: 接入 Vue 动态合成和 3D 回退

**Files:**
- Modify: `src/components/NurseStationVisualScene.vue`
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Test: `scripts/nurse-station-scene-boundary.test.mjs`

**Interfaces:**
- Consumes: `getCoverFrame`、`mapCompositeRegion`、`NURSE_STATION_REGIONS`、`NURSE_STATION_MARKER_ANCHORS`。
- Consumes: `/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp`、PNG 回退和现有宣教视频。
- Produces: 背景、视频、时钟、病区概览、病房浮标统一缩放的合成场景。

- [ ] **Step 1: 更新边界测试并确认旧组件失败**

```js
assert.match(visualScene, /nurse_station_high_fidelity\.webp/);
assert.match(visualScene, /nurse_station_high_fidelity\.png/);
assert.match(visualScene, /NURSE_STATION_REGIONS/);
assert.match(visualScene, /ResizeObserver/);
assert.match(visualScene, /hospital-handwashing-education\.mp4/);
assert.match(visualScene, /v-if="backgroundFailed"[\s\S]*?<AreaScene3D/);
assert.doesNotMatch(visualScene, /--station-shift-x/);
```

- [ ] **Step 2: 运行边界测试并确认失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: FAIL，提示高精度资源或回退结构缺失。

- [ ] **Step 3: 建立响应式合成画布**

组件使用 `ResizeObserver` 读取根容器尺寸，以 `getCoverFrame()` 计算 `stageStyle`，背景、视频、时钟和浮标全部放在同一个 `.nurse-station-visual__stage` 内。根容器销毁时断开 observer，禁止残留监听。

```ts
const stageStyle = computed(() => ({
  width: `${frame.value.width}px`,
  height: `${frame.value.height}px`,
  left: `${frame.value.left}px`,
  top: `${frame.value.top}px`,
}));
```

- [ ] **Step 4: 接入 picture 背景与实时 3D 回退**

```vue
<AreaScene3D v-if="backgroundFailed" ... scene-type="nurse-station" />
<div v-else class="nurse-station-visual__stage" :style="stageStyle">
  <picture>
    <source srcset="/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp" type="image/webp">
    <img
      src="/images/smart-ward-nurse-station/nurse_station_high_fidelity.png"
      alt=""
      @load="backgroundReady = true"
      @error="backgroundFailed = true"
    >
  </picture>
</div>
```

- [ ] **Step 5: 叠加电视、时钟和视频回退概览**

中央屏幕使用绝对定位 `<video muted autoplay loop playsinline>`，资源为 `/videos/hospital-handwashing-education.mp4`。`error` 或播放失败时显示当前病区名称、房间数、床位占用数和设备数；时钟每秒更新 `HH:mm:ss`，卸载时清除 timer。

- [ ] **Step 6: 将病房浮标改为归一化锚点**

浮标在 16:9 stage 内按 `NURSE_STATION_MARKER_ANCHORS` 定位，继续使用 `selectNurseStationMarkers(props.roomSummaries)`、现有优先级样式和 `emit('roomClick', room.roomIndex)`。移动端继续隐藏第 5 个及之后的浮标。

- [ ] **Step 7: 调整视觉层级和控制区避让**

移除指针视差和旧全屏 wash，保留轻度暗角但不得降低中央屏幕可读性。桌面端右侧“进入病房走廊”继续避让 `--scene-panel-width`；移动端按钮继续位于底部信息面板上方。底部导航 z-index 与 App 结构保持现状。

- [ ] **Step 8: 运行合成、边界和构建验证**

Run:

```bash
node --experimental-strip-types scripts/nurse-station-composite.test.ts
node scripts/nurse-station-scene-boundary.test.mjs
node --experimental-strip-types scripts/nurse-station-markers.test.ts
node --experimental-strip-types scripts/scene-transition.test.ts
npm run build
```

Expected: 所有测试输出通过信息，`vue-tsc` 与 Vite 构建退出码为 0。

### Task 5: 真实数据和跨视口视觉验收

**Files:**
- Modify only if verification exposes a defect: `src/components/NurseStationVisualScene.vue`
- Modify only if render alignment is wrong: `scripts/render_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: 完成的护士站混合场景与当前真实接口配置。
- Produces: 桌面和移动端无错位截图，护士站以外场景无回归。

- [ ] **Step 1: 启动开发服务**

Run: `npm run dev -- --host 0.0.0.0`

Expected: Vite 输出可访问的本地 URL；如默认端口被占用，使用 Vite 自动分配的新端口。

- [ ] **Step 2: 验证真实病区流程**

在浏览器中选择病区进入护士站，确认顶部病区、浮标和右侧面板来自真实接口；切换病区后浮标同步变化；刷新后无需重新选择病区。不得在控制台或页面中输出 token。

- [ ] **Step 3: 验证桌面构图**

在 `1920x1080` 和 `1440x900` 截图检查：弧形护士台、四台显示器、中央大屏、左右走廊、红色时钟完整可辨；视频边界与电视外框对齐；浮标不遮挡病区切换、中央屏幕或右侧面板。

- [ ] **Step 4: 验证移动端构图**

在 `390x844` 截图检查：中央护士台和大屏保持可见，背景不拉伸，视频与时钟不漂移，前四个浮标和进入走廊按钮不与底部导航重叠。

- [ ] **Step 5: 验证失败回退**

临时在浏览器拦截高精度背景请求，确认现有实时 3D 护士站出现且交互可用；拦截视频请求，确认中央屏幕显示实时病区概览。结束验证后取消请求拦截，不修改真实资源地址。

- [ ] **Step 6: 验证场景边界**

依次进入病房走廊和病房内部，确认模型、相机和交互与修改前一致；返回护士站后视频恢复播放，且没有重复计时器或媒体请求。

- [ ] **Step 7: 运行最终验证**

Run:

```bash
node --experimental-strip-types scripts/nurse-station-composite.test.ts
node scripts/nurse-station-scene-boundary.test.mjs
node --experimental-strip-types scripts/nurse-station-markers.test.ts
node --experimental-strip-types scripts/scene-transition.test.ts
npm run build
```

Expected: 所有命令退出码为 0；桌面和移动截图不存在黑屏、拉伸、动态层错位、文字重叠或关键控件遮挡。
