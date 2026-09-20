import * as THREE from 'three';
import { createHospitalExterior } from './hospital-intro-model';
import { createExteriorSky } from './hospital-exterior-materials';

export const HOSPITAL_INTRO_DURATION = 8;
export interface HospitalIntroScene {
  setPaused: (paused: boolean) => void;
  dispose: () => void;
}
interface IntroCallbacks {
  onProgress: (seconds: number) => void;
  onComplete: () => void;
  onError: () => void;
}

/** The caller owns navigation; this scene owns only its canvas and render lifecycle. */
export function createHospitalIntroScene(host: HTMLElement, callbacks: IntroCallbacks): HospitalIntroScene {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 500);
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(77, 46, 96), new THREE.Vector3(48, 33, 91),
    new THREE.Vector3(23, 23, 77), new THREE.Vector3(5, 12, 53),
  ]);
  const target = new THREE.Vector3();
  let elapsed = 0, last = 0, frame = 0;
  let paused = false, finished = false, disposed = false;
  let sky: THREE.Texture | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  let observer: ResizeObserver | undefined;

  function stop() { cancelAnimationFrame(frame); last = 0; }
  function fail() {
    if (disposed || finished) return;
    finished = true; stop(); callbacks.onError();
  }
  function render() {
    const t = Math.min(elapsed / HOSPITAL_INTRO_DURATION, 1);
    const eased = t * t * (3 - 2 * t);
    camera.position.copy(path.getPoint(eased));
    target.set(-3 + 3 * eased, 12 - 4 * eased, 3 + 9 * eased);
    // Use aspect ratio rather than a width breakpoint to avoid a jump on rotation.
    const viewScale = Math.max(1, .95 / camera.aspect);
    camera.position.sub(target).multiplyScalar(viewScale).add(target);
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.near = 120 * viewScale; scene.fog.far = 290 * viewScale;
    }
    camera.lookAt(target);
    renderer.render(scene, camera);
    callbacks.onProgress(elapsed);
  }
  function tick(now: number) {
    if (disposed || finished || paused || document.hidden) { last = 0; return; }
    if (last) elapsed = Math.min(HOSPITAL_INTRO_DURATION, elapsed + (now - last) / 1000);
    last = now;
    try { render(); } catch { fail(); return; }
    if (elapsed >= HOSPITAL_INTRO_DURATION) {
      finished = true; callbacks.onComplete();
    } else frame = requestAnimationFrame(tick);
  }
  function schedule() {
    stop();
    if (!disposed && !finished && !paused && !document.hidden) frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    try { render(); } catch { fail(); }
  }
  function visibility() { if (document.hidden) stop(); else schedule(); }
  function contextLost(event: Event) { event.preventDefault(); fail(); }
  function dispose() {
    if (disposed) return;
    disposed = true; stop(); observer?.disconnect();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', visibility);
    renderer.domElement.removeEventListener('webglcontextlost', contextLost);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      }
      if (object instanceof THREE.InstancedMesh) object.dispose();
    });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose()); environment?.dispose(); sky?.dispose();
    renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  }

  try {
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    scene.background = new THREE.Color(0xd4e1e7); scene.fog = new THREE.Fog(0xd6dedb, 120, 290);
    scene.add(new THREE.HemisphereLight(0xdceaf6, 0x827b63, .75));
    const sun = new THREE.DirectionalLight(0xffedcf, 2.5);
    sun.position.set(-38, 49, 35); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -62, right: 62, top: 55, bottom: -55, near: 1, far: 160 });
    sun.shadow.normalBias = .025; scene.add(sun);
    sky = createExteriorSky();
    const pmrem = new THREE.PMREMGenerator(renderer);
    try { environment = pmrem.fromEquirectangular(sky); } finally { pmrem.dispose(); }
    scene.environment = environment.texture; scene.environmentIntensity = .7;
    scene.add(createHospitalExterior()); host.append(renderer.domElement);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibility);
    if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(resize); observer.observe(host); }
    else window.addEventListener('resize', resize);
    resize(); schedule();
  } catch (error) { dispose(); throw error; }
  return { setPaused(value) { paused = value; schedule(); }, dispose };
}
