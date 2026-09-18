import * as THREE from "three";

/** 深色：冷青对比更硬，贴合侧栏。 */
const darkPalette: Record<string, string> = {
  Warm_White_Solid_Surface: "#e6eef0",
  Warm_White_Paint: "#c5d6d8",
  Warm_Grey_Vinyl: "#a8b8b4",
  Floor_Border: "#5a727c",
  Natural_Oak: "#d8e1df",
  Sign_Teal: "#dceef2",
  V2_Exterior_Daylight: "#1c3348",
  Warm_LED: "#c8dde6",
  Brushed_Stainless: "#7a8a90",
};

/** 浅色：台面更干净、墙去青灰；门硬朗，橡木后墙保持淡色。 */
const lightPalette: Record<string, string> = {
  Warm_White_Solid_Surface: "#e8eef0",
  Warm_White_Paint: "#e8eef0",
  Warm_Grey_Vinyl: "#c2cecc",
  Floor_Border: "#6a8288",
  Natural_Oak: "#ced8d5",
  Sign_Teal: "#1a5f6e",
  V2_Exterior_Daylight: "#d8e8ee",
  Warm_LED: "#eaf4f6",
  Brushed_Stainless: "#7e9398",
};

/** 时钟后墙/橡木饰面：硬朗前淡色，避免大面积发深。 */
const LIGHT_OAK_TINT = "#ced8d5";
const LIGHT_OAK_MAP_COLOR = "#edf2f0";
/** 房门：偏蓝青、对比清楚。 */
const LIGHT_WARD_DOOR = "#4f7f9a";
const LIGHT_NURSE_COUNTER_ACCENT = "#6ea5b4";

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

function readTextureSize(
  image: {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
  } | null,
) {
  if (!image) return null;
  if (
    typeof HTMLImageElement !== "undefined" &&
    image instanceof HTMLImageElement &&
    !image.complete
  )
    return null;
  const width = image.width || image.naturalWidth || 0;
  const height = image.height || image.naturalHeight || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/** 把偏青漫反射按亮度重着色为浅橡木，保留木纹层次。 */
function createWarmOakAlbedo(
  source: THREE.Texture,
  tintHex: string,
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const size = readTextureSize(
    source.image as {
      width?: number;
      height?: number;
      naturalWidth?: number;
      naturalHeight?: number;
    } | null,
  );
  if (!size) return null;

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(
      source.image as CanvasImageSource,
      0,
      0,
      size.width,
      size.height,
    );
  } catch {
    return null;
  }
  const pixels = ctx.getImageData(0, 0, size.width, size.height);
  const tint = new THREE.Color(tintHex);
  const data = pixels.data;
  for (let i = 0; i < data.length; i += 4) {
    // 偏青贴图用 G/B 权重提取木纹明暗。
    const lum = (0.18 * data[i] + 0.52 * data[i + 1] + 0.3 * data[i + 2]) / 255;
    const contrast = Math.pow(Math.min(1, Math.max(0.08, lum)), 0.82);
    // 后墙橡木保持硬朗前的淡色层次，避免发深发脏。
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
  const originals = new WeakMap<
    THREE.MeshStandardMaterial,
    {
      map: THREE.Texture | null;
      normalMap: THREE.Texture | null;
      roughnessMap: THREE.Texture | null;
      metalness: number;
      color: THREE.Color;
      emissive: THREE.Color;
      intensity: number;
      roughness: number;
      envMapIntensity: number;
    }
  >();
  const lightDefaults = new WeakMap<
    THREE.Light,
    { color: THREE.Color; intensity: number }
  >();
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

  return (
    model: THREE.Object3D | null,
    lights: THREE.Object3D | undefined,
    dark: boolean,
  ) => {
    model?.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 分离共享材质，避免后墙、弧面和台面互相串色；只克隆一次。
      if (!prepared.has(mesh)) {
        const clone = (material: THREE.Material) => {
          const m = material as THREE.MeshStandardMaterial;
          return m.isMeshStandardMaterial &&
            (themedMaterialNames.has(m.name) ||
              mesh.name === "Counter_Steel_Plinth")
            ? m.clone()
            : m;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(clone)
          : clone(mesh.material);
        prepared.add(mesh);
      }

      for (const material of (Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (
          !material.isMeshStandardMaterial ||
          (!themedMaterialNames.has(material.name) &&
            mesh.name !== "Counter_Steel_Plinth")
        )
          continue;
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
        material.color.set(
          palette[material.name] ?? (dark ? "#334955" : "#e8ebe9"),
        );

        if (dark) {
          if (
            material.name === "Natural_Oak" ||
            material.name === "Warm_White_Solid_Surface"
          ) {
            clearSurfaceMaps(material);
          }
          // 建筑面共享材质，按节点分色才能保留台面与后墙的层次。
          if (["Nurse_Counter", "Nurse_Counter_Oak"].includes(mesh.name))
            material.color.set("#5a92a8");
          if (mesh.name === "Station_Canopy") material.color.set("#5c96ac");
          if (mesh.name === "Ceiling") material.color.set("#e8ece8");
          if (
            ["墙壁", "墙壁2"].includes(mesh.name) ||
            mesh.name.startsWith("Corridor_Inner_Wall")
          )
            material.color.set("#6aa0b4");
          if (mesh.name.startsWith("Ward_Door_")) material.color.set("#3d6f88");
          if (
            ["Nurse_Counter_Top", "Staff_Worktop", "Back_Cabinet_Top"].includes(
              mesh.name,
            )
          )
            material.color.set("#e6eef0");
          if (mesh.name === "Counter_Steel_Plinth") {
            material.color.set("#2a3c48");
            material.roughness = 0.78;
            material.metalness = 0.15;
          }
          if (mesh.name === "Wall_Motto") material.color.set("#3a6574");
          if (mesh.name === "Back_Wall") {
            // 时钟后墙保持硬朗前的浅青灰，不受橡木/硬朗饰面影响。
            clearSurfaceMaps(material);
            material.color.set("#d8e1df");
            material.roughness = 0.86;
          }
          if (material.name === "Warm_White_Solid_Surface") {
            material.roughness = 0.82;
            material.envMapIntensity = original.envMapIntensity * 0.45;
          }
          if (material.name === "Natural_Oak") {
            material.roughness = 0.78;
            material.envMapIntensity = original.envMapIntensity * 0.6;
          }
          if (material.name === "Warm_LED") {
            material.emissive.set("#d4e3e9");
            material.emissiveIntensity = original.intensity * 0.35;
          }
          if (mesh.name === "Counter_Reveal_LED") {
            material.color.set("#e1e8ea");
            material.emissiveIntensity = 0;
            material.roughness = 0.85;
          }
          if (material.name === "Warm_Grey_Vinyl") {
            material.roughnessMap = null;
            material.roughness = 0.95;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * 0.25;
          }
          if (material.name === "V2_Exterior_Daylight")
            material.emissiveIntensity = 0.08;
        } else {
          // 浅色硬朗：白台面干净、青绿饰面与房门对比更清楚。
          if (material.name === "Warm_White_Solid_Surface") {
            clearSurfaceMaps(material);
          }
          if (material.name === "Natural_Oak") {
            material.metalness = 0;
            material.normalMap = original.normalMap;
            material.roughnessMap = original.roughnessMap;
            if (material.normalScale) material.normalScale.set(1.25, 1.25);
            if (original.map) {
              const warm = resolveWarmOakMap(original.map);
              material.map = warm;
              material.color.set(warm ? LIGHT_OAK_MAP_COLOR : LIGHT_OAK_TINT);
            } else {
              material.map = null;
              material.color.set(LIGHT_OAK_TINT);
            }
          }
          if (mesh.name === "Nurse_Counter") material.color.set("#e8eef0");
          if (mesh.name === "Nurse_Counter_Oak") {
            material.map = null;
            material.normalMap = null;
            material.roughnessMap = null;
            material.color.set(LIGHT_NURSE_COUNTER_ACCENT);
            material.roughness = 0.78;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * 0.28;
          }
          if (
            mesh.name.startsWith("Oak_Wall_Panel") ||
            mesh.name === "Back_Cabinet" ||
            mesh.name.startsWith("Cabinet_Door_") ||
            mesh.name.startsWith("Upper_Cabinet_")
          ) {
            material.color.set(
              material.map ? LIGHT_OAK_MAP_COLOR : LIGHT_OAK_TINT,
            );
          }
          if (mesh.name === "Back_Wall") {
            // 时钟后墙：比硬朗前再略提亮，保持淡色不发深。
            clearSurfaceMaps(material);
            material.color.set("#eef3f2");
            material.roughness = 0.88;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * 0.28;
          }
          if (mesh.name === "Station_Canopy") material.color.set("#eef3f4");
          if (mesh.name === "Ceiling") material.color.set("#f4f7f6");
          if (
            ["墙壁", "墙壁2"].includes(mesh.name) ||
            mesh.name.startsWith("Corridor_Inner_Wall")
          )
            material.color.set("#eef3f4");
          if (mesh.name.startsWith("Ward_Door_")) {
            material.map = null;
            material.roughnessMap = null;
            material.color.set(LIGHT_WARD_DOOR);
            material.roughness = 0.78;
            material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * 0.32;
          }
          if (
            ["Nurse_Counter_Top", "Staff_Worktop", "Back_Cabinet_Top"].includes(
              mesh.name,
            )
          )
            material.color.set("#e3eae8");
          if (mesh.name === "Counter_Steel_Plinth") {
            material.color.set("#6e848a");
            material.roughness = 0.38;
            material.metalness = 0.62;
          }
          if (mesh.name === "Wall_Motto" || mesh.name === "Counter_Lettering")
            material.color.set("#1a5f6e");
          if (mesh.name === "Counter_Lettering_Rule")
            material.color.set("#3d8a9a");
          if (material.name === "Warm_White_Solid_Surface") {
            material.roughness = 0.72;
            material.envMapIntensity = original.envMapIntensity * 0.42;
          }
          if (material.name === "Natural_Oak") {
            const isFlatClinicalSurface =
              mesh.name === "Nurse_Counter_Oak" ||
              mesh.name.startsWith("Ward_Door_");
            material.roughness = isFlatClinicalSurface
              ? 0.72
              : original.roughnessMap
                ? Math.max(original.roughness, 0.48)
                : 0.48;
            material.envMapIntensity =
              original.envMapIntensity *
              (mesh.name === "Nurse_Counter_Oak"
                ? 0.34
                : mesh.name.startsWith("Ward_Door_")
                  ? 0.38
                  : 0.55);
          }
          if (material.name === "Warm_LED") {
            material.emissive.set("#dcebef");
            material.emissiveIntensity = Math.max(
              original.intensity * 0.3,
              0.2,
            );
          }
          if (mesh.name === "Counter_Reveal_LED") {
            material.color.set("#2f7a88");
            material.emissive.set("#2f7a88");
            material.emissiveIntensity = 0.12;
            material.roughness = 0.48;
            material.metalness = 0.28;
          }
          if (material.name === "Warm_Grey_Vinyl") {
            material.roughnessMap = null;
            material.roughness = 0.72;
            material.metalness = 0.04;
            material.envMapIntensity = original.envMapIntensity * 0.42;
          }
          if (material.name === "Sign_Teal") {
            material.color.set("#1a5f6e");
          }
          if (material.name === "Brushed_Stainless") {
            material.color.set("#6e848a");
            material.metalness = 0.72;
            material.roughness = 0.3;
          }
        }

        if (
          previousMap !== material.map ||
          previousNormalMap !== material.normalMap ||
          previousRoughnessMap !== material.roughnessMap
        ) {
          material.needsUpdate = true;
        }
      }
    });

    lights?.traverse((object) => {
      if (!(object instanceof THREE.Light)) return;
      if (!lightDefaults.has(object))
        lightDefaults.set(object, {
          color: object.color.clone(),
          intensity: object.intensity,
        });
      const original = lightDefaults.get(object)!;
      object.color.copy(original.color);
      object.intensity = original.intensity;
      if (dark) {
        object.intensity *=
          object instanceof THREE.HemisphereLight ? 0.95 : 0.9;
        object.color.set(
          object instanceof THREE.HemisphereLight ? "#e6edf0" : "#f2f3ed",
        );
      } else {
        // 浅色：保持灯光原强度，靠阴影与材质反光出层次。
        object.color.set(
          object instanceof THREE.HemisphereLight ? "#f2f7f8" : "#fff8f0",
        );
      }
    });
  };
}
