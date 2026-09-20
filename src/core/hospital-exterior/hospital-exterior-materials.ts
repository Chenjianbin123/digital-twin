import * as THREE from 'three';

// Stable material variation keeps login and preview renders consistent.
export function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
}

function canvasTexture(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建建筑材质');
  paint(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function grain(base: string, amount: number, seed: number) {
  return canvasTexture(256, 256, ctx => {
    const random = seededRandom(seed);
    ctx.fillStyle = base; ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 16000; i++) {
      ctx.fillStyle = random() > .5 ? `rgba(255,255,255,${random() * amount})` : `rgba(26,33,35,${random() * amount})`;
      ctx.fillRect(random() * 256, random() * 256, 1, 1);
    }
  });
}

export function createExteriorMaterials() {
  const stoneMap = grain('#d4cebf', .12, 31);
  const asphaltMap = grain('#535958', .38, 47);
  asphaltMap.wrapS = asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.repeat.set(40, 4);
  const pavementMap = canvasTexture(512, 512, ctx => {
    const random = seededRandom(17);
    ctx.fillStyle = '#b1b4b0'; ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const shade = 170 + Math.floor(random() * 19);
      ctx.fillStyle = `rgb(${shade + 8},${shade + 7},${shade + 2})`;
      ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
    }
    for (let i = 0; i < 12000; i++) {
      ctx.fillStyle = `rgba(55,60,54,${random() * .08})`;
      ctx.fillRect(random() * 512, random() * 512, 1, 1);
    }
  });
  pavementMap.wrapS = pavementMap.wrapT = THREE.RepeatWrapping;
  pavementMap.repeat.set(10, 7);
  const grassMap = grain('#788363', .12, 53);
  grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping; grassMap.repeat.set(80, 80);
  const glazingMap = canvasTexture(128, 256, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 18, 256);
    gradient.addColorStop(0, '#8fa9b4'); gradient.addColorStop(.3, '#a6bcc5');
    gradient.addColorStop(.55, '#526975'); gradient.addColorStop(1, '#2c414a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 256);
    ctx.fillStyle = '#9ca8a333'; ctx.fillRect(10, 0, 26, 256);
    ctx.fillStyle = '#e3e1cd22'; ctx.fillRect(95, 18, 26, 224);
    ctx.fillStyle = '#15263155'; ctx.fillRect(0, 246, 128, 10);
  });
  const leafMap = canvasTexture(128, 128, ctx => {
    const random = seededRandom(79);
    // An irregular alpha-cut branch silhouette, rather than a solid sphere crown.
    for (let i = 0; i < 95; i++) {
      const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * 53;
      const x = 64 + Math.cos(angle) * radius, y = 64 + Math.sin(angle) * radius * .9;
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      ctx.fillStyle = ['#789052', '#586e3d', '#91a767', '#667d44'][i % 4];
      ctx.beginPath(); ctx.ellipse(0, 0, 4 + random() * 3, 2 + random() * 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });
  const standard = (color: number, roughness = .75, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  return {
    stone: new THREE.MeshStandardMaterial({ map: stoneMap, roughness: .78 }),
    paleStone: standard(0xe0ddd2), limestone: standard(0xb9b3a4), joint: standard(0x7e817b),
    aluminium: standard(0x556169, .28, .7), bronze: standard(0x998972, .38, .55),
    glass: new THREE.MeshPhysicalMaterial({ map: glazingMap, color: 0xd0e0e3, metalness: .48, roughness: .18, clearcoat: .9, clearcoatRoughness: .15, envMapIntensity: 1.3 }),
    spandrel: standard(0x394e57, .3, .45), dark: standard(0x253a40, .4, .3),
    paving: new THREE.MeshStandardMaterial({ map: pavementMap, roughness: .92 }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphaltMap, roughness: .96 }),
    grass: new THREE.MeshStandardMaterial({ map: grassMap, roughness: 1 }),
    soil: standard(0x4e4c36), white: standard(0xe5e4d8), wood: standard(0x89745b),
    leaf: new THREE.MeshStandardMaterial({ map: leafMap, alphaTest: .45, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .95 }),
    bark: standard(0x786d57), steel: standard(0xa6adb0, .27, .8), rubber: standard(0x202829),
    light: new THREE.MeshStandardMaterial({ color: 0xffe6bd, emissive: 0xffd39a, emissiveIntensity: .8 }),
    teal: standard(0x267b7d, .38, .2),
  };
}

export type ExteriorMaterials = ReturnType<typeof createExteriorMaterials>;

/** Outdoor sky and treeline provide directional reflections without external assets. */
export function createExteriorSky() {
  const texture = canvasTexture(2048, 1024, ctx => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#7396b2'); gradient.addColorStop(.32, '#a6bfce');
    gradient.addColorStop(.5, '#e8e6d9'); gradient.addColorStop(.54, '#939e8b'); gradient.addColorStop(1, '#737b70');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 2048, 1024);
    const random = seededRandom(71);
    for (let i = 0; i < 70; i++) {
      const x = random() * 2048, y = 250 + random() * 230;
      const cloud = ctx.createRadialGradient(x, y, 2, x, y, 80 + random() * 100);
      cloud.addColorStop(0, '#fffaf024'); cloud.addColorStop(1, '#fffaf000');
      ctx.fillStyle = cloud; ctx.fillRect(x - 200, y - 200, 400, 400);
    }
    for (let x = 0; x < 2048; x += 18) {
      ctx.fillStyle = '#617365'; const h = 5 + random() * 33;
      ctx.fillRect(x, 534 - h, 18, h + 50);
    }
  });
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}
