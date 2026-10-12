import * as THREE from 'three';

export const WARM_STATION_APPEARANCE = {
  light: { background: '#eeede9', exposure: 1.06, environmentIntensity: .42 },
  dark: { background: '#252c32', exposure: .82, environmentIntensity: .10 },
} as const;

interface LightProfile { color: string; intensity: number; ground?: string }

const LIGHTS = new Map<string, { light: LightProfile; dark: LightProfile }>([
  ['warm-station-ambient', {
    light: { color: '#f7f6f2', ground: '#a3a099', intensity: .42 },
    dark: { color: '#e5e9ec', ground: '#777570', intensity: .12 },
  }],
  ['warm-station-front', { light: { color: '#fffaf3', intensity: 2.8 }, dark: { color: '#f6f3ec', intensity: .65 } }],
  ['warm-station-left', { light: { color: '#f5f8fa', intensity: 3.0 }, dark: { color: '#e4ebf0', intensity: .45 } }],
  ['warm-station-worktop', { light: { color: '#fffaf2', intensity: 3.2 }, dark: { color: '#fff7e9', intensity: 3.4 } }],
  ['warm-station-corridor', { light: { color: '#f6f8fa', intensity: 3.0 }, dark: { color: '#edf0f2', intensity: 1.2 } }],
  ['warm-station-key', { light: { color: '#fffaf3', intensity: 55 }, dark: { color: '#fff7ec', intensity: 32 } }],
]);

/** 每盏灯使用固定主题参数，深色仍保留工作台和走廊的可读性。 */
export function applyWarmStationLighting(group: THREE.Group, dark: boolean): void {
  group.traverse(object => {
    if (!(object instanceof THREE.Light)) return;
    const theme = LIGHTS.get(object.name);
    if (!theme) return;
    const profile = dark ? theme.dark : theme.light;
    object.color.set(profile.color);
    object.intensity = profile.intensity;
    if (object instanceof THREE.HemisphereLight && profile.ground) object.groundColor.set(profile.ground);
  });
}

/** 调用方初始化 RectAreaLightUniformsLib，并在几何变动后刷新主光静态阴影。 */
export function createWarmStationLights(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'warm-nurse-station-lights';
  const ambient = new THREE.HemisphereLight();
  ambient.name = 'warm-station-ambient'; group.add(ambient);
  for (const [name, position, target, width, height] of [
    ['front', [-2, 2.8, 3], [0, 1, -2], 5.5, 2.4],
    ['left', [-5.35, 2.2, -1.5], [0, 1, -3], 2.6, 2],
    ['worktop', [0, 3.03, -1.7], [0, 0, -1.7], 4, 1],
    ['corridor', [-4.3, 2, -21.7], [-4.3, 1, -10], 2.55, 2.1],
  ] as const) {
    const light = new THREE.RectAreaLight(0xffffff, 1, width, height);
    light.name = `warm-station-${name}`;
    light.position.fromArray(position); light.lookAt(target[0], target[1], target[2]); group.add(light);
  }
  const key = new THREE.SpotLight(0xffffff, 1, 18, Math.PI / 4, .7, 1.8);
  key.name = 'warm-station-key';
  key.position.set(-2.8, 3.15, 3.2); key.target.position.set(0, .7, -1.7);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0001; key.shadow.normalBias = .01; key.shadow.radius = 2;
  key.shadow.autoUpdate = false; key.shadow.needsUpdate = true;
  group.add(key, key.target);
  applyWarmStationLighting(group, false);
  return group;
}

/** GLTFLoader splits multi-material nodes into children with generated mesh names. */
export function prepareWarmStationShadows(model: THREE.Object3D): void {
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false;
    object.receiveShadow = object.userData.runtimeSurface !== true;
  });
  for (const name of ['Desk_Static', 'Equipment_Static', 'Foliage_Static']) {
    model.getObjectByName(name)?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.runtimeSurface === true) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = materials.some(material => !material.transparent);
    });
  }
}

interface SurfaceProfile {
  color?: string;
  colorScale?: readonly [number, number, number];
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  emissive?: string;
  emissionScale?: number;
}

interface SurfaceTheme {
  light: SurfaceProfile;
  dark: SurfaceProfile;
}

const OAK: SurfaceTheme = {
  light: { colorScale: [1.06, 1.12, 1.3], envMapIntensity: .55 },
  dark: { colorScale: [1.06, 1.12, 1.3], envMapIntensity: .55 },
};

// Architecture keeps its physical finish at night; lighting, not dark paint, creates the theme.
const finish = (profile: SurfaceProfile): SurfaceTheme => ({ light: profile, dark: profile });

// warm-v3 merges geometry by material; material roles remain stable after glTF primitive splitting.
const SURFACES = new Map<string, SurfaceTheme>([
  ['WarmStationV1_wall', finish({ color: '#eeeae3', roughness: .8 })],
  ['WarmStationV2_v2_wall_panel', finish({ color: '#f4f1eb', roughness: .7 })],
  ['WarmStationV2_v2_ceiling_metal', finish({ color: '#e8e6e0', metalness: .03, roughness: .82, envMapIntensity: .45 })],
  ['WarmStationV1_white', finish({ color: '#f7f5ef', roughness: .34, envMapIntensity: .65 })],
  ['WarmStationV1_silver', {
    light: { color: '#c2cace', metalness: .48, roughness: .42, envMapIntensity: .7 },
    dark: { color: '#8e9ba3', metalness: .45, roughness: .49, envMapIntensity: .55 },
  }],
  ['WarmStationV1_steel', {
    light: { color: '#9aa8af', metalness: .65, roughness: .4, envMapIntensity: .85 },
    dark: { color: '#87949c', metalness: .6, roughness: .46, envMapIntensity: .65 },
  }],
  ['WarmStationV1_blue', {
    light: { color: '#385b74', roughness: .5 },
    dark: { color: '#223c50', roughness: .56 },
  }],
  ['WarmStationV1_dark', {
    light: { color: '#34434c' },
    dark: { color: '#273037' },
  }],
  ['WarmStationV1_floor', finish({ colorScale: [1.1, 1.06, 1], roughness: .65, envMapIntensity: .4 })],
  ['WarmStationV1_floor_blue', finish({ colorScale: [1.35, 1.12, .94], roughness: .62, envMapIntensity: .4 })],
  ['WarmStationV1_oak', OAK],
  ['WarmStationV3_oak_column', OAK],
  ['WarmStationV3_oak_door', OAK],
  ['WarmStationV3_oak_portal', OAK],
  ['WarmStationV1_fabric', {
    light: { colorScale: [.98, 1, 1.02] },
    dark: { colorScale: [.78, .84, .9] },
  }],
  ['WarmStationV1_paper', {
    light: { color: '#f3f3ed' },
    dark: { color: '#cdd2d0' },
  }],
  ['WarmStationV1_lamp', {
    light: { color: '#fffaf2', emissive: '#fffaf2', emissionScale: .32 },
    dark: { color: '#fff8ed', emissive: '#fff8ed', emissionScale: .22 },
  }],
  ['WarmStationV2_RecessedWarmLED', {
    light: { color: '#fff7e9', emissive: '#fff7e9', emissionScale: .28 },
    dark: { color: '#e6eff1', emissive: '#e6eff1', emissionScale: .22 },
  }],
]);

/** 独立调整两套材质外观，保存作者参数；不替换材质、贴图或屏幕内容。 */
export function createWarmStationTheme() {
  const originals = new WeakMap<THREE.MeshStandardMaterial, {
    color: THREE.Color; roughness: number; metalness: number; envMapIntensity: number;
    emissive: THREE.Color; emissiveIntensity: number;
  }>();

  return (model: THREE.Object3D | null, dark: boolean) => {
    const visited = new Set<THREE.Material>();
    model?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!(material instanceof THREE.MeshStandardMaterial) || visited.has(material)) continue;
        visited.add(material);
        const surface = SURFACES.get(material.name.replace(/_AO$/, ''));
        if (!surface) continue;
        if (!originals.has(material)) originals.set(material, {
          color: material.color.clone(), roughness: material.roughness, metalness: material.metalness,
          envMapIntensity: material.envMapIntensity, emissive: material.emissive.clone(), emissiveIntensity: material.emissiveIntensity,
        });
        const original = originals.get(material)!;
        const profile = dark ? surface.dark : surface.light;
        material.color.copy(original.color);
        if (profile.color) material.color.set(profile.color);
        if (profile.colorScale) {
          // A textured surface's color is a linear multiplier, not the visible wood/floor color.
          material.color.r *= profile.colorScale[0];
          material.color.g *= profile.colorScale[1];
          material.color.b *= profile.colorScale[2];
        }
        material.roughness = profile.roughness ?? original.roughness;
        material.metalness = profile.metalness ?? original.metalness;
        material.envMapIntensity = profile.envMapIntensity ?? original.envMapIntensity;
        if (profile.emissive) material.emissive.set(profile.emissive);
        else material.emissive.copy(original.emissive);
        material.emissiveIntensity = original.emissiveIntensity * (profile.emissionScale ?? 1);
      }
    });
  };
}
