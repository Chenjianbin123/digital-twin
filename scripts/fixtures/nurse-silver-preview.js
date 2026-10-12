import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { bindReferenceStationDisplays, createReferenceClockTexture, referenceStationFov } from '/src/core/reference-nurse-station.ts';

const host = document.querySelector('#scene');
const status = document.querySelector('#status');
const videoStatus = document.querySelector('#video-status');
const buttons = [...document.querySelectorAll('[data-view]')];
const resources = { geometry: new Set(), material: new Set(), texture: new Set() };
const views = {
  front: [[-7.6, 2.15, 9.5], [-.5, 1.65, -1.2], 29.82],
  detail: [[-4.7, 1.72, 4.6], [-.25, .94, -.2], 29.82],
  wall: [[3.10, 2.30, -.70], [2.9, 2.24, -3.42], 45.80],
  staff: [[-3.7, 1.82, -2.10], [-.8, 1.02, .15], 42.60],
};
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d9e2e5');
const camera = new THREE.PerspectiveCamera(31.39, 1, .025, 100);
const video = document.createElement('video');
video.muted = true;
video.loop = true;
video.playsInline = true;
video.preload = 'auto';
let renderer, controls, observer, environment, tv, model;
let frame = 0, demoTimer = 0, mediaGeneration = 0, fileUrl;
let disposed = false, activeView = 'front', videoActive = false;

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

function boardTexture(title) {
  const canvas = document.createElement('canvas');
  canvas.width = 1440; canvas.height = title === '病区动态' ? 640 : 810;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0c2e46'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#d4f2ff'; ctx.font = 'bold 60px Microsoft YaHei'; ctx.fillText(title, 55, 95);
  ['病区概览', '患者呼叫', '设备状态'].forEach((label, i) => {
    const x = 45+i*455;
    ctx.fillStyle = '#123e58'; ctx.fillRect(x, 150, 425, canvas.height-230);
    ctx.fillStyle = '#9cddf3'; ctx.font = '40px Microsoft YaHei'; ctx.fillText(label, x+25, 220);
    ctx.font = '32px Microsoft YaHei'; ctx.fillText('等待接入', x+25, 320);
    ctx.fillText('— —', x+25, 405);
  });
  ctx.fillStyle = '#b6d5e3'; ctx.font = '26px Microsoft YaHei';
  ctx.fillText('模型验收 · 演示界面 · 非实时业务数据', 55, canvas.height-30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
  resources.texture.add(texture);
  return texture;
}

function invalidate() {
  if (disposed || frame || !renderer) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderer.render(scene, camera);
    if (videoActive) invalidate();
  });
}

function resize() {
  if (disposed) return;
  const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  camera.aspect = width/height;
  camera.fov = referenceStationFov(camera.aspect, views[activeView][2]);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  invalidate();
}

function setView(name) {
  activeView = name;
  camera.position.fromArray(views[name][0]);
  controls.target.fromArray(views[name][1]);
  controls.update();
  buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === name)));
  resize();
}

function stopVideo() {
  mediaGeneration++;
  videoActive = false;
  clearInterval(demoTimer);
  video.pause();
  if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  video.removeAttribute('src');
  video.load();
  if (fileUrl) URL.revokeObjectURL(fileUrl);
  fileUrl = undefined;
  if (tv?.material.map?.isVideoTexture) {
    resources.texture.delete(tv.material.map);
    tv.material.map.dispose();
    tv.material.map = boardTexture('护理宣教 · 已停止');
    tv.material.needsUpdate = true;
  }
  videoStatus.textContent = '视频已停止；选择视频后仅在本机播放。';
  invalidate();
}

async function playVideo(source) {
  stopVideo();
  const generation = mediaGeneration;
  if (source instanceof MediaStream) video.srcObject = source;
  else { fileUrl = URL.createObjectURL(source); video.src = fileUrl; }
  try {
    await video.play();
    if (disposed || generation !== mediaGeneration) return;
    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
    resources.texture.add(texture);
    resources.texture.delete(tv.material.map);
    tv.material.map?.dispose();
    tv.material.map = texture;
    tv.material.needsUpdate = true;
    videoActive = true;
    videoStatus.textContent = source instanceof MediaStream ? '正在播放合成测试视频 · 非宣教成片' : '正在播放本地视频 · 未上传';
    invalidate();
    return generation;
  } catch (error) {
    if (disposed || generation !== mediaGeneration) return;
    stopVideo();
    videoStatus.textContent = `视频未能播放：${error.message}。请尝试浏览器支持的 MP4 / WebM。`;
  }
}

async function initialize() {
  RectAreaLightUniformsLib.init();
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '护士站模型，方向键平移，鼠标拖动旋转');
  controls = new OrbitControls(camera, renderer.domElement);
  controls.listenToKeyEvents(renderer.domElement);
  controls.minDistance = .25; controls.maxDistance = 20;
  controls.addEventListener('change', invalidate);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .58;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe8f1ff, 0x99948d, .8));
  for (const [pos, size, intensity] of [
    [[-3, 3.1, 4.4], [7, 3], 4], [[6.7, 2.8, .4], [2, 2.5], 3],
    [[-6.8, 2.7, .4], [2, 2.7], 4], [[0, 2.9, -1.4], [8, 1.5], 3],
  ]) {
    const light = new THREE.RectAreaLight(0xfff4e5, intensity, ...size);
    light.position.fromArray(pos); light.lookAt(0, 1, -1.5); scene.add(light);
  }
  const key = new THREE.SpotLight(0xfff6ea, 170, 25, Math.PI/2.6, .8, 1.7);
  key.position.set(-3, 3.35, 4);
  key.target.position.set(0, 0, -1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001; key.shadow.normalBias = .008;
  scene.add(key, key.target);
  observer = new ResizeObserver(resize); observer.observe(host);
  setView('front');
  model = (await new GLTFLoader().loadAsync('/models/smart-ward-nurse-station/nurse-station-silver-v1.glb')).scene;
  collect(model);
  if (disposed) { release(); return; }
  // Reuse the actual screen-binding contract, but not v2's furniture resize.
  bindReferenceStationDisplays(model, kind => kind === 'clock' ? createReferenceClockTexture(new Date('2026-09-29T10:10:00')) : boardTexture(kind === 'dashboard' ? '病区动态' : '护理工作台'));
  tv = model.getObjectByName('Screen_Video');
  if (!tv?.isMesh) throw new Error('模型缺少独立视频面 Screen_Video');
  tv.material = new THREE.MeshBasicMaterial({ map: boardTexture('护理宣教 · 待播放'), toneMapped: false });
  const service = model.getObjectByName('Screen_Service');
  service.material = new THREE.MeshBasicMaterial({ map: boardTexture('低位服务台'), toneMapped: false });
  model.traverse(object => {
    if (!object.isMesh) return;
    object.castShadow = !/Screen|display|Architecture|Ceiling|地板/.test(object.name);
    object.receiveShadow = true;
  });
  collect(model);
  scene.add(model);
  await renderer.compileAsync(scene, camera);
  if (disposed) return;
  buttons.forEach(button => { button.disabled = false; button.onclick = () => setView(button.dataset.view); });
  for (const id of ['demo', 'stop', 'video-file']) document.getElementById(id).disabled = false;
  status.textContent = '模型已加载 · 主屏 / 4 个工作屏 / 时钟已通过项目原有绑定器接入演示内容';
  window.nurseSilverPreview = { scene, model, camera, renderer, controls, video, setView };
  invalidate();
}

document.querySelector('#demo').onclick = async () => {
  const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
  const ctx = canvas.getContext('2d'); let tick = 0;
  const draw = () => {
    ctx.fillStyle = '#0b3752'; ctx.fillRect(0, 0, 960, 540);
    ctx.fillStyle = '#bdf0ff'; ctx.font = 'bold 55px Microsoft YaHei'; ctx.fillText('护理宣教 · 视频测试', 50, 100);
    ctx.font = '40px Microsoft YaHei'; ctx.fillText(`动态帧 ${++tick} · 非宣教成片`, 50, 230);
    ctx.fillStyle = '#31badc'; ctx.fillRect(50, 430, (tick*18)%850, 12);
    ctx.fillStyle = '#df8357'; ctx.fillRect(0, 0, 36, 36);
    ctx.fillStyle = '#87c57c'; ctx.fillRect(924, 504, 36, 36);
  };
  draw();
  const generation = await playVideo(canvas.captureStream(10));
  if (videoActive && generation === mediaGeneration) demoTimer = setInterval(draw, 100);
};
document.querySelector('#stop').onclick = stopVideo;
document.querySelector('#video-file').onchange = event => {
  const file = event.target.files?.[0];
  if (file) playVideo(file);
};
document.querySelector('#retry').onclick = () => location.reload();

function release() {
  resources.geometry.forEach(value => value.dispose());
  resources.material.forEach(value => value.dispose());
  resources.texture.forEach(value => value.dispose());
  Object.values(resources).forEach(set => set.clear());
}

window.addEventListener('pagehide', () => {
  disposed = true; stopVideo(); cancelAnimationFrame(frame);
  observer?.disconnect(); controls?.dispose();
  release(); environment?.dispose();
  scene.traverse(object => object.shadow?.dispose());
  renderer?.dispose(); delete window.nurseSilverPreview;
}, { once: true });
initialize().catch(error => {
  if (disposed) return;
  status.textContent = `模型加载失败：${error.message}`;
  document.querySelector('#retry').hidden = false;
});
