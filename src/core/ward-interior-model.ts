import * as THREE from 'three';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

export const WARD_INTERIOR_MODEL_URL = wardInteriorSceneConfig.model.url;
export const WARD_INTERIOR_BASE_SIZE = wardInteriorSceneConfig.model.baseSize;

export type WardInteriorModelMode = 'prototype' | 'baked';

export interface WardInteriorBakedBedSlot {
  index: number;
  group: THREE.Group;
  mattress: THREE.Mesh;
  indicator: THREE.Mesh;
  bedTerminalScreen: THREE.Mesh;
  bedsideMonitor: THREE.Mesh;
}

export interface WardInteriorBaseBounds {
  size: THREE.Vector3;
  center: THREE.Vector3;
  minY: number;
}

export interface WardInteriorAssetParts {
  mode: WardInteriorModelMode;
  architecture: THREE.Object3D;
  props: THREE.Object3D;
  bedPrototype: THREE.Object3D | null;
  bakedBeds: WardInteriorBakedBedSlot[];
  baseBounds?: WardInteriorBaseBounds;
}

export interface WardInteriorBedParts {
  group: THREE.Object3D;
  mattress: THREE.Mesh;
  indicator: THREE.Mesh;
  bedTerminalScreen: THREE.Mesh;
  bedsideMonitor: THREE.Mesh;
}

const originalPropPositions = new WeakMap<THREE.Object3D, THREE.Vector3>();

const BAKED_MATTRESS_RE = /^床(?:\.\d{3})?$/;
const BAKED_BED_PART_RE = /^(床|枕头|被子|扶手|滑轮|床板|床支架|床配饰)/;
const BAKED_BED_EQUIP_RE = /^(检测设施|壳|液体|床头柜)/;

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

function isPrototypeWardInterior(root: THREE.Object3D): boolean {
  return Boolean(
    root.getObjectByName('WardArchitecture')
    && root.getObjectByName('WardProps')
    && root.getObjectByName('BedPrototype'),
  );
}

function reparentPreservingWorld(object: THREE.Object3D, parent: THREE.Object3D) {
  parent.attach(object);
}

function createProxyScreen(name: string, width: number, height: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      color: 0x101820,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  mesh.name = name;
  return mesh;
}

function createStatusIndicator(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x4caf50,
      emissive: 0x2e7d32,
      emissiveIntensity: 0.55,
      metalness: 0.15,
      roughness: 0.4,
    }),
  );
  mesh.name = 'BakedBedStatus';
  return mesh;
}

function collectBakedMattresses(root: THREE.Object3D): THREE.Mesh[] {
  const mattresses: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && BAKED_MATTRESS_RE.test(object.name))
      mattresses.push(object);
  });
  mattresses.sort((a, b) => {
    const az = a.getWorldPosition(new THREE.Vector3()).z;
    const bz = b.getWorldPosition(new THREE.Vector3()).z;
    return az - bz;
  });
  return mattresses;
}

function collectMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh)
      meshes.push(object);
  });
  return meshes;
}

function isCloserToMattress(
  point: THREE.Vector3,
  mattressCenter: THREE.Vector3,
  otherCenters: THREE.Vector3[],
): boolean {
  const own = point.distanceToSquared(mattressCenter);
  return otherCenters.every(center => own <= point.distanceToSquared(center) + 1e-6);
}

function organizeBakedWardInterior(root: THREE.Object3D): WardInteriorAssetParts {
  const architecture = new THREE.Group();
  architecture.name = 'WardArchitecture';
  for (const child of [...root.children])
    architecture.add(child);
  root.add(architecture);

  const props = new THREE.Group();
  props.name = 'WardProps';
  root.add(props);

  architecture.updateWorldMatrix(true, true);
  const mattresses = collectBakedMattresses(architecture);
  if (mattresses.length === 0)
    throw new Error('Ward interior baked model is missing bed meshes (床)');

  const mattressCenters = mattresses.map(mesh => {
    const box = new THREE.Box3().setFromObject(mesh);
    return box.getCenter(new THREE.Vector3());
  });
  const allMeshes = collectMeshes(architecture);
  const bakedBeds: WardInteriorBakedBedSlot[] = [];

  mattresses.forEach((mattress, index) => {
    const center = mattressCenters[index];
    const otherCenters = mattressCenters.filter((_, i) => i !== index);
    const group = new THREE.Group();
    group.name = `BakedBed_${index + 1}`;
    group.position.set(center.x, 0, center.z);
    architecture.add(group);

    const related: THREE.Object3D[] = [mattress];
    for (const mesh of allMeshes) {
      if (mesh === mattress)
        continue;
      const name = mesh.name;
      if (!BAKED_BED_PART_RE.test(name) && !BAKED_BED_EQUIP_RE.test(name))
        continue;
      const meshCenter = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      if (isCloserToMattress(meshCenter, center, otherCenters))
        related.push(mesh);
    }

    for (const object of related)
      reparentPreservingWorld(object, group);

    group.updateWorldMatrix(true, true);
    const worldBox = new THREE.Box3().setFromObject(mattress);
    const localBox = worldBox.clone().applyMatrix4(
      new THREE.Matrix4().copy(group.matrixWorld).invert(),
    );
    const localSize = localBox.getSize(new THREE.Vector3());
    const localCenter = localBox.getCenter(new THREE.Vector3());
    const headX = localBox.min.x;

    const indicator = createStatusIndicator();
    indicator.position.set(headX - 0.02, Math.max(1.35, localCenter.y + localSize.y * 0.55), localCenter.z);
    group.add(indicator);

    const bedTerminalScreen = createProxyScreen('BakedBedTerminalSurface', 0.62, 0.4);
    bedTerminalScreen.position.set(
      headX - 0.04,
      Math.max(1.55, localCenter.y + localSize.y * 0.85),
      localCenter.z,
    );
    bedTerminalScreen.rotation.y = Math.PI / 2;
    group.add(bedTerminalScreen);

    const bedsideMonitor = createProxyScreen('BakedBedsideMonitor', 0.36, 0.28);
    bedsideMonitor.position.set(
      headX + localSize.x * 0.18,
      Math.max(1.15, localCenter.y + localSize.y * 0.35),
      localBox.max.z + 0.22,
    );
    bedsideMonitor.rotation.y = -Math.PI / 2.4;
    group.add(bedsideMonitor);

    bakedBeds.push({
      index,
      group,
      mattress,
      indicator,
      bedTerminalScreen,
      bedsideMonitor,
    });
  });

  architecture.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(architecture);
  const baseBounds: WardInteriorBaseBounds = {
    size: bounds.getSize(new THREE.Vector3()),
    center: bounds.getCenter(new THREE.Vector3()),
    minY: bounds.min.y,
  };

  return {
    mode: 'baked',
    architecture,
    props,
    bedPrototype: null,
    bakedBeds,
    baseBounds,
  };
}

function getPrototypeWardInteriorParts(root: THREE.Object3D): WardInteriorAssetParts {
  const architecture = requireObject(root, 'WardArchitecture');
  const props = requireObject(root, 'WardProps');
  const bedPrototype = requireObject(root, 'BedPrototype');

  requireMesh(bedPrototype, 'Bed_1_Mattress');
  requireMesh(bedPrototype, 'SmartBedhead_1_Status');
  requireMesh(bedPrototype, 'BedTerminalSurface');
  requireMesh(bedPrototype, 'Monitor_1_Screen');

  return {
    mode: 'prototype',
    architecture,
    props,
    bedPrototype,
    bakedBeds: [],
  };
}

export function getWardInteriorAssetParts(root: THREE.Object3D): WardInteriorAssetParts {
  if (isPrototypeWardInterior(root))
    return getPrototypeWardInteriorParts(root);
  return organizeBakedWardInterior(root);
}

function cloneMeshMaterial(mesh: THREE.Mesh) {
  mesh.material = Array.isArray(mesh.material)
    ? mesh.material.map(material => material.clone())
    : mesh.material.clone();
}

function ensureMattressStandardMaterial(mesh: THREE.Mesh) {
  const previous = mesh.material;
  const previousMaterials = Array.isArray(previous) ? previous : [previous];
  let color = 0xf5f7fa;
  for (const material of previousMaterials) {
    if ('color' in material && material.color instanceof THREE.Color) {
      color = material.color.getHex();
      break;
    }
  }
  mesh.material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
  });
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

export function bindWardInteriorBakedBed(
  slot: WardInteriorBakedBedSlot,
  bedCode: string,
): WardInteriorBedParts {
  const { group, mattress, indicator, bedTerminalScreen, bedsideMonitor } = slot;
  group.visible = true;
  group.userData = {
    ...group.userData,
    bedCode,
    wardInteriorModelBed: true,
    wardInteriorBakedBed: true,
  };

  ensureMattressStandardMaterial(mattress);
  cloneMeshMaterial(indicator);
  cloneMeshMaterial(bedTerminalScreen);
  cloneMeshMaterial(bedsideMonitor);

  return {
    group,
    mattress,
    indicator,
    bedTerminalScreen,
    bedsideMonitor,
  };
}

export function syncWardInteriorBakedBedVisibility(
  parts: WardInteriorAssetParts,
  activeCount: number,
) {
  if (parts.mode !== 'baked')
    return;
  for (const slot of parts.bakedBeds)
    slot.group.visible = slot.index < activeCount;
}

function fitBakedWardInteriorEnvironment(parts: WardInteriorAssetParts) {
  const bounds = parts.baseBounds;
  if (!bounds)
    return;

  // Keep Blender export scale 1:1. Only ground and center the room.
  parts.architecture.scale.setScalar(1);
  parts.architecture.position.set(
    -bounds.center.x,
    -bounds.minY,
    -bounds.center.z,
  );
}

/** Prepare glTF materials so they read closer to Blender's look under in-app lighting. */
export function prepareWardInteriorModelMaterials(
  root: THREE.Object3D,
  options: {
    envMapIntensity: number;
    maxMetalness: number;
  },
) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh))
      return;
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if ('envMapIntensity' in material)
        (material as THREE.MeshStandardMaterial).envMapIntensity = options.envMapIntensity;
      if ('metalness' in material && typeof (material as THREE.MeshStandardMaterial).metalness === 'number') {
        const std = material as THREE.MeshStandardMaterial;
        std.metalness = Math.min(std.metalness, options.maxMetalness);
      }
      if ('map' in material && material.map instanceof THREE.Texture)
        material.map.colorSpace = THREE.SRGBColorSpace;
      if ('emissiveMap' in material && material.emissiveMap instanceof THREE.Texture)
        material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      if (
        'transmission' in material
        && typeof (material as THREE.MeshPhysicalMaterial).transmission === 'number'
        && (material as THREE.MeshPhysicalMaterial).transmission > 0.05
      ) {
        const physical = material as THREE.MeshPhysicalMaterial;
        physical.transparent = true;
        physical.transmission = Math.min(physical.transmission, 0.25);
      }
      material.needsUpdate = true;
    }
  });
}

export function fitWardInteriorEnvironment(
  parts: Pick<WardInteriorAssetParts, 'architecture' | 'props'> & Partial<Pick<WardInteriorAssetParts, 'mode' | 'baseBounds'>>,
  roomWidth: number,
  roomDepth: number,
  roomHeight: number,
) {
  if (parts.mode === 'baked') {
    fitBakedWardInteriorEnvironment(parts as WardInteriorAssetParts);
    return;
  }

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
