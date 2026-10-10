import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as vue from 'vue';
import ts from 'typescript';

// 执行真实 SFC 的监听与生命周期；仅替换 WebGL 渲染器，不依赖 GPU 或医院数据。
const calls = [];
class Scene {
  focusRoom(index) { calls.push(index); }
  setTheme() {} updateArea() {} syncAreaData() {} setNurseStationViewModel() {}
  setViewPhase() {} setActive() {} refreshLayout() {} resetToNurseStationView() {} dispose() {}
}
const source = await readFile(new URL('../src/components/AreaScene3D.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'corridor-focus-test', inlineTemplate: true });
const compiled = ts.transpileModule(script.content.replaceAll('import.meta.env.DEV', 'false'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => {
  if (name === 'vue') return vue;
  if (name === '@/core/area-scene') return { AreaScene: Scene };
  if (name === '@/core/area-scene-identity') return { buildAreaStructureSignature: area => area.areaCode };
  if (name === '@/types/twin') return { twinSceneToAreaPhase: type => type === 'ward' ? 'corridor' : 'station' };
  if (name === './WardCorridorToolbar.vue') return { default: { render: () => null } };
  throw new Error(`Unexpected import: ${name}`);
}, module, module.exports);

const host = () => ({ children: [], parent: null, clientWidth: 800, clientHeight: 600 });
const renderer = vue.createRenderer({
  createElement: host, createText: host, createComment: host,
  insert(child, parent) { child.parent = parent; parent.children.push(child); },
  remove(child) { if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child); },
  setText() {}, setElementText() {}, patchProp() {},
  parentNode: node => node.parent, nextSibling: () => null,
});
const originalFrame = globalThis.requestAnimationFrame, originalObserver = globalThis.ResizeObserver;
globalThis.requestAnimationFrame = callback => { callback(); return 0; };
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
const props = vue.reactive({ area: { areaCode: 'TEST', areaName: '', deptName: '', rooms: [] },
  areaId: 1, focusedRoomIndex: 0, focusRequestKey: 0, sceneType: 'ward', active: true });
const app = renderer.createApp({ render: () => vue.h(module.exports.default, props) });
try {
  app.mount(host());
  await vue.nextTick(); await vue.nextTick(); await vue.nextTick();
  await test('repeated focus requests reach the camera even when room index stays unchanged', async () => {
    calls.length = 0;
    props.focusRequestKey++;
    await vue.nextTick();
    props.focusRequestKey++;
    await vue.nextTick();
    assert.deepEqual(calls, [0, 0]);
    props.focusedRoomIndex = 1;
    props.focusRequestKey++;
    await vue.nextTick();
    assert.deepEqual(calls, [0, 0, 1]);
  });
  await test('inactive scenes and invalid selections cannot move the camera', async () => {
    props.active = false; await vue.nextTick(); calls.length = 0;
    props.focusRequestKey++; await vue.nextTick();
    assert.deepEqual(calls, []);
    props.focusedRoomIndex = -1; props.active = true; await vue.nextTick();
    props.focusRequestKey++; await vue.nextTick();
    assert.deepEqual(calls, []);
  });
} finally {
  app.unmount();
  globalThis.requestAnimationFrame = originalFrame;
  globalThis.ResizeObserver = originalObserver;
}
