import * as THREE from 'three';
import type { RoomSummary } from './area-summary';

/** Depth-tested markers stay behind walls; no patient identifiers are displayed in the corridor. */
export class CorridorMarker {
  // Retain the scene attachment property; the plate itself must not billboard.
  readonly sprite: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private signature = '';
  private mountingParts: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>[] = [];
  constructor(door: THREE.Object3D, corridor?: THREE.Box3, widthAxis: 'x' | 'z' = 'x') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 160;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: this.texture, depthTest: true, depthWrite: true, toneMapped: false,
    }));
    const bounds = new THREE.Box3().setFromObject(door);
    const center = bounds.getCenter(new THREE.Vector3());
    this.sprite.position.copy(center);
    const middle = corridor?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
    const positiveSide = center[widthAxis] > middle[widthAxis];
    const height = .18;
    const width = height * (512 / 160);
    const bracketLength = .04;
    const wallFace = positiveSide ? bounds.min[widthAxis] : bounds.max[widthAxis];
    // The plate projects from its own door frame, not from the corridor bounds.
    this.sprite.position[widthAxis] = wallFace + (positiveSide ? -1 : 1) * (bracketLength + width / 2);
    this.sprite.position.y = bounds.max.y + .015 + height / 2;
    this.sprite.scale.set(width, height, 1);
    this.sprite.rotation.y = widthAxis === 'x' ? 0 : Math.PI / 2;
    // Separate outward-facing planes keep text readable from either end.
    const back = new THREE.Mesh(this.sprite.geometry, this.sprite.material);
    back.name = 'room-plate-back';
    back.rotation.y = Math.PI;
    back.position.z = -.026;
    back.raycast = () => {};
    this.sprite.add(back);
    const wallSide = (positiveSide ? 1 : -1) * (widthAxis === 'x' ? 1 : -1);
    const addPart = (name: string, x: number, w: number, h: number, depth: number) => {
      const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth),
        new THREE.MeshStandardMaterial({ color: '#607d8b', roughness: .75, metalness: .15 }));
      part.name = name;
      part.position.set(x, 0, -.013);
      part.raycast = () => {};
      this.sprite.add(part);
      this.mountingParts.push(part);
    };
    addPart('room-plate-housing', 0, 1.014, 1.045, .024);
    addPart('room-plate-bracket', wallSide * (.5 + bracketLength / (2 * width)), bracketLength / width, .06 / height, .035);
    addPart('room-plate-wall-mount', wallSide * (.5 + bracketLength / width), .025 / width, .15 / height, .07);
    // Markers are information, not an invisible shortcut through the physical door.
    this.sprite.raycast = () => {};
  }
  updateVisibility(camera: THREE.Camera) {
    const point = this.sprite.position.clone().project(camera);
    this.sprite.visible = point.z > -1 && point.z < 1 && Math.abs(point.x) < .88 && Math.abs(point.y) < .72;
  }
  update(label: string, summary: RoomSummary | undefined, offline: boolean, focused: boolean, _dark = true) {
    // Keep actionable warnings, but leave occupancy details in the room panel.
    const state = offline ? '门口机离线' : summary?.priority === 'calling' ? summary.statusText : '';
    const signature = JSON.stringify([label, state, focused]);
    if (signature === this.signature) return;
    this.signature = signature;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = focused ? '#6298ab' : '#9db3be';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = focused ? '#e0eef3' : '#eef4f6';
    ctx.fillRect(4, 4, 504, 152);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(5, 5, 502, 2);
    ctx.fillStyle = '#cbdce3';
    ctx.fillRect(5, 149, 502, 6);
    ctx.fillStyle = '#294c60';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let size = state ? 54 : 76;
    ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
    const measured = ctx.measureText(label).width;
    if (measured > 448) size *= 448 / measured;
    ctx.font = `600 ${size}px "Microsoft YaHei", sans-serif`;
    ctx.fillText(label, 256, state ? 54 : 80);
    if (state) {
      ctx.font = '30px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = offline ? '#89561f' : '#a33c42';
      const stateWidth = ctx.measureText(state).width;
      if (stateWidth > 448) ctx.font = `${30 * 448 / stateWidth}px "Microsoft YaHei", sans-serif`;
      ctx.fillText(state, 256, 119);
    }
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.sprite.removeFromParent();
    for (const part of this.mountingParts) {
      part.geometry.dispose();
      part.material.dispose();
    }
    this.mountingParts = [];
    this.sprite.clear();
    this.texture.dispose();
    this.sprite.geometry.dispose();
    this.sprite.material.dispose();
  }
}
