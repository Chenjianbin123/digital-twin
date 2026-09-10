import * as THREE from 'three';
const palette: Record<string, string> = {
  Warm_White_Solid_Surface: '#536774', Warm_White_Paint: '#435563',
  Warm_Grey_Vinyl: '#46535d', Floor_Border: '#283a46',
  Natural_Oak: '#aeb7bb', Sign_Teal: '#a3d8d4',
  V2_Exterior_Daylight: '#263e59',
};
/** Cache original values once so repeated switches never compound color changes. */
export function createStationTheme() {
  const originals = new WeakMap<THREE.MeshStandardMaterial, { color: THREE.Color; emissive: THREE.Color; intensity: number }>();
  const lightDefaults = new WeakMap<THREE.Light, { color: THREE.Color; intensity: number }>();
  return (model: THREE.Object3D | null, lights: THREE.Object3D | undefined, dark: boolean) => {
    model?.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const material of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as THREE.MeshStandardMaterial[]) {
        if (!material.isMeshStandardMaterial || !palette[material.name]) continue;
        if (!originals.has(material)) originals.set(material, { color: material.color.clone(), emissive: material.emissive.clone(), intensity: material.emissiveIntensity });
        const original = originals.get(material)!;
        material.color.copy(original.color);
        material.emissive.copy(original.emissive);
        material.emissiveIntensity = original.intensity;
        if (dark) {
          material.color.set(palette[material.name]);
          if (material.name === 'V2_Exterior_Daylight') material.emissiveIntensity = .08;
        }
      }
    });
    lights?.traverse(object => {
      if (!(object instanceof THREE.Light)) return;
      if (!lightDefaults.has(object)) lightDefaults.set(object, { color: object.color.clone(), intensity: object.intensity });
      const original = lightDefaults.get(object)!;
      object.color.copy(original.color); object.intensity = original.intensity;
      if (dark) {
        object.intensity *= object instanceof THREE.HemisphereLight ? .55 : .85;
        if (object instanceof THREE.HemisphereLight) object.color.set('#a7c7df');
      }
    });
  };
}
