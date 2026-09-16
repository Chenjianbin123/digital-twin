import * as THREE from 'three';
import type { RoomSummary } from './area-summary';

/** Depth-tested markers stay behind walls; no patient identifiers are displayed in the corridor. */
export class CorridorMarker {
  readonly sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private signature = '';
  constructor(door: THREE.Object3D, corridor?: THREE.Box3, widthAxis: 'x' | 'z' = 'x') {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 160;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.texture, depthTest: true, depthWrite: false, toneMapped: false,
    }));
    const bounds = new THREE.Box3().setFromObject(door);
    const center = bounds.getCenter(new THREE.Vector3());
    this.sprite.position.copy(center);
    this.sprite.position.y = bounds.max.y - .25;
    if (corridor) {
      const middle = corridor.getCenter(new THREE.Vector3());
      this.sprite.position[widthAxis] = center[widthAxis] > middle[widthAxis]
        ? corridor.max[widthAxis] - .35 : corridor.min[widthAxis] + .35;
      this.sprite.position.y = Math.min(this.sprite.position.y, corridor.max.y - .3);
    }
    this.sprite.scale.set(1.2, .375, 1);
    // Markers are information, not an invisible shortcut through the physical door.
    this.sprite.raycast = () => {};
  }
  updateVisibility(camera: THREE.Camera) {
    const point = this.sprite.position.clone().project(camera);
    this.sprite.visible = point.z > -1 && point.z < 1 && Math.abs(point.x) < .88 && Math.abs(point.y) < .72;
  }
  update(label: string, summary: RoomSummary | undefined, offline: boolean, focused: boolean, dark = true) {
    const state = offline ? '门口机离线' : summary?.statusText ?? '未配置';
    const signature = JSON.stringify([label, state, focused, summary?.priority, dark]);
    if (signature === this.signature) return;
    this.signature = signature;
    const ctx = this.canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 160);
    ctx.fillStyle = dark ? (focused ? '#075a83' : '#102735') : (focused ? '#dceff4' : '#f3f8fa');
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = dark ? '#456675' : '#9abdc9';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 509, 157);
    ctx.fillStyle = offline ? (dark ? '#ffc78c' : '#aa6820') : summary?.accentColor ?? '#278297';
    ctx.fillRect(0, 0, 10, 160);
    ctx.fillStyle = dark ? '#ffffff' : '#17384c';
    ctx.font = 'bold 46px "Microsoft YaHei", sans-serif';
    ctx.fillText(label, 28, 63, 456);
    ctx.font = '30px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = dark ? '#e1eef5' : '#426574';
    ctx.fillText(state, 28, 122, 456);
    this.texture.needsUpdate = true;
  }
  dispose() {
    this.sprite.removeFromParent();
    this.texture.dispose();
    this.sprite.material.dispose();
  }
}
