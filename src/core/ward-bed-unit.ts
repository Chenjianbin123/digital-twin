import * as THREE from 'three';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';
import type { WardInteriorAssetParts } from './ward-interior-model.ts';

export interface WardBedUnit {
  group: THREE.Group;
  body: THREE.Object3D;
  screen: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  infusion: THREE.Object3D;
}

function requireNode(root: THREE.Object3D, name: string): THREE.Object3D {
  const node = root.getObjectByName(name);
  if (!node) throw new Error('BedUnit missing node: ' + name);
  return node;
}

export function validateWardBedUnit(root: THREE.Object3D) {
  for (const name of ['BedUnit', 'BedBody', 'BedsideCabinet', 'BedTerminal', 'IVStand', 'InfusionEquipment'])
    requireNode(root, name);
  const screen = requireNode(root, 'BedTerminalSurface');
  if (!(screen instanceof THREE.Mesh) || !screen.geometry.getAttribute('position'))
    throw new Error('BedTerminalSurface must be a mesh');
}

/** Original local screen UVs are rotated; normalize using the actual plane (any axis pair). */
export function createWardBedUnit(prototype: THREE.Object3D, bedCode: string): WardBedUnit {
  const source = prototype.getObjectByName('BedUnit') ?? prototype;
  validateWardBedUnit(source);
  const group = source.clone(true) as THREE.Group;
  group.visible = true;
  group.userData = { ...group.userData, bedCode, wardBedUnit: true };
  const body = requireNode(group, 'BedBody');
  const screen = requireNode(group, 'BedTerminalSurface') as WardBedUnit['screen'];
  screen.geometry = screen.geometry.clone();
  const position = screen.geometry.getAttribute('position');
  if (!position)
    throw new Error('BedTerminalSurface must be a mesh');
  const box = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute);
  const size = box.getSize(new THREE.Vector3());
  // Prefer authored YZ terminal faces; otherwise use the two largest axes (new exports vary).
  let uAxis: 'x' | 'y' | 'z' = 'z';
  let vAxis: 'x' | 'y' | 'z' = 'y';
  let uMin = box.min.z;
  let uSpan = size.z;
  let vMin = box.min.y;
  let vSpan = size.y;
  let flipU = true;
  let flipV = true;
  if (uSpan < 1e-6 || vSpan < 1e-6) {
    const axes = (
      [
        { axis: 'x' as const, extent: size.x },
        { axis: 'y' as const, extent: size.y },
        { axis: 'z' as const, extent: size.z },
      ]
    ).sort((a, b) => b.extent - a.extent);
    if (axes[0]!.extent < 1e-6 || axes[1]!.extent < 1e-6) {
      screen.geometry.dispose();
      throw new Error('Bed terminal plane has invalid dimensions');
    }
    uAxis = axes[0]!.axis;
    vAxis = axes[1]!.axis;
    uMin = box.min[uAxis];
    uSpan = box.max[uAxis] - uMin;
    vMin = box.min[vAxis];
    vSpan = box.max[vAxis] - vMin;
    flipU = false;
    flipV = false;
  }
  const read = (index: number, axis: 'x' | 'y' | 'z') => (
    axis === 'x' ? position.getX(index) : axis === 'y' ? position.getY(index) : position.getZ(index)
  );
  const uv = new THREE.BufferAttribute(new Float32Array(position.count * 2), 2);
  for (let i = 0; i < position.count; i++) {
    const u = (read(i, uAxis) - uMin) / uSpan;
    const v = (read(i, vAxis) - vMin) / vSpan;
    uv.setXY(i, flipU ? 1 - u : u, flipV ? 1 - v : v);
  }
  screen.geometry.setAttribute('uv', uv);
  screen.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  group.traverse(node => {
    if (node instanceof THREE.Mesh) { node.castShadow = false; node.receiveShadow = true; }
  });
  // Floor-level furnishings cast the indoor key shadow; overhead rails must not draw hard rings across the floor.
  for (const name of ['BedBody', 'BedChair', 'BedsideCabinet', 'IVStand', 'InfusionEquipment', '球体']) {
    group.getObjectByName(name)?.traverse(node => {
      if (node instanceof THREE.Mesh) node.castShadow = true;
    });
  }
  const infusion = requireNode(group, 'InfusionEquipment');
  infusion.visible = false;
  // 旧资产里「球体」是床头状态球；新资产同名节点常是花瓶绿植（材质含花瓶），保留可见。
  const orb = group.getObjectByName('球体');
  if (orb) {
    let isPlant = false;
    orb.traverse((node) => {
      if (!(node instanceof THREE.Mesh))
        return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some(material => /花瓶|plant|叶|绿植/i.test(material?.name ?? '')))
        isPlant = true;
    });
    if (!isPlant)
      orb.traverse((node) => { node.visible = false; });
  }
  return { group, body, screen, infusion };
}

/** The scene owns screen textures and selection effects; static asset resources remain shared. */
export function disposeWardBedUnit(unit: WardBedUnit) {
  unit.group.removeFromParent();
  unit.screen.geometry.dispose();
  unit.screen.material.dispose();
}

export function placeWardBedUnit(group: THREE.Object3D, index: number, slots = wardInteriorSceneConfig.modular.slots) {
  const slot = slots[index];
  if (!slot) throw new Error('No room slot for bed index ' + index);
  group.position.set(...slot.position);
  group.rotation.set(0, slot.rotationY, 0);
  group.scale.setScalar(1);
}

/** Keep the shell at source scale and relocate shared equipment out of bed slots. */
export function prepareModularWardRoom(room: THREE.Group, prototype: THREE.Group): WardInteriorAssetParts {
  validateWardBedUnit(prototype);
  for (const name of ['外壳', '灯']) requireNode(room, name);
  for (const name of wardInteriorSceneConfig.modular.hiddenRoomNodes) {
    const node = room.getObjectByName(name) ?? room.getObjectByName(name.replace(/\./g, ''));
    if (node) node.visible = false;
  }
  const sharedEquipment = new THREE.Group();
  sharedEquipment.name = 'WardSharedMedicalEquipment';
  const equipment = room.children.filter(node => node.name.startsWith('cgaxis_models_55_07_'));
  room.add(sharedEquipment);
  room.updateMatrixWorld(true);
  for (const node of equipment) sharedEquipment.attach(node);
  sharedEquipment.position.set(...wardInteriorSceneConfig.modular.sharedEquipmentOffset);
  const bounds = new THREE.Box3().setFromObject(requireNode(room, '外壳'));
  return {
    mode: 'modular', architecture: room, props: sharedEquipment, bedPrototype: prototype, bakedBeds: [],
    baseBounds: { size: bounds.getSize(new THREE.Vector3()), center: bounds.getCenter(new THREE.Vector3()), minY: bounds.min.y },
  };
}
