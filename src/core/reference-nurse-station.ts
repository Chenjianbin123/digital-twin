import * as THREE from 'three';

export const REFERENCE_SCREENS = [
  ['dashboard', 'Screen_Main'], ['taskQueue', 'Screen_Work_01'],
  ['wardStatus', 'Screen_Work_02'], ['bedMonitor', 'Screen_Work_03'],
  ['deviceHealth', 'Screen_Work_04'],
] as const;
export type ReferenceBoardKind = typeof REFERENCE_SCREENS[number][0] | 'clock';

export function referenceStationFov(aspect: number, baseFov: number) {
  const safeAspect = Math.max(.1, Number.isFinite(aspect) ? aspect : 1);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * Math.max(1, (16 / 9) / safeAspect)));
}

/** Bind exact exported faces, never infer an absent board from unrelated furniture. */
export function bindReferenceStationDisplays(
  model: THREE.Object3D,
  createTexture: (kind: ReferenceBoardKind) => THREE.Texture,
) {
  const faces = REFERENCE_SCREENS.map(([kind, name]) => {
    const source = model.getObjectByName(name);
    if (!(source instanceof THREE.Mesh) || !source.geometry.getAttribute('uv'))
      throw new Error(`护士站模型缺少独立屏幕或 UV: ${name}`);
    return { kind, source };
  });
  const clock = model.getObjectByName('Clock_Display');
  if (!(clock instanceof THREE.Mesh)) throw new Error('护士站模型缺少 Clock_Display');
  model.updateMatrixWorld(true);
  const displays: { kind: ReferenceBoardKind; screen: THREE.Mesh; texture: THREE.Texture }[] = [];
  for (const { kind, source } of faces) {
    const texture = createTexture(kind);
    texture.flipY = false;
    const screen = new THREE.Mesh(source.geometry.clone(), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    screen.name = `nurse-station-reference-display-${kind}`;
    screen.position.copy(source.position);
    screen.quaternion.copy(source.quaternion);
    screen.scale.copy(source.scale);
    // Keep the original material attached to the hidden source so normal teardown owns it.
    source.visible = false;
    source.parent!.add(screen);
    displays.push({ kind, screen, texture });
  }
  const bounds = new THREE.Box3().setFromObject(clock);
  const position = bounds.getCenter(new THREE.Vector3());
  position.z = bounds.max.z + .001;
  model.worldToLocal(position);
  const texture = createTexture('clock');
  const screen = new THREE.Mesh(new THREE.CircleGeometry(.222, 64), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  screen.name = 'nurse-station-reference-display-clock';
  screen.position.copy(position);
  model.add(screen);
  displays.push({ kind: 'clock', screen, texture });
  return displays;
}

/** The reference model is authored in metres and faces +Z in glTF coordinates. */
export function prepareReferenceStation(model: THREE.Object3D) {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = !/Glass|Glazing|Screen|LED/i.test(object.name);
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material instanceof THREE.MeshPhysicalMaterial && material.name === 'V2_Window_Glass') {
        // Thin architectural windows do not need a second full-scene refraction pass.
        material.transmission = 0;
        material.transparent = true;
        material.opacity = .16;
        material.depthWrite = false;
        material.needsUpdate = true;
      }
    }
  });
  model.updateMatrixWorld(true);
}

export function createReferenceStationLights() {
  const group = new THREE.Group();
  group.name = 'reference-nurse-station-lights';
  group.add(new THREE.HemisphereLight(0xe6f1ff, 0xb3a28a, .6));
  for (const [x, y, z, width, height] of [[-3.7, 2.9, 4, 4.8, 2], [5.8, 2.6, 0, 2, 2.5], [0, 2.85, -2.9, 6.5, .8]]) {
    const light = new THREE.RectAreaLight(0xfff2de, 2, width, height);
    light.position.set(x, y, z);
    light.lookAt(0, 1, -2);
    group.add(light);
  }
  const key = new THREE.SpotLight(0xfff7eb, 45, 25, Math.PI / 2.7, .85, 2);
  key.position.set(-3, 3.05, 3.5);
  key.target.position.set(0, .6, -.6);
  key.castShadow = true;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001;
  key.shadow.normalBias = .012;
  group.add(key, key.target);
  return group;
}

export function createReferenceClockTexture(now = new Date()) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建护士站时钟画布');
  ctx.fillStyle = '#faf9f4'; ctx.fillRect(0, 0, 512, 512);
  ctx.translate(256, 256);
  ctx.fillStyle = ctx.strokeStyle = '#203c43';
  ctx.font = '36px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let hour = 1; hour <= 12; hour++) {
    const angle = hour * Math.PI / 6;
    ctx.fillText(String(hour), Math.sin(angle) * 202, -Math.cos(angle) * 202);
  }
  const seconds = now.getSeconds();
  const minutes = now.getMinutes() + seconds / 60;
  const hours = now.getHours() % 12 + minutes / 60;
  for (const [angle, length, width] of [[hours * Math.PI / 6, 116, 14], [minutes * Math.PI / 30, 174, 9], [seconds * Math.PI / 30, 182, 3]]) {
    ctx.beginPath(); ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.moveTo(0, 0); ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
