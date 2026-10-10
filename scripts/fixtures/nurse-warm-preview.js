// Standalone synthetic acceptance: no app, store, authentication or hospital API imports.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createWarmStationTheme, createWarmStationLights, applyWarmStationLighting,
  prepareWarmStationShadows, WARM_STATION_APPEARANCE } from '/src/core/warm-nurse-station-theme.ts';

const version = new URLSearchParams(location.search).get('model') ?? 'v3';
const names = ['Screen_Main', 'Clock_Display', ...Array.from({ length: 4 }, (_, i) => `Screen_Work_0${i + 1}`),
  ...Array.from({ length: 7 }, (_, i) => `DoorScreen_${301 + i}`)];
const host = document.querySelector('#scene'), status = document.querySelector('#status');
const button = id => document.getElementById(id);
const resources = { geometry: new Set(), material: new Set(), texture: new Set() };
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(42, 1, .025, 90);
const bindings = [], lights = [], metrics = {};
const applyWarmTheme = createWarmStationTheme();
let renderer, controls, decoder, observer, environment, manifest, model, warmLighting, sidebar;
let disposed = false, frame = 0, activeView = 'front', dark = false, bound = false, selected = 0, nextScreen = 0;
const preview = window.nurseWarmPreview = { ready: false, version, scene, camera, bindings, metrics,
  setView, setTheme, setBinding, updateScreen, inspectScreen, measure };

function collect(root) {
  root.traverse(object => {
    if (!object.isMesh) return;
    resources.geometry.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.material.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.texture.add(value);
    }
  });
}
function release() {
  for (const set of Object.values(resources)) { set.forEach(value => value.dispose()); set.clear(); }
}
function render() { if (!disposed && renderer) renderer.render(scene, camera); }
function invalidate() {
  if (disposed || frame || !renderer) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}
function resize() {
  if (disposed || !renderer) return;
  camera.aspect = Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight);
  const referenceAspect = manifest ? manifest.referenceSize[0] / manifest.referenceSize[1] : 480 / 324;
  const referenceFov = activeView === 'front' && manifest
    ? THREE.MathUtils.radToDeg(2 * Math.atan(36 / (2 * manifest.camera.lens * referenceAspect))) : 42;
  camera.fov = Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(
    Math.tan(THREE.MathUtils.degToRad(referenceFov) / 2) * Math.max(1, referenceAspect / camera.aspect))));
  camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight, false); invalidate();
}
function setView(view) {
  if (!manifest || !controls) return;
  activeView = view;
  camera.position.fromArray(view === 'front' ? manifest.camera.position : [-3.4, 1.65, 2.9]);
  controls.target.fromArray(view === 'front' ? manifest.camera.target : [-.65, .85, -.15]);
  controls.update(); resize();
  for (const name of ['front', 'detail']) button(name).setAttribute('aria-pressed', String(name === view));
}
function setTheme(value) {
  dark = value === 'dark'; document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const appearance = version === 'v3' ? WARM_STATION_APPEARANCE[dark ? 'dark' : 'light'] : {
    background: dark ? '#172733' : '#d3dee2', environmentIntensity: dark ? .22 : .46, exposure: dark ? .73 : 1.03,
  };
  scene.background = new THREE.Color(appearance.background);
  scene.environmentIntensity = appearance.environmentIntensity;
  if (renderer) renderer.toneMappingExposure = appearance.exposure;
  if (version === 'v3') {
    applyWarmTheme(model, dark);
    if (warmLighting) applyWarmStationLighting(warmLighting, dark);
  } else lights.forEach(light => { light.intensity = light.userData.baseIntensity * (dark ? .55 : 1); });
  sidebar?.setTheme(dark ? 'dark' : 'light');
  bindings.forEach(drawScreen);
  button('theme').setAttribute('aria-pressed', String(dark));
  button('theme').textContent = dark ? '浅色模式' : '深色模式'; invalidate();
}
async function toggleSidebar() {
  const sideHost = button('theme-sidebar'), toggle = button('sidebar');
  const show = sideHost.hidden;
  toggle.disabled = true;
  try {
    if (show && !sidebar) {
      const { mountWarmSidebar } = await import('./nurse-warm-sidebar.js');
      if (disposed) return;
      sidebar = mountWarmSidebar(sideHost, dark ? 'dark' : 'light');
    }
    sideHost.hidden = !show;
    document.querySelector('.warm-preview-stage').classList.toggle('with-sidebar', show);
    toggle.setAttribute('aria-pressed', String(show));
    toggle.textContent = show ? '隐藏项目侧边栏' : '显示项目侧边栏';
    resize();
  } catch (error) {
    status.textContent = `侧边栏加载失败：${error.message}，请重新加载预览`;
    button('retry').hidden = false;
  } finally { toggle.disabled = false; }
}
function drawScreen(binding) {
  const { canvas, texture, index, revision } = binding, ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = dark ? '#102d3d' : '#e7f3f7'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = dark ? '#dcf1f5' : '#173f50'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(w * .06)}px system-ui`; ctx.fillText('DEMO', w / 2, h * .24);
  ctx.font = `${Math.round(w * .044)}px system-ui`; ctx.fillText(names[index], w / 2, h * .47);
  ctx.fillText(`TEST ${index + 1} / UPDATE ${revision}`, w / 2, h * .66);
  ctx.fillText('SYNTHETIC / NOT LIVE', w / 2, h * .86);
  ctx.fillStyle = revision % 2 ? '#d59836' : '#316881';
  ctx.fillRect(w * .10, h * .73, w * .12, h * .07);
  for (const [x, y, color] of [[0, 0, '#e97943'], [w - 24, 0, '#489dde'], [0, h - 24, '#a889d7'], [w - 24, h - 24, '#59b779']]) {
    ctx.fillStyle = color; ctx.fillRect(x, y, 24, 24);
  }
  texture.needsUpdate = true;
}
function setBinding(value) {
  bound = Boolean(value);
  bindings.forEach(binding => { binding.mesh.material = bound ? binding.material : binding.original; });
  button('binding').setAttribute('aria-pressed', String(bound));
  button('binding').textContent = bound ? '还原模型屏幕' : '绑定合成屏幕';
  status.textContent = bound ? '13 个屏幕已独立绑定合成 DEMO · 不涉及生产模板或真实接口' : '显示 GLB 自带的合成屏幕画面';
  invalidate();
}
function updateScreen(index = selected) {
  const binding = bindings[index];
  if (!binding) return;
  if (!bound) setBinding(true);
  binding.revision++; drawScreen(binding);
  status.textContent = `仅更新 ${names[index]} · 次数 ${binding.revision} · 其余 12 个纹理保持不变`; invalidate();
}
function inspectScreen(index = nextScreen) {
  const binding = bindings[index];
  if (!binding) return;
  selected = index; nextScreen = (index + 1) % bindings.length; activeView = 'screen';
  const mesh = binding.mesh, center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  const normal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'), 0)
    .applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  camera.position.copy(center).addScaledVector(normal, Math.max(size.x, size.y, size.z) * 1.6);
  controls.target.copy(center); controls.update(); resize();
  for (const id of ['front', 'detail']) button(id).setAttribute('aria-pressed', 'false');
  status.textContent = `${names[index]} · ${index + 1}/13 · 四角颜色用于检查上下与镜像方向`;
}
async function measure() {
  if (!preview.ready || button('measure').disabled) return;
  button('measure').disabled = true;
  try {
    const intervals = []; let last;
    for (let i = 0; i <= 60 && !disposed; i++) {
      const now = await new Promise(resolve => requestAnimationFrame(resolve));
      if (disposed) return;
      render(); if (last !== undefined) intervals.push(now - last); last = now;
    }
    intervals.sort((a, b) => a - b);
    Object.assign(metrics, { frameMedianMs: intervals[Math.floor(intervals.length / 2)],
      frameP95Ms: intervals[Math.floor(intervals.length * .95)], ...renderer.info.render,
      textures: renderer.info.memory.textures, geometries: renderer.info.memory.geometries });
    button('metrics').textContent = `加载 ${metrics.loadMs.toFixed(0)} ms · 就绪 ${metrics.readyMs.toFixed(0)} ms · ${metrics.calls} 次绘制 · ${metrics.triangles} 三角形 · 帧间隔中位 ${metrics.frameMedianMs.toFixed(1)} / P95 ${metrics.frameP95Ms.toFixed(1)} ms（本机浏览器，非 GPU 耗时）`;
    return { ...metrics };
  } finally { button('measure').disabled = false; }
}
async function initialize() {
  if (!['v1', 'v2', 'v3'].includes(version)) throw Error('model 仅支持 v1、v2、v3');
  button('title').textContent = `暖色护士站 ${version.toUpperCase()} · 独立模型验收`;
  const response = await fetch(`/output/nurse-station-warm-${version}/manifest.json`);
  if (!response.ok) throw Error(`模型机位清单加载失败 (${response.status})`);
  manifest = await response.json();
  if (disposed) return;
  if (![manifest.camera?.position, manifest.camera?.target].every(value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite))
      || !Number.isFinite(manifest.camera?.lens) || manifest.camera.lens <= 0
      || !Array.isArray(manifest.referenceSize) || manifest.referenceSize.length !== 2 || !manifest.referenceSize.every(value => Number.isFinite(value) && value > 0)) throw Error('模型机位清单格式无效');
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Single-sample cached contact shadows retain depth without the measured PCF cost on integrated GPUs.
  renderer.shadowMap.enabled = version === 'v3'; renderer.shadowMap.type = THREE.BasicShadowMap;
  host.append(renderer.domElement); renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '三维模型，拖动旋转、滚轮缩放、方向键平移');
  controls = new OrbitControls(camera, renderer.domElement); controls.listenToKeyEvents(renderer.domElement);
  controls.minDistance = .10; controls.maxDistance = 40; controls.addEventListener('change', invalidate);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  environment = pmrem.fromScene(room, .04); scene.environment = environment.texture; room.dispose(); pmrem.dispose();
  RectAreaLightUniformsLib.init();
  if (version === 'v3') {
    warmLighting = createWarmStationLights(); scene.add(warmLighting);
  } else {
    lights.push(new THREE.HemisphereLight(0xe4eff5, 0x888177, .65));
    for (const [position, target, intensity, width, height] of [
      [[-2, 2.8, 3], [0, 1, -2], 3, 5.5, 2.4], [[-5.35, 2.2, -1.5], [0, 1, -3], 3, 2.6, 2],
      [[0, 3.03, -1.7], [0, 0, -1.7], 2.4, 4, 1], [[-4.3, 2, -21.7], [-4.3, 1, -10], 3, 2.55, 2.1],
    ]) { const light = new THREE.RectAreaLight(0xf8f7ef, intensity, width, height); light.position.fromArray(position); light.lookAt(...target); lights.push(light); }
    lights.forEach(light => { light.userData.baseIntensity = light.intensity; scene.add(light); });
  }
  setTheme('light'); observer = new ResizeObserver(resize); observer.observe(host); setView('front');
  decoder = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
  const started = performance.now();
  model = (await new GLTFLoader().setDRACOLoader(decoder).loadAsync(`/models/smart-ward-nurse-station/nurse-station-warm-${version}.glb`)).scene;
  metrics.loadMs = performance.now() - started; collect(model);
  if (disposed) { release(); return; }
  if (!model.getObjectByName(`NurseStationWarmV${version.slice(1)}`)) throw Error('加载的模型版本与 URL 不一致');
  if (version === 'v3') prepareWarmStationShadows(model);
  setTheme(new URLSearchParams(location.search).get('theme') === 'dark' ? 'dark' : 'light');
  model.updateMatrixWorld(true);
  for (const [index, name] of names.entries()) {
    const mesh = model.getObjectByName(name);
    if (!mesh?.isMesh || Array.isArray(mesh.material)) throw Error(`缺少独立屏幕 ${name}`);
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = name.startsWith('Door') ? 768 : name === 'Clock_Display' ? 180 : 288;
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
    resources.texture.add(texture); resources.material.add(material);
    const binding = { mesh, original: mesh.material, material, canvas, texture, index, revision: 0 };
    bindings.push(binding); drawScreen(binding);
  }
  scene.add(model);
  warmLighting?.traverse(object => { if (object.isLight && object.shadow) object.shadow.needsUpdate = true; });
  await renderer.compileAsync(scene, camera);
  if (disposed) return;
  render(); metrics.readyMs = performance.now() - started;
  Object.assign(preview, { ready: true, renderer, controls, model, manifest }); host.setAttribute('aria-busy', 'false');
  document.querySelectorAll('nav button').forEach(node => { node.disabled = false; });
  status.textContent = `模型 ${version} 已加载 · 13 个独立屏幕待验收 · 非实时数据`;
  if (new URLSearchParams(location.search).has('presentation')) await toggleSidebar();
}
button('front').onclick = () => setView('front'); button('detail').onclick = () => setView('detail');
button('screens').onclick = () => inspectScreen(); button('binding').onclick = () => setBinding(!bound);
button('update').onclick = () => updateScreen(); button('theme').onclick = () => setTheme(dark ? 'light' : 'dark');
button('measure').onclick = measure; button('retry').onclick = () => location.reload();
button('sidebar').onclick = toggleSidebar;
window.addEventListener('pagehide', () => {
  disposed = true; cancelAnimationFrame(frame); observer?.disconnect(); controls?.dispose(); decoder?.dispose();
  sidebar?.dispose();
  warmLighting?.traverse(object => { if (object.isLight && object.shadow) object.shadow.dispose(); });
  release(); environment?.dispose(); renderer?.dispose(); preview.ready = false;
}, { once: true });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
initialize().catch(error => {
  if (disposed) return;
  preview.error = error.message; host.setAttribute('aria-busy', 'false');
  status.textContent = `模型加载失败：${error.message}`; button('retry').hidden = false;
});
