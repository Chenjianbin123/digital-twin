# Smart Ward Vertical Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将智慧病房完整场景沿世界 Z 轴拉高 12%，修正两组监护仪和共享护理车悬空，并另存可验证的优化版 Blender 文件。

**Architecture:** 新增一个可重复执行的 Blender 优化脚本，用根空对象承担世界 Z 轴缩放，并单独重算相机位置和朝向；新增独立验证脚本，检查元数据、根节点倍率、关键尺寸和设备落地包围盒。原稿先运行验证脚本得到预期失败，优化版再运行同一契约得到通过。

**Tech Stack:** Blender 5.1、Python、`bpy`、`mathutils`、Eevee、PNG。

## Global Constraints

- 纵向倍率固定为 `1.12`，缩放基准为世界地面 `Z=0`。
- X/Y 平面布局、材质、灯光功率、渲染分辨率和采样设置保持不变。
- 修正 `Monitor_1_*`、`Monitor_2_*` 和 `SharedCare*` 的世界包围盒最低点为 `Z=0`，误差不超过 `0.001 m`。
- 输出为 `smart_ward_scene_highres_optimized.blend`，不得覆盖 `smart_ward_scene_highres.blend`。
- 当前目录不是 Git 仓库，不执行 commit。

---

### Task 1: 增加优化契约并确认原稿失败

**Files:**
- Create: `scripts/verify_smart_ward_scene_optimization.py`

**Interfaces:**
- Consumes: Blender 当前已加载场景。
- Produces: 退出码 0 的优化契约验证结果，或带具体断言信息的非零退出码。

- [x] **Step 1: 写入失败的 Blender 场景契约**

创建验证脚本，包含以下完整检查：

```python
from __future__ import annotations

import math

import bpy
from mathutils import Vector


VERTICAL_SCALE = 1.12
ROOT_NAME = "SmartWardVerticalScale"
GROUND_PREFIXES = ("Monitor_1_", "Monitor_2_", "SharedCare")


def world_min_z(objects: list[bpy.types.Object]) -> float:
    return min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )


def assert_close(actual: float, expected: float, tolerance: float) -> None:
    assert math.isclose(actual, expected, abs_tol=tolerance), (
        f"expected {expected:.6f}, got {actual:.6f}"
    )


scene = bpy.context.scene
root = bpy.data.objects.get(ROOT_NAME)

assert math.isclose(scene.get("smart_ward_vertical_scale", 0.0), VERTICAL_SCALE)
assert root is not None, f"missing root object: {ROOT_NAME}"
assert math.isclose(root.scale.z, VERTICAL_SCALE, abs_tol=1e-6)
assert_close(bpy.data.objects["BackWall"].dimensions.z, 3.92, 0.001)
assert_close(bpy.data.objects["Bed_1_Base"].dimensions.x, 2.3, 0.001)
assert_close(bpy.context.scene.camera.location.z, 2.744, 0.001)

for prefix in GROUND_PREFIXES:
    objects = [obj for obj in scene.objects if obj.name.startswith(prefix)]
    assert objects, f"missing device group: {prefix}"
    assert abs(world_min_z(objects)) <= 0.001, (
        f"device group is not grounded: {prefix} min_z={world_min_z(objects):.6f}"
    )

assert bpy.data.filepath.endswith("smart_ward_scene_highres_optimized.blend")
print("Smart ward vertical optimization contract passed.")
```

- [x] **Step 2: 在原稿上运行契约确认失败**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres.blend --python-exit-code 1 --python scripts/verify_smart_ward_scene_optimization.py
```

Expected: 非零退出，首个失败原因为缺少 `smart_ward_vertical_scale = 1.12` 元数据。

### Task 2: 实现场景纵向缩放、设备落地与另存

**Files:**
- Create: `scripts/optimize_smart_ward_scene_vertical.py`
- Create: `/Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres_optimized.blend`

**Interfaces:**
- Consumes: 当前已加载的 `smart_ward_scene_highres.blend`。
- Produces: 带 `SmartWardVerticalScale` 根节点和优化元数据的独立 `.blend` 文件。

- [x] **Step 1: 写入最小优化实现**

脚本应实现以下函数和数据流：

```python
VERTICAL_SCALE = 1.12
ROOT_NAME = "SmartWardVerticalScale"
CAMERA_TARGET = Vector((-0.45, 1.05, 1.25 * VERTICAL_SCALE))


def world_min_z(objects):
    return min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )


def create_vertical_root(scene):
    root = bpy.data.objects.new(ROOT_NAME, None)
    scene.collection.objects.link(root)
    for obj in list(scene.objects):
        if obj != root and obj.type != "CAMERA":
            assert obj.parent is None, f"unexpected existing parent: {obj.name}"
            obj.parent = root
    root.scale.z = VERTICAL_SCALE
    bpy.context.view_layer.update()
    return root


def ground_group(scene, root, prefix):
    objects = [obj for obj in scene.objects if obj.name.startswith(prefix)]
    min_z = world_min_z(objects)
    local_shift = -min_z / root.scale.z
    for obj in objects:
        obj.location.z += local_shift
    bpy.context.view_layer.update()


def update_camera(scene):
    camera = scene.camera
    camera.location.z *= VERTICAL_SCALE
    direction = CAMERA_TARGET - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
```

在 `main()` 中按 `create_vertical_root()`、三次 `ground_group()`、`update_camera()`、写入场景元数据、`bpy.ops.wm.save_as_mainfile()` 的顺序执行。输出路径从 Blender `--` 后的 `--output` 参数读取，且必须与当前源文件路径不同。

- [x] **Step 2: 记录原稿校验值并生成优化文件**

Run:

```bash
shasum -a 256 /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres.blend
/Applications/Blender.app/Contents/MacOS/Blender --background /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres.blend --python scripts/optimize_smart_ward_scene_vertical.py -- --output /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres_optimized.blend
```

Expected: Blender 输出保存成功，原稿 SHA-256 值被保留用于最终复核。

- [x] **Step 3: 在优化版上运行契约确认通过**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres_optimized.blend --python-exit-code 1 --python scripts/verify_smart_ward_scene_optimization.py
```

Expected: 输出 `Smart ward vertical optimization contract passed.`，退出码为 0。

### Task 3: 渲染预览并执行视觉与原稿完整性验收

**Files:**
- Create: `docs/superpowers/previews/smart-ward-scene-highres-optimized.png`
- Verify: `/Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres.blend`

**Interfaces:**
- Consumes: Task 2 的优化 `.blend` 文件。
- Produces: 当前相机的 Eevee 验收预览和原稿未修改证明。

- [x] **Step 1: 生成 1280 × 900 Eevee 预览**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres_optimized.blend --python-expr 'import bpy; scene=bpy.context.scene; scene.render.engine="BLENDER_EEVEE"; scene.render.resolution_x=1280; scene.render.resolution_y=900; scene.render.resolution_percentage=100; scene.render.image_settings.file_format="PNG"; scene.render.filepath="/Users/chenjianbin/Projects/3D/digital-twin/docs/superpowers/previews/smart-ward-scene-highres-optimized.png"; bpy.ops.render.render(write_still=True)'
```

Expected: PNG 成功保存，尺寸为 `1280 × 900`。

- [x] **Step 2: 检查预览和像素输出**

使用本地图像查看器确认双床、床头设备、监护仪、共享护理车、地面和天花均可见；使用图像尺寸检查确认图片非空且为 `1280 × 900`。

- [x] **Step 3: 复核原稿未发生变化**

Run:

```bash
shasum -a 256 /Users/chenjianbin/Documents/Codex/2026-07-31/blender/work/smart_ward_scene_highres.blend
```

Expected: SHA-256 与 Task 2 Step 2 保存的值完全一致。
