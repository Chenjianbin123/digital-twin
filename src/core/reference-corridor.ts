import * as THREE from 'three';

export const REFERENCE_CORRIDOR_ROOT = 'CorridorReferenceV2';
export const REFERENCE_CORRIDOR_LIGHTS = 'reference-corridor-lights';

export function isReferenceCorridor(model: THREE.Object3D) {
  return !!model.getObjectByName(REFERENCE_CORRIDOR_ROOT);
}

/** 静态建筑的接触影已烘焙；不用室外太阳光穿透封闭吊顶制造硬影。 */
export function prepareReferenceCorridor(model: THREE.Object3D) {
  if (!isReferenceCorridor(model)) return false;
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && material.aoMap)
        material.aoMapIntensity = .72;
    }
  });
  return true;
}

export function createReferenceCorridorLights() {
  const group = new THREE.Group();
  group.name = REFERENCE_CORRIDOR_LIGHTS;
  group.add(new THREE.HemisphereLight(0xe8f1f6, 0xd8ddd9, .95));
  // 两条连续顶灯对应模型灯槽；柔光不需要额外的逐帧阴影 pass。
  for (const x of [-1.36, 1.36]) {
    const strip = new THREE.RectAreaLight(0xfff6e9, 3.8, .7, 25);
    strip.position.set(x, 3.08, 0);
    strip.lookAt(x, 0, 0);
    group.add(strip);
  }
  const window = new THREE.RectAreaLight(0xeaf5ff, 3, 4.2, 2.4);
  window.position.set(0, 1.7, -12.7);
  window.lookAt(0, 1.3, 4);
  group.add(window);
  return group;
}

/** 只调底色：保留木纹、拉丝、法线及独立 UV 的 AO，不影响运行时门口屏。 */
export function createReferenceCorridorTheme() {
  const originals = new WeakMap<THREE.MeshStandardMaterial, THREE.Color>();
  const surfaces = new Set([
    'Ceramic warm white', 'Impact panel pearl grey', 'Brushed aluminium',
    'Door pale ash', 'Floor fine aggregate', 'Handrail ivory', 'Satin clinical teal',
  ]);
  const tint = new THREE.Color('#7298b3');
  return (model: THREE.Object3D, dark: boolean) => {
    if (!isReferenceCorridor(model)) return false;
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        const name = material.name.replace(/(?:_AO|\.\d+)+$/g, '');
        if (!surfaces.has(name)) continue;
        if (!originals.has(material)) originals.set(material, material.color.clone());
        material.color.copy(originals.get(material)!);
        if (dark) material.color.multiply(tint);
      }
    });
    return true;
  };
}
