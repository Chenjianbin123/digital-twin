# 护士站写实实时 3D 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 Blender 重建参考图构图的护士站 GLB，并在现有 Three.js 场景中保留动态电视、真实数据浮标和固定主视角。

**Architecture:** Blender Python 脚本作为护士站模型的唯一可重复生成源，输出现有路径下的 `.blend` 与 `.glb`。Three.js 只负责加载、动态表面替换、灯光补偿和固定视角，Vue 继续负责业务浮标和导航，不改动走廊及病房内部。

**Tech Stack:** Blender 4.x Python API、glTF/GLB、Three.js、Vue 3、TypeScript、Vite。

## Global Constraints

- 仅替换护士站模型和护士站专用渲染参数，不修改病房走廊和病房内部。
- 不使用参考图本身作为背景或纹理。
- 保留 `/models/smart-ward-nurse-station/smart_ward_nurse_station.glb` 加载路径。
- 保留 `/videos/hospital-handwashing-education.mp4` 动态视频。
- 不新增模拟业务数据，不修改真实接口、数据库或权限模型。
- 首版采用固定主视角和有限视差，不实现自由漫游。
- 当前目录不是 Git 仓库；每项任务使用测试和产物备份作为检查点，不能创建提交。

---

## File Structure

- `scripts/rebuild_clean_nurse_station.py`: 重建原创护士站空间、家具、动态屏幕网格、材质、灯光和预览相机，导出 Blend/GLB。
- `scripts/validate_nurse_station_model.py`: 在 Blender 中打开产物并验证空间尺寸、关键物体、动态网格和相机契约。
- `src/core/area-scene.ts`: 将 GLB 动态网格映射到视频/业务纹理，并限定护士站相机、灯光和交互范围。
- `scripts/nurse-station-scene-boundary.test.mjs`: 验证护士站专用组件不影响走廊与病房分支。
- `public/models/smart-ward-nurse-station/smart_ward_nurse_station.blend`: 可编辑 Blender 产物。
- `public/models/smart-ward-nurse-station/smart_ward_nurse_station.glb`: 网页运行时产物。

### Task 1: 建立 Blender 模型契约

**Files:**
- Create: `scripts/validate_nurse_station_model.py`
- Modify: `scripts/rebuild_clean_nurse_station.py`
- Test: `scripts/validate_nurse_station_model.py`

**Interfaces:**
- Consumes: Blender 场景文件 `smart_ward_nurse_station.blend`。
- Produces: 必须存在的对象 `Screen_Main`、`Screen_Work_01..04`、`Clock_Display`、`Reference_Camera`，以及 `Nurse_Counter`、`Corridor_Left`、`Corridor_Right` 三个场景锚点。

- [ ] **Step 1: 写失败的模型契约检查**

```python
required = {
    "Screen_Main", "Screen_Work_01", "Screen_Work_02",
    "Screen_Work_03", "Screen_Work_04", "Clock_Display",
    "Reference_Camera", "Nurse_Counter", "Corridor_Left", "Corridor_Right",
}
missing = sorted(required - set(bpy.data.objects.keys()))
assert not missing, f"missing required objects: {missing}"
```

- [ ] **Step 2: 运行检查并确认旧模型失败**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/smart_ward_nurse_station.blend --python scripts/validate_nurse_station_model.py
```

Expected: FAIL，报告新的动态网格和锚点缺失。

- [ ] **Step 3: 在建模脚本中定义稳定命名和导出元数据**

```python
MAIN_SCREEN = "Screen_Main"
WORK_SCREENS = [f"Screen_Work_{index:02d}" for index in range(1, 5)]
CLOCK_SCREEN = "Clock_Display"
REFERENCE_CAMERA = "Reference_Camera"
```

- [ ] **Step 4: 运行 Blender 重建并确认产物可保存、导出**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/rebuild_clean_nurse_station.py
```

Expected: 退出码 0，`.blend` 和 `.glb` 更新时间发生变化。

### Task 2: 重建参考图空间与弧形护士台

**Files:**
- Modify: `scripts/rebuild_clean_nurse_station.py`
- Test: `scripts/validate_nurse_station_model.py`

**Interfaces:**
- Consumes: Task 1 的对象命名常量和现有 `cube`、`vertical_plane`、`arc_counter_mesh`、`bevel` 辅助函数。
- Produces: 对称室内空间、左右走廊和前景弧形护士台。

- [ ] **Step 1: 扩展契约检查空间构图**

```python
counter = bpy.data.objects["Nurse_Counter"]
assert counter.dimensions.x >= 6.0
left = bpy.data.objects["Corridor_Left"]
right = bpy.data.objects["Corridor_Right"]
assert left.location.x < -3.0 and right.location.x > 3.0
```

- [ ] **Step 2: 用前墙、后墙、模块化吊顶和双侧走廊替换旧展示墙结构**

空间坐标以护士台中心为原点，后墙位于 `y=3.2`，左右走廊中心位于 `x=-5.0` 和 `x=5.0`，天花板高度约 `3.2m`。每侧至少包含三扇带观察窗的病房门、蓝色扶手与纵深灯带。

- [ ] **Step 3: 使用环形网格生成中央护士台**

```python
counter = arc_counter_mesh(
    "Nurse_Counter", center_y=0.55, inner_radius=2.15,
    outer_radius=3.45, z_min=0.08, z_max=0.92,
    material_name="counter", angle_min=-78, angle_max=78, segments=72,
)
```

护士台增加独立台面、前面板、蓝色导视牌和内侧工作区，所有近景边缘使用倒角或平滑法线。

- [ ] **Step 4: 重建并运行模型契约检查**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/rebuild_clean_nurse_station.py
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/smart_ward_nurse_station.blend --python scripts/validate_nurse_station_model.py
```

Expected: 两个命令退出码均为 0。

### Task 3: 完成动态屏幕、室内细节和写实材质

**Files:**
- Modify: `scripts/rebuild_clean_nurse_station.py`
- Test: `scripts/validate_nurse_station_model.py`

**Interfaces:**
- Consumes: Task 2 的建筑空间和护士台。
- Produces: 具备稳定 UV 的中央电视、四台工作显示器、电子时钟和浏览器友好的 PBR 材质。

- [ ] **Step 1: 扩展契约检查动态屏幕类型和 UV**

```python
for name in ["Screen_Main", "Screen_Work_01", "Screen_Work_02", "Screen_Work_03", "Screen_Work_04", "Clock_Display"]:
    screen = bpy.data.objects[name]
    assert screen.type == "MESH"
    assert len(screen.data.uv_layers) > 0
```

- [ ] **Step 2: 建立中央屏幕、工作屏和时钟**

中央屏幕放置在后墙中心，四台工作屏沿护士台内缘排列，时钟放在右侧墙面。屏幕内容只使用独立平面，外框与支架使用独立实体，避免运行时替换整个显示器材质。

- [ ] **Step 3: 增加参考图关键细节**

增加后墙储物柜、文件夹、绿植、打印机、电话、键盘、鼠标、座椅、门牌、观察窗、扶手和护士站导视牌。导视牌只写通用“护士站 / NURSE STATION”，不写业务状态。

- [ ] **Step 4: 调整 PBR 材质与照明**

白色人造石使用中低粗糙度，墙体为高粗糙度哑光，地面保留微弱反射，玻璃使用透明混合，屏幕和灯具使用适度自发光。设置一盏主区域光、两盏走廊补光和屏幕微弱反射光，避免过曝与纯黑区域。

- [ ] **Step 5: 重建并通过完整模型契约**

Run: 与 Task 2 Step 4 相同。

Expected: `nurse station model contract passed`。

### Task 4: 接入 Three.js 动态表面和固定主视角

**Files:**
- Modify: `src/core/area-scene.ts`
- Modify: `scripts/nurse-station-scene-boundary.test.mjs`
- Test: `scripts/nurse-station-scene-boundary.test.mjs`

**Interfaces:**
- Consumes: GLB 中 `Screen_Main`、`Screen_Work_01..04` 和 `Clock_Display`。
- Produces: `NurseStationBoardKind` 新映射、视频纹理、工作看板纹理、时钟纹理和固定相机参数。

- [ ] **Step 1: 更新边界测试并确认旧映射失败**

```js
assert.match(areaSceneSource, /\['education', 'Screen_Main'\]/);
assert.match(areaSceneSource, /\['workLeft', 'Screen_Work_01'\]/);
assert.match(areaSceneSource, /\['clock', 'Clock_Display'\]/);
```

- [ ] **Step 2: 更新运行时动态网格映射**

```ts
const boards: Array<[NurseStationBoardKind, string]> = [
  ['education', 'Screen_Main'],
  ['workLeft', 'Screen_Work_01'],
  ['workRight', 'Screen_Work_02'],
  ['dashboard', 'Screen_Work_03'],
  ['roomStatus', 'Screen_Work_04'],
  ['clock', 'Clock_Display'],
];
```

为 `clock` 增加每秒更新的 `HH:mm:ss` CanvasTexture；视频自动播放失败时将 `Screen_Main` 回退到 `dashboard` 纹理。

- [ ] **Step 3: 更新护士站模型版本和固定相机**

更新 GLB 查询版本，重新校准 `STATION_TARGET_LOCAL`、`STATION_CAM_LOCAL`、`STATION_DESK_FOV` 和 Orbit 限制，使桌面主视角完整展示护士台、大屏和左右走廊，仅允许轻微视差。

- [ ] **Step 4: 运行边界、切换和构建验证**

Run:

```bash
node scripts/nurse-station-scene-boundary.test.mjs
node --experimental-strip-types scripts/scene-transition.test.ts
npm run build
```

Expected: 测试通过，Vite 构建退出码 0。

### Task 5: 浏览器视觉校准与回归验证

**Files:**
- Modify if needed: `scripts/rebuild_clean_nurse_station.py`
- Modify if needed: `src/core/area-scene.ts`
- Modify if needed: `src/components/NurseStationVisualScene.vue`

**Interfaces:**
- Consumes: Task 4 的完整网页场景。
- Produces: 桌面和移动端构图通过的护士站效果。

- [ ] **Step 1: 启动真实项目并进入护士站**

Run:

```bash
npm run dev -- --host 0.0.0.0
```

Expected: Vite 给出可访问地址，选择病区后显示新护士站 GLB。

- [ ] **Step 2: 验证桌面视口**

在 `1440x900` 检查 Canvas 非空、护士台与中央屏幕居中、左右走廊可见、电视正在播放或显示正确回退、浮标不遮挡主屏。

- [ ] **Step 3: 验证移动视口**

在 `390x844` 检查中央护士台与屏幕仍可识别，浮标数量受限，底部导航、病区切换和侧栏不互相遮挡。

- [ ] **Step 4: 验证导航和真实数据**

切换病区后浮标与侧栏数据更新；点击浮标进入正确病房；返回护士站恢复新模型；进入走廊后原走廊模型和交互保持不变。

- [ ] **Step 5: 运行最终检查**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background public/models/smart-ward-nurse-station/smart_ward_nurse_station.blend --python scripts/validate_nurse_station_model.py
node --experimental-strip-types scripts/nurse-station-markers.test.ts
node scripts/nurse-station-scene-boundary.test.mjs
node --experimental-strip-types scripts/scene-transition.test.ts
npm run build
```

Expected: 所有检查退出码 0；仅允许项目既有的 Sass legacy API 和包体积警告。
