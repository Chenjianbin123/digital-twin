# Nurse Station Corridor Wayfinding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将护士站两侧走廊翼外移到 `x=±5.00m`，增加一组完整可见的双语悬挂导视牌，并生成不覆盖正式产物的预览及最终 4K 渲染。

**Architecture:** `scripts/render_high_fidelity_nurse_station.py` 继续作为 Blender 场景的唯一生成源，统一生成走廊几何、导视牌、灯光、`.blend` 和渲染图。`scripts/validate_high_fidelity_nurse_station.py` 先锁定走廊位置、导视对象和文案对象，再通过 build-only、独立预览和正式渲染逐级验证。

**Tech Stack:** Blender 5.1 Python API、Cycles、Python assertions、Node.js、Vite、PNG、WebP。

## Global Constraints

- 只修改 Blender 建模脚本、模型验证器、模型源文件和护士站渲染图片。
- 不修改 Vue、Three.js、病区接口、病区切换、运行时走廊或病房内部。
- 左右走廊翼固定在 `x=±5.00m`，外侧建筑墙保持 `x=±7.02m`。
- 左牌文案固定为 `← 病房区` 与 `WARD AREA`。
- 右牌文案固定为 `请保持安静` 与 `QUIET ZONE`。
- 标牌中心固定为 `x=±5.15m`、`y=0.18m`、`z=2.73m`。
- 正式渲染保持 `3840×2160`、256 samples；预览保持 `1920×1080`、32 samples。
- 预览不得覆盖正式 `.blend`、PNG 或 WebP。
- 当前目录不是 Git 仓库，不执行 commit；每个任务以测试输出和可重复产物作为检查点。

---

### Task 1: 扩展走廊与导视模型契约

**Files:**
- Modify: `scripts/validate_high_fidelity_nurse_station.py:57-78`
- Test: `scripts/validate_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Produces: 走廊位置、导视网格和四个文字对象的失败优先契约。

- [ ] **Step 1: 写入走廊与导视失败契约**

将走廊阈值改为 `5.00`，并在门组循环后加入：

```python
for sign_name in ("Wayfinding_Sign_Left", "Wayfinding_Sign_Right"):
    sign = bpy.data.objects.get(sign_name)
    assert sign is not None, f"missing wayfinding sign: {sign_name}"
    assert sign.type == "MESH", f"wayfinding sign must be mesh: {sign_name}"

for text_name in (
    "Wayfinding_Sign_Left_Title",
    "Wayfinding_Sign_Left_Subtitle",
    "Wayfinding_Sign_Right_Title",
    "Wayfinding_Sign_Right_Subtitle",
):
    assert text_name in bpy.data.objects, f"missing wayfinding text: {text_name}"
```

走廊断言必须为：

```python
assert direction * corridor_wall.location.x >= 5.00, (
    f"corridor wing must leave the information wall visually open on {side}: "
    f"x={corridor_wall.location.x:.2f}"
)
```

- [ ] **Step 2: 用当前模型确认契约失败**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend \
  --python-exit-code 1 \
  --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: 退出码非零，首先报告 `corridor wing must leave the information wall visually open on Left: x=-4.65`。

### Task 2: 外移走廊并建立双语悬挂导视牌

**Files:**
- Modify: `scripts/render_high_fidelity_nurse_station.py:261-286`
- Modify: `scripts/render_high_fidelity_nurse_station.py:422-451`
- Modify: `scripts/render_high_fidelity_nurse_station.py:549-563`
- Regenerate: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Test: `scripts/validate_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: 现有 `cube(...)`、`cylinder(...)`、`add_text(...)` 和材质字典。
- Produces: `add_wayfinding_sign(side, title, subtitle, materials)`、`Wayfinding_Sign_Left`、`Wayfinding_Sign_Right` 及对应文字对象。

- [ ] **Step 1: 将走廊翼固定到 `x=±5.00m`**

在 `build_corridor_wing()` 中设置：

```python
wall_x = direction * 5.00
```

在 `build_architecture()` 中同步定位锚点：

```python
for side, x in (("Left", -5.35), ("Right", 5.35)):
```

- [ ] **Step 2: 建立可复用的单侧导视牌函数**

在 `build_corridor_wing()` 后加入：

```python
def add_wayfinding_sign(side, title, subtitle, materials):
    direction = -1 if side == "Left" else 1
    x = direction * 5.15
    y = 0.18

    for index, rod_offset in enumerate((-0.38, 0.38), start=1):
        cylinder(
            f"Wayfinding_Sign_{side}_Rod_{index:02d}",
            (x + rod_offset, y + 0.02, 3.03),
            0.018,
            0.45,
            materials["metal"],
            vertices=20,
        )

    cube(
        f"Wayfinding_Sign_{side}_Frame",
        (x, y, 2.73),
        (1.36, 0.12, 0.46),
        materials["trim"],
        bevel=0.035,
    )
    cube(
        f"Wayfinding_Sign_{side}",
        (x, y - 0.071, 2.73),
        (1.22, 0.025, 0.33),
        materials["sign"],
        bevel=0.018,
    )
    add_text(
        f"Wayfinding_Sign_{side}_Title",
        title,
        (x, y - 0.092, 2.79),
        0.112,
        materials["text"],
    )
    add_text(
        f"Wayfinding_Sign_{side}_Subtitle",
        subtitle,
        (x, y - 0.094, 2.64),
        0.052,
        materials["text"],
    )
```

- [ ] **Step 3: 在建筑生成流程中加入两块标牌**

在两侧走廊翼生成完成后调用：

```python
add_wayfinding_sign("Left", "← 病房区", "WARD AREA", materials)
add_wayfinding_sign("Right", "请保持安静", "QUIET ZONE", materials)
```

- [ ] **Step 4: 同步走廊补光**

将左右补光改为：

```python
add_area_light("Left_Corridor_Fill", (-5.90, 1.20, 2.70), 125, (1.7, 2.6), color=(0.68, 0.82, 0.95), target=(-4.53, 3.45, 1.1))
add_area_light("Right_Corridor_Fill", (5.90, 1.20, 2.70), 125, (1.7, 2.6), color=(0.68, 0.82, 0.95), target=(4.53, 3.45, 1.1))
```

- [ ] **Step 5: 生成正式配置的 build-only 场景并确认契约转绿**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/render_high_fidelity_nurse_station.py -- --build-only
/Applications/Blender.app/Contents/MacOS/Blender \
  --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend \
  --python-exit-code 1 \
  --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: 两个命令退出码均为 0，验证器输出 `High-fidelity nurse station contract passed.`。

### Task 3: 隔离预览输出并完成视觉验收

**Files:**
- Modify: `scripts/render_high_fidelity_nurse_station.py:10-15`
- Modify: `scripts/render_high_fidelity_nurse_station.py:577-599`
- Create: `scripts/nurse-station-render-output-boundary.test.mjs`
- Create: `public/images/smart-ward-nurse-station/nurse_station_corridor_wayfinding_preview.png`

**Interfaces:**
- Consumes: Task 2 生成的完整场景。
- Produces: `PREVIEW_PNG_PATH` 和不会保存 `.blend`、不会覆盖正式图片的 `--preview` 分支。

- [ ] **Step 1: 写入失败的预览产物边界契约**

创建 Node.js 源码契约，检查独立预览路径、预览参数和正式 `.blend` 保存保护。

- [ ] **Step 2: 运行边界契约并确认失败**

Run: `node scripts/nurse-station-render-output-boundary.test.mjs`

Expected: FAIL，首先报告缺少 `PREVIEW_PNG_PATH`。

- [ ] **Step 3: 增加独立预览路径**

在图片路径常量后加入：

```python
PREVIEW_PNG_PATH = IMAGE_DIR / "nurse_station_corridor_wayfinding_preview.png"
```

- [ ] **Step 4: 让渲染函数按模式选择产物**

将 `render_outputs()` 改为：

```python
def render_outputs(scene, preview=False):
    png_path = PREVIEW_PNG_PATH if preview else PNG_PATH
    scene.render.filepath = str(png_path)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 35
    bpy.ops.render.render(write_still=True)

    outputs = [png_path]
    if not preview:
        scene.render.image_settings.file_format = "WEBP"
        scene.render.image_settings.quality = 92
        bpy.data.images["Render Result"].save_render(filepath=str(WEBP_PATH), scene=scene)
        outputs.append(WEBP_PATH)
    return outputs
```

- [ ] **Step 5: 阻止预览保存正式 `.blend`**

将 `main()` 的保存和输出流程改为：

```python
scene = build_scene(preview=args.preview)
if not args.preview:
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
if not args.build_only:
    for output_path in render_outputs(scene, preview=args.preview):
        print(f"Rendered {output_path}")
```

- [ ] **Step 6: 运行边界契约并渲染独立预览**

Run: `node scripts/nurse-station-render-output-boundary.test.mjs`

Expected: 输出 `Nurse-station render output boundary tests passed.`。

随后在运行预览前后验证正式图片摘要：

在运行预览前后分别计算正式图片摘要：

```bash
shasum public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png \
  public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/render_high_fidelity_nurse_station.py -- --preview
shasum public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png \
  public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp
sips -g pixelWidth -g pixelHeight \
  public/images/smart-ward-nurse-station/nurse_station_corridor_wayfinding_preview.png
```

Expected: 预览前后两个正式图片摘要完全相同；预览报告 `1920×1080`。

- [ ] **Step 7: 视觉检查预览**

打开 `nurse_station_corridor_wayfinding_preview.png`，确认：两块标牌完整位于画面内；中文、英文没有溢出；每侧三扇门仍有纵深；信息墙、显示器、护士台和时钟没有被新增对象遮挡。

### Task 4: 生成正式产物并执行最终验证

**Files:**
- Regenerate: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Regenerate: `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png`
- Regenerate: `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp`
- Verify: `scripts/validate_high_fidelity_nurse_station.py`
- Verify: `scripts/nurse-station-scene-boundary.test.mjs`

**Interfaces:**
- Consumes: Task 3 通过视觉验收的场景生成脚本。
- Produces: 4K PNG/WebP、正式 `.blend` 和完整验证结果。

- [ ] **Step 1: 生成 4K 正式模型与渲染图**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python-exit-code 1 \
  --python scripts/render_high_fidelity_nurse_station.py
```

Expected: 保存 `high_fidelity_nurse_station.blend`，并输出正式 PNG 与 WebP 路径。

- [ ] **Step 2: 运行模型契约和前端边界检查**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender \
  --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend \
  --python-exit-code 1 \
  --python scripts/validate_high_fidelity_nurse_station.py
node scripts/nurse-station-scene-boundary.test.mjs
npm run build
```

Expected: 模型契约和场景边界测试通过；Vite production build 退出码为 0。

- [ ] **Step 3: 检查最终图片尺寸并做视觉复核**

Run:

```bash
sips -g pixelWidth -g pixelHeight \
  public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png \
  public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp
```

Expected: PNG 与 WebP 均报告 `3840×2160`。打开正式 PNG，确认构图与已确认的 1080p 预览一致，且 4K 细节没有新增文字裁切、穿模或噪点问题。
