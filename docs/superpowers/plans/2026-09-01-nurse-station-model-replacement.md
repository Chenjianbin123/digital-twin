# 护士站新模型替换与适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将外部提供的 `h-n2-v1.glb` 替换为护士站正式模型，保持现有节点识别、真实接口数据和所有信息展示逻辑不变，并通过版本化 URL 使浏览器加载新资源。

**Architecture:** 新模型覆盖当前正式资源路径 `public/models/smart-ward-nurse-station/1-1.glb`，前端继续从 `src/config/nurse-station-scene.ts` 读取模型 URL，因此无需改动护士站、病房走廊或病房内的业务绑定。新增 GLB 结构边界测试解析文件头和 JSON chunk，校验关键屏幕/工作台节点和材质存在，避免后续导入缺少命名导致信息模板再次失效。

**Tech Stack:** Vue 3、TypeScript、Three.js `GLTFLoader`/`DRACOLoader`、Node.js `node:test`、GLB 2.0 二进制格式。

## Global Constraints

- 只替换护士站模型；病房走廊和病房内场景不改。
- 保留真实接口和当前护士站信息展示内容，不改接口入参、数据类型或业务映射。
- 保留现有护士站相机参数：`target { x: 1.068, y: 0.807, z: 0.369 }`、`initialDistance 5.726`、`initialAngle { azimuthDeg: -82.69, elevationDeg: 2.2 }`、限制开启。
- 新模型正式路径保持为 `public/models/smart-ward-nurse-station/1-1.glb`，不删除可编辑的 `.blend`/`.blend1` 源文件。
- 前端模型 URL 使用版本参数 `/models/smart-ward-nurse-station/1-1.glb?v=20260901-h-n2-v1`。
- 新模型必须保留 `Screen_Main_Frame`、`Clock_Frame`、`Workstation_01`～`Workstation_04`、`Keyboard_01`～`Keyboard_04`、`走廊屏_1` 等运行时适配入口及 `Monitor_Bezel`、`Screen_Glass`、`UI_Blue`、`UI_Cyan`、`Clock_Red` 等材质。

---

### Task 1: 建立新模型来源契约

**Files:**
- Create: `scripts/nurse-station-model-replacement-boundary.test.mjs`

**Interfaces:**
- Consumes: `src/config/nurse-station-scene.ts` 和 `public/models/smart-ward-nurse-station/1-1.glb`
- Produces: 可独立运行的 Node.js 边界测试，验证 URL 版本、GLB 2.0 文件格式、关键节点和材质集合。

- [x] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const config = await readFile(new URL('../src/config/nurse-station-scene.ts', import.meta.url), 'utf8');
const modelPath = new URL('../public/models/smart-ward-nurse-station/1-1.glb', import.meta.url);

assert.match(config, /url:\s*['"]\/models\/smart-ward-nurse-station\/1-1\.glb\?v=20260901-h-n2-v1['"]/);

await access(modelPath);
const model = await readFile(modelPath);
assert.equal(model.subarray(0, 4).toString('ascii'), 'glTF');
assert.equal(model.readUInt32LE(4), 2);
assert.ok(model.length > 50_000_000, `expected h-n2-v1.glb to be the supplied high-detail model, got ${model.length} bytes`);

const jsonLength = model.readUInt32LE(12);
const jsonType = model.readUInt32LE(16);
assert.equal(jsonType, 0x4e4f534a);
const json = JSON.parse(model.subarray(20, 20 + jsonLength).toString('utf8').trim());
const nodeNames = new Set((json.nodes ?? []).map(node => node.name).filter(Boolean));
const materialNames = new Set((json.materials ?? []).map(material => material.name).filter(Boolean));

for (const name of [
  'Screen_Main_Frame',
  'Clock_Frame',
  'Workstation_01',
  'Workstation_02',
  'Workstation_03',
  'Workstation_04',
  'Keyboard_01',
  'Keyboard_02',
  'Keyboard_03',
  'Keyboard_04',
  '走廊屏_1',
])
  assert.ok(nodeNames.has(name), `missing required nurse-station node: ${name}`);

for (const name of ['Monitor_Bezel', 'Screen_Glass', 'UI_Blue', 'UI_Cyan', 'Clock_Red'])
  assert.ok(materialNames.has(name), `missing required nurse-station material: ${name}`);

console.log('Nurse-station model replacement boundary checks passed.');
```

- [x] **Step 2: Run test to verify it fails**

Run: `node scripts/nurse-station-model-replacement-boundary.test.mjs`

Expected: FAIL on the URL assertion because the current configuration still contains `v=20260831-nurse-station-1-1`.

- [x] **Step 3: Keep the test as the regression contract**

No production code is changed in this task; the test remains the executable specification for the supplied model.

### Task 2: Replace the formal nurse-station GLB

**Files:**
- Modify: `public/models/smart-ward-nurse-station/1-1.glb`

**Interfaces:**
- Consumes: `/Users/chenjianbin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_l0lxrc51aw1c21_5462/msg/file/2026-09/h-n2-v1.glb`
- Produces: The same formal URL now serves the new model without changing runtime paths.

- [x] **Step 1: Copy the supplied model into the formal path**

Run:

```bash
cp "/Users/chenjianbin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_l0lxrc51aw1c21_5462/msg/file/2026-09/h-n2-v1.glb" \
  public/models/smart-ward-nurse-station/1-1.glb
```

- [x] **Step 2: Verify the copied asset before changing code**

Run:

```bash
ls -lh public/models/smart-ward-nurse-station/1-1.glb
shasum -a 256 public/models/smart-ward-nurse-station/1-1.glb \
  "/Users/chenjianbin/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_l0lxrc51aw1c21_5462/msg/file/2026-09/h-n2-v1.glb"
```

Expected: matching SHA-256 hashes and a file size close to 59 MB.

### Task 3: Version the runtime URL and update stale source contracts

**Files:**
- Modify: `src/config/nurse-station-scene.ts:64`
- Modify: any tests under `scripts/` that still assert `v=20260831-nurse-station-1-1`

**Interfaces:**
- Consumes: formal model path from Task 2
- Produces: cache-busting URL `/models/smart-ward-nurse-station/1-1.glb?v=20260901-h-n2-v1`; all existing scene mapping remains unchanged.

- [x] **Step 1: Change only the URL version**

```ts
url: "/models/smart-ward-nurse-station/1-1.glb?v=20260901-h-n2-v1",
```

Keep the current `maxSize`, camera, limits, appearance, position, and shell values unless verification demonstrates the supplied model cannot fit.

- [x] **Step 2: Update stale static contracts**

Run:

```bash
rg -l "1-1\\.glb\\?v=20260831-nurse-station-1-1" scripts docs src
```

Replace only the expected nurse-station URL assertions in those test files and any model replacement documentation. Do not alter ward-corridor URLs or unrelated historical plan records.

- [x] **Step 3: Run the focused red-green checks**

Run:

```bash
node scripts/nurse-station-model-replacement-boundary.test.mjs
node scripts/nurse-station-scene-boundary.test.mjs
node scripts/nurse-station-workstation-display-boundary.test.mjs
```

Expected: all three commands exit with code 0 and print their corresponding “boundary tests passed” messages.

### Task 4: Verify build and preserve existing behavior

**Files:**
- No additional source changes expected.

**Interfaces:**
- Consumes: Tasks 1–3
- Produces: verified build and test result; existing real-data display logic remains intact.

- [x] **Step 1: Run TypeScript validation**

Run: `npm run typecheck`

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 2: Run all nurse-station boundary tests**

Run: `node --test scripts/*nurse-station*.test.mjs`

Expected: all matching tests pass.

- [x] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: exit code 0 and a refreshed `dist/` bundle.

- [x] **Step 4: Check patch formatting**

Run: `git diff --check`

Expected: no whitespace errors.

- [x] **Step 5: Report the exact replacement**

Include the final formal model path, the cache-busting URL, the preserved node/material compatibility, and any verification command that did not pass.

Verification note: the focused nurse-station suite (`node --test scripts/*nurse-station*.test.mjs`) passed all 37 tests. The full `npm test` command still reports one pre-existing failure in `scripts/camera-debug-panel-toggle-boundary.test.mjs` because it expects `CAMERA_DEBUG_PANEL_ENABLED = true` while the current component intentionally defines it as `false`; this task does not touch that unrelated toggle.
