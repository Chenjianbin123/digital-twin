import * as THREE from 'three';

/** 深色：冷青 HUD，贴合侧栏。 */
const darkPalette: Record<string, string> = {
  Warm_White_Solid_Surface: '#e1e8ea',
  Warm_White_Paint: '#d8e1df',
  Warm_Grey_Vinyl: '#becbc3',
  Floor_Border: '#738991',
  Natural_Oak: '#d8e1df',
  Sign_Teal: '#e5f0f2',
  V2_Exterior_Daylight: '#263e59',
  Warm_LED: '#d4e3e9',
  Brushed_Stainless: '#8a969c',
};

/** 浅色：对齐参考图 — 中性白台面 + 低饱和浅橡木。 */
const lightPalette: Record<string, string> = {
  Warm_White_Solid_Surface: '#f7f8f6',
  Warm_White_Paint: '#f1f2ef',
  Warm_Grey_Vinyl: '#d9dcda',
  Floor_Border: '#9ea6a2',
  Natural_Oak: '#d8bea0',
  Sign_Teal: '#44515b',
  V2_Exterior_Daylight: '#e6eef2',
  Warm_LED: '#f7f9fa',
  Brushed_Stainless: '#b9a68b',
};

const LIGHT_OAK_TINT = '#d8bea0';
const LIGHT_OAK_DOOR = '#806047';

const themedMaterialNames = new Set([
  ...Object.keys(darkPalette),
  ...Object.keys(lightPalette),
]);

function clearSurfaceMaps(material: THREE.MeshStandardMaterial) {
  material.map = null;
  material.normalMap = null;
  material.roughnessMap = null;
  material.metalness = 0;
}

function readTextureSize(image: { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | null) {
  if (!image) return null;
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement && !image.complete) return null;
  const width = image.width || image.naturalWidth || 0;
  const height = image.height || image.naturalHeight || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/** 把偏青漫反射按亮度重着色为浅橡木，保留木纹层次。 */
function createWarmOakAlbedo(source: THREE.Texture, tintHex: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const size = readTextureSize(source.image as { width?: number; height?: number; naturalWidth?: number; naturalHeight?: number } | null);
  if (!size) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(source.image as CanvasImageSource, 0, 0, size.width, size.height);
  }
  catch {
    return null;
  }
  const pixels = ctx.getImageData(0, 0, size.width, size.height);
  const tint = new THREE.Color(tintHex);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    // 偏青贴图用 G/B 权重提取木纹明暗。
    const lum = (0.18 * data[i] + 0.52 * data[i + 1] + 0.3 * data[i + 2]) / 255;
    const contrast = Math.pow(Math.min(1, Math.max(0.08, lum)), 0.82);
    // 提高暗部下限，保留木纹但避免大面积木墙显得脏、沉。
    const shade = 0.68 + 0.32 * contrast;
    data[i] = Math.round(tint.r * 255 * shade);
    data[i + 1] = Math.round(tint.g * 255 * shade);
    data[i + 2] = Math.round(tint.b * 255 * shade);
  }
  ctx.putImageData(pixels, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  texture.flipY = source.flipY;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.repeat.copy(source.repeat);
  texture.offset.copy(source.offset);
  texture.anisotropy = source.anisotropy;
  texture.needsUpdate = true;
  return texture;
}

/** Cache original values once so repeated switches never compound color changes. */
export function createStationTheme() {
  const prepared = new WeakSet<THREE.Mesh>();
  const originals = new WeakMap<THREE.MeshStandardMaterial, {
    map: THREE.Texture | null;
    normalMap: THREE.Texture | null;
    roughnessMap: THREE.Texture | null;
    metalness: number;
    color: THREE.Color;
    emissive: THREE.Color;
    intensity: number;
    roughness: number;
    envMapIntensity: number;
  }>();
  const lightDefaults = new WeakMap<THREE.Light, { color: THREE.Color; intensity: number }>();
  const warmOakMaps = new Map<string, THREE.CanvasTexture>();

  const resolveWarmOakMap = (source: THREE.Texture) => {
    const key = `${source.uuid}:${LIGHT_OAK_TINT}`;
    const cached = warmOakMaps.get(key);
    if (cached) return cached;
    const warm = createWarmOakAlbedo(source, LIGHT_OAK_TINT);
    // 贴图未就绪时不缓存失败，下次主题应用再试。
    if (warm) warmOakMaps.set(key, warm);
    return warm;
  };

  return (model: THREE.Object3D | null, lights: THREE.Object3D | undefined, dark: boolean) => {
    model?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 分离共享材质，避免后墙、弧面和台面互相串色；只克隆一次。
      if (!prepared.has(mesh)) {
        const clone = (material: THREE.Material) => {
          const m = material as THREE.MeshStandardMaterial;
          return m.isMeshStandardMaterial && (themedMaterialNames.has(m.name) || mesh.name === 'Counter_Steel_Plinth')
            ? m.clone()
            : m;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
        prepared.add(mesh);
      }

      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (!material.isMeshStandardMaterial || (!themedMaterialNames.has(material.name) && mesh.name !== 'Counter_Steel_Plinth')) continue;
        if (!originals.has(material)) {
          originals.set(material, {
            map: material.map,
            normalMap: material.normalMap,
            roughnessMap: material.roughnessMap,
            metalness: material.metalness,
            color: material.color.clone(),
            emissive: material.emissive.clone(),
            intensity: material.emissiveIntensity,
            roughness: material.roughness,
            envMapIntensity: material.envMapIntensity,
          });
        }
        const original = originals.get(material)!;
        const previousMap = material.map;
        const previousNormalMap = material.normalMap;
        const previousRoughnessMap = material.roughnessMap;
        material.map = original.map;
        material.normalMap = original.normalMap;
        material.roughnessMap = original.roughnessMap;
        material.metalness = original.metalness;
        material.color.copy(original.color);
        material.emissive.copy(original.emissive);
        material.emissiveIntensity = original.intensity;
        material.roughness = original.roughness;
        material.envMapIntensity = original.envMapIntensity;

        const palette = dark ? darkPalette : lightPalette;
        material.color.set(palette[material.name] ?? (dark ? '#334955' : '#e8ebe9'));

        if (dark) {
          if (material.name === 'Natural_Oak' || material.name === 'Warm_White_Solid_Surface') {
            clearSurfaceMaps(material);
          }
          // 建筑面共享材质，按节点分色才能保留台面与后墙的层次。
          if (['Nurse_Counter', 'Nurse_Counter_Oak'].includes(mesh.name)) material.color.set('#7ca0ae');
          if (mesh.name === 'Station_Canopy') material.color.set('#7da2b0');
          if (mesh.name === 'Ceiling') material.color.set('#eceee6');
          if (['墙壁', '墙壁2'].includes(mesh.name) || mesh.name.startsWith('Corridor_Inner_Wall')) material.color.set('#83aabb');
          if (mesh.name.startsWith('Ward_Door_')) material.color.set('#527d8d');
          if (['Nurse_Counter_Top', 'Staff_Worktop', 'Back_Cabinet_Top'].includes(mesh.name)) material.color.set('#e1e8ea');
          if (mesh.name === 'Counter_Steel_Plinth') {
            material.color.set('#334955'); material.roughness = .78; material.metalness = .15;
          }
          if (mesh.name === 'Wall_Motto') material.color.set('#48606b');
          if (material.name === 'Warm_White_Solid_Surface') {
            material.roughness = .82;
            material.envMapIntensity = original.envMapIntensity * .45;
          }
          if (material.name === 'Natural_Oak') {
            material.roughness = .78;
            material.envMapIntensity = original.envMapIntensity * .6;
          }
          if (material.name === 'Warm_LED') {
            material.emissive.set('#d4e3e9');
            material.emissiveIntensity = original.intensity * .35;
          }
          if (mesh.name === 'Counter_Reveal_LED') {
            material.color.set('#e1e8ea');
            material.emissiveIntensity = 0;
            material.roughness = .85;
          }
          if (material.name === 'Warm_Grey_Vinyl') {
            material.roughnessMap = null;
            material.roughness = .95;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * .25;
          }
          if (material.name === 'V2_Exterior_Daylight') material.emissiveIntensity = .08;
        }
        else {
          // 浅色对齐参考图：低饱和浅橡木 + 中性白台面。
          if (material.name === 'Warm_White_Solid_Surface') {
            clearSurfaceMaps(material);
          }
          if (material.name === 'Natural_Oak') {
            material.metalness = 0;
            material.normalMap = original.normalMap;
            material.roughnessMap = original.roughnessMap;
            if (material.normalScale) material.normalScale.set(1.25, 1.25);
            if (original.map) {
              const warm = resolveWarmOakMap(original.map);
              material.map = warm;
              material.color.set(warm ? '#f7f1e8' : LIGHT_OAK_TINT);
            }
            else {
              material.map = null;
              material.color.set(LIGHT_OAK_TINT);
            }
          }
          if (mesh.name === 'Nurse_Counter') material.color.set('#f7f8f6');
          if (mesh.name === 'Nurse_Counter_Oak') {
            material.color.set(material.map ? '#f7f1e8' : LIGHT_OAK_TINT);
          }
          if (mesh.name.startsWith('Oak_Wall_Panel') || mesh.name === 'Back_Cabinet' || mesh.name.startsWith('Cabinet_Door_') || mesh.name.startsWith('Upper_Cabinet_')) {
            material.color.set(material.map ? '#f7f1e8' : LIGHT_OAK_TINT);
          }
          if (mesh.name === 'Back_Wall') material.color.set('#eeeae3');
          if (mesh.name === 'Station_Canopy') material.color.set('#f7f8f7');
          if (mesh.name === 'Ceiling') material.color.set('#f9f9f7');
          if (['墙壁', '墙壁2'].includes(mesh.name) || mesh.name.startsWith('Corridor_Inner_Wall')) material.color.set('#f4f5f2');
          if (mesh.name.startsWith('Ward_Door_')) {
            material.color.set(material.map ? '#bda58f' : LIGHT_OAK_DOOR);
          }
          if (['Nurse_Counter_Top', 'Staff_Worktop', 'Back_Cabinet_Top'].includes(mesh.name)) material.color.set('#f9faf9');
          if (mesh.name === 'Counter_Steel_Plinth') {
            material.color.set('#b9a68b');
            material.roughness = .42;
            material.metalness = .58;
          }
          if (mesh.name === 'Wall_Motto' || mesh.name === 'Counter_Lettering') material.color.set('#44515b');
          if (mesh.name === 'Counter_Lettering_Rule') material.color.set('#8a9096');
          if (material.name === 'Warm_White_Solid_Surface') {
            material.roughness = .86;
            material.envMapIntensity = original.envMapIntensity * .32;
          }
          if (material.name === 'Natural_Oak') {
            material.roughness = original.roughnessMap ? Math.max(original.roughness, .58) : .58;
            material.envMapIntensity = original.envMapIntensity * .42;
          }
          if (material.name === 'Warm_LED') {
            material.emissive.set('#f5f8f9');
            material.emissiveIntensity = Math.max(original.intensity * .32, .22);
          }
          if (mesh.name === 'Counter_Reveal_LED') {
            // 参考图白/木交界的细金线。
            material.color.set('#b99b6d');
            material.emissive.set('#ad8c5c');
            material.emissiveIntensity = 0.18;
            material.roughness = .36;
            material.metalness = .42;
          }
          if (material.name === 'Warm_Grey_Vinyl') {
            material.roughnessMap = null;
            material.roughness = .95;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * .28;
          }
          if (material.name === 'Sign_Teal') {
            material.color.set('#44515b');
          }
          if (material.name === 'Brushed_Stainless') {
            material.color.set('#c9b286');
            material.metalness = .68;
            material.roughness = .34;
          }
        }

        if (previousMap !== material.map || previousNormalMap !== material.normalMap || previousRoughnessMap !== material.roughnessMap) {
          material.needsUpdate = true;
        }
      }
    });

    lights?.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      if (!lightDefaults.has(object)) lightDefaults.set(object, { color: object.color.clone(), intensity: object.intensity });
      const original = lightDefaults.get(object)!;
      object.color.copy(original.color);
      object.intensity = original.intensity;
      if (dark) {
        object.intensity *= object instanceof THREE.HemisphereLight ? .95 : .9;
        object.color.set(object instanceof THREE.HemisphereLight ? '#e6edf0' : '#f2f3ed');
      }
      else {
        // 参考图偏明亮中性光，避免过暖发黄。
        object.intensity *= object instanceof THREE.HemisphereLight ? 1.08 : 1.12;
        object.color.set(object instanceof THREE.HemisphereLight ? '#f4f6f4' : '#fff8ef');
      }
    });
  };
}
