<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import type { RoomPriority, RoomSummary } from '@/core/area-summary';

const props = defineProps<{
  rooms: RoomSummary[];
  alertCount: number;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let root: THREE.Group | null = null;
let roomLayer: THREE.Group | null = null;
let frameId = 0;
let startedAt = 0;
let observer: ResizeObserver | null = null;

const PRIORITY_COLORS: Record<RoomPriority, number> = {
  calling: 0xff5f91,
  danger: 0xff385c,
  offline: 0xff684f,
  infusing: 0xffb14a,
  warning: 0xffd166,
  normal: 0x46ddff,
  empty: 0x91a4ad,
};

function disposeObject(object: THREE.Object3D) {
  if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
    object.geometry.dispose();
    const material = object.material;
    if (Array.isArray(material))
      material.forEach(item => item.dispose());
    else
      material.dispose();
  }
}

function addBox(
  parent: THREE.Group,
  position: THREE.Vector3Tuple,
  scale: THREE.Vector3Tuple,
  color: number,
  opacity = 0.32,
) {
  const geometry = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.48,
    metalness: 0.14,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x9aefff,
      transparent: true,
      opacity: 0.3,
    }),
  );
  edges.position.copy(mesh.position);
  parent.add(edges);

  return mesh;
}

function createBaseScene(canvas: HTMLCanvasElement) {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
  camera.position.set(0, 2.2, 6.5);
  camera.lookAt(0, 0.45, 0);

  root = new THREE.Group();
  roomLayer = new THREE.Group();
  scene.add(root);
  root.add(roomLayer);

  const ambient = new THREE.AmbientLight(0x9fe8ff, 0.7);
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(2, 3.2, 4);
  const rim = new THREE.PointLight(0x4fe7ff, 1.3, 12);
  rim.position.set(-2.8, 1.4, 2.4);
  scene.add(ambient, key, rim);

  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(2.35, 2.55, 0.08, 72),
    new THREE.MeshStandardMaterial({
      color: 0x082033,
      transparent: true,
      opacity: 0.72,
      roughness: 0.32,
      metalness: 0.32,
    }),
  );
  platform.position.y = -0.42;
  root.add(platform);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.012, 8, 128),
    new THREE.MeshBasicMaterial({
      color: 0x58e4ff,
      transparent: true,
      opacity: 0.46,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -0.36;
  root.add(ring);

  addBox(root, [0, -0.06, 0.1], [1.8, 0.34, 0.5], 0x8eddf0, 0.26);
  addBox(root, [-0.54, 0.24, -0.12], [0.46, 0.4, 0.04], 0x1f9cff, 0.35);
  addBox(root, [0.54, 0.24, -0.12], [0.46, 0.4, 0.04], 0x1f9cff, 0.35);
  addBox(root, [0, 0.42, -0.32], [1.08, 0.52, 0.05], 0x52d9ff, 0.22);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.45, 0.62, 0.36),
    new THREE.Vector3(-1.25, 1.08, 0.08),
    new THREE.Vector3(0, 1.26, -0.06),
    new THREE.Vector3(1.25, 1.08, 0.08),
    new THREE.Vector3(2.45, 0.62, 0.36),
  ]);
  const curveLine = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, 0.01, 8, false),
    new THREE.MeshBasicMaterial({
      color: 0xf3fdff,
      transparent: true,
      opacity: 0.64,
    }),
  );
  root.add(curveLine);

  updateRooms();
  resize();
  observer = new ResizeObserver(resize);
  observer.observe(canvas);

  startedAt = performance.now();
  animate();
}

function updateRooms() {
  if (!roomLayer)
    return;
  const layer = roomLayer;
  layer.children.forEach(disposeObject);
  layer.clear();

  const rooms = props.rooms.slice(0, 12);
  const count = Math.max(rooms.length, 1);
  rooms.forEach((room, index) => {
    const angle = count === 1 ? 0 : -Math.PI * 0.68 + (Math.PI * 1.36 * index) / (count - 1);
    const radius = 2.05;
    const color = PRIORITY_COLORS[room.priority] ?? 0x46ddff;
    const height = 0.18 + Math.min(0.52, (room.occupiedBeds / Math.max(room.totalBeds, 1)) * 0.44);
    const block = addBox(
      layer,
      [Math.sin(angle) * radius, -0.2 + height / 2, Math.cos(angle) * radius - 0.35],
      [0.23, height, 0.23],
      color,
      room.priority === 'empty' ? 0.16 : 0.38,
    );
    block.name = `room-${room.sickroomCode}`;

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: room.priority === 'normal' || room.priority === 'empty' ? 0.38 : 0.9,
      }),
    );
    beacon.position.set(Math.sin(angle) * radius, 0.08 + height, Math.cos(angle) * radius - 0.35);
    layer.add(beacon);
  });
}

function resize() {
  if (!renderer || !camera || !canvasRef.value)
    return;
  const rect = canvasRef.value.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  if (!renderer || !scene || !camera || !root)
    return;
  const elapsed = (performance.now() - startedAt) / 1000;
  root.rotation.y = Math.sin(elapsed * 0.32) * 0.24;
  root.position.y = Math.sin(elapsed * 0.9) * 0.025;

  if (roomLayer) {
    roomLayer.children.forEach((child, index) => {
      if (!(child instanceof THREE.Mesh) || !child.material || Array.isArray(child.material))
        return;
      const material = child.material;
      if (!('opacity' in material))
        return;
      const pulse = props.alertCount ? Math.sin(elapsed * 4 + index) * 0.12 : Math.sin(elapsed * 1.6 + index) * 0.04;
      material.opacity = Math.max(0.16, Math.min(0.92, material.opacity + pulse * 0.02));
    });
  }

  renderer.render(scene, camera);
  frameId = window.requestAnimationFrame(animate);
}

function disposeScene() {
  if (frameId)
    window.cancelAnimationFrame(frameId);
  observer?.disconnect();
  scene?.traverse(disposeObject);
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  root = null;
  roomLayer = null;
  observer = null;
}

watch(
  () => props.rooms.map(room => `${room.sickroomCode}:${room.priority}:${room.occupiedBeds}:${room.totalBeds}`).join('|'),
  updateRooms,
);

onMounted(() => {
  if (canvasRef.value)
    createBaseScene(canvasRef.value);
});

onUnmounted(disposeScene);
</script>

<template>
  <canvas ref="canvasRef" class="command-scene" aria-label="护士站 3D 态势场景" />
</template>

<style scoped lang="scss">
.command-scene {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
