import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { hospitalModels, type HospitalOverview } from './hospital-navigation';

export interface HospitalModelMetadata {
  cameraDirection: [number, number, number];
  focusBounds: [[number, number, number], [number, number, number]];
  navigationBounds: [[number, number, number], [number, number, number]];
  anchor: [number, number, number];
  triangles: number;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  cameraHorizontalFov?: number;
  floorTargets?: { building: string; anchor: [number, number, number];
    bounds: [[number, number, number], [number, number, number]] }[];
}

export function disposeHospitalModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); });
    }
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}

function vector(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
}
function metadata(value: unknown): HospitalModelMetadata {
  const data = value as HospitalModelMetadata;
  if (!data || !vector(data.cameraDirection) || !vector(data.anchor)
    || !Array.isArray(data.focusBounds) || data.focusBounds.length !== 2 || !data.focusBounds.every(vector)
    || !Array.isArray(data.navigationBounds) || data.navigationBounds.length !== 2 || !data.navigationBounds.every(vector)
    || !Number.isFinite(data.triangles) || data.triangles < 1)
    throw new Error('医院模型元数据无效');
  return data;
}

/** Each mounted scene owns its decoded geometry. Hidden scenes reuse it; disposal aborts downloads. */
export async function loadHospitalModel(kind: HospitalOverview, signal: AbortSignal, progress: (percent: number) => void) {
  const descriptor = hospitalModels[kind];
  const draco = new DRACOLoader().setDecoderPath('/draco/').setWorkerLimit(2);
  try {
    const [modelResponse, metadataResponse, daylightResponse] = await Promise.all([
      fetch(descriptor.asset, { signal }), fetch(descriptor.metadata, { signal }),
      kind === 'exterior' ? fetch(hospitalModels.exterior.environment, { signal }) : null,
    ]);
    if (!modelResponse.ok || !metadataResponse.ok || daylightResponse?.ok === false) throw new Error('医院模型下载失败');
    const info = metadata(await metadataResponse.json());
    if (kind === 'exterior' && (!vector(info.cameraPosition) || !vector(info.cameraTarget)
      || !Number.isFinite(info.cameraHorizontalFov) || info.cameraHorizontalFov! <= 0 || info.cameraHorizontalFov! >= 150
      || !Array.isArray(info.floorTargets) || !info.floorTargets.length
      || !info.floorTargets.every(target => target && typeof target.building === 'string' && vector(target.anchor)
        && Array.isArray(target.bounds) && target.bounds.length === 2 && target.bounds.every(vector)
        && target.bounds[0].every((value, axis) => value < target.bounds[1][axis]))))
      throw new Error('医院外部相机或楼层导航数据无效');
    const daylightBytes = await daylightResponse?.arrayBuffer();
    const total = Number(modelResponse.headers.get('content-length'));
    const reader = modelResponse.body?.getReader();
    let bytes: ArrayBuffer;
    if (reader) {
      const parts: Uint8Array[] = []; let received = 0;
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        parts.push(part.value); received += part.value.length;
        if (total > 0) progress(Math.min(85, Math.round(received / total * 85)));
      }
      const joined = new Uint8Array(received); let offset = 0;
      for (const part of parts) { joined.set(part, offset); offset += part.length; }
      bytes = joined.buffer;
    } else bytes = await modelResponse.arrayBuffer();
    signal.throwIfAborted();
    progress(88);
    const gltf = await new GLTFLoader().setDRACOLoader(draco).parseAsync(bytes, '/models/hospital-navigation/');
    if (signal.aborted) { disposeHospitalModel(gltf.scene); signal.throwIfAborted(); }
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
    if (!meshes.length || !meshes.some(mesh => mesh.userData.targetScene === descriptor.target)
      || !gltf.scene.getObjectByName('NavigationAnchor')) {
      disposeHospitalModel(gltf.scene); throw new Error('模型缺少三维导航节点');
    }
    let daylight: THREE.DataTexture | undefined;
    try {
      if (daylightBytes) {
        const parsed = new EXRLoader().parse(daylightBytes);
        daylight = new THREE.DataTexture(parsed.data, parsed.width, parsed.height, parsed.format, parsed.type);
        daylight.colorSpace = parsed.colorSpace;
        daylight.minFilter = THREE.LinearFilter; daylight.magFilter = THREE.LinearFilter;
        daylight.generateMipmaps = false; daylight.flipY = false;
        daylight.mapping = THREE.EquirectangularReflectionMapping; daylight.needsUpdate = true;
      }
      return { root: gltf.scene, meshes, metadata: info, daylight };
    } catch (error) { daylight?.dispose(); disposeHospitalModel(gltf.scene); throw error; }
  } finally { draco.dispose(); }
}
