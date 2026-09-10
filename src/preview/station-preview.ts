import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import modelUrl from '../../output/nurse-station-reference-v2/nurse-station-design-v2.glb?url';

export type PreviewView = 'front' | 'detail' | 'workstation' | 'wall';
// Blender Z-up → glTF Y-up: (x, y, z) becomes (x, z, -y).
const views: Record<PreviewView, { position: number[]; target: number[]; fov: number }> = {
  front: { position: [-2.5, 1.8, 9.5], target: [0, 1.65, -1.2], fov: 33 },
  detail: { position: [-4.5, 1.8, 6.4], target: [-.3, 1.2, -.7], fov: 30 },
  workstation: { position: [-3.8, 1.85, -3.4], target: [-1.1, .87, -1.1], fov: 46 },
  wall: { position: [-.35, 1.85, -.9], target: [-.35, 1.95, -4], fov: 46 },
};

function displayTexture(workstation: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 1440;
  canvas.height = workstation ? 810 : 640;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建信息屏');
  ctx.fillStyle = '#19485d';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
  ctx.fillText(workstation ? '护理工作台' : '病区动态', 48, 80);
  ctx.font = '26px "Microsoft YaHei", sans-serif';
  ctx.fillText('模型预览 · 演示数据', 1060, 74);
  const items = [['住院患者', '32 人', '今日入院  3', '今日出院  2'], ['护理工作', '12 项', '待执行  2', '已完成  10'], ['重点关注', '5 人', '一级护理  2', '特殊观察  3']];
  items.forEach((item, index) => {
    const x = 36 + index * 466;
    ctx.fillStyle = '#e8f1f4';
    ctx.fillRect(x, 132, 438, canvas.height - 210);
    ctx.fillStyle = '#2b6271';
    ctx.font = '36px "Microsoft YaHei", sans-serif';
    ctx.fillText(item[0]!, x + 30, 200);
    ctx.font = 'bold 76px "Microsoft YaHei", sans-serif';
    ctx.fillText(item[1]!, x + 30, 314);
    ctx.font = '30px "Microsoft YaHei", sans-serif';
    ctx.fillText(item[2]!, x + 30, 390);
    ctx.fillText(item[3]!, x + 30, 445);
  });
  ctx.fillStyle = '#cee3e9';
  ctx.font = '24px "Microsoft YaHei", sans-serif';
  ctx.fillText('仅用于空间与屏幕清晰度评审，尚未连接业务接口', 40, canvas.height - 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  return texture;
}

export function createStationPreview(host: HTMLElement) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dbe2e2');
  const camera = new THREE.PerspectiveCamera(33, 1, .03, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '三维护士站，可拖动旋转、滚轮缩放、方向键平移');
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = .3;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * .94;
  controls.listenToKeyEvents(renderer.domElement);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentTarget = pmrem.fromScene(environment, .04);
  scene.environment = environmentTarget.texture;
  scene.environmentIntensity = .5;
  environment.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe6f1ff, 0xb3a28a, .6));
  RectAreaLightUniformsLib.init();
  for (const [x, y, z, intensity, width, height] of [[-3.7, 2.9, 4, 2, 4.8, 2], [5.8, 2.6, 0, 2, 2, 2.5], [0, 2.85, -2.9, 2, 6.5, .8]]) {
    const light = new THREE.RectAreaLight(0xfff2de, intensity, width, height);
    light.position.set(x!, y!, z!);
    light.lookAt(0, 1, -2);
    scene.add(light);
  }
  const key = new THREE.SpotLight(0xfff7eb, 45, 25, Math.PI / 2.7, .85, 2);
  key.position.set(-3, 3.05, 3.5);
  key.target.position.set(0, .6, -.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001;
  key.shadow.normalBias = .012;
  scene.add(key, key.target);
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  let disposed = false;
  let currentView: PreviewView = 'front';
  let triangles = 0;
  let meshes = 0;
  let renderFrame = 0;
  // Render on changes only: a static review scene should not consume GPU when idle.
  function invalidate() {
    if (disposed || renderFrame) return;
    renderFrame = requestAnimationFrame(() => {
      renderFrame = 0;
      renderer.render(scene, camera);
    });
  }
  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    camera.aspect = width / height;
    // Preserve horizontal framing on narrow screens without backing out through walls.
    const baseFov = THREE.MathUtils.degToRad(views[currentView].fov);
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseFov / 2) * Math.max(1, (16 / 9) / camera.aspect)));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    invalidate();
  }
  function setView(view: PreviewView) {
    currentView = view;
    camera.position.fromArray(views[view].position);
    controls.target.fromArray(views[view].target);
    controls.update();
    resize();
  }
  controls.addEventListener('change', invalidate);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  setView('front');
  function collect(root: THREE.Object3D) {
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  }
  function releaseAssets() {
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    textures.forEach(texture => texture.dispose());
    geometries.clear(); materials.clear(); textures.clear();
  }
  return {
    async load(onProgress: (percent: number) => void) {
      const gltf = await new GLTFLoader().loadAsync(modelUrl, event => {
        if (!disposed && event.total > 0) onProgress(Math.round(event.loaded / event.total * 100));
      });
      collect(gltf.scene);
      if (disposed) { releaseAssets(); return; }
      const main = gltf.scene.getObjectByName('Screen_Main');
      const screens = [main, ...[1, 2, 3, 4].map(i => gltf.scene.getObjectByName(`Screen_Work_0${i}`))];
      if (screens.some(screen => !(screen instanceof THREE.Mesh))) throw new Error('模型缺少独立屏幕');
      const mainTexture = displayTexture(false);
      const workTexture = displayTexture(true);
      textures.add(mainTexture); textures.add(workTexture);
      screens.forEach((object, index) => {
        const material = new THREE.MeshBasicMaterial({ map: index === 0 ? mainTexture : workTexture, toneMapped: false });
        materials.add(material);
        (object as THREE.Mesh).material = material;
      });
      const clock = gltf.scene.getObjectByName('Clock_Display');
      if (clock) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法创建钟面');
        ctx.fillStyle = '#faf9f4'; ctx.fillRect(0, 0, 512, 512);
        ctx.translate(256, 256);
        ctx.fillStyle = ctx.strokeStyle = '#203c43';
        ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let hour = 1; hour <= 12; hour++) {
          const angle = hour * Math.PI / 6;
          ctx.fillText(String(hour), Math.sin(angle) * 202, -Math.cos(angle) * 202);
        }
        // Fixed reference time, not a clinical time source.
        for (const [angle, length, width] of [[10.4 * Math.PI / 6, 116, 14], [24 * Math.PI / 30, 174, 9]]) {
          ctx.beginPath(); ctx.lineWidth = width!; ctx.lineCap = 'round';
          ctx.moveTo(0, 0); ctx.lineTo(Math.sin(angle!) * length!, -Math.cos(angle!) * length!); ctx.stroke();
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        textures.add(texture);
        const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        materials.add(material);
        const geometry = new THREE.CircleGeometry(.222, 64);
        geometries.add(geometry);
        const face = new THREE.Mesh(geometry, material);
        face.name = 'Preview_Analog_Clock_Face';
        const bounds = new THREE.Box3().setFromObject(clock);
        bounds.getCenter(face.position);
        face.position.z = bounds.max.z + .001;
        scene.add(face);
      }
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        meshes++;
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3;
        object.castShadow = !/Glass|Glazing|Screen|LED/i.test(object.name);
        object.receiveShadow = true;
      });
      scene.add(gltf.scene);
      await renderer.compileAsync(scene, camera);
      if (!disposed) invalidate();
    },
    setView,
    setExposure(value: number) {
      if (!Number.isFinite(value)) return;
      renderer.toneMappingExposure = THREE.MathUtils.clamp(value, .6, 1.6);
      invalidate();
    },
    stats: () => `${meshes} 个网格 · ${Math.round(triangles / 1000)}k 三角面`,
    dispose() {
      disposed = true;
      cancelAnimationFrame(renderFrame);
      observer.disconnect();
      controls.removeEventListener('change', invalidate);
      controls.dispose();
      releaseAssets();
      environmentTarget.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
