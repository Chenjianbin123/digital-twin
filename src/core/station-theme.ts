import * as THREE from 'three';
const palette: Record<string, string> = {
  Warm_White_Solid_Surface: '#718793', Warm_White_Paint: '#53616a',
  Warm_Grey_Vinyl: '#354650', Floor_Border: '#283a46',
  Natural_Oak: '#b2bec3', Sign_Teal: '#a3d8d4',
  V2_Exterior_Daylight: '#263e59', Warm_LED: '#d4e3e9',
};
/** Cache original values once so repeated switches never compound color changes. */
export function createStationTheme() {
  const prepared = new WeakSet<THREE.Mesh>();
  const originals = new WeakMap<THREE.MeshStandardMaterial, { map: THREE.Texture | null; normalMap: THREE.Texture | null; roughnessMap: THREE.Texture | null; metalness: number; color: THREE.Color; emissive: THREE.Color; intensity: number; roughness: number; envMapIntensity: number }>();
  const lightDefaults = new WeakMap<THREE.Light, { color: THREE.Color; intensity: number }>();
  return (model: THREE.Object3D | null, lights: THREE.Object3D | undefined, dark: boolean) => {
    model?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      // 分离共享材质，避免后墙、弧面和台面互相串色；只克隆一次。
      if (!prepared.has(mesh)) {
        const clone = (material: THREE.Material) => {
          const m = material as THREE.MeshStandardMaterial;
          return m.isMeshStandardMaterial && (palette[m.name] || mesh.name === 'Counter_Steel_Plinth') ? m.clone() : m;
        };
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
        prepared.add(mesh);
      }
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (!material.isMeshStandardMaterial || (!palette[material.name] && mesh.name !== 'Counter_Steel_Plinth')) continue;
        if (!originals.has(material)) originals.set(material, { map: material.map, normalMap: material.normalMap, roughnessMap: material.roughnessMap, metalness: material.metalness, color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity, roughness: material.roughness, envMapIntensity: material.envMapIntensity });
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
        if (dark) {
          material.color.set(palette[material.name] ?? '#334955');
          if (material.name === 'Natural_Oak' || material.name === 'Warm_White_Solid_Surface') {
            material.map = null;
            material.normalMap = null;
            material.roughnessMap = null;
            material.metalness = 0;
          }
          if (mesh.name === 'Nurse_Counter_Oak') material.color.set('#718793');
          if (['Nurse_Counter_Top', 'Staff_Worktop', 'Back_Cabinet_Top'].includes(mesh.name)) material.color.set('#e1e8ea');
          if (mesh.name === 'Counter_Steel_Plinth') {
            material.color.set('#334955'); material.roughness = .78; material.metalness = .15;
          }
          if (mesh.name === 'Wall_Motto') material.color.set('#48606b');
          if (material.name === 'Warm_White_Solid_Surface') { material.roughness = .82; material.envMapIntensity = original.envMapIntensity * .45; }
          if (material.name === 'Natural_Oak') { material.roughness = .78; material.envMapIntensity = original.envMapIntensity * .6; }
          if (material.name === 'Warm_LED') { material.emissive.set('#d4e3e9'); material.emissiveIntensity = original.intensity * .35; }
          if (mesh.name === 'Counter_Reveal_LED') {
            material.color.set('#718793'); material.emissiveIntensity = 0; material.roughness = .85;
          }
          if (material.name === 'Warm_Grey_Vinyl') {
            material.roughnessMap = null; material.roughness = .95; material.metalness = 0;
            material.envMapIntensity = original.envMapIntensity * .25;
          }
          if (material.name === 'V2_Exterior_Daylight') material.emissiveIntensity = .08;
        }
        if (previousMap !== material.map || previousNormalMap !== material.normalMap || previousRoughnessMap !== material.roughnessMap) material.needsUpdate = true;
      }
    });
    lights?.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      if (!lightDefaults.has(object)) lightDefaults.set(object, { color: object.color.clone(), intensity: object.intensity });
      const original = lightDefaults.get(object)!;
      object.color.copy(original.color); object.intensity = original.intensity;
      if (dark) {
        object.intensity *= object instanceof THREE.HemisphereLight ? .7 : .62;
        object.color.set(object instanceof THREE.HemisphereLight ? '#b7ccdf' : '#e3edf2');
      }
    });
  };
}
