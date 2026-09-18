import * as THREE from 'three';
import { wardCorridorSceneConfig } from '../config/ward-corridor-scene.ts';

export const WARD_CORRIDOR_MODEL_URL = wardCorridorSceneConfig.model.url;
export const WARD_CORRIDOR_SLOT_COUNT = wardCorridorSceneConfig.model.slotCount;
export const WARD_CORRIDOR_CANVAS_TEXTURE_FLIP_Y = wardCorridorSceneConfig.model.canvasTextureFlipY;
export const HOSPITAL_CORRIDOR_DOOR_NAMES = wardCorridorSceneConfig.model.doorNodeNames;
export const HOSPITAL_CORRIDOR_ENTRANCE_DEVICE_NAMES =
  wardCorridorSceneConfig.model.entranceDeviceNodeNames;

const FLOOR_STRIPE_CHROMA_MIN = 0.35;

function corridorThemeMaterialNames() {
  const { light, dark } = wardCorridorSceneConfig.appearance.themeMaterials;
  return new Set([...Object.keys(light), ...Object.keys(dark)]);
}

/** 仅压暗未纳入主题映射的高饱和色带；主题色带由 createCorridorTheme 统一上色。 */
export function dimHospitalCorridorFloorStripes(root: THREE.Object3D) {
  const meshName = wardCorridorSceneConfig.appearance.floorMeshName;
  const scale = wardCorridorSceneConfig.appearance.floorStripeColorScale;
  const themed = corridorThemeMaterialNames();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.name !== meshName)
      return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const next = materials.map((material) => {
      if (!('color' in material))
        return material;
      const std = material as THREE.MeshStandardMaterial;
      if (themed.has(std.name))
        return material;
      const max = Math.max(std.color.r, std.color.g, std.color.b);
      const min = Math.min(std.color.r, std.color.g, std.color.b);
      const chroma = max === 0 ? 0 : (max - min) / max;
      if (chroma < FLOOR_STRIPE_CHROMA_MIN)
        return material;
      const cloned = std.clone();
      cloned.color.multiplyScalar(scale);
      if (cloned.emissiveIntensity > 0)
        cloned.emissiveIntensity *= scale;
      return cloned;
    });
    object.material = Array.isArray(object.material) ? next : next[0];
  });
}

/** 走廊门板/座椅/墙面/导向带与护士站浅色主题对齐；可重复切换不叠加。 */
export function createCorridorTheme() {
  const prepared = new WeakSet<THREE.Mesh>();
  const originals = new WeakMap<THREE.MeshStandardMaterial, THREE.Color>();

  return (root: THREE.Object3D | null, dark: boolean) => {
    if (!root)
      return;

    const palette = dark
      ? wardCorridorSceneConfig.appearance.themeMaterials.dark
      : wardCorridorSceneConfig.appearance.themeMaterials.light;
    const themedNames = corridorThemeMaterialNames();

    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh))
        return;

      if (!prepared.has(object)) {
        const clone = (material: THREE.Material) => {
          const std = material as THREE.MeshStandardMaterial;
          return std.isMeshStandardMaterial && themedNames.has(std.name)
            ? std.clone()
            : material;
        };
        object.material = Array.isArray(object.material)
          ? object.material.map(clone)
          : clone(object.material);
        prepared.add(object);
      }

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const std = material as THREE.MeshStandardMaterial;
        if (!std.isMeshStandardMaterial || palette[std.name] === undefined)
          continue;
        if (!originals.has(std))
          originals.set(std, std.color.clone());
        std.color.setHex(palette[std.name]!);
        // 门/椅保留一点反光层次，避免塑料哑光发灰。
        if (std.name.startsWith('椅子.')) {
          std.metalness = 0.04;
          std.roughness = 0.66;
          std.envMapIntensity = 0.52;
        }
        else if (std.name === '灰白') {
          std.roughness = 0.76;
          std.envMapIntensity = 0.4;
        }
        else if (std.name === '门周') {
          std.roughness = 0.52;
          std.envMapIntensity = 0.46;
          std.metalness = 0.08;
        }
        else if (std.name === '材质.008' || std.name === '材质.020' || std.name === '材质.018') {
          // 导向带自发光一点，避免曝光/环境光把色带洗成灰。
          const hex = palette[std.name]!;
          std.color.setHex(hex);
          std.emissive.setHex(hex);
          std.emissiveIntensity = 0.16;
          std.roughness = 0.48;
          std.envMapIntensity = 0.52;
          std.metalness = 0.02;
        }
        std.needsUpdate = true;
      }
    });
  };
}

/** 地砖/墙面补一点环境反射，拉开灰白哑光与高级感。 */
export function polishHospitalCorridorMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh))
      return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      const std = material as THREE.MeshStandardMaterial;
      if (!std.isMeshStandardMaterial)
        continue;
      const max = Math.max(std.color.r, std.color.g, std.color.b);
      const min = Math.min(std.color.r, std.color.g, std.color.b);
      const chroma = max === 0 ? 0 : (max - min) / max;
      if (object.name === '地板' && chroma < 0.35) {
        std.roughness = Math.min(std.roughness || 1, 0.42);
        std.envMapIntensity = Math.max(std.envMapIntensity || 0, 0.82);
        std.metalness = Math.min(Math.max(std.metalness || 0, 0.06), 0.12);
        std.needsUpdate = true;
      }
      else if (object.name === '天花板' || std.name.includes('天花板')) {
        std.roughness = Math.min(std.roughness || 1, 0.78);
        std.envMapIntensity = Math.max(std.envMapIntensity || 0, 0.34);
        std.needsUpdate = true;
      }
      else if (std.name === '灰白' || /墙|wall/i.test(object.name)) {
        std.roughness = Math.min(std.roughness || 1, 0.72);
        std.envMapIntensity = Math.max(std.envMapIntensity || 0, 0.45);
        std.needsUpdate = true;
      }
    }
  });
}

export function normalizeHospitalCorridorModelTransform(root: THREE.Object3D) {
  root.rotation.set(wardCorridorSceneConfig.model.rotationX, 0, 0);
  root.updateMatrixWorld(true);

  const initialBounds = new THREE.Box3().setFromObject(root);
  const initialCenter = initialBounds.getCenter(new THREE.Vector3());
  root.position.x -= initialCenter.x;
  root.position.z -= initialCenter.z;
  root.position.y -= initialBounds.min.y;
  root.updateMatrixWorld(true);

  return new THREE.Box3().setFromObject(root);
}

export function getHospitalCorridorDoorOrder(
  nodes: readonly THREE.Object3D[],
) {
  const allowedNames = new Set<string>(HOSPITAL_CORRIDOR_DOOR_NAMES);
  const doors = nodes
    .filter(node => allowedNames.has(node.name))
    .map((node) => {
      if (node instanceof THREE.Mesh)
        return node;
      let mesh: THREE.Mesh | undefined;
      node.traverse((child) => {
        if (!mesh && child instanceof THREE.Mesh)
          mesh = child;
      });
      if (mesh) mesh.userData.corridorDoorNodeName = node.name;
      return mesh;
    })
    .filter((node): node is THREE.Mesh => !!node);
  return doors
    .sort((left, right) => {
      const leftCenter = new THREE.Box3().setFromObject(left).getCenter(new THREE.Vector3());
      const rightCenter = new THREE.Box3().setFromObject(right).getCenter(new THREE.Vector3());
      return rightCenter.z - leftCenter.z || left.name.localeCompare(right.name, 'zh-Hans');
    });
}

/** 新走廊模型中的门口机模板节点，按与病房门相同的空间顺序排列。 */
export function getHospitalCorridorEntranceDeviceOrder(
  nodes: readonly THREE.Object3D[],
) {
  const allowedNames = new Set<string>(HOSPITAL_CORRIDOR_ENTRANCE_DEVICE_NAMES);
  return nodes
    .filter(node => allowedNames.has(node.name))
    .sort((left, right) => {
      const leftCenter = new THREE.Box3().setFromObject(left).getCenter(new THREE.Vector3());
      const rightCenter = new THREE.Box3().setFromObject(right).getCenter(new THREE.Vector3());
      return rightCenter.z - leftCenter.z || rightCenter.x - leftCenter.x;
    });
}

/** 按“门口机内”材质识别所有实际门口屏网格，兼容节点名称不规范的模型。 */
export function getHospitalCorridorEntranceScreenOrder(
  nodes: readonly THREE.Object3D[],
) {
  return nodes
    .filter((node): node is THREE.Mesh => {
      if (!(node instanceof THREE.Mesh))
        return false;
      if (/^走廊屏/.test(node.name))
        return false;
      return /^门口机\d+$/.test(node.name)
        || getHospitalCorridorEntranceScreenMaterialIndex(node) >= 0;
    })
    .sort((left, right) => {
      const leftCenter = new THREE.Box3().setFromObject(left).getCenter(new THREE.Vector3());
      const rightCenter = new THREE.Box3().setFromObject(right).getCenter(new THREE.Vector3());
      return rightCenter.z - leftCenter.z || rightCenter.x - leftCenter.x;
    });
}

/** 识别模型中的两块走廊屏，优先按节点名，兼容节点为 Group 的导出结果。 */
export function getHospitalCorridorDisplayScreenOrder(
  nodes: readonly THREE.Object3D[],
) {
  const namedMeshes: THREE.Mesh[] = [];
  nodes
    .filter(node => /^走廊屏[12]$/.test(node.name))
    .forEach(node => {
      if (node instanceof THREE.Mesh) {
        namedMeshes.push(node);
        return;
      }
      let preferredMesh: THREE.Mesh | undefined;
      let firstMesh: THREE.Mesh | undefined;
      node.traverse(child => {
        if (!(child instanceof THREE.Mesh))
          return;
        firstMesh ??= child;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        if (!preferredMesh && materials.some(material => material.name.includes('门口机内')))
          preferredMesh = child;
      });
      if (preferredMesh ?? firstMesh)
        namedMeshes.push(preferredMesh ?? firstMesh!);
    });
  if (namedMeshes.length) {
    return [...new Set(namedMeshes)]
      .sort((left, right) => {
        const leftIndex = Number(left.name.match(/走廊屏(\d+)/)?.[1] ?? 99);
        const rightIndex = Number(right.name.match(/走廊屏(\d+)/)?.[1] ?? 99);
        return leftIndex - rightIndex;
      })
      .slice(0, 2);
  }

  const fallbackMeshes = nodes
    .filter((node): node is THREE.Mesh => {
      if (!(node instanceof THREE.Mesh) || /^门口机\d+$/.test(node.name))
        return false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      return materials.some(material => material.name.includes('门口机内'));
    })
    .filter((mesh, index, meshes) => meshes.indexOf(mesh) === index)
    .sort((left, right) => {
      const leftCenter = new THREE.Box3().setFromObject(left).getCenter(new THREE.Vector3());
      const rightCenter = new THREE.Box3().setFromObject(right).getCenter(new THREE.Vector3());
      return rightCenter.z - leftCenter.z || rightCenter.x - leftCenter.x;
    });
  return fallbackMeshes.slice(0, 2);
}

export function getHospitalCorridorEntranceScreenMaterialIndex(mesh: THREE.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  // Dynamic textures replace materials; mesh identity must survive that replacement.
  const savedIndex = mesh.userData.hospitalCorridorTemplateMaterialIndex;
  if (mesh.userData.hospitalCorridorTemplateDevice === true
    && Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < materials.length)
    return savedIndex as number;
  return materials.findIndex(material =>
    material.name.includes('门口机内')
    || (material.name.includes('门口机') && /屏|screen|display/i.test(material.name)),
  );
}

/** 提取走廊屏可见面并按模型 Y/Z 轴重新生成完整横屏 UV。 */
export function createHospitalCorridorDisplayGeometry(
  mesh: THREE.Mesh,
  materialIndex: number,
) {
  const geometry = mesh.geometry.clone();
  const groups = materialIndex >= 0
    ? geometry.groups.filter(group => group.materialIndex === materialIndex)
    : [];
  const targetGroups = groups.length
    ? groups
    : [{ start: 0, count: geometry.index?.count ?? geometry.getAttribute('position').count }];
  const position = geometry.getAttribute('position');
  const vertexIndices = new Set<number>();
  targetGroups.forEach(group => {
    const end = Math.min(group.start + group.count, geometry.index?.count ?? position.count);
    for (let i = group.start; i < end; i++)
      vertexIndices.add(geometry.index?.getX(i) ?? i);
  });

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  vertexIndices.forEach(index => {
    min.min(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
    max.max(new THREE.Vector3(position.getX(index), position.getY(index), position.getZ(index)));
  });
  const width = Math.max(max.z - min.z, 1e-6);
  const height = Math.max(max.y - min.y, 1e-6);
  const uv = new THREE.BufferAttribute(new Float32Array(position.count * 2), 2);
  for (let index = 0; index < position.count; index++) {
    const u = (position.getZ(index) - min.z) / width;
    const v = (position.getY(index) - min.y) / height;
    uv.setXY(index, u, v);
  }
  geometry.setAttribute('uv', uv);
  geometry.clearGroups();
  targetGroups.forEach(group => geometry.addGroup(group.start, group.count, 0));
  return geometry;
}

export function getHospitalCorridorEntranceScreenAspect(mesh: THREE.Mesh) {
  const materialIndex = getHospitalCorridorEntranceScreenMaterialIndex(mesh);
  const screenBounds = materialIndex >= 0
    ? getHospitalCorridorEntranceScreenBounds(mesh, materialIndex)
    : new THREE.Box3();
  const bounds = screenBounds.isEmpty()
    ? (() => {
      if (!mesh.geometry.boundingBox)
        mesh.geometry.computeBoundingBox();
      return mesh.geometry.boundingBox ?? new THREE.Box3(
        new THREE.Vector3(-0.5, -0.5, -0.5),
        new THREE.Vector3(0.5, 0.5, 0.5),
      );
    })()
    : screenBounds;
  const size = bounds.getSize(new THREE.Vector3());
  const dimensions = [
    Math.abs(size.x * mesh.scale.x),
    Math.abs(size.y * mesh.scale.y),
    Math.abs(size.z * mesh.scale.z),
  ].sort((left, right) => right - left);
  const width = dimensions[0] || 1;
  const height = dimensions[1] || 1;
  return width / height;
}

/** 模型自带门口屏必须参与深度测试，才能在斜视角下被真实门框遮挡。 */
export function shouldDepthTestHospitalCorridorScreen(mesh: THREE.Mesh) {
  return !mesh.userData.generatedHospitalCorridorOverlay;
}

/** 将门口机内屏幕面调整为 9:16；只改屏幕顶点，不拉伸门框。 */
export function fitHospitalCorridorEntranceScreenGeometry(
  mesh: THREE.Mesh,
  targetAspect = 9 / 16,
) {
  if (mesh.userData.hospitalCorridorScreenGeometryFitted)
    return;
  const materialIndex = getHospitalCorridorEntranceScreenMaterialIndex(mesh);
  if (materialIndex < 0)
    return;

  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute('position');
  const groups = geometry.groups.filter(group => group.materialIndex === materialIndex);
  if (!position || !groups.length)
    return;

  const vertexIndices = new Set<number>();
  for (const group of groups) {
    const end = Math.min(group.start + group.count, geometry.index?.count ?? position.count);
    for (let i = group.start; i < end; i++)
      vertexIndices.add(geometry.index?.getX(i) ?? i);
  }
  if (!vertexIndices.size)
    return;

  const bounds = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const index of vertexIndices) {
    point.fromBufferAttribute(position, index);
    bounds.expandByPoint(point);
  }
  const width = Math.abs(bounds.max.x - bounds.min.x);
  const height = Math.abs(bounds.max.z - bounds.min.z);
  if (width <= 0 || height <= 0)
    return;

  const currentPortraitAspect = (height * Math.abs(mesh.scale.z))
    / (width * Math.abs(mesh.scale.x));
  const zFactor = targetAspect / currentPortraitAspect;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  for (const index of vertexIndices) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = centerZ + (position.getZ(index) - centerZ) * zFactor;
    position.setXYZ(index, x, y, z);
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.geometry = geometry;
  mesh.userData.hospitalCorridorScreenGeometryFitted = true;
}

export function getHospitalCorridorEntranceScreenBounds(mesh: THREE.Mesh, materialIndex: number) {
  const position = mesh.geometry.getAttribute('position');
  const bounds = new THREE.Box3();
  if (!position)
    return bounds;
  const groups = mesh.geometry.groups.filter(group => group.materialIndex === materialIndex);
  const ranges = groups.length
    ? groups.map(group => ({ start: group.start, end: group.start + group.count }))
    : [{ start: 0, end: position.count }];
  const point = new THREE.Vector3();
  for (const range of ranges) {
    for (let i = range.start; i < range.end; i++) {
      const index = mesh.geometry.index?.getX(i) ?? i;
      point.fromBufferAttribute(position, index);
      bounds.expandByPoint(point);
    }
  }
  return bounds;
}

export function configureWardCorridorCanvasTexture(
  texture: { flipY: boolean; needsUpdate: boolean },
) {
  texture.flipY = WARD_CORRIDOR_CANVAS_TEXTURE_FLIP_Y;
  texture.needsUpdate = true;
}

export interface WardCorridorRoomLike {
  sickroomId?: string;
  deviceCode?: string;
  sickroomName?: string;
  sickroomCode?: string;
  templateId?: number;
  director?: string;
}

export interface WardCorridorScreenPresentation {
  width: number;
  height: number;
  shellWidth: number;
  shellHeight: number;
}

/** Fixed GLB screen bounds with an aspect-correct live surface. */
export function getWardCorridorScreenPresentation(
  isHorizontal: boolean,
): WardCorridorScreenPresentation {
  const height = isHorizontal ? 0.484 : 0.72;
  return {
    width: isHorizontal ? height * (16 / 9) : height * (2 / 3),
    height,
    shellWidth: isHorizontal ? 0.98 : 0.62,
    shellHeight: isHorizontal ? 0.60 : 0.86,
  };
}

export function getWardCorridorScreenNodeScale(isHorizontal: boolean) {
  const presentation = getWardCorridorScreenPresentation(isHorizontal);
  return {
    screen: {
      x: presentation.width / 0.51,
      y: 1,
      z: presentation.height / 0.68,
    },
    shell: {
      x: 1,
      y: presentation.shellHeight / 0.82,
      z: presentation.shellWidth / 0.62,
    },
  };
}

export function buildWardCorridorBindingSignature(
  rooms: readonly WardCorridorRoomLike[],
): string {
  return rooms.map(room => [
    room.sickroomCode ?? room.sickroomName ?? '',
    room.sickroomId ?? '',
    room.deviceCode ?? '',
    room.templateId ?? 0,
    room.director ?? '',
  ].join(':')).join('|');
}

export interface WardCorridorSlot {
  slotIndex: number;
  roomIndex: number | null;
  label: string;
  interactive: boolean;
}

function formatRoomLabel(room: WardCorridorRoomLike, index: number) {
  const name = room.sickroomName?.trim().replace(/房$/, '');
  return name || `病房${index + 1}`;
}

export function buildWardCorridorSlots(
  rooms: readonly WardCorridorRoomLike[],
): WardCorridorSlot[] {
  return Array.from({ length: WARD_CORRIDOR_SLOT_COUNT }, (_, slotIndex) => {
    const room = rooms[slotIndex];
    if (!room) {
      return {
        slotIndex,
        roomIndex: null,
        label: '未配置',
        interactive: false,
      };
    }
    return {
      slotIndex,
      roomIndex: slotIndex,
      label: formatRoomLabel(room, slotIndex),
      interactive: true,
    };
  });
}

export function shouldUseWardCorridorModel(roomCount: number) {
  return roomCount >= 0;
}

export function shouldReserveWardCorridorModel(
  roomCount: number,
  modelFailed: boolean,
  modelLoaded = true,
) {
  return !modelFailed && modelLoaded && shouldUseWardCorridorModel(roomCount);
}

/** GLTFLoader sanitizes Blender node names by replacing spaces with underscores. */
export function normalizeWardCorridorNodeName(objectName: string): string {
  return objectName.replace(/_/g, ' ');
}

export function parseWardCorridorSlotIndex(objectName: string): number | null {
  const match = /^Room (\d{2})(?:\s|$)/.exec(normalizeWardCorridorNodeName(objectName));
  if (!match)
    return null;
  const slotIndex = Number(match[1]) - 1;
  return slotIndex >= 0 && slotIndex < WARD_CORRIDOR_SLOT_COUNT ? slotIndex : null;
}
