<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import * as THREE from 'three';

const props = defineProps<{
  progress: number;
  phase: string;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let frameId = 0;
let startedAt = 0;
let resizeHandler: (() => void) | null = null;
let curveProgressUniform: { value: number } | null = null;

function addBox(
  parent: THREE.Group,
  position: THREE.Vector3Tuple,
  scale: THREE.Vector3Tuple,
  color: number,
  opacity = 0.34,
) {
  const geometry = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.62,
    metalness: 0.08,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  parent.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x83eaff,
      transparent: true,
      opacity: 0.36,
    }),
  );
  edges.position.copy(mesh.position);
  parent.add(edges);

  return mesh;
}

function addGlowCurve(parent: THREE.Group) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-4.2, 1.25, 0.3),
    new THREE.Vector3(-2.7, 1.52, 0.25),
    new THREE.Vector3(-1.2, 1.44, 0.18),
    new THREE.Vector3(0.15, 1.9, 0),
    new THREE.Vector3(1.55, 1.78, -0.1),
    new THREE.Vector3(2.8, 1.45, -0.16),
    new THREE.Vector3(4.25, 1.32, -0.2),
  ]);
  const baseGeometry = new THREE.TubeGeometry(curve, 128, 0.011, 8, false);
  const baseMaterial = new THREE.MeshBasicMaterial({
    color: 0x8da8b4,
    transparent: true,
    opacity: 0.22,
  });
  const baseLine = new THREE.Mesh(baseGeometry, baseMaterial);
  parent.add(baseLine);

  const progressGeometry = new THREE.TubeGeometry(curve, 128, 0.017, 10, false);
  const progressMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uProgress: { value: 0.02 },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        if (vUv.x > uProgress) {
          discard;
        }

        float head = smoothstep(0.11, 0.0, abs(vUv.x - uProgress));
        float pulse = 0.72 + 0.28 * sin(uTime * 4.0 + vUv.x * 18.0);
        vec3 base = vec3(0.72, 0.93, 1.0);
        vec3 hot = vec3(1.0, 1.0, 1.0);
        vec3 color = mix(base, hot, head) * pulse;
        float alpha = 0.7 + head * 0.3;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  });
  curveProgressUniform = progressMaterial.uniforms.uProgress as { value: number };
  const progressLine = new THREE.Mesh(progressGeometry, progressMaterial);
  parent.add(progressLine);

  const glowGeometry = new THREE.TubeGeometry(curve, 128, 0.031, 10, false);
  const glowMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: progressMaterial.uniforms,
    vertexShader: progressMaterial.vertexShader,
    fragmentShader: `
      uniform float uProgress;
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        if (vUv.x > uProgress) {
          discard;
        }

        float head = smoothstep(0.18, 0.0, abs(vUv.x - uProgress));
        float pulse = 0.45 + 0.25 * sin(uTime * 3.2 + vUv.x * 14.0);
        gl_FragColor = vec4(0.35, 0.86, 1.0, (0.08 + head * 0.22) * pulse);
      }
    `,
  });
  const glowLine = new THREE.Mesh(glowGeometry, glowMaterial);
  parent.add(glowLine);

  return progressMaterial.uniforms;
}

function addParticles(parent: THREE.Group) {
  const count = 90;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 9;
    positions[i * 3 + 1] = Math.random() * 2.5 - 0.2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5.2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0x6fe3ff,
    size: 0.025,
    transparent: true,
    opacity: 0.34,
  });
  parent.add(new THREE.Points(geometry, material));
}

function createStartupScene(canvas: HTMLCanvasElement) {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 2.55, 8.8);
  camera.lookAt(0, 0.55, 0);

  const root = new THREE.Group();
  root.name = 'startup-ward-webgl';
  scene.add(root);

  const ambient = new THREE.AmbientLight(0x8bdcff, 0.75);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 4.5, 3);
  scene.add(ambient, key);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(9.5, 5.6, 18, 12),
    new THREE.MeshStandardMaterial({
      color: 0x06131e,
      transparent: true,
      opacity: 0.6,
      roughness: 0.28,
      metalness: 0.26,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.42;
  root.add(floor);

  const grid = new THREE.GridHelper(9, 18, 0x50d9ff, 0x1b455a);
  grid.position.y = -0.4;
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.18;
  root.add(grid);

  addBox(root, [0, 0, 0], [3.7, 0.56, 0.72], 0x88c8d8, 0.26);
  addBox(root, [-1.45, 0.42, -0.18], [0.82, 0.52, 0.06], 0x66dfff, 0.32);
  addBox(root, [1.35, 0.4, -0.2], [0.72, 0.48, 0.06], 0x66dfff, 0.32);
  addBox(root, [0, 0.64, -0.46], [1.65, 0.72, 0.05], 0x1f7ed0, 0.3);
  addBox(root, [-2.95, -0.03, 0.86], [1.12, 0.22, 1.38], 0xa8d8e2, 0.2);
  addBox(root, [2.9, -0.03, 0.86], [1.12, 0.22, 1.38], 0xa8d8e2, 0.2);
  addBox(root, [-3.4, 0.52, -0.88], [0.88, 0.7, 0.05], 0x41b7ff, 0.2);
  addBox(root, [3.4, 0.52, -0.88], [0.88, 0.7, 0.05], 0x41b7ff, 0.2);

  const glowCurveUniforms = addGlowCurve(root);
  addParticles(root);

  resizeHandler = () => {
    if (!renderer || !camera)
      return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resizeHandler();
  window.addEventListener('resize', resizeHandler);

  startedAt = performance.now();
  const animate = () => {
    if (!renderer || !scene || !camera)
      return;
    const elapsed = (performance.now() - startedAt) / 1000;
    root.rotation.y = Math.sin(elapsed * 0.36) * 0.18;
    root.rotation.x = -0.05 + Math.sin(elapsed * 0.28) * 0.018;
    root.position.y = Math.sin(elapsed * 0.9) * 0.025;
    camera.position.x = Math.sin(elapsed * 0.25) * 0.28;
    camera.lookAt(0, 0.48, 0);
    const targetProgress = THREE.MathUtils.clamp(props.progress / 100, 0.02, 1);
    if (curveProgressUniform)
      curveProgressUniform.value += (targetProgress - curveProgressUniform.value) * 0.12;
    glowCurveUniforms.uTime.value = elapsed;
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(animate);
  };
  animate();
}

function disposeStartupScene() {
  if (frameId)
    window.cancelAnimationFrame(frameId);
  if (resizeHandler)
    window.removeEventListener('resize', resizeHandler);

  scene?.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Points) {
      object.geometry.dispose();
      const material = object.material;
      if (Array.isArray(material))
        material.forEach(item => item.dispose());
      else
        material.dispose();
    }
  });
  renderer?.dispose();
  renderer = null;
  scene = null;
  camera = null;
  resizeHandler = null;
  curveProgressUniform = null;
}

onMounted(() => {
  if (canvasRef.value)
    createStartupScene(canvasRef.value);
});

onUnmounted(() => {
  disposeStartupScene();
});
</script>

<template>
  <section class="startup-loader" aria-label="系统初始化">
    <canvas ref="canvasRef" class="startup-loader__canvas" aria-hidden="true" />

    <div class="startup-loader__stage">
      <div class="startup-loader__percent">
        <strong>{{ Math.round(progress) }}%</strong>
        <span>{{ phase }}</span>
      </div>
    </div>

    <div class="startup-loader__footer">
      <span>WARD DIGITAL TWIN</span>
      <i />
      <span>SMART NURSE STATION</span>
    </div>
  </section>
</template>

<style scoped lang="scss">
.startup-loader {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-height: 100dvh;
  padding: clamp(28px, 5.5vh, 56px) 28px clamp(30px, 5.8vh, 60px);
  background:
    radial-gradient(circle at 50% 18%, rgba(64, 204, 255, 0.1), transparent 28%),
    #03070c;
  color: #f3fbff;
  overflow: hidden;

  &__canvas {
    position: absolute;
    inset: 0;
    z-index: 0;
    width: 100%;
    height: 100%;
    opacity: 0.94;
  }

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.018) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at center, black 0 38%, transparent 76%);
    pointer-events: none;
    z-index: 1;
  }

  &__stage {
    position: relative;
    z-index: 2;
    display: grid;
    place-items: center;
    align-self: center;
    width: min(760px, 78vw);
    min-height: min(520px, 58vh);
    margin: 0 auto;
    transform: translateY(-2vh);
  }

  &__percent {
    position: absolute;
    top: 51%;
    left: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translate(-50%, -50%);

    strong {
      font-size: clamp(30px, 4.1vw, 52px);
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0;
      color: #fff;
      text-shadow: 0 0 22px rgba(124, 230, 255, 0.28);
      font-variant-numeric: tabular-nums;
    }

    span {
      margin-top: 10px;
      color: rgba(185, 213, 228, 0.82);
      font-size: 12px;
      font-weight: 700;
    }
  }

  &__footer {
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 10px;
    color: rgba(178, 210, 228, 0.68);
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1.8px;

    i {
      width: 48px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(104, 219, 255, 0.76), transparent);
    }
  }
}

@include down($bp-sm) {
  .startup-loader {
    padding: 26px 16px 28px;

    &__stage {
      width: min(560px, 88vw);
      min-height: min(440px, 60vh);
    }

    &__percent {
      strong {
        font-size: clamp(28px, 10vw, 42px);
      }

      span {
        font-size: 11px;
      }
    }

    &__footer {
      gap: 8px;
      font-size: 9px;
      letter-spacing: 1px;

      i {
        width: 30px;
      }
    }
  }
}
</style>
