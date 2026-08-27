# 新医院走廊模型替换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 `hospital-in.glb` 替换病区走廊静态模型，同时保留六扇门的动态门口屏、状态刷新和病房点击交互。

**Architecture:** 在 `ward-corridor-model.ts` 中集中定义新资产 URL、坐标归一化和六门识别/排序适配；`area-scene.ts` 负责加载适配后的模型、创建动态屏挂载面并把门绑定到现有房间数据。旧生成式走廊作为 GLB 加载失败时的回退。

**Tech Stack:** Vue 3, TypeScript, Three.js `GLTFLoader`, Vitest-compatible project tests, Vite.

## Global Constraints

- 新 GLB 使用 Blender Z-up，加载后绕 X 轴旋转 `-PI/2` 转为 Three.js Y-up。
- 只绑定新模型现有六扇门：`门1`、`门2`、`门2.001`、`门3`、`门4`、`门5`。
- 动态门口屏继续使用现有 `renderDoorTerminalTexture` 与模板缓存。
- 新 GLB 加载失败时必须显示现有生成式走廊回退。
- 不修改护士站模型、病房内部模型或后端接口。

---

### Task 1: Add the new corridor asset

**Files:**
- Create: `public/models/hospital-corridor/hospital-in.glb`

**Steps:**

- [x] Create the destination directory and copy the supplied GLB without recompression or conversion.
- [x] Verify the copied file is a glTF 2.0 binary and has the same SHA-256 as the supplied source.

Run:

```bash
mkdir -p public/models/hospital-corridor
cp "/Users/chenjianbin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_l0lxrc51aw1c21_5462/msg/file/2026-08/hospital-in.glb" public/models/hospital-corridor/hospital-in.glb
file public/models/hospital-corridor/hospital-in.glb
shasum -a 256 public/models/hospital-corridor/hospital-in.glb
```

Expected: `glTF binary model, version 2` and checksum `96c6f7555f306db0e3f0a7a8bd35abc8b71dfe582b3a439db8f236e32f04cd25`.

### Task 2: Add pure model-adapter behavior and tests

**Files:**
- Modify: `src/core/ward-corridor-model.ts`
- Test: `src/core/ward-corridor-model.test.ts`

**Interfaces:**
- Produce `WARD_CORRIDOR_MODEL_URL` with the new public path.
- Produce `WARD_CORRIDOR_MODEL_NODE_NAMES` as a readonly six-name tuple.
- Produce `normalizeWardCorridorModelTransform(root, bounds)` that rotates Z-up to Y-up, centers X/Z, and moves the minimum Y to zero.
- Produce `getHospitalCorridorDoorOrder(nodes)` that filters the six exact names and sorts by transformed longitudinal position, with stable name tie-breaking.

- [x] Write tests covering exact six-name filtering, longitudinal ordering, missing names, and transform output using a `THREE.Group` with known bounds.
- [x] Run the focused Node test and confirm the new tests fail before implementation.
- [x] Implement the constants and pure functions without touching scene state.
- [x] Run the focused test again and confirm it passes.

### Task 3: Replace corridor loading and bind dynamic overlays

**Files:**
- Modify: `src/core/area-scene.ts`
- Modify: `src/core/ward-corridor-camera.ts`

**Interfaces:**
- `AreaScene.loadWardCorridorModel()` consumes the new URL and adapter functions.
- The loaded model exposes each selected door with `userData.roomIndex` and `userData.role='wardCorridorDoor'`.
- Six `WardCorridorModelBinding` records expose door mesh, generated screen surface, label surface, and screen texture.

- [x] Reset the loaded model transform with the adapter and align its normalized bounds with the existing corridor Z axis.
- [x] Replace the old `Room NN` node traversal with six-door discovery; missing doors log a warning and do not abort loading.
- [x] For each door create a thin `PlaneGeometry` overlay above the door, orient it toward the corridor center, and apply the existing canvas texture.
- [x] Create a compact label surface beside the screen using the existing label texture helper.
- [x] Bind only room indexes `0..5`; keep the new GLB active when extra room data exists.
- [x] Preserve `onRoomClick` through `wardCorridorDoor` user data and guard unsupported extra slots.
- [x] Use normalized model bounds for the corridor overview camera.
- [x] Preserve `wardCorridorModelFailed` fallback and disposal paths.

### Task 4: Add regression coverage for six-door binding

**Files:**
- Modify: `src/core/ward-corridor-model.test.ts`
- Modify: `src/core/ward-corridor-camera.test.ts`

**Steps:**

- [x] Add a regression test proving room data beyond six remains supported while bindings stay capped at six.
- [x] Run focused corridor and camera tests.

### Task 5: Verify application behavior

**Files:**
- No source changes expected.

**Steps:**

- [x] Run `npm run build`.
- [x] Start the local Vite server on `http://127.0.0.1:5177/`.
- [x] Open the application in the browser; the page loaded successfully but account authentication prevented entering the corridor view.
- [x] Verify the built static asset exists in `dist/models/hospital-corridor/` with the source checksum; record the login-gated browser limitation.
