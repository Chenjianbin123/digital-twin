# Nurse Station Corridor and Information Wall Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将护士站后方改为左右纵深病房走廊，并建立中央电视、左侧护理白板和右侧患者状态看板三块独立信息面。

**Architecture:** `scripts/render_high_fidelity_nurse_station.py` 继续作为 Blender 场景的唯一生成源，负责空间、家具、材质、灯光和渲染。`scripts/validate_high_fidelity_nurse_station.py` 先锁定对象命名和走廊契约，再生成 `.blend`、预览图和 4K PNG/WebP；前端代码不变。

**Tech Stack:** Blender 5.1 Python API、Cycles、Python assertion、PNG、WebP。

## Global Constraints

- 只修改 Blender 建模脚本、模型验证器、模型源文件和渲染图片。
- 不修改 Vue、Three.js、接口、病区切换、运行时病房走廊或病房内部。
- 不把真实患者信息写入模型或纹理。
- 保留 `Reference_Camera`、`Screen_Main`、`Corridor_Left` 和 `Corridor_Right`。
- 左右各至少三扇沿纵深排列的病房门。
- 删除全部 `Corridor_Front_Door_*` 平铺门对象。
- 新增独立网格 `Board_Nursing` 与 `Board_Patient_Status`。
- 正式渲染固定为 `3840x2160`、256 samples；预览为 `1920x1080`、32 samples。
- 当前目录不是 Git 仓库，使用测试和可重复产物作为检查点。

---

### Task 1: 扩展模型契约

**Files:**
- Modify: `scripts/validate_high_fidelity_nurse_station.py`
- Test: `scripts/validate_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`。
- Produces: 三块信息面、双侧病房门和无平铺门的验证契约。

- [ ] **Step 1: 写失败的模型契约**

```python
for board_name in ("Screen_Main", "Board_Nursing", "Board_Patient_Status"):
    board = bpy.data.objects.get(board_name)
    assert board is not None, f"missing information surface: {board_name}"
    assert board.type == "MESH", f"information surface must be mesh: {board_name}"

for side in ("Left", "Right"):
    doors = [obj for obj in bpy.data.objects if obj.name.startswith(f"Ward_Door_{side}_")]
    assert len(doors) >= 3, f"missing corridor doors on {side}: {len(doors)}"

flat_doors = [obj.name for obj in bpy.data.objects if obj.name.startswith("Corridor_Front_Door_")]
assert not flat_doors, f"flat rear-wall doors remain: {flat_doors}"
```

- [ ] **Step 2: 运行现有模型并确认失败原因正确**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: FAIL，首先报告缺少 `Board_Nursing` 或仍存在 `Corridor_Front_Door_*`。

### Task 2: 重构双侧纵深走廊与信息墙

**Files:**
- Modify: `scripts/render_high_fidelity_nurse_station.py`
- Test: `scripts/validate_high_fidelity_nurse_station.py`

**Interfaces:**
- Consumes: Task 1 的对象命名契约和现有 `cube`、`cylinder`、`add_text`、`add_area_light` 辅助函数。
- Produces: `build_corridor_wing(side, materials)`、`add_information_board(...)` 和新的 `build_command_wall(materials)`。

- [ ] **Step 1: 删除平铺后墙门生成循环**

移除 `build_architecture()` 中创建 `Corridor_Front_Door_*`、`Corridor_Front_Frame_*`、`Corridor_Front_Door_Face_*`、`Corridor_Front_Window_*` 和 `Corridor_Front_Sign_*` 的循环。

- [ ] **Step 2: 建立真实纵深走廊翼**

```python
def build_corridor_wing(side, materials):
    direction = -1 if side == "Left" else 1
    wall_x = direction * 4.25
    cube(f"Corridor_Inner_Wall_{side}", (wall_x, 4.2, 1.65), (0.16, 6.2, 3.3), materials["wall"])
    for index, y in enumerate((1.15, 3.15, 5.05), start=1):
        add_corridor_door(side, index, wall_x, y, materials)
    cube(f"Corridor_Rail_{side}", (wall_x - direction * 0.11, 3.25, 0.90), (0.13, 5.8, 0.15), materials["trim"], bevel=0.055)
```

`add_corridor_door()` 将门板、门框、观察窗、把手和门牌放在同一侧墙面，左右使用相反法线偏移。远端门依靠真实相机透视自然缩小，不使用手工缩放。

- [ ] **Step 3: 建立三块独立信息面**

```python
def add_information_board(name, x, size, frame_material, face_material):
    width, height = size
    cube(f"{name}_Frame", (x, 5.65, 2.18), (width + 0.16, 0.16, height + 0.16), frame_material, bevel=0.055)
    return cube(name, (x, 5.545, 2.18), (width, 0.035, height), face_material, bevel=0.025)

add_information_board("Board_Nursing", -2.95, (1.72, 1.22), materials["metal"], materials["whiteboard"])
add_information_board("Screen_Main", 0.0, (2.75, 1.34), materials["monitor"], materials["screen"])
add_information_board("Board_Patient_Status", 2.95, (1.72, 1.22), materials["monitor"], materials["dashboard"])
```

- [ ] **Step 4: 增加脱敏白板和状态看板内容**

护理白板仅使用 `101`、`102`、`103` 等床位编号、护理等级色条和交班时间；患者状态看板仅使用房间编号、圆点状态和待处理数量。内容由几何色块与通用文本组成，不包含姓名、诊断或住院号。

- [ ] **Step 5: 重排柜体、文件夹和绿植**

三块信息面下方使用连续柜体，绿植和文件夹分别放在白板与中央电视之间、中央电视与状态看板之间。所有柜体和摆件保持在前景工作显示器上方或间隙中可见。

- [ ] **Step 6: 增加走廊补光并生成 build-only 场景**

左右走廊各增加一盏 Area Light，能量约 `110W`、色温视觉为中性冷白，目标指向远端第二和第三扇门。

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_high_fidelity_nurse_station.py -- --build-only
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend --python scripts/validate_high_fidelity_nurse_station.py
```

Expected: 两个命令退出码为 0，验证器输出 `High-fidelity nurse station contract passed.`。

### Task 3: 预览校准与正式渲染

**Files:**
- Modify only if preview exposes a composition defect: `scripts/render_high_fidelity_nurse_station.py`
- Regenerate: `public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend`
- Regenerate: `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png`
- Regenerate: `public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp`

**Interfaces:**
- Consumes: Task 2 通过契约的完整 Blender 场景。
- Produces: 预览校准后的 4K PNG/WebP 和最终 `.blend`。

- [ ] **Step 1: 生成快速预览**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_high_fidelity_nurse_station.py -- --preview
```

Expected: 输出 `1920x1080` 预览，左右各三扇门沿纵深可辨，三块信息面没有被完全遮挡。

- [ ] **Step 2: 检查并修正构图**

使用本地图片检查确认：病房门不平铺、走廊入口完整、中央电视最大、左右看板层级明确、前景四台显示器不遮挡全部信息内容。若任一条件失败，只调整相机位置、信息面高度、走廊墙位置或灯光强度后重新生成预览。

- [ ] **Step 3: 生成 4K 正式渲染**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/render_high_fidelity_nurse_station.py
```

Expected: PNG 与 WebP 均为 `3840x2160`，模型源文件保存成功。

- [ ] **Step 4: 运行最终验证**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/high_fidelity_nurse_station.blend --python scripts/validate_high_fidelity_nurse_station.py
node scripts/nurse-station-scene-boundary.test.mjs
npm run build
sips -g pixelWidth -g pixelHeight public/images/smart-ward-nurse-station/nurse_station_high_fidelity.png public/images/smart-ward-nurse-station/nurse_station_high_fidelity.webp
```

Expected: 模型契约、护士站边界和生产构建通过，PNG 与 WebP 均报告 `3840x2160`。
