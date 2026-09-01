import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

// 新 1-1.glb 的四台工作台适配入口，避免依赖旧模型的独立屏幕命名。
assert.match(areaScene, /resolveNurseStationWorkstationDisplays/);
assert.match(areaScene, /Keyboard_04\.001/);
// GLTFLoader 会将带点的节点名规范化为 Keyboard_04001，必须兼容该运行时名称。
assert.match(areaScene, /Keyboard_04001/);
assert.match(areaScene, /sourceMeshes/);
assert.match(areaScene, /mergedMonitor\.traverse/);
assert.match(areaScene, /Workstation_01/);
assert.match(areaScene, /taskQueue/);
assert.match(areaScene, /wardStatus/);
assert.match(areaScene, /bedMonitor/);
assert.match(areaScene, /deviceHealth/);

// 合并网格必须按显示区域生成独立覆盖层，并保持斜视角下的层级策略。
assert.match(areaScene, /createMergedWorkstationDisplayOverlays/);
assert.match(areaScene, /displayRegion/);
assert.match(areaScene, /renderOrder\s*=\s*10000/);
assert.match(areaScene, /frustumCulled\s*=\s*false/);

// 1-1.glb 的 Workstation_* 是空父节点且共享同一坐标，必须使用每个工作台
// 下的 Keyboard_* 实体作为分区锚点，否则后三台屏幕会被判定为空。
assert.match(areaScene, /workstationAnchors/);
assert.match(areaScene, /Keyboard_\$\{String\(index \+ 1\)\.padStart\(2, '0'\)\}/);
assert.match(areaScene, /anchor!\.getWorldPosition/);

// 合并屏的可见区域包含深蓝底和右侧 UI_Cyan/UI_Blue 装饰；
// 这些材质必须一起参与分区并隐藏，否则模板会缩在中间且静态方块继续露出。
assert.match(areaScene, /深蓝\|UI_Cyan\|UI_Blue/);
assert.match(areaScene, /UI_Blue\|UI_Cyan\|Clock_Red/);

// 主屏 Canvas 使用统一安全边距和裁剪，防止标题/卡片越界重叠。
assert.match(areaScene, /const dashboardPadding/);
assert.match(areaScene, /ctx\.save\(\)/);
assert.match(areaScene, /ctx\.clip\(\)/);
assert.match(areaScene, /patientCardHeight/);

console.log('Nurse-station workstation display boundary checks passed.');
