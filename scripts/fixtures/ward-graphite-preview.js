// Local asset acceptance only: no store, hospital API, or real patient information.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createWardBedUnit } from '/src/core/ward-bed-unit.ts';

const host = document.querySelector('#scene');
const status = document.querySelector('#status');
const buttons = [...document.querySelectorAll('.actions button:not(#retry)')];
const scene = new THREE.Scene();
scene.background = new THREE.Color('#bbced7');
const camera = new THREE.PerspectiveCamera(37.4, 1, .025, 60);
const units = [];
const resources = { geometry: new Set(), material: new Set(), texture: new Set() };
let renderer, controls, observer, environment, decoder, room;
let disposed = false, frame = 0, nextScreen = 0;
const preview = window.wardGraphitePreview = { ready: false, scene, camera, units, reset, detail, screenCheck };

function collect(root) {
  root.traverse(node => {
    if (!node.isMesh) return;
    resources.geometry.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      resources.material.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.texture.add(value);
    }
  });
}

function release() {
  for (const set of Object.values(resources)) { set.forEach(resource => resource.dispose()); set.clear(); }
}

function invalidate() {
  if (disposed || frame || !renderer) return;
  frame = requestAnimationFrame(() => { frame = 0; renderer.render(scene, camera); });
}

function resize() {
  if (disposed || !renderer) return;
  const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  camera.aspect = width / height;
  camera.fov = Math.min(88, THREE.MathUtils.radToDeg(2 * Math.atan(
    Math.tan(THREE.MathUtils.degToRad(37.4) / 2) * Math.max(1, (16 / 9) / camera.aspect),
  )));
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  invalidate();
}

function view(position, target, active) {
  if (!controls || disposed) return;
  camera.position.fromArray(position); controls.target.fromArray(target); controls.update();
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.id === active)));
  invalidate();
}

function reset() {
  view([-2.9, 1.9, -6.6], [-.05, 1.15, -1.1], 'reset');
  if (preview.ready) status.textContent = '双床整体预览 · 独立演示纹理 · 尚未替换生产场景';
}
function detail() {
  view([-2.60, 1.30, -3.42], [-1.45, .72, -1.32], 'detail');
  if (preview.ready) status.textContent = '病床细节 · 检查护栏、底盘、脚轮与床品材质';
}

function screenCheck(index = nextScreen) {
  const unit = units[index];
  if (!unit) return;
  unit.screen.updateWorldMatrix(true, false);
  const center = new THREE.Box3().setFromObject(unit.screen).getCenter(new THREE.Vector3());
  view([center.x, center.y, center.z - .70], center.toArray(), 'screen-check');
  nextScreen = (index + 1) % units.length;
  status.textContent = `演示床位 ${String(index + 1).padStart(2, '0')} · 检查四角文字方向；再次点击切换另一床`;
}

function terminalTexture(index) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 576;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法建立屏幕验收画布');
  const accent = index === 0 ? '#75d4dc' : '#e1ba75';
  context.fillStyle = '#0e2029'; context.fillRect(0, 0, 1024, 576);
  context.strokeStyle = accent; context.lineWidth = 8; context.strokeRect(8, 8, 1008, 560);
  context.fillStyle = accent; context.font = 'bold 30px system-ui';
  context.textAlign = 'left'; context.fillText('TOP-LEFT', 32, 56); context.fillText('BOTTOM-LEFT', 32, 540);
  context.textAlign = 'right'; context.fillText('TOP-RIGHT', 992, 56); context.fillText('BOTTOM-RIGHT', 992, 540);
  context.textAlign = 'center'; context.fillStyle = '#f2f6f5';
  context.font = 'bold 72px "Microsoft YaHei", sans-serif'; context.fillText(`演示床位 ${String(index + 1).padStart(2, '0')}`, 512, 238);
  context.fillStyle = accent; context.font = '44px "Microsoft YaHei", sans-serif'; context.fillText('床头屏模板方向验收', 512, 327);
  context.fillStyle = '#c3d1d5'; context.font = '30px "Microsoft YaHei", sans-serif'; context.fillText('独立纹理 · 非真实患者数据', 512, 411);
  canvas.dataset.bedCode = `GRAPHITE-DEMO-${index + 1}`;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
  resources.texture.add(texture);
  return texture;
}

function lighting() {
  RectAreaLightUniformsLib.init();
  const pmrem = new THREE.PMREMGenerator(renderer), environmentRoom = new RoomEnvironment();
  environment = pmrem.fromScene(environmentRoom, .04);
  scene.environment = environment.texture; scene.environmentIntensity = .25;
  environmentRoom.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8edf0, 0x77766f, .28));
  const area = (color, intensity, size, position, target) => {
    const light = new THREE.RectAreaLight(color, intensity, ...size);
    light.position.fromArray(position); light.lookAt(...target); scene.add(light);
  };
  area(0xe7f4ff, 1.8, [3.15, 1.9], [3.07, 2, -2.25], [-1.5, .9, -1.8]);
  for (const x of [-1.45, 1.45]) {
    area(0xfffbf3, 2, [1.35, .7], [x, 3.02, -1.85], [x, 0, -1.85]);
    area(0xffe6be, 1.2, [.82, .07], [x, 1.99, -.23], [x, .82, -1.3]);
  }
  area(0xf7faff, .8, [3.4, 2], [-1.7, 2.65, -4.4], [0, 1, -.8]);
  const key = new THREE.SpotLight(0xf3f6f8, 30, 14, Math.PI / 2.9, .8, 1.7);
  key.position.set(2.8, 2.9, -3.6); key.target.position.set(-.6, .25, -1.35);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001; key.shadow.normalBias = .012; key.shadow.radius = 2;
  // The renderer owns the static-shadow update gate; the light must participate whenever it opens.
  key.shadow.needsUpdate = true;
  scene.add(key, key.target);
}

async function initialize() {
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  // Loading-state renders already contain a shadow-casting light. Allocate its depth map on the first frame.
  renderer.shadowMap.needsUpdate = true;
  host.append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '双床病房模型，拖动旋转、滚轮缩放、方向键平移');
  controls = new OrbitControls(camera, renderer.domElement);
  controls.listenToKeyEvents(renderer.domElement); controls.minDistance = .20; controls.maxDistance = 10;
  controls.addEventListener('change', invalidate);
  Object.assign(preview, { renderer, controls });
  lighting();
  observer = new ResizeObserver(resize); observer.observe(host); reset(); resize();
  decoder = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(1);
  const loader = new GLTFLoader().setDRACOLoader(decoder);
  room = (await loader.loadAsync('/models/smart-ward-interior/ward-graphite-room-v1.glb')).scene;
  collect(room);
  if (disposed) { release(); return; }
  room.traverse(node => {
    if (!node.isMesh) return;
    // The authored closed ceiling must not block the fixture's indoor fill shadow.
    node.castShadow = false; node.receiveShadow = true;
  });
  scene.add(room); preview.room = room;
  renderer.shadowMap.needsUpdate = true;
  status.textContent = '房间已加载，正在装配两张独立床位…'; invalidate();
  const prototype = (await loader.loadAsync('/models/smart-ward-interior/ward-graphite-bed-v1.glb')).scene;
  collect(prototype);
  if (disposed) { release(); return; }
  for (const [index, x] of [-1.45, 1.45].entries()) {
    const unit = createWardBedUnit(prototype, `GRAPHITE-DEMO-${index + 1}`);
    unit.group.position.set(x, 0, -1.5);
    unit.screen.material.map = terminalTexture(index); unit.screen.material.needsUpdate = true;
    unit.group.updateMatrixWorld(true); scene.add(unit.group); units.push(unit); collect(unit.group);
  }
  renderer.shadowMap.needsUpdate = true;
  await renderer.compileAsync(scene, camera);
  if (disposed) return;
  renderer.render(scene, camera);
  preview.ready = true; host.setAttribute('aria-busy', 'false');
  buttons.forEach(button => { button.disabled = false; });
  status.textContent = '模型已加载 · 两床使用独立演示纹理 · 尚未替换生产场景';
}

document.querySelector('#reset').onclick = reset;
document.querySelector('#detail').onclick = detail;
document.querySelector('#screen-check').onclick = () => screenCheck();
document.querySelector('#retry').onclick = () => location.reload();
window.addEventListener('pagehide', () => {
  disposed = true; cancelAnimationFrame(frame);
  observer?.disconnect(); controls?.dispose(); decoder?.dispose();
  release(); environment?.dispose(); scene.traverse(node => node.shadow?.dispose()); renderer?.dispose();
  preview.ready = false;
}, { once: true });
initialize().catch(error => {
  if (disposed) return;
  preview.error = error.message; host.setAttribute('aria-busy', 'false');
  status.textContent = `模型加载失败：${error.message}。请检查模型导出结果后重新加载。`;
  document.querySelector('#retry').hidden = false;
});
