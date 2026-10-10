import * as THREE from 'three';
import { REFERENCE_SCREENS } from './reference-nurse-station.ts';

export const SILVER_STATION_SCREENS = [...REFERENCE_SCREENS, ['wardStatus', 'Screen_Service']] as const;
export const SILVER_STATION_LIGHTS = 'silver-nurse-station-lights';

/** 仅适配实时渲染，不移动/缩放模型或屏幕，保留作者的 PBR 贴图。 */
export function prepareSilverStation(model: THREE.Object3D) {
  if (!model.getObjectByName('NurseStationSilverV1')) throw new Error('护士站模型与 silver-v1 布局不匹配');
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    // glTF splits multi-material meshes into primitives; preserve the hero shadow marker.
    object.castShadow = object.userData.castStationShadow === true
      || !/Screen|display|Architecture|Ceiling|地板/i.test(object.name);
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshStandardMaterial && material.aoMap) material.aoMapIntensity = .72;
    }
  });
}

export function createSilverStationLights() {
  const group = new THREE.Group();
  group.name = SILVER_STATION_LIGHTS;
  const ambient = new THREE.HemisphereLight(0xe8f1ff, 0x99948d, .5);
  ambient.name = 'station-ambient';
  group.add(ambient);
  for (const [name, x, y, z, width, height, intensity] of [
    ['station-front', -3, 3.1, 4.4, 7, 3, 2.7], ['station-right', 6.7, 2.8, .4, 2, 2.5, 2.2],
    ['station-left', -6.8, 2.7, .4, 2, 2.7, 3], ['station-worktop', 0, 2.9, -1.4, 8, 1.5, 2.7],
  ] as const) {
    const light = new THREE.RectAreaLight(0xfff4e5, intensity, width, height);
    light.name = name;
    light.position.set(x, y, z);
    light.lookAt(0, 1, -1.5);
    group.add(light);
  }
  const key = new THREE.SpotLight(0xfff6ea, 145, 25, Math.PI / 2.6, .8, 1.7);
  key.name = 'station-key';
  key.position.set(-3, 3.35, 4);
  key.target.position.set(0, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001;
  key.shadow.normalBias = .008;
  key.shadow.radius = 2;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  group.add(key, key.target);
  return group;
}

interface DarkSurface {
  color: string;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  emissive?: string;
  emissionScale?: number;
}

// Neutral architectural surfaces keep the hospital readable; cyan is reserved for accents.
const DARK_SURFACES: Record<string, DarkSurface> = {
  SilverV1_white: { color: '#adb9bf' },
  SilverV1_wall: { color: '#56636b' },
  SilverV1_silver: { color: '#5c646b', metalness: .55, envMapIntensity: .55 },
  SilverV1_steel: { color: '#a2a9ad', roughness: .48, envMapIntensity: .8 },
  SilverV1_teal: { color: '#225562', roughness: .48 },
  SilverV1_floor: { color: '#666d73' },
  SilverV1_oak: { color: '#dfd3c4' },
  SilverV1_backplate: { color: '#273e49' },
  SilverV1_header: { color: '#20343f', roughness: .52 },
  SilverV1_porcelain: { color: '#c3c9ca' },
  SilverV1_glass_trim: { color: '#82979f' },
  SilverV1_cyan: { color: '#29b1c5', emissive: '#62d4e5', emissionScale: .85 },
  SilverV1_lamp: { color: '#e8ece9', emissive: '#e8ece9', emissionScale: .6 },
  SilverV1_sky: { color: '#697e8b', emissive: '#91a4af', emissionScale: .45 },
};

const DARK_LIGHTS: Record<string, { color: string; scale: number; ground?: string }> = {
  'station-ambient': { color: '#e5e9ec', ground: '#6b7377', scale: .56 },
  'station-front': { color: '#e5eff2', scale: .65 },
  'station-right': { color: '#fff0de', scale: .55 },
  'station-left': { color: '#c8e3ec', scale: .38 },
  'station-worktop': { color: '#edf3f2', scale: .85 },
  'station-key': { color: '#fff5e9', scale: .82 },
};

/** 深色独立调整材质/光温；完整保存浅色 PBR 参数，切换不累加、不替换贴图。 */
export function createSilverStationTheme() {
  const originals = new WeakMap<THREE.MeshStandardMaterial, {
    color: THREE.Color; roughness: number; metalness: number; envMapIntensity: number;
    emissive: THREE.Color; emissiveIntensity: number;
  }>();
  const lights = new WeakMap<THREE.Light, { color: THREE.Color; intensity: number; ground?: THREE.Color }>();
  return (model: THREE.Object3D | null, lighting: THREE.Object3D | undefined, dark: boolean) => {
    const visited = new Set<THREE.Material>();
    model?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || visited.has(material)) continue;
        visited.add(material);
        const surface = DARK_SURFACES[material.name.replace(/_AO$/, '')];
        if (!surface) continue;
        if (!originals.has(material)) originals.set(material, {
          color: material.color.clone(), roughness: material.roughness, metalness: material.metalness,
          envMapIntensity: material.envMapIntensity, emissive: material.emissive.clone(), emissiveIntensity: material.emissiveIntensity,
        });
        const original = originals.get(material)!;
        const profile = dark ? surface : undefined;
        if (profile) material.color.set(profile.color);
        else material.color.copy(original.color);
        material.roughness = profile?.roughness ?? original.roughness;
        material.metalness = profile?.metalness ?? original.metalness;
        material.envMapIntensity = profile?.envMapIntensity ?? original.envMapIntensity;
        if (profile?.emissive) material.emissive.set(profile.emissive);
        else material.emissive.copy(original.emissive);
        material.emissiveIntensity = original.emissiveIntensity * (profile?.emissionScale ?? 1);
      }
    });
    lighting?.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      const profile = DARK_LIGHTS[object.name];
      if (!profile) return;
      if (!lights.has(object)) lights.set(object, { color: object.color.clone(), intensity: object.intensity,
        ground: object instanceof THREE.HemisphereLight ? object.groundColor.clone() : undefined });
      const original = lights.get(object)!;
      if (dark) object.color.set(profile.color);
      else object.color.copy(original.color);
      object.intensity = original.intensity * (dark ? profile.scale : 1);
      if (object instanceof THREE.HemisphereLight && original.ground) {
        if (dark && profile.ground) object.groundColor.set(profile.ground);
        else object.groundColor.copy(original.ground);
      }
    });
  };
}
