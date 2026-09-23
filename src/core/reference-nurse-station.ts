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
  // GLB 的静态演示卡片位于屏幕前方；实时屏幕就绪后隐藏，避免遮挡真实数据。
  model.traverse(object => {
    if (object.name.startsWith('Preview_Dashboard_') || object.name === 'Preview_Data_Footer') {
      object.visible = false;
    }
  });
  return displays;
}

const adaptedWallDisplays = new WeakSet<THREE.Object3D>();

/** Move the exported face and bezel together in world axes, regardless of glTF node rotation. */
export function adaptReferenceWallDisplay(model: THREE.Object3D) {
  if (adaptedWallDisplays.has(model)) return;
  const face = model.getObjectByName('Screen_Main');
  const frame = model.getObjectByName('Screen_Main_Frame');
  if (!(face instanceof THREE.Mesh) || !(frame instanceof THREE.Mesh)) return;
  model.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(face).getCenter(new THREE.Vector3());
  const resize = new THREE.Matrix4().makeTranslation(center.x, center.y + .10, center.z)
    .multiply(new THREE.Matrix4().makeScale(1.24, .88, 1))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z));
  const transform = (object: THREE.Object3D, matrix: THREE.Matrix4) => {
    const local = object.parent!.matrixWorld.clone().invert().multiply(matrix).multiply(object.matrixWorld);
    local.decompose(object.position, object.quaternion, object.scale);
    object.updateMatrixWorld(true);
  };
  transform(face, resize);
  transform(frame, resize);
  const clockOffset = new THREE.Matrix4().makeTranslation(.18, 0, 0);
  for (const name of ['Clock_Frame', 'Clock_Display', 'Wall_Motto']) {
    const object = model.getObjectByName(name);
    if (object) transform(object, clockOffset);
  }
  adaptedWallDisplays.add(model);
}

/** The reference model is authored in metres and faces +Z in glTF coordinates. */
export function prepareReferenceStation(model: THREE.Object3D) {
  adaptReferenceWallDisplay(model);
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const architecturalShell = /^(Ceiling|Station_Canopy|Floor|地板|天花板)$/i.test(object.name)
      || /Ceiling|Floor|天花板|地板/i.test(object.name);
    // Geometry Nodes 导出的立体字网格常叫「GN Instance」，要沿父链识别台楣标题/标语。
    const noWallShadow = (() => {
      for (let node: THREE.Object3D | null = object; node; node = node.parent) {
        if (/Station_Header|Lettering|Motto|Station_Canopy|^Canopy_|Clock/i.test(node.name))
          return true;
      }
      return false;
    })();
    object.castShadow = !architecturalShell && !noWallShadow && !/Glass|Glazing|Screen|LED/i.test(object.name);
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
  // 压低环境/面光填充，让 Spot 投影真正落在台面与地面上。
  group.add(new THREE.HemisphereLight(0xf4f0e8, 0x8a9498, .3));
  for (const [x, y, z, width, height] of [[-3.7, 2.9, 4, 4.8, 2], [5.8, 2.6, 0, 2, 2.5], [0, 2.85, -2.9, 6.5, .8]]) {
    const light = new THREE.RectAreaLight(0xfff4e4, 1.62, width, height);
    light.position.set(x, y, z);
    light.lookAt(0, 1, -2);
    group.add(light);
  }
  const key = new THREE.SpotLight(0xfff4e4, 72, 25, Math.PI / 2.55, .48, 1.85);
  key.position.set(-2.4, 3.35, 3.2);
  key.target.position.set(0.2, 0.05, -0.4);
  key.castShadow = true;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001;
  key.shadow.normalBias = .012;
  key.shadow.radius = 1.05;
  key.shadow.intensity = 1.48;
  key.shadow.camera.near = 0.6;
  key.shadow.camera.far = 18;
  group.add(key, key.target);

  // 接触影略收敛，避免地面大片发闷。
  const contact = new THREE.DirectionalLight(0xfff4e8, 0.55);
  contact.name = 'reference-station-contact-shadow';
  contact.position.set(2.5, 5.5, 3.2);
  contact.target.position.set(0, 0, -0.5);
  contact.castShadow = true;
  contact.shadow.autoUpdate = false;
  contact.shadow.needsUpdate = true;
  contact.shadow.mapSize.set(2048, 2048);
  contact.shadow.bias = -0.00008;
  contact.shadow.normalBias = 0.01;
  contact.shadow.radius = 0.95;
  contact.shadow.intensity = 1.3;
  contact.shadow.camera.near = 0.5;
  contact.shadow.camera.far = 22;
  contact.shadow.camera.left = -7;
  contact.shadow.camera.right = 7;
  contact.shadow.camera.top = 7;
  contact.shadow.camera.bottom = -7;
  group.add(contact, contact.target);
  return group;
}

export function createReferenceClockTexture(now = new Date(), target?: THREE.CanvasTexture) {
  const canvas: HTMLCanvasElement = target?.image ?? document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建护士站时钟画布');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 512, 512);
  ctx.beginPath();
  ctx.arc(256, 256, 252, 0, Math.PI * 2);
  ctx.fillStyle = '#faf9f4';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(256, 256, 252, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(256, 256);
  ctx.fillStyle = ctx.strokeStyle = '#203c43';
  ctx.font = '36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let hour = 1; hour <= 12; hour++) {
    const angle = hour * Math.PI / 6;
    ctx.fillText(String(hour), Math.sin(angle) * 202, -Math.cos(angle) * 202);
  }
  for (let tick = 0; tick < 60; tick++) {
    const angle = tick * Math.PI / 30;
    const outer = 238;
    const inner = tick % 5 === 0 ? 214 : 226;
    ctx.beginPath();
    ctx.lineWidth = tick % 5 === 0 ? 3 : 1.5;
    ctx.moveTo(Math.sin(angle) * inner, -Math.cos(angle) * inner);
    ctx.lineTo(Math.sin(angle) * outer, -Math.cos(angle) * outer);
    ctx.stroke();
  }
  const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  for (const [angle, length, width, color] of [
    [hours * Math.PI / 6, 116, 14, '#203c43'],
    [minutes * Math.PI / 30, 174, 9, '#203c43'],
    [seconds * Math.PI / 30, 198, 3, '#c43c3c'],
  ] as const) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(angle) * length, -Math.cos(angle) * length);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.fillStyle = '#c43c3c';
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const texture = target ?? new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
