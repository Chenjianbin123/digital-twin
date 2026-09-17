import * as THREE from 'three';
import { wardInteriorSceneConfig } from '../config/ward-interior-scene.ts';

/** Extend only the middle of the room; the window end and door opening keep their proportions. */
export class WardRoomExpansion {
  private structural: { mesh: THREE.Mesh; original: THREE.BufferGeometry; geometry: THREE.BufferGeometry; world: THREE.Vector3[]; inverse: THREE.Matrix4 }[] = [];
  private props: { node: THREE.Object3D; position: THREE.Vector3; moves: boolean }[] = [];
  private detached: { node: THREE.Object3D; parent: THREE.Object3D }[] = [];
  private repeatedLights: THREE.Object3D[] = [];
  private depthMinZ = 0;
  private depthMaxZ = 0;
  private count = -1;
  extraDepth = 0;
  slots: { position: readonly [number, number, number]; rotationY: number }[] = [];

  private room: THREE.Group;

  constructor(room: THREE.Group) {
    this.room = room;
    room.updateMatrixWorld(true);
    // These fixtures belong to the shell in Blender but must retain manufactured dimensions.
    for (const name of ['CeilingLight_1', 'CeilingLight_2', 'CeilingVent_Frame', 'HandHygiene_Sign', 'HandRubDispenser']) {
      const node = room.getObjectByName(name);
      if (node?.parent && node.parent !== room) {
        this.detached.push({ node, parent: node.parent });
        room.attach(node);
      }
    }
    const structuralNames = new Set(['外壳', '灯']);
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const node of room.children) {
      if (structuralNames.has(node.name)) {
        node.traverse(mesh => {
          if (!(mesh instanceof THREE.Mesh)) return;
          const original = mesh.geometry;
          const geometry = original.clone();
          const positions = geometry.getAttribute('position');
          const world = Array.from({ length: positions.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld));
          for (const point of world) {
            minZ = Math.min(minZ, point.z);
            maxZ = Math.max(maxZ, point.z);
          }
          this.structural.push({ mesh, original, geometry, world, inverse: mesh.matrixWorld.clone().invert() });
          mesh.geometry = geometry;
        });
      }
      else {
        const center = new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3());
        this.props.push({ node, position: node.position.clone(), moves: center.z > 1.3 });
      }
    }
    this.depthMinZ = Number.isFinite(minZ) ? minZ : 0;
    this.depthMaxZ = Number.isFinite(maxZ) ? maxZ : 0;
  }

  update(count: number): boolean {
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid occupied bed count');
    if (count === this.count) return false;
    this.count = count;
    const native = wardInteriorSceneConfig.modular.slots;
    const first = native[0]!;
    const pitch = native[1]!.position[2] - first.position[2];
    // Empty rooms keep a single-bed shell; 1 bed shrinks, 2 beds = native, 3+ extend the door end.
    const layoutCount = Math.max(count, 1);
    this.extraDepth = (layoutCount - native.length) * pitch;
    this.slots = Array.from({ length: count }, (_, i) => ({
      position: [first.position[0], first.position[1], first.position[2] + pitch * i], rotationY: first.rotationY,
    }));
    // Shrink must not shear walls (hard hinge folds faces → door/shell z-fight + shadow band).
    // Scale depth from the window end so planes stay planar; expand still extends only the door half.
    const span = this.depthMaxZ - this.depthMinZ;
    const shrinking = this.extraDepth < 0 && span > 1e-6;
    const depthScale = shrinking ? (span + this.extraDepth) / span : 1;
    const point = new THREE.Vector3();
    for (const part of this.structural) {
      const positions = part.geometry.getAttribute('position');
      for (const [i, original] of part.world.entries()) {
        point.copy(original);
        if (shrinking)
          point.z = this.depthMinZ + (point.z - this.depthMinZ) * depthScale;
        else if (point.z > 1.3)
          point.z += this.extraDepth;
        point.applyMatrix4(part.inverse);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
      positions.needsUpdate = true;
      part.geometry.computeVertexNormals();
      part.geometry.computeBoundingBox();
      part.geometry.computeBoundingSphere();
    }
    for (const prop of this.props)
      prop.node.position.copy(prop.position).add(new THREE.Vector3(0, 0, prop.moves ? this.extraDepth : 0));
    for (const light of this.repeatedLights) light.removeFromParent();
    this.repeatedLights = [];
    const template = this.props.find(prop => prop.node.name === 'CeilingLight_2');
    if (template) {
      // Second native fixture belongs to bed 2; hide it when the shell shrinks to one bed.
      template.node.visible = layoutCount >= native.length;
      for (let i = 0; i < Math.max(0, layoutCount - native.length); i++) {
        const light = template.node.clone(true);
        light.name = 'WardExpandedCeilingLight_' + i;
        light.visible = true;
        light.position.copy(template.position).add(new THREE.Vector3(0, 0, pitch * i));
        this.room.add(light);
        this.repeatedLights.push(light);
      }
    }
    this.room.visible = true;
    this.room.updateMatrixWorld(true);
    return true;
  }

  dispose() {
    for (const part of this.structural) { part.mesh.geometry = part.original; part.geometry.dispose(); }
    for (const prop of this.props) {
      prop.node.position.copy(prop.position);
      prop.node.visible = true;
    }
    // Clones share GPU resources with the source fixture; only detach them.
    for (const light of this.repeatedLights) light.removeFromParent();
    this.repeatedLights = [];
    this.room.updateMatrixWorld(true);
    for (const { node, parent } of this.detached) parent.attach(node);
    this.detached = [];
    this.structural = [];
    this.props = [];
  }
}
