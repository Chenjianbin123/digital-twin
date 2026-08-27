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
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a151c);
const camera = new THREE.PerspectiveCamera(51, 1, 0.1, 100);
camera.position.set(0, 1.46, 5.45);
const target = new THREE.Vector3(0, 0.62, -0.2);

scene.add(new THREE.HemisphereLight(0xf2fbff, 0x6e8489, 1.22));
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

const key = new THREE.DirectionalLight(0xfffdf3, 2.1);
key.position.set(-4.5, 7.5, 5.5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 6;
key.shadow.camera.bottom = -4;
scene.add(key);

const fillLight = new THREE.DirectionalLight(0x8edfff, 0.9);
fillLight.position.set(5, 4, 2);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 18),
  new THREE.MeshStandardMaterial({ color: 0x0b6474, roughness: 0.76, metalness: 0.03 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, -0.025, 1.8);
floor.receiveShadow = true;
scene.add(floor);

const architecture = new THREE.Group();
const panelMaterial = new THREE.MeshStandardMaterial({ color: 0xc5ced0, roughness: 0.86, metalness: 0.02 });
const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0xe9eef0, roughness: 0.9, metalness: 0.01, side: THREE.DoubleSide });
const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x7f9297, roughness: 0.72, metalness: 0.04 });

const upperWall = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.68, 0.12), panelMaterial);
upperWall.position.set(0, 2.62, -2.38);
upperWall.receiveShadow = true;
architecture.add(upperWall);

const ceilingReturn = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.1, 1.18), ceilingMaterial);
ceilingReturn.position.set(0, 2.94, -1.84);
ceilingReturn.receiveShadow = true;
architecture.add(ceilingReturn);

const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.16, 0.18), trimMaterial);
frontTrim.position.set(0, 2.88, -1.23);
architecture.add(frontTrim);

for (const x of [-3.05, -1.52, 0, 1.52, 3.05]) {
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.58, 0.024), trimMaterial);
  seam.position.set(x, 2.62, -2.31);
  architecture.add(seam);
}

const lightMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xe9fbff,
  emissiveIntensity: 4.2,
  roughness: 0.24,
});
for (const x of [-2.75, 0, 2.75]) {
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.025, 0.31), lightMaterial);
  panel.position.set(x, 2.875, -1.62);
  architecture.add(panel);

  const glow = new THREE.PointLight(0xd9f7ff, 0.8, 4.2, 2);
  glow.position.set(x, 2.62, -1.3);
  architecture.add(glow);
}
scene.add(architecture);

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
        material.envMapIntensity = 0.62;
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
