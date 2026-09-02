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

export interface WardInteriorTerminalCandidateDebug {
  name: string;
  materialNames: string[];
  worldCenter: [number, number, number];
  dimensions: [number, number, number];
  frontNormal: [number, number, number];
  distanceToMattress: number;
}

export interface WardInteriorBedPlacementDebugInfo {
  bedIndex: number;
  screenSource: 'model' | 'proxy';
  mattress: {
    name: string;
    worldCenter: [number, number, number];
    dimensions: [number, number, number];
  };
  groupWorldPosition: [number, number, number];
  inferredHeadX: number;
  proxy: {
    localPosition: [number, number, number];
    worldPosition: [number, number, number];
    dimensions: [number, number, number];
    rotationY: number;
    frontNormal: [number, number, number];
  };
  terminalCandidates: WardInteriorTerminalCandidateDebug[];
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

// GLTFLoader sanitizes Blender duplicate suffixes (`床.001` → `床001`).
// Accept both source and runtime spellings so every baked bed is discovered.
const BAKED_MATTRESS_RE = /^床(?:\.?\d{3})?$/;
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

function getMeshMaterials(mesh: THREE.Mesh): THREE.Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

function getSurfaceVertexIndex(
  index: THREE.BufferAttribute | THREE.InterleavedBufferAttribute | null,
  vertexIndex: number,
) {
  return index ? index.getX(vertexIndex) : vertexIndex;
}

function getSurfaceNormal(
  mesh: THREE.Mesh,
  materialNamePattern: RegExp,
): THREE.Vector3 {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const materials = getMeshMaterials(mesh);
  const matchingMaterialIndexes = new Set<number>();
  materials.forEach((material, materialIndex) => {
    if (materialNamePattern.test(material.name))
      matchingMaterialIndexes.add(materialIndex);
  });
  const groups = geometry.groups.length > 0
    ? geometry.groups.filter(group => matchingMaterialIndexes.has(group.materialIndex ?? 0))
    : matchingMaterialIndexes.has(0)
      ? [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }]
      : [];
  const normal = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();

  for (const group of groups) {
    const end = Math.min(group.start + group.count, index ? index.count : position.count);
    for (let offset = group.start; offset + 2 < end; offset += 3) {
      const ia = getSurfaceVertexIndex(index, offset);
      const ib = getSurfaceVertexIndex(index, offset + 1);
      const ic = getSurfaceVertexIndex(index, offset + 2);
      a.fromBufferAttribute(position, ia);
      b.fromBufferAttribute(position, ib);
      c.fromBufferAttribute(position, ic);
      edgeA.subVectors(b, a);
      edgeB.subVectors(c, a);
      normal.add(edgeA.cross(edgeB));
    }
  }

  if (normal.lengthSq() < 1e-8) {
    normal.set(0, 0, 1);
  }
  return normal
    .normalize()
    .transformDirection(mesh.matrixWorld)
    .normalize();
}

function collectSurfaceCenter(
  mesh: THREE.Mesh,
  materialNamePattern: RegExp,
): THREE.Vector3 {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const materials = getMeshMaterials(mesh);
  const matchingMaterialIndexes = new Set<number>();
  materials.forEach((material, materialIndex) => {
    if (materialNamePattern.test(material.name))
      matchingMaterialIndexes.add(materialIndex);
  });
  const groups = geometry.groups.length > 0
    ? geometry.groups.filter(group => matchingMaterialIndexes.has(group.materialIndex ?? 0))
    : matchingMaterialIndexes.has(0)
      ? [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }]
      : [];
  const center = new THREE.Vector3();
  const worldVertex = new THREE.Vector3();
  let count = 0;

  for (const group of groups) {
    const end = Math.min(group.start + group.count, index ? index.count : position.count);
    for (let offset = group.start; offset < end; offset++) {
      const vertexIndex = getSurfaceVertexIndex(index, offset);
      worldVertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(mesh.matrixWorld);
      center.add(worldVertex);
      count += 1;
    }
  }

  if (count === 0)
    return new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  return center.multiplyScalar(1 / count);
}

function collectSurfaceVertexIndices(
  mesh: THREE.Mesh,
  materialNamePattern: RegExp,
): Set<number> {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const materials = getMeshMaterials(mesh);
  const matchingMaterialIndexes = new Set<number>();
  materials.forEach((material, materialIndex) => {
    if (materialNamePattern.test(material.name))
      matchingMaterialIndexes.add(materialIndex);
  });
  const groups = geometry.groups.length > 0
    ? geometry.groups.filter(group => matchingMaterialIndexes.has(group.materialIndex ?? 0))
    : matchingMaterialIndexes.has(0)
      ? [{ start: 0, count: index ? index.count : position.count, materialIndex: 0 }]
      : [];
  const vertexIndexes = new Set<number>();
  for (const group of groups) {
    const end = Math.min(group.start + group.count, index ? index.count : position.count);
    for (let offset = group.start; offset < end; offset++)
      vertexIndexes.add(getSurfaceVertexIndex(index, offset));
  }
  return vertexIndexes;
}

/**
 * Blender often exports these faces from a shared UV atlas. Dynamic canvas
 * textures must use the entire face, so clone only the selected surface
 * geometry and normalize its UV range to [0, 1].
 */
function normalizeBedTerminalSurfaceUv(mesh: THREE.Mesh) {
  if (mesh.userData.wardInteriorTerminalUvNormalized)
    return;

  const uv = mesh.geometry.getAttribute('uv');
  if (!uv || uv.count === 0)
    return;

  const vertexIndexes = collectSurfaceVertexIndices(mesh, /门口机内/);
  if (vertexIndexes.size === 0)
    return;

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const vertexIndex of vertexIndexes) {
    const u = uv.getX(vertexIndex);
    const v = uv.getY(vertexIndex);
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }

  const spanU = maxU - minU;
  const spanV = maxV - minV;
  if (spanU < 1e-6 || spanV < 1e-6)
    return;
  if (
    Math.abs(minU) < 1e-6
    && Math.abs(maxU - 1) < 1e-6
    && Math.abs(minV) < 1e-6
    && Math.abs(maxV - 1) < 1e-6
  ) {
    mesh.userData.wardInteriorTerminalUvNormalized = true;
    return;
  }

  const normalizedGeometry = mesh.geometry.clone();
  const normalizedUv = normalizedGeometry.getAttribute('uv');
  if (!normalizedUv)
    return;
  for (const vertexIndex of vertexIndexes) {
    normalizedUv.setXY(
      vertexIndex,
      (uv.getY(vertexIndex) - minV) / spanV,
      1 - (uv.getX(vertexIndex) - minU) / spanU,
    );
  }
  normalizedUv.needsUpdate = true;
  mesh.geometry = normalizedGeometry;
  mesh.userData.wardInteriorTerminalUvNormalized = true;
}

function isBedTerminalSurface(mesh: THREE.Mesh): boolean {
  return Boolean(mesh.userData.wardInteriorTerminalSurface)
    || getMeshMaterials(mesh).some(material => material.name.includes('门口机内'));
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

function isBakedBedRelatedName(name: string): boolean {
  return BAKED_BED_PART_RE.test(name) || BAKED_BED_EQUIP_RE.test(name);
}

/**
 * Multi-material GLB primitives are loaded as child meshes under a named
 * Group (for example `检测设施002` → `立方体035` + `立方体035_1`).
 * Reparent that semantic container instead of only looking at the child mesh
 * name, otherwise the real terminal remains outside of its bed slot.
 */
function findBakedBedAnchor(
  object: THREE.Object3D,
  root: THREE.Object3D,
): THREE.Object3D | null {
  let current: THREE.Object3D | null = object;
  while (current && current !== root) {
    if (isBakedBedRelatedName(current.name))
      return current;
    current = current.parent;
  }
  return null;
}

function collectBakedBedAnchors(root: THREE.Object3D): THREE.Object3D[] {
  const anchors: THREE.Object3D[] = [];
  const seen = new Set<THREE.Object3D>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh))
      return;
    const anchor = findBakedBedAnchor(object, root);
    if (anchor && !seen.has(anchor)) {
      seen.add(anchor);
      anchors.push(anchor);
    }
  });
  return anchors;
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
  const allBedAnchors = collectBakedBedAnchors(architecture);
  const bakedBeds: WardInteriorBakedBedSlot[] = [];

  mattresses.forEach((mattress, index) => {
    const center = mattressCenters[index];
    const otherCenters = mattressCenters.filter((_, i) => i !== index);
    const group = new THREE.Group();
    group.name = `BakedBed_${index + 1}`;
    group.position.set(center.x, 0, center.z);
    architecture.add(group);

    const related: THREE.Object3D[] = [mattress];
    for (const anchor of allBedAnchors) {
      if (anchor === mattress)
        continue;
      const anchorCenter = new THREE.Box3().setFromObject(anchor).getCenter(new THREE.Vector3());
      if (isCloserToMattress(anchorCenter, center, otherCenters))
        related.push(anchor);
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

    const realBedTerminalScreen = collectMeshes(group)
      .filter(mesh => mesh !== mattress && isBedTerminalSurface(mesh))
      .sort((a, b) => {
        const aCenter = collectSurfaceCenter(a, /门口机内/);
        const bCenter = collectSurfaceCenter(b, /门口机内/);
        return aCenter.distanceTo(center) - bCenter.distanceTo(center);
    })[0];
    let bedTerminalScreen = realBedTerminalScreen;
    if (!bedTerminalScreen) {
      bedTerminalScreen = createProxyScreen('BakedBedTerminalSurface', 0.62, 0.4);
      bedTerminalScreen.position.set(
        headX - 0.04,
        Math.max(1.55, localCenter.y + localSize.y * 0.85),
        localCenter.z,
      );
      bedTerminalScreen.rotation.y = Math.PI / 2;
      group.add(bedTerminalScreen);
    }
    else {
      normalizeBedTerminalSurfaceUv(bedTerminalScreen);
      bedTerminalScreen.userData.wardInteriorTerminalSurface = true;
    }

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

/** 生成床头机定位诊断数据，供浏览器控制台核对真实网格与代理屏幕。 */
export function getWardInteriorBedPlacementDebugInfo(
  parts: WardInteriorAssetParts,
): WardInteriorBedPlacementDebugInfo[] {
  if (parts.mode !== 'baked')
    return [];

  const diagnostics: WardInteriorBedPlacementDebugInfo[] = [];
  for (const slot of parts.bakedBeds) {
    slot.group.updateWorldMatrix(true, true);
    const mattressBox = new THREE.Box3().setFromObject(slot.mattress);
    const mattressCenter = mattressBox.getCenter(new THREE.Vector3());
    const mattressSize = mattressBox.getSize(new THREE.Vector3());
    const localMattressBox = mattressBox.clone().applyMatrix4(
      new THREE.Matrix4().copy(slot.group.matrixWorld).invert(),
    );
    const proxyWorldPosition = slot.bedTerminalScreen.getWorldPosition(new THREE.Vector3());
    const proxyBox = new THREE.Box3().setFromObject(slot.bedTerminalScreen);
    const candidates: WardInteriorTerminalCandidateDebug[] = [];

    slot.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || !isBedTerminalSurface(object))
        return;
      const box = new THREE.Box3().setFromObject(object);
      const worldCenter = collectSurfaceCenter(object, /门口机内/);
      candidates.push({
        name: object.name,
        materialNames: getMeshMaterials(object).map(material => material.name),
        worldCenter: toPoint(worldCenter),
        dimensions: toPoint(box.getSize(new THREE.Vector3())),
        frontNormal: toPoint(getSurfaceNormal(object, /门口机内/)),
        distanceToMattress: Number(worldCenter.distanceTo(mattressCenter).toFixed(3)),
      });
    });
    candidates.sort((a, b) => a.distanceToMattress - b.distanceToMattress);

    const groupWorldPosition = slot.group.getWorldPosition(new THREE.Vector3());
    const proxyWorldQuaternion = slot.bedTerminalScreen.getWorldQuaternion(new THREE.Quaternion());
    const proxyFrontNormal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(proxyWorldQuaternion)
      .normalize();

    diagnostics.push({
      bedIndex: slot.index,
      screenSource: slot.bedTerminalScreen.userData.wardInteriorTerminalSurface ? 'model' : 'proxy',
      mattress: {
        name: slot.mattress.name,
        worldCenter: toPoint(mattressCenter),
        dimensions: toPoint(mattressSize),
      },
      groupWorldPosition: toPoint(groupWorldPosition),
      inferredHeadX: Number(localMattressBox.min.x.toFixed(3)),
      proxy: {
        localPosition: toPoint(slot.bedTerminalScreen.position),
        worldPosition: toPoint(proxyWorldPosition),
        dimensions: toPoint(proxyBox.getSize(new THREE.Vector3())),
        rotationY: Number(slot.bedTerminalScreen.rotation.y.toFixed(3)),
        frontNormal: toPoint(proxyFrontNormal),
      },
      terminalCandidates: candidates,
    });
  }
  return diagnostics;
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

function resolveWardInteriorBedTerminalMaterialIndex(mesh: THREE.Mesh): number {
  const materials = getMeshMaterials(mesh);
  const configured = Number(mesh.userData.wardInteriorTerminalMaterialIndex);
  if (Number.isInteger(configured) && configured >= 0 && configured < materials.length)
    return configured;

  const namedIndex = materials.findIndex(material => material.name.includes('门口机内'));
  const index = namedIndex >= 0 ? namedIndex : 0;
  mesh.userData.wardInteriorTerminalMaterialIndex = index;
  return index;
}

/**
 * Replace only the material assigned to the real screen surface.
 *
 * The Blender export keeps the bezel and the inner display in one mesh with
 * separate geometry groups. Assigning a single material to that mesh makes
 * group index 1 render with no material (or paints the bezel with the canvas).
 * Keep the material array aligned with the original groups and swap only the
 * `门口机内` slot.
 */
export function setWardInteriorBedTerminalMaterial(
  mesh: THREE.Mesh,
  material: THREE.Material,
) {
  const current = getMeshMaterials(mesh);
  const index = resolveWardInteriorBedTerminalMaterialIndex(mesh);
  const next = [...current];
  if (next[index] && next[index] !== material)
    next[index].dispose();
  next[index] = material;
  mesh.material = next.length === 1 ? next[0] : next;
  mesh.userData.wardInteriorTerminalMaterialIndex = index;
}

export function getWardInteriorBedTerminalMaterial(mesh: THREE.Mesh): THREE.Material {
  const materials = getMeshMaterials(mesh);
  return materials[resolveWardInteriorBedTerminalMaterialIndex(mesh)] ?? materials[0];
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

export interface WardInteriorRayHit {
  name: string;
  point: [number, number, number];
  distance: number;
}

export interface WardInteriorRayCameraDebug {
  floor: WardInteriorRayHit | null;
  walls: WardInteriorRayHit[];
  door: WardInteriorRayHit | null;
  position: [number, number, number];
  target: [number, number, number];
}

export interface WardInteriorLockedView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

function toPoint(vector: THREE.Vector3): [number, number, number] {
  return [
    Number(vector.x.toFixed(3)),
    Number(vector.y.toFixed(3)),
    Number(vector.z.toFixed(3)),
  ];
}

function collectRayMeshes(root: THREE.Object3D): THREE.Object3D[] {
  const meshes: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh && object.visible)
      meshes.push(object);
  });
  return meshes;
}

function firstHit(
  raycaster: THREE.Raycaster,
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  meshes: THREE.Object3D[],
): THREE.Intersection | null {
  raycaster.set(origin, direction.clone().normalize());
  const hits = raycaster.intersectObjects(meshes, false);
  return hits[0] ?? null;
}

function findDoorObject(root: THREE.Object3D): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((object) => {
    if (found || !object.name.includes('门'))
      return;
    found = object;
  });
  return found;
}

/** Raycast the baked room to lock a doorway standing view looking inward. */
export function resolveBakedWardInteriorCameraFromRays(root: THREE.Object3D): {
  view: WardInteriorLockedView;
  debug: WardInteriorRayCameraDebug;
} {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const meshes = collectRayMeshes(root);
  const raycaster = new THREE.Raycaster();
  raycaster.far = Math.max(size.length() * 2, 20);

  const floorOrigin = new THREE.Vector3(center.x, bounds.max.y + 0.8, center.z);
  const floorHit = firstHit(raycaster, floorOrigin, new THREE.Vector3(0, -1, 0), meshes);
  const floorY = floorHit?.point.y ?? bounds.min.y;
  const eyeY = floorY + 1.55;

  const wallDirs: { name: string; dir: THREE.Vector3 }[] = [
    { name: '+z', dir: new THREE.Vector3(0, 0, 1) },
    { name: '-z', dir: new THREE.Vector3(0, 0, -1) },
    { name: '+x', dir: new THREE.Vector3(1, 0, 0) },
    { name: '-x', dir: new THREE.Vector3(-1, 0, 0) },
  ];
  const eyeOrigin = new THREE.Vector3(center.x, eyeY, center.z);
  const walls: WardInteriorRayHit[] = [];
  for (const wall of wallDirs) {
    const hit = firstHit(raycaster, eyeOrigin, wall.dir, meshes);
    if (!hit)
      continue;
    walls.push({
      name: `${wall.name}:${hit.object.name || '(unnamed)'}`,
      point: toPoint(hit.point),
      distance: Number(hit.distance.toFixed(3)),
    });
  }

  const doorObject = findDoorObject(root);
  const doorPoint = new THREE.Vector3();
  if (doorObject)
    doorObject.getWorldPosition(doorPoint);
  else if (walls.length) {
    const farthest = walls.reduce((best, wall) => wall.distance > best.distance ? wall : best);
    doorPoint.set(...farthest.point);
  }
  else {
    doorPoint.set(center.x, eyeY, bounds.max.z);
  }

  const inward = new THREE.Vector3(center.x - doorPoint.x, 0, center.z - doorPoint.z);
  if (inward.lengthSq() < 1e-6)
    inward.set(0, 0, -1);
  inward.normalize();

  const position = new THREE.Vector3(doorPoint.x, eyeY, doorPoint.z);
  position.addScaledVector(inward, 0.62);
  const target = new THREE.Vector3(center.x, floorY + 1.05, center.z);
  target.addScaledVector(inward, 0.35);

  const debug: WardInteriorRayCameraDebug = {
    floor: floorHit
      ? {
          name: floorHit.object.name || '(unnamed)',
          point: toPoint(floorHit.point),
          distance: Number(floorHit.distance.toFixed(3)),
        }
      : null,
    walls,
    door: {
      name: doorObject?.name || '(inferred)',
      point: toPoint(doorPoint),
      distance: Number(doorPoint.distanceTo(center).toFixed(3)),
    },
    position: toPoint(position),
    target: toPoint(target),
  };

  return {
    view: { position, target },
    debug,
  };
}

export function resolveBakedWardInteriorPresetView(
  presetId: string,
  doorView: WardInteriorLockedView,
  root: THREE.Object3D,
): WardInteriorLockedView {
  if (presetId === 'door' || presetId === 'free')
    return doorView;

  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const inward = doorView.target.clone().sub(doorView.position).setY(0);
  if (inward.lengthSq() < 1e-6)
    inward.set(0, 0, -1);
  inward.normalize();
  const side = new THREE.Vector3(-inward.z, 0, inward.x);

  if (presetId === 'top') {
    return {
      position: new THREE.Vector3(center.x, bounds.max.y + Math.max(2.4, size.z * 0.55), center.z + 0.01),
      target: new THREE.Vector3(center.x, bounds.min.y, center.z),
    };
  }

  return {
    position: doorView.position.clone().addScaledVector(side, Math.max(size.x, size.z) * 0.28).add(new THREE.Vector3(0, 0.45, 0)),
    target: doorView.target.clone(),
  };
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
