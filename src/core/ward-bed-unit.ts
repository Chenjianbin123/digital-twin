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

/** Original local YZ screen UVs are rotated; normalize using the actual plane. */
export function createWardBedUnit(prototype: THREE.Object3D, bedCode: string): WardBedUnit {
  validateWardBedUnit(prototype);
  const group = prototype.clone(true) as THREE.Group;
  group.visible = true;
  group.userData = { ...group.userData, bedCode, wardBedUnit: true };
  const body = requireNode(group, 'BedBody');
  const screen = requireNode(group, 'BedTerminalSurface') as WardBedUnit['screen'];
  screen.geometry = screen.geometry.clone();
  const position = screen.geometry.getAttribute('position');
  const box = new THREE.Box3().setFromBufferAttribute(position as THREE.BufferAttribute);
  const height = box.max.y - box.min.y;
  const width = box.max.z - box.min.z;
  if (height < 1e-6 || width < 1e-6) {
    screen.geometry.dispose();
    throw new Error('Bed terminal plane has invalid dimensions');
  }
  const uv = new THREE.BufferAttribute(new Float32Array(position.count * 2), 2);
  for (let i = 0; i < position.count; i++)
    uv.setXY(i, (box.max.z - position.getZ(i)) / width, (box.max.y - position.getY(i)) / height);
  screen.geometry.setAttribute('uv', uv);
  screen.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  group.traverse(node => {
    if (node instanceof THREE.Mesh) { node.castShadow = false; node.receiveShadow = true; }
  });
  // Floor-level furnishings cast the indoor key shadow; overhead rails must not draw hard rings across the floor.
  for (const name of ['BedBody', 'BedChair', 'BedsideCabinet', 'IVStand', 'InfusionEquipment']) {
    group.getObjectByName(name)?.traverse(node => {
      if (node instanceof THREE.Mesh) node.castShadow = true;
    });
  }
  const infusion = requireNode(group, 'InfusionEquipment');
  infusion.visible = false;
  // Bedhead status orb is not shown in the twin; keep geometry for asset compatibility.
  group.getObjectByName('球体')?.traverse(node => { node.visible = false; });
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
