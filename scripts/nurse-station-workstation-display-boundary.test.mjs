import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const areaScene = await readFile(new URL('../src/core/area-scene.ts', import.meta.url), 'utf8');

// 新 1-1.glb 的四台工作台适配入口，避免依赖旧模型的独立屏幕命名。
assert.match(areaScene, /resolveNurseStationWorkstationDisplays/);
assert.match(areaScene, /Keyboard_04\.001/);
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

// 主屏 Canvas 使用统一安全边距和裁剪，防止标题/卡片越界重叠。
assert.match(areaScene, /const dashboardPadding/);
assert.match(areaScene, /ctx\.save\(\)/);
assert.match(areaScene, /ctx\.clip\(\)/);
assert.match(areaScene, /patientCardHeight/);

console.log('Nurse-station workstation display boundary checks passed.');
