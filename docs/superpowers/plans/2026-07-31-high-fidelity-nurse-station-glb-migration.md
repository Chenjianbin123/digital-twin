# High-Fidelity Nurse Station GLB Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将高精度护士站 `.blend` 转换成适合 Three.js 运行时的新 GLB，并把前端默认护士站模型切换到该资产。

**Architecture:** 新导出脚本在内存场景中裁剪超大地面、转换文字、兼容动态屏幕命名并剔除预览占位物，然后输出独立的 `high_fidelity_nurse_station.glb`。Blender 导入契约先验证资产结构，前端边界测试再锁定新 URL，最后用本地浏览器验证真实加载、动态屏幕和响应式构图。

**Tech Stack:** Blender 5.1 Python API、glTF 2.0/GLB、Three.js 0.184、Vue 3、Node.js assertions、Vite、Playwright 浏览器检查。

## Global Constraints

- 不覆盖或删除旧 `smart_ward_nurse_station.glb`。
- 不保存导出阶段临时修改到 `high_fidelity_nurse_station.blend`。
- 新资产固定输出到 `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`。
- 前端 URL 固定为 `/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb?v=20260731-wayfinding`。
- 保留六个动态屏幕对象：`Screen_Main`、`Screen_Work_01..04`、`Clock_Display`。
- 不导出 Blender 相机和灯光。
- 不修改动态看板内容、病区数据、病房标记、走廊入口或加载失败回退逻辑。
- 当前目录不是 Git 仓库，不执行 commit；每个任务以测试和可重复产物作为检查点。

---

### Task 1: 建立 GLB 模型契约

**Files:**
- Create: `scripts/validate_high_fidelity_nurse_station_glb.py`
- Test: `scripts/validate_high_fidelity_nurse_station_glb.py`

**Interfaces:**
- Consumes: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`
- Produces: 可在 Blender 后台运行的 GLB 结构契约。

- [ ] **Step 1: 写入失败优先的 GLB 验证器**

验证器先断言文件存在，再清空场景并导入 GLB。导入后检查六块动态屏幕、护士台、走廊、导视牌、无相机灯光、无静态动态屏幕占位物、导视文字已转网格和包围盒纵深不超过 `10m`。

- [ ] **Step 2: 运行验证器并确认失败**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/validate_high_fidelity_nurse_station_glb.py
```

Expected: 退出码非零，报告缺少 `high_fidelity_nurse_station.glb`。

### Task 2: 导出高精度运行时 GLB

**Files:**
- Create: `scripts/export_high_fidelity_nurse_station_glb.py`
- Create: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`
- Test: `scripts/validate_high_fidelity_nurse_station_glb.py`

**Interfaces:**
- Consumes: `high_fidelity_nurse_station.blend` 和 Blender glTF exporter。
- Produces: 前端可加载的 `high_fidelity_nurse_station.glb`。

- [ ] **Step 1: 写导出场景准备函数**

脚本必须定义并在 `main()` 中依次调用：

```python
def trim_runtime_bounds(): ...
def rename_dynamic_screens(): ...
def hide_dynamic_screen_placeholders(): ...
def convert_visible_fonts_to_mesh(): ...
def export_glb(): ...
```

`trim_runtime_bounds()` 将 `Floor`、`Ceiling` 设置为：

```python
target.location.y = 1.3
target.dimensions.y = 9.7
```

`rename_dynamic_screens()` 使用固定映射：

```python
{
    "Monitor_Screen_01": "Screen_Work_01",
    "Monitor_Screen_02": "Screen_Work_02",
    "Monitor_Screen_03": "Screen_Work_03",
    "Monitor_Screen_04": "Screen_Work_04",
}
```

- [ ] **Step 2: 隐藏静态动态屏幕占位物**

隐藏精确对象名 `Main_Board_Title`、`Main_Board_Beds`、`Main_Board_Tasks`、`Clock_Preview_Text`，并隐藏前缀 `Monitor_UI_` 与 `Main_Board_Bar_`。同时设置 `hide_viewport`、`hide_render` 和 `hide_set(True)`。

- [ ] **Step 3: 将可见 FONT 对象转为网格**

逐个选择可见 `FONT` 对象并运行：

```python
bpy.context.view_layer.objects.active = target
target.select_set(True)
bpy.ops.object.convert(target="MESH")
```

对象名必须保持不变。

- [ ] **Step 4: 导出 GLB 且不保存源 `.blend`**

导出调用固定为：

```python
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_visible=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
)
```

`main()` 只打开源 `.blend`、准备内存场景并导出，不调用 `save_as_mainfile()`。

- [ ] **Step 5: 运行导出并确认 GLB 契约转绿**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/export_high_fidelity_nurse_station_glb.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/validate_high_fidelity_nurse_station_glb.py
```

Expected: 导出退出码为 0，验证器输出 `High-fidelity nurse station GLB contract passed.`。

### Task 3: 将前端切换到新 GLB

**Files:**
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Modify: `src/core/area-scene.ts:92`
- Test: `scripts/nurse-station-scene-boundary.test.mjs`

**Interfaces:**
- Consumes: Task 2 通过契约的新 GLB。
- Produces: 固定新模型 URL 的前端加载配置。

- [ ] **Step 1: 先写失败的前端模型 URL 契约**

在边界测试中加入：

```javascript
assert.match(
  areaScene,
  /const NURSE_STATION_MODEL_URL = '\/models\/smart-ward-nurse-station\/high_fidelity_nurse_station\.glb\?v=20260731-wayfinding';/,
);
```

- [ ] **Step 2: 运行测试并确认旧 URL 失败**

Run: `node scripts/nurse-station-scene-boundary.test.mjs`

Expected: 退出码非零，报告新 URL 正则不匹配。

- [ ] **Step 3: 更新默认模型 URL**

将常量改为：

```typescript
const NURSE_STATION_MODEL_URL = '/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb?v=20260731-wayfinding';
```

- [ ] **Step 4: 运行边界测试与生产构建**

Run:

```bash
node scripts/nurse-station-scene-boundary.test.mjs
node scripts/nurse-station-render-output-boundary.test.mjs
npm run build
```

Expected: 两个边界测试和 Vite production build 均退出码为 0。

### Task 4: 浏览器运行时验收

**Files:**
- Verify: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.glb`
- Verify: `src/core/area-scene.ts`

**Interfaces:**
- Consumes: Task 3 的生产前端和新 GLB。
- Produces: 桌面、移动视口截图与运行时确认结果。

- [ ] **Step 1: 启动本地开发服务器**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 输出可访问的本地 URL。

- [ ] **Step 2: 在浏览器进入护士站页面并等待 GLB 加载**

确认网络请求命中 `high_fidelity_nurse_station.glb?v=20260731-wayfinding`，页面没有进入程序化回退。

- [ ] **Step 3: 检查六块动态屏幕与交互**

确认中央视频、四块工作屏和时钟均显示动态内容；控制台没有 `board mesh not found` 或 `failed to load nurse station GLB`；病房标记和进入走廊按钮可用。

- [ ] **Step 4: 桌面和移动端截图检查**

分别使用约 `1440×900` 与 `390×844` 视口，确认新模型非空、居中、无遮挡，门组、导视牌和信息墙可见，页面文字与按钮不重叠。

- [ ] **Step 5: 停止开发服务器并汇总结果**

停止仅为本次验证启动的 Vite 进程，保留 GLB、源代码和截图证据。
