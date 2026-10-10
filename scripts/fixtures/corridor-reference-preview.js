// Development-only fixture: use the production loader, binding and template path.
// Never loads real patients or sends requests to the hospital backend.
import * as THREE from 'three';
import { wardCorridorSceneConfig as config } from '/src/config/ward-corridor-scene.ts';
import { normalizeDoorDevice } from '/src/api/normalize-door.ts';
import { mapDoorListToTwinArea } from '/src/types/twin.ts';
import { clearTemplateCache } from '/src/core/template/template-cache.ts';

const status = document.querySelector('#status');
const nativeFetch = window.fetch.bind(window);
const modes = { portrait: 9001, landscape: 9002, failed: 9003, missing: 0 };
const makeTemplate = horizontal => ({
  isNew: true, width: horizontal ? 1920 : 1080, height: horizontal ? 1080 : 1920,
  background: '#11304b',
  data: [
    { type: 'element', text: 'TOP · 左 L  →  右 R', left: 4, top: 3, width: 92, height: 8, background: '#13627a', color: '#ffffff', fontSize: 1.1 },
    { type: 'text', id: 'roomNum', left: 6, top: 17, width: 88, height: 15, color: '#ffffff', fontSize: 2.2, fontWeight: '700' },
    { type: 'text', text: '门口屏模板渲染验证', left: 6, top: 34, width: 88, height: 10, color: '#8bdded', fontSize: 1.1 },
    { type: 'element', text: '01 床   待入住', left: 6, top: 48, width: 88, height: 12, background: '#204664', color: '#ffffff', fontSize: 1.2 },
    { type: 'element', text: '02 床   待入住', left: 6, top: 63, width: 88, height: 12, background: '#204664', color: '#ffffff', fontSize: 1.2 },
    { type: 'element', text: 'BOTTOM · 合成验收数据', left: 4, top: 88, width: 92, height: 8, background: '#13627a', color: '#ffffff', fontSize: .9 },
  ],
});
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url, location.href);
  if (url.pathname.endsWith('/querySwpTemplateInfoById')) {
    const id = Number(JSON.parse(init?.body || '{}').id);
    if (id === modes.failed) return new Response(JSON.stringify({ code: 503, message: '验收用失败状态' }), { status: 503 });
    return Response.json({ code: 200, data: { id, analyzeType: '2', templateContent: JSON.stringify(makeTemplate(id === modes.landscape)) } });
  }
  if (/\/(?:swp|db-adapter)\//.test(url.pathname) || url.origin !== location.origin)
    throw new Error('独立模型预览禁止访问医院接口');
  return nativeFetch(input, init);
};

// Default follows the production configuration. v1 is retained for like-for-like comparisons.
if (new URLSearchParams(location.search).get('model') === 'v1') {
  config.model.url = '/models/hospital-corridor/corridor-reference-v1.glb';
  config.model.layout = undefined;
  config.appearance.exposure = 1.2;
  config.appearance.environmentIntensity = .36;
}
let scene, area, dark = false, empty = false, timer;

function updateStatus() {
  if (!scene) return;
  const bound = scene.wardCorridorBindings.filter(b => b.slot.interactive);
  const ready = bound.filter(b => b.screenReady).length;
  status.textContent = `模型：${window.corridorPreview.state} · 绑定 ${bound.length}/10 · 模板就绪 ${ready}/${bound.length} · 仅验收数据`;
}

function showScreen(slot) {
  const binding = scene.wardCorridorBindings.find(b => b.slot.deviceNode === `门口机${slot}`);
  if (!binding?.screen) { status.textContent = '当前没有绑定房间，请先恢复房间。'; return; }
  scene.setActive(false);
  const target = new THREE.Box3().setFromObject(binding.screen).getCenter(new THREE.Vector3());
  scene.camera.position.copy(target).add(new THREE.Vector3(target.x < 0 ? 1.25 : -1.25, .05, .13));
  scene.camera.lookAt(target);
  scene.camera.updateMatrixWorld();
  scene.renderer.render(scene.scene, scene.camera);
}

function overview() {
  scene.setActive(true);
  scene.resetToNurseStationView();
}

function readScreenPixel(slot) {
  const binding = scene.wardCorridorBindings.find(b => b.slot.deviceNode === `门口机${slot}`);
  const box = new THREE.Box3().setFromObject(binding.screen);
  const sample = box.getCenter(new THREE.Vector3());
  sample.y = box.min.y + (box.max.y-box.min.y)*.18;
  sample.project(scene.camera);
  const size = scene.renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y);
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const oldTarget = scene.renderer.getRenderTarget();
  const pixel = new Uint8Array(4);
  try {
    scene.renderer.setRenderTarget(target);
    scene.renderer.render(scene.scene, scene.camera);
    scene.renderer.readRenderTargetPixels(target, Math.floor((sample.x+1)*size.x/2), Math.floor((sample.y+1)*size.y/2), 1, 1, pixel);
    return [...pixel];
  } finally {
    scene.renderer.setRenderTarget(oldTarget);
    target.dispose();
  }
}

try {
  // Import after overriding config so AreaScene's model URL constant is correct.
  const { AreaScene } = await import('/src/core/area-scene.ts');
  area = mapDoorListToTwinArea(Array.from({ length: 10 }, (_, i) => normalizeDoorDevice({
    doorDeviceInfo: { sickroomId: `preview-${i+1}`, sickroomCode: String(301+i), sickroomName: `${301+i} 病房`, deviceCode: `PREVIEW-${i+1}`, templateId: modes.portrait, director: '1', areaName: '模型验收病区', isOnline: '1' },
    bedDeviceList: [],
  })));
  window.corridorPreview = { state: 'loading', get scene() { return scene; }, get area() { return area; }, showScreen, overview, readScreenPixel };
  scene = new AreaScene({ container: document.querySelector('#scene'), modelKind: 'corridor', areaId: 999999,
    onCorridorState: state => { window.corridorPreview.state = state; updateStatus(); } });
  scene.setTheme('light');
  scene.updateArea(area);
  document.querySelector('#overview').onclick = overview;
  document.querySelector('#left').onclick = () => showScreen(1);
  document.querySelector('#right').onclick = () => showScreen(6);
  document.querySelector('#template').onchange = event => {
    clearTemplateCache();
    area = { ...area, rooms: area.rooms.map(room => ({ ...room, templateId: modes[event.target.value] || undefined })) };
    scene.setActive(true);
    scene.updateArea(empty ? { ...area, rooms: [] } : area);
  };
  document.querySelector('#reverse').onclick = () => {
    area = { ...area, rooms: [...area.rooms].reverse() };
    scene.setActive(true);
    scene.updateArea(empty ? { ...area, rooms: [] } : area);
  };
  document.querySelector('#empty').onclick = () => {
    empty = !empty;
    scene.setActive(true);
    scene.updateArea(empty ? { ...area, rooms: [] } : area);
  };
  document.querySelector('#theme').onclick = () => { dark = !dark; scene.setTheme(dark ? 'dark' : 'light'); scene.renderer.render(scene.scene, scene.camera); };
  timer = setInterval(updateStatus, 500);
} catch (error) {
  status.textContent = `预览加载失败：${error.message}。修复后刷新重试。`;
  console.error(error);
}
window.addEventListener('pagehide', () => { clearInterval(timer); scene?.dispose(); window.fetch = nativeFetch; }, { once: true });
