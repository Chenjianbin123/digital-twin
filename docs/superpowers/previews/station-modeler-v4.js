import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const canvas = document.querySelector('#scene');
const stage = document.querySelector('#stage');
const loading = document.querySelector('#loading');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdde7e3);
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 100);
camera.position.set(0, 1.46, 5.45);
const target = new THREE.Vector3(0, 0.62, -0.2);

scene.add(new THREE.HemisphereLight(0xf7fbf8, 0x71847d, 1.05));
scene.add(new THREE.AmbientLight(0xffffff, 0.42));

const keyLight = new THREE.DirectionalLight(0xfffdf5, 1.65);
keyLight.position.set(-4.2, 7.2, 5.1);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -7;
keyLight.shadow.camera.right = 7;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -4;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xb8e3df, 0.38);
fillLight.position.set(5, 3.8, 2.4);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 18),
  new THREE.MeshStandardMaterial({ color: 0x91b8b2, roughness: 0.9, metalness: 0.01 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.025, 1.8);
floor.receiveShadow = true;
scene.add(floor);

const architecture = new THREE.Group();
architecture.name = 'hospitalArchitecture';
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xdde5e1, roughness: 0.92, metalness: 0.01 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xf0f4f1, roughness: 0.94, metalness: 0, side: THREE.DoubleSide });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x91aaa5, roughness: 0.78, metalness: 0.02 });

const upperWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.72, 0.12), wallMaterial);
upperWall.position.set(0, 2.6, -2.38);
upperWall.receiveShadow = true;
architecture.add(upperWall);

const ceilingReturn = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.1, 1.18), ceilingMaterial);
ceilingReturn.position.set(0, 2.94, -1.84);
ceilingReturn.receiveShadow = true;
architecture.add(ceilingReturn);

const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.13, 0.16), trimMaterial);
frontTrim.position.set(0, 2.88, -1.23);
architecture.add(frontTrim);

for (const x of [-3.05, -1.52, 0, 1.52, 3.05]) {
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.58, 0.022), trimMaterial);
  seam.position.set(x, 2.61, -2.31);
  architecture.add(seam);
}

const lightMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xfffdf2,
  emissiveIntensity: 2.7,
  roughness: 0.3,
});
for (const x of [-2.75, 0, 2.75]) {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.025, 0.31), lightMaterial);
  panel.position.set(x, 2.875, -1.62);
  architecture.add(panel);

  const glow = new THREE.PointLight(0xfff8de, 0.42, 3.7, 2);
  glow.position.set(x, 2.55, -1.3);
  architecture.add(glow);
}
scene.add(architecture);

function createInfoTexture(title, rows, accent) {
  const infoCanvas = document.createElement('canvas');
  infoCanvas.width = 640;
  infoCanvas.height = 360;
  const context = infoCanvas.getContext('2d');
  context.fillStyle = '#123a42';
  context.fillRect(0, 0, infoCanvas.width, infoCanvas.height);
  context.fillStyle = accent;
  context.fillRect(0, 0, 12, infoCanvas.height);
  context.fillStyle = '#e9f6f3';
  context.font = '700 34px "Microsoft YaHei", sans-serif';
  context.fillText(title, 38, 55);
  context.strokeStyle = 'rgba(151, 220, 211, 0.32)';
  context.beginPath();
  context.moveTo(38, 76);
  context.lineTo(600, 76);
  context.stroke();
  context.font = '24px "Microsoft YaHei", sans-serif';
  rows.forEach((row, index) => {
    const y = 128 + index * 64;
    context.fillStyle = index === 1 ? accent : '#c9ddda';
    context.fillText(row, 38, y);
    context.fillStyle = index === 1 ? '#f1b75d' : '#70bbb3';
    context.fillRect(500, y - 18, 70 + index * 16, 8);
  });
  const texture = new THREE.CanvasTexture(infoCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function createScreen(x, title, rows, accent, width = 0.9) {
  const texture = createInfoTexture(title, rows, accent);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.64),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  screen.position.set(x, 1.32, -1.1);
  return screen;
}

function createWayfindingTexture() {
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 1024;
  signCanvas.height = 180;
  const context = signCanvas.getContext('2d');
  context.clearRect(0, 0, signCanvas.width, signCanvas.height);
  context.fillStyle = '#2d8582';
  context.fillRect(0, 0, 1024, 180);
  context.fillStyle = '#ffffff';
  context.font = '700 58px "Microsoft YaHei", sans-serif';
  context.textAlign = 'center';
  context.fillText('护士站  NURSE STATION', 512, 82);
  context.fillStyle = '#cfeae5';
  context.font = '28px "Microsoft YaHei", sans-serif';
  context.fillText('请保持安静  ·  安全通行', 512, 134);
  const texture = new THREE.CanvasTexture(signCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const hospitalDetails = new THREE.Group();
hospitalDetails.name = 'hospitalDetails';
hospitalDetails.add(
  createScreen(-1.25, '今日排班', ['早班  4 人', '中班  3 人', '夜班  2 人'], '#69c5b8'),
  createScreen(0, '护理呼叫', ['待处理  02', '优先处理  01', '平均响应  38 秒'], '#f0b15e', 1.2),
  createScreen(1.25, '床位状态', ['在院  32', '空床  06', '重点护理  03'], '#69c5b8'),
);

const wayfinding = new THREE.Mesh(
  new THREE.PlaneGeometry(2.7, 0.47),
  new THREE.MeshBasicMaterial({ map: createWayfindingTexture(), transparent: true, toneMapped: false }),
);
wayfinding.position.set(0, 2.3, -1.1);
hospitalDetails.add(wayfinding);
scene.add(hospitalDetails);

const loader = new GLTFLoader();
try {
  const gltf = await loader.loadAsync('/models/smart-ward-nurse-station/high_fidelity_nurse_station_v3.glb?v=20260820-latest-blender-v3-export-v20');
  const model = gltf.scene;
  model.traverse((object) => {
    if (!object.isMesh)
      return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if ('envMapIntensity' in material)
        material.envMapIntensity = 0.48;
    }
  });

  model.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(model);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = Math.min(8.748 / initialSize.x, 2.3895 / initialSize.y, 4.7385 / initialSize.z);
  model.scale.multiplyScalar(scale);
  model.scale.y *= 1.1;
  model.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(model);
  const center = fittedBox.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -fittedBox.min.y + 0.03, -center.z);
  scene.add(model);

  loading.classList.add('hidden');
  window.__previewReady = true;
  window.dispatchEvent(new Event('preview-ready'));
}
catch (error) {
  loading.textContent = '护士站模型加载失败';
  window.__previewError = String(error);
  console.error(error);
}

function render() {
  const rect = stage.getBoundingClientRect();
  const width = Math.max(Math.round(rect.width), 1);
  const height = Math.max(Math.round(rect.height), 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);

  const gl = renderer.getContext();
  const pixel = new Uint8Array(4);
  const samples = [
    [0.25, 0.25], [0.5, 0.25], [0.75, 0.25],
    [0.25, 0.5], [0.5, 0.5], [0.75, 0.5],
    [0.25, 0.75], [0.5, 0.75], [0.75, 0.75],
  ].map(([x, y]) => {
    gl.readPixels(Math.floor(width * x), Math.floor(height * y), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    return Array.from(pixel);
  });
  canvas.dataset.pixelSamples = JSON.stringify(samples);
}

new ResizeObserver(render).observe(stage);
render();
window.addEventListener('preview-ready', render, { once: true });
