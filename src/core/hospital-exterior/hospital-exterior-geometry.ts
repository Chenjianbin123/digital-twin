import * as THREE from 'three';

/** Repeated exterior parts share geometry and one draw call per material. */
export class ExteriorGeometry {
  readonly root = new THREE.Group();
  private readonly batches = new Map<THREE.Material, THREE.Matrix4[]>();
  private readonly transform = new THREE.Object3D();

  box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material, rotation = 0) {
    this.transform.position.set(x, y, z);
    this.transform.scale.set(w, h, d);
    this.transform.rotation.set(0, rotation, 0);
    this.transform.updateMatrix();
    const batch = this.batches.get(material) ?? [];
    batch.push(this.transform.matrix.clone());
    this.batches.set(material, batch);
  }

  finish() {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    for (const [material, matrices] of this.batches) {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.computeBoundingSphere(); this.root.add(mesh);
    }
    this.batches.clear();
    return this.root;
  }
}

export function addArchitecturalSign(root: THREE.Group, title: string, subtitle: string, width: number, height: number, x: number, y: number, z: number, dark = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1536;
  canvas.height = Math.round(1536 * height / width);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法绘制医院标识');
  ctx.fillStyle = dark ? '#243b3e' : '#dedace'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = dark ? '#e9e1ce' : '#314e54';
  ctx.font = `500 ${Math.round(canvas.height * (subtitle ? .48 : .65))}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(title, 768, canvas.height * (subtitle ? .4 : .5), 1410);
  if (subtitle) {
    ctx.font = `400 ${Math.round(canvas.height * .13)}px Arial, sans-serif`;
    ctx.fillText(subtitle, 768, canvas.height * .81, 1410);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .65 }));
  mesh.position.set(x, y, z); root.add(mesh);
}
