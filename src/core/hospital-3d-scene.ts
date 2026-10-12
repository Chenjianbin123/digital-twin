import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { hospitalModels, type HospitalOverview } from './hospital-navigation';
import { loadHospitalModel, disposeHospitalModel } from './hospital-3d-assets';
import { hospitalCameraFrame } from './hospital-3d-camera';
import { createHospitalExteriorSky } from './hospital-exterior-sky';

export interface Hospital3DCallbacks {
  state: (state: 'loading' | 'ready' | 'fallback') => void;
  progress: (percent: number) => void;
  marker: (position: { x: number; y: number; visible: boolean }) => void;
  zoom: (value: number) => void;
  enter: () => void;
}

export function createHospital3DScene(host: HTMLElement, kind: HospitalOverview, theme: 'light' | 'dark', callbacks: Hospital3DCallbacks) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  const scene = new THREE.Scene();
  // Distant window panes sit millimetres in front of their facade. A tiny
  // near plane loses depth precision there and produces a broken window grid.
  const camera = kind === 'exterior' ? new THREE.PerspectiveCamera(30, 1, 10, 4500)
    : new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 3000);
  const controls = new OrbitControls(camera, renderer.domElement);
  const abort = new AbortController(), raycaster = new THREE.Raycaster();
  const hemisphere = new THREE.HemisphereLight(0xddecff, 0x8b897b, 1.7);
  const sun = new THREE.DirectionalLight(0xfff1df, 2.7);
  const rim = new THREE.DirectionalLight(0xb8ddff, .8);
  let disposed = false, active = true, ready = false, lost = false, frame = 0, renderCount = 0;
  let model: Awaited<ReturnType<typeof loadHospitalModel>> | undefined;
  let bounds: THREE.Box3 | undefined;
  const floorRanges: THREE.Box3[] = [];
  let home: { target: THREE.Vector3; position: THREE.Vector3 } | undefined;
  let environment: THREE.WebGLRenderTarget | undefined;
  const sky = kind === 'exterior' ? createHospitalExteriorSky() : undefined;
  let width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
  let pointerStart: { x: number; y: number; id: number } | undefined;
  let pointerMoved = false;
  const frameTimes: number[] = [];
  const materials = new Map<THREE.MeshStandardMaterial, number>();
  const keyLights: THREE.PointLight[] = [];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(width, height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute('aria-label', kind === 'floor' ? '可旋转的三维病区模型' : '可旋转的三维医院模型');
  renderer.domElement.setAttribute('role', 'img');
  host.append(renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = .12;
  controls.minPolarAngle = .08; controls.maxPolarAngle = Math.PI / 2 - .06;
  controls.minZoom = .65; controls.maxZoom = 4;
  if (kind === 'exterior') { controls.minDistance = 80; controls.maxDistance = 600; }
  controls.screenSpacePanning = true;
  controls.listenToKeyEvents(host);
  if (sky) scene.add(sky.mesh);
  else {
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, .04);
    pmrem.dispose(); room.dispose(); scene.environment = environment.texture;
  }
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = kind === 'floor' ? .025 : .08;
  sun.shadow.bias = -.0001;
  scene.add(hemisphere, sun, sun.target, rim);

  function schedule() {
    if (!disposed && !lost && active && !document.hidden && !frame) frame = requestAnimationFrame(draw);
  }
  function draw() {
    frame = 0;
    if (disposed || lost || !active || document.hidden) return;
    const changing = controls.update();
    const before = performance.now();
    try {
      sky?.mesh.position.copy(camera.position);
      renderer.render(scene, camera); renderCount++;
      frameTimes.push(performance.now() - before); if (frameTimes.length > 120) frameTimes.shift();
      callbacks.zoom(camera.zoom);
      if (model && kind === 'floor') {
        const point = model.root.getObjectByName('NavigationAnchor')!.getWorldPosition(new THREE.Vector3()).project(camera);
        callbacks.marker({ x: (point.x + 1) / 2 * width, y: (1 - point.y) / 2 * height,
          visible: ready && Math.abs(point.x) < .95 && Math.abs(point.y) < .94 && Math.abs(point.z) < 1 });
      }
    } catch { callbacks.state('fallback'); lost = true; return; }
    if (changing) schedule();
  }
  function updateFrustum() {
    if (!bounds || !model) return;
    if (camera instanceof THREE.PerspectiveCamera) {
      const info = model.metadata;
      home = { target: new THREE.Vector3(...info.cameraTarget!), position: new THREE.Vector3(...info.cameraPosition!) };
      camera.aspect = width / height;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(info.cameraHorizontalFov!) / 2) / camera.aspect));
    } else {
      const fitted = hospitalCameraFrame(bounds, new THREE.Vector3(...model.metadata.cameraDirection), width / height);
      home = fitted;
      camera.left = -fitted.height * width / height / 2; camera.right = -camera.left;
      camera.top = fitted.height / 2; camera.bottom = -camera.top;
    }
    camera.updateProjectionMatrix();
  }
  function reset() {
    if (!home) return;
    // Clear OrbitControls' damping residual before restoring the saved default.
    controls.enableDamping = false; controls.update(); controls.enableDamping = true;
    controls.target.copy(home.target); camera.position.copy(home.position); camera.zoom = 1;
    camera.lookAt(controls.target); camera.updateProjectionMatrix(); controls.update(); controls.saveState(); schedule();
  }
  function resize() {
    if (disposed || !host.clientWidth || !host.clientHeight) return;
    width = host.clientWidth; height = host.clientHeight;
    renderer.setSize(width, height); updateFrustum(); schedule();
  }
  function setTheme(value: 'light' | 'dark') {
    theme = value;
    const dark = value === 'dark';
    scene.background = new THREE.Color(dark ? 0x10232f : 0xdce8ed);
    sky?.setTheme(dark);
    scene.fog = sky ? new THREE.Fog(dark ? 0x263c50 : 0xc0cbd1, 400, 1800) : null;
    hemisphere.intensity = dark ? .32 : .65;
    sun.intensity = dark ? .7 : (sky ? 3.3 : 1.7); sun.color.set(dark ? 0x91bfff : 0xfff1df);
    rim.intensity = dark ? .9 : .35;
    scene.environmentIntensity = dark ? .3 : .5;
    renderer.toneMappingExposure = dark ? .85 : (sky ? 1.05 : .9);
    materials.forEach((emission, material) => { material.emissiveIntensity = emission * (dark ? 1.8 : 1); });
    keyLights.forEach(light => { light.intensity = dark ? 22 : 5; });
    renderer.shadowMap.needsUpdate = true; schedule();
  }
  function hit(clientX: number, clientY: number) {
    if (!model) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, 1 - (clientY - rect.top) / rect.height * 2), camera);
    const intersection = raycaster.intersectObjects(model.meshes, false)[0];
    if (!intersection || (kind === 'exterior' && !floorRanges.some(range => range.containsPoint(intersection.point)))) return null;
    return intersection.object;
  }
  function down(event: PointerEvent) {
    if (pointerStart) { pointerMoved = true; return; }
    if (event.button === 0) { pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; pointerMoved = false; }
  }
  function move(event: PointerEvent) {
    if (pointerStart && Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) pointerMoved = true;
  }
  function up(event: PointerEvent) {
    if (pointerStart?.id !== event.pointerId) return;
    const click = !pointerMoved; pointerStart = undefined;
    if (click && ready && active && hit(event.clientX, event.clientY)?.userData.targetScene === hospitalModels[kind].target) callbacks.enter();
  }
  function cancelPointer() { pointerStart = undefined; pointerMoved = true; }
  function contextLost(event: Event) { event.preventDefault(); lost = true; cancelAnimationFrame(frame); frame = 0; callbacks.state('fallback'); }
  function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); }
  controls.addEventListener('change', schedule);
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancelPointer);
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(host);
  setTheme(theme); callbacks.state('loading');
  void loadHospitalModel(kind, abort.signal, callbacks.progress).then(loaded => {
    if (disposed) { disposeHospitalModel(loaded.root); loaded.daylight?.dispose(); return; }
    model = loaded; bounds = new THREE.Box3(new THREE.Vector3(...loaded.metadata.focusBounds[0]), new THREE.Vector3(...loaded.metadata.focusBounds[1]));
    scene.add(loaded.root);
    loaded.metadata.floorTargets?.forEach(target => floorRanges.push(new THREE.Box3(
      new THREE.Vector3(...target.bounds[0]), new THREE.Vector3(...target.bounds[1]))));
    if (loaded.daylight) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      environment = pmrem.fromEquirectangular(loaded.daylight);
      scene.environment = environment.texture;
      pmrem.dispose(); loaded.daylight.dispose(); loaded.daylight = undefined;
    }
    loaded.meshes.forEach(mesh => {
      mesh.castShadow = mesh.userData.backgroundContext !== true; mesh.receiveShadow = mesh.castShadow;
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        materials.set(material, material.emissiveIntensity);
        if (kind === 'floor' && material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) {
          material.transmission = 0; material.transparent = true;
          material.opacity = .24; material.depthWrite = false;
        }
      }
    });
    if (kind === 'floor') {
      for (const x of [-7, 7]) for (const z of [-4, 4]) {
        const light = new THREE.PointLight(0xffe3ba, 5, 12, 2); light.position.set(x, 4, z); keyLights.push(light); scene.add(light);
      }
    }
    const center = bounds.getCenter(new THREE.Vector3()), radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    sun.position.copy(center).add(new THREE.Vector3(-radius, radius * 1.8, radius)); sun.target.position.copy(center);
    if (sky) sun.position.copy(center).addScaledVector(new THREE.Vector3(-80, 105, 58).normalize(), radius * 2);
    rim.position.copy(center).add(new THREE.Vector3(radius, radius, -radius));
    Object.assign(sun.shadow.camera, { left: -radius, right: radius, top: radius, bottom: -radius, near: .1, far: radius * 6 });
    sun.shadow.camera.updateProjectionMatrix();
    updateFrustum(); reset(); setTheme(theme);
    renderer.shadowMap.needsUpdate = true;
    ready = true; controls.enabled = active; callbacks.progress(100);
    draw(); if (!lost) callbacks.state('ready');
  }).catch(error => { if (!disposed && error?.name !== 'AbortError') callbacks.state('fallback'); });

  return {
    setActive(value: boolean) { active = value; controls.enabled = value && ready; cancelPointer();
      if (!value) { cancelAnimationFrame(frame); frame = 0; } else { resize(); schedule(); } },
    setTheme,
    diagnostics() { return { kind, ready, active, renderCount, meshes: model?.meshes.length ?? 0,
      triangles: model?.metadata.triangles ?? 0, drawCalls: renderer.info.render.calls,
      camera: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom,
      frameMs: frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0,
      projection: camera.type, backgroundMeshes: model?.meshes.filter(mesh => mesh.userData.backgroundContext === true).length ?? 0,
      floorTargets: model?.metadata.floorTargets?.map(target => ({ building: target.building,
        point: new THREE.Vector3(...target.anchor).project(camera).toArray() })) ?? [],
      anchor: model ? new THREE.Vector3(...model.metadata.anchor).project(camera).toArray() : null }; },
    dispose() {
      if (disposed) return;
      disposed = true; abort.abort(); cancelAnimationFrame(frame); observer.disconnect();
      controls.removeEventListener('change', schedule); controls.dispose();
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up); renderer.domElement.removeEventListener('pointercancel', cancelPointer);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      if (model) disposeHospitalModel(model.root);
      sun.shadow.dispose(); environment?.dispose(); sky?.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    },
  };
}
