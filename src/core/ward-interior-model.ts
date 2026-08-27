import * as THREE from 'three';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

export const WARD_INTERIOR_MODEL_URL = wardInteriorSceneConfig.model.url;
export const WARD_INTERIOR_BASE_SIZE = wardInteriorSceneConfig.model.baseSize;

export interface WardInteriorAssetParts {
  architecture: THREE.Object3D;
  props: THREE.Object3D;
  bedPrototype: THREE.Object3D;
}

export interface WardInteriorBedParts {
  group: THREE.Object3D;
  mattress: THREE.Mesh;
  indicator: THREE.Mesh;
  bedTerminalScreen: THREE.Mesh;
  bedsideMonitor: THREE.Mesh;
}

const originalPropPositions = new WeakMap<THREE.Object3D, THREE.Vector3>();

export interface WardInteriorBedPose {
  x: number;
  z: number;
  rotationY: number;
  scale: number;
}

const WARD_INTERIOR_BED_LAYOUT = wardInteriorSceneConfig.modelBedLayout;

function requireObject(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object)
    throw new Error(`Ward interior model is missing required node: ${name}`);
  return object;
}

function requireMesh(root: THREE.Object3D, name: string): THREE.Mesh {
  const object = requireObject(root, name);
  if (!(object instanceof THREE.Mesh))
    throw new Error(`Ward interior node must be a mesh: ${name}`);
  return object;
}

export function configureWardInteriorCanvasTexture(
  texture: { flipY: boolean; needsUpdate: boolean },
) {
  texture.flipY = wardInteriorSceneConfig.model.canvasTextureFlipY;
  texture.needsUpdate = true;
}

export function getWardInteriorAssetParts(root: THREE.Object3D): WardInteriorAssetParts {
  const architecture = requireObject(root, 'WardArchitecture');
  const props = requireObject(root, 'WardProps');
  const bedPrototype = requireObject(root, 'BedPrototype');

  requireMesh(bedPrototype, 'Bed_1_Mattress');
  requireMesh(bedPrototype, 'SmartBedhead_1_Status');
  requireMesh(bedPrototype, 'BedTerminalSurface');
  requireMesh(bedPrototype, 'Monitor_1_Screen');

  return { architecture, props, bedPrototype };
}

function cloneMeshMaterial(mesh: THREE.Mesh) {
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map(material => material.clone())
    : mesh.material.clone();
}

export function cloneWardInteriorBed(
  prototype: THREE.Object3D,
  bedCode: string,
): WardInteriorBedParts {
  const group = prototype.clone(true);
  group.userData = { ...group.userData, bedCode };

  const mattress = requireMesh(group, 'Bed_1_Mattress');
  const indicator = requireMesh(group, 'SmartBedhead_1_Status');
  const bedTerminalScreen = requireMesh(group, 'BedTerminalSurface');
  const bedsideMonitor = requireMesh(group, 'Monitor_1_Screen');

  for (const mesh of [mattress, indicator, bedTerminalScreen])
    cloneMeshMaterial(mesh);
  cloneMeshMaterial(bedsideMonitor);

  return {
    group,
    mattress,
    indicator,
    bedTerminalScreen,
    bedsideMonitor,
  };
}

export function fitWardInteriorEnvironment(
  parts: Pick<WardInteriorAssetParts, 'architecture' | 'props'>,
  roomWidth: number,
  roomDepth: number,
  roomHeight: number,
) {
  const scaleX = roomWidth / WARD_INTERIOR_BASE_SIZE.width;
  const scaleY = roomHeight / WARD_INTERIOR_BASE_SIZE.height;
  const scaleZ = roomDepth / WARD_INTERIOR_BASE_SIZE.depth;

  parts.architecture.scale.set(scaleX, scaleY, scaleZ);
  for (const prop of parts.props.children) {
    let originalPosition = originalPropPositions.get(prop);
    if (!originalPosition) {
      originalPosition = prop.position.clone();
      originalPropPositions.set(prop, originalPosition);
    }
    prop.position.set(
      originalPosition.x * scaleX,
      originalPosition.y * scaleY,
      originalPosition.z * scaleZ,
    );
  }
}

export function hideWardInteriorCeiling(architecture: THREE.Object3D) {
  architecture.traverse((object) => {
    if (object.name.startsWith('Ceiling'))
      object.visible = false;
  });
}

export function resolveWardInteriorModelBedPose(
  index: number,
  total: number,
  roomWidth: number,
  roomDepth: number,
): WardInteriorBedPose | null {
  if (total <= 0)
    return null;

  const count = Math.min(WARD_INTERIOR_BED_LAYOUT.maxBeds, Math.max(1, Math.floor(total)));
  const safeIndex = Math.min(count - 1, Math.max(0, Math.floor(index)));
  const availableWidth = Math.max(0, roomWidth - WARD_INTERIOR_BED_LAYOUT.horizontalMargin);
  const scale = count === 1
    ? 1
    : THREE.MathUtils.clamp(
        availableWidth / (count * WARD_INTERIOR_BED_LAYOUT.baseWidth),
        WARD_INTERIOR_BED_LAYOUT.minScale,
        WARD_INTERIOR_BED_LAYOUT.maxScale,
      );
  const scaledWidth = WARD_INTERIOR_BED_LAYOUT.baseWidth * scale;
  const spacing = count === 1
    ? 0
    : Math.max(0, (roomWidth - scaledWidth - WARD_INTERIOR_BED_LAYOUT.horizontalMargin) / (count - 1));

  return {
    x: -(spacing * (count - 1)) / 2 + safeIndex * spacing,
    z: -roomDepth / 2 + WARD_INTERIOR_BED_LAYOUT.backOffset * scale + 0.12,
    rotationY: 0,
    scale,
  };
}

export function disposeWardInteriorModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh))
      return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture)
          textures.add(value);
      }
    }
  });

  textures.forEach(texture => texture.dispose());
  materials.forEach(material => material.dispose());
  geometries.forEach(geometry => geometry.dispose());
}
