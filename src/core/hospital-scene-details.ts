import * as THREE from 'three';

/** 医院 PVC 地胶纹理（浅灰绿、低反光防滑感） */
export function createHospitalFloorTexture(repeatX = 4, repeatY = 4): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e2ebe6';
  ctx.fillRect(0, 0, size, size);
  const tile = size / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#eaf0ec' : '#d8e4dc';
      ctx.fillRect(x * tile + 0.5, y * tile + 0.5, tile - 1, tile - 1);
    }
  }
  for (let i = 0; i < 520; i++) {
    const px = Math.random() * size;
    const py = Math.random() * size;
    ctx.fillStyle = `rgba(96, 125, 110, ${0.03 + Math.random() * 0.05})`;
    ctx.fillRect(px, py, 1, 1);
  }
  ctx.strokeStyle = 'rgba(76, 129, 98, 0.06)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= size; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 病房墙面：上区暖白 + 下区浅绿医用护墙板 + 腰线 */
export function createHospitalWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7faf8';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#d4e8dc';
  ctx.fillRect(0, 155, 128, 101);
  ctx.fillStyle = 'rgba(76, 129, 98, 0.28)';
  ctx.fillRect(0, 152, 128, 4);
  ctx.strokeStyle = 'rgba(76, 129, 98, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 155);
  ctx.lineTo(128, 155);
  ctx.stroke();
  for (let y = 0; y < 256; y += 24) {
    ctx.strokeStyle = 'rgba(160, 180, 168, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 单段走廊墙挂扶手（沿 Z 方向，挂在侧墙朝走廊一侧，横杆凸入走廊确保可见） */
export function addCorridorWallHandrailRun(
  parent: THREE.Group,
  side: -1 | 1,
  zLow: number,
  zHigh: number,
  corridorHalfW: number,
  wallThick = 0.12,
) {
  if (zHigh - zLow < 0.35)
    return;

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xf0e6d4,
    metalness: 0.03,
    roughness: 0.82,
  });
  const bracketMat = new THREE.MeshStandardMaterial({
    color: 0xc8d2d8,
    metalness: 0.62,
    roughness: 0.38,
  });
  const railH = 0.92;
  const len = zHigh - zLow;
  const zMid = (zLow + zHigh) / 2;
  const wallCenterX = side * (corridorHalfW - wallThick / 2);
  const towardCorridor = -side as -1 | 1;
  const railCenterX = side * (corridorHalfW - 0.28);

  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, len),
    railMat,
  );
  rail.position.set(railCenterX, railH, zMid);
  rail.castShadow = true;
  rail.renderOrder = 5;
  parent.add(rail);

  const postCount = Math.max(2, Math.ceil(len / 2.8));
  for (let i = 0; i < postCount; i++) {
    const t = postCount === 1 ? 0.5 : i / (postCount - 1);
    const z = zLow + len * t;

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.2, 0.11),
      bracketMat,
    );
    plate.position.set(wallCenterX + towardCorridor * 0.02, railH - 0.08, z);
    parent.add(plate);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.04),
      bracketMat,
    );
    arm.position.set((wallCenterX + railCenterX) / 2, railH, z);
    parent.add(arm);

    const clip = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.07, 0.07),
      bracketMat,
    );
    clip.position.set(railCenterX - towardCorridor * 0.04, railH, z);
    parent.add(clip);
  }
}

/** 走廊扶手：贴装在侧墙内壁，门洞处断开（左右墙分别按各自门洞留白） */
export function buildCorridorHandrails(
  parent: THREE.Group,
  corridorLen: number,
  centerZ: number,
  corridorHalfW: number,
  wallThick = 0.12,
  doorZsBySide: { left: number[]; right: number[] } = { left: [], right: [] },
) {
  const railLen = corridorLen + 4;
  const zMin = centerZ - railLen / 2;
  const zMax = centerZ + railLen / 2;
  const gapHalf = 1.17;

  const buildSideRails = (side: -1 | 1, doorZs: number[]) => {
    const sorted = [...new Set(doorZs)].sort((a, b) => b - a);
    let cursor = zMax;
    for (const doorZ of sorted) {
      addCorridorWallHandrailRun(parent, side, doorZ + gapHalf, cursor, corridorHalfW, wallThick);
      cursor = doorZ - gapHalf;
    }
    addCorridorWallHandrailRun(parent, side, zMin, cursor, corridorHalfW, wallThick);
  };

  buildSideRails(-1, doorZsBySide.left);
  buildSideRails(1, doorZsBySide.right);
}

/** 走廊侧墙护墙板色带 + 顶角线 */
export function addCorridorWallFinish(
  parent: THREE.Group,
  side: -1 | 1,
  zStart: number,
  zEnd: number,
  wallX: number,
  wallH: number,
  wallThick = 0.12,
) {
  if (zEnd - zStart < 0.25)
    return;

  const len = zEnd - zStart;
  const zMid = (zStart + zEnd) / 2;
  const towardCorridor = -side as -1 | 1;
  const faceX = wallX + towardCorridor * (wallThick / 2 + 0.008);

  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xc8dcc8,
    roughness: 0.84,
    metalness: 0.02,
  });
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.018, 0.58, len),
    bandMat,
  );
  band.position.set(faceX, 1.18, zMid);
  parent.add(band);

  const crownMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4f8,
    roughness: 0.78,
    metalness: 0.04,
  });
  const crown = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.06, len),
    crownMat,
  );
  crown.position.set(faceX, wallH - 0.04, zMid);
  parent.add(crown);
}

export interface CorridorDisplayData {
  mode?: 'area' | 'clock';
  areaName: string;
  deptName?: string;
  dutyNurseName?: string;
  dutyDoctorName?: string;
  emergencyPhone?: string;
  bulletin?: string;
  callingCount?: number;
}

export interface NurseStationDisplayInfo {
  areaName?: string;
  deptName?: string;
  dutyNurseName?: string;
  dutyDoctorName?: string;
  emergencyPhone?: string;
  bulletin?: string;
}

function fitCanvasFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  minSize: number,
  fontWeight = 'bold',
) {
  let size = baseSize;
  while (size >= minSize) {
    ctx.font = `${fontWeight} ${size}px "Microsoft YaHei", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth)
      break;
    size -= 2;
  }
  return size;
}

/** 走廊屏贴图：病区信息 + 值班医护 + 公告 + 当前时间 */
export function createCorridorScreenTexture(data: CorridorDisplayData): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const renderScale = 2;
  canvas.width = 800 * renderScale;
  canvas.height = 360 * renderScale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(renderScale, renderScale);
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
  });

  if (data.mode === 'clock') {
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#071521');
    bg.addColorStop(0.55, '#0b2231');
    bg.addColorStop(1, '#07131e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(111, 214, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 32; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.lineTo(x, canvas.height - 18);
      ctx.stroke();
    }
    for (let y = 32; y < canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(18, y);
      ctx.lineTo(canvas.width - 18, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#18c7b4';
    ctx.fillRect(0, 0, canvas.width, 7);
    ctx.fillStyle = '#229ef2';
    ctx.fillRect(0, 7, canvas.width, 4);
    ctx.fillStyle = 'rgba(4, 15, 24, 0.72)';
    ctx.fillRect(8, 14, 784, 332);
    ctx.strokeStyle = 'rgba(103, 215, 255, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 14, 784, 332);
    ctx.fillStyle = '#8be6ff';
    ctx.beginPath();
    ctx.arc(28, 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(71, 206, 255, 0.58)';
    ctx.shadowBlur = 14;
    ctx.font = 'bold 150px "Consolas", monospace';
    ctx.fillText(timeStr, 400, 200);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  if (data.mode === 'area') {
    const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bg.addColorStop(0, '#061d22');
    bg.addColorStop(0.5, '#0b2b32');
    bg.addColorStop(1, '#071820');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#19c6a5';
    ctx.fillRect(0, 0, canvas.width, 7);
    ctx.fillStyle = '#229ef2';
    ctx.fillRect(0, 7, canvas.width, 4);
    ctx.fillStyle = 'rgba(4, 18, 24, 0.72)';
    ctx.fillRect(8, 14, 784, 332);
    ctx.strokeStyle = 'rgba(72, 231, 198, 0.34)';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 14, 784, 332);
    ctx.fillStyle = '#6df0d4';
    ctx.beginPath();
    ctx.arc(28, 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5dafa6';
    ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 140px "Microsoft YaHei", sans-serif`;
    ctx.shadowColor = 'rgba(40, 235, 190, 0.48)';
    ctx.shadowBlur = 14;
    ctx.fillText(data.areaName, 400, 140);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#80a9b8';
    ctx.font = '60px "Microsoft YaHei", sans-serif';
    ctx.fillText(data.deptName ?? '智慧病房', 400, 280);
    ctx.fillStyle = '#3b8d89';
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
  }

  ctx.fillStyle = '#f3f7fb';
  ctx.fillRect(0, 0, 800, 360);

  ctx.fillStyle = '#1565c0';
  ctx.fillRect(0, 0, 800, 50);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 19px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('走廊信息发布屏', 24, 25);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#e3f2fd';
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillText(dateStr, 776, 25);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0d47a1';
  const nameSize = fitCanvasFontSize(ctx, data.areaName, 720, 50, 30);
  ctx.font = `bold ${nameSize}px "Microsoft YaHei", sans-serif`;
  ctx.fillText(data.areaName, 400, 82);

  if (data.deptName) {
    ctx.fillStyle = '#607d8b';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.fillText(data.deptName, 400, 112);
  }

  const dutyNurse = data.dutyNurseName ? `护士长 ${data.dutyNurseName}` : '护士长 —';
  const dutyDoctor = data.dutyDoctorName ? `科主任 ${data.dutyDoctorName}` : '科主任 —';
  ctx.fillStyle = '#37474f';
  ctx.font = '17px "Microsoft YaHei", sans-serif';
  ctx.fillText(`今日值班  ${dutyNurse}    ${dutyDoctor}`, 400, 142);

  const emergency = data.emergencyPhone ?? '暂无数据';
  ctx.fillStyle = '#546e7a';
  ctx.font = '15px "Microsoft YaHei", sans-serif';
  ctx.fillText(`紧急联系  ${emergency}`, 400, 166);

  const bulletin = data.bulletin ?? '暂无公告';
  ctx.fillStyle = '#78909c';
  ctx.font = '14px "Microsoft YaHei", sans-serif';
  ctx.fillText(bulletin, 400, 188);

  let timeY = 300;
  if (data.callingCount && data.callingCount > 0) {
    ctx.fillStyle = 'rgba(229, 57, 53, 0.92)';
    ctx.fillRect(60, 202, 680, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
    ctx.fillText(`⚠ ${data.callingCount} 床正在呼叫护士站`, 400, 219);
    timeY = 318;
  }

  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 242);
  ctx.lineTo(720, 242);
  ctx.stroke();

  ctx.fillStyle = '#546e7a';
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillText('当前时间', 400, 262);

  ctx.fillStyle = '#1565c0';
  ctx.font = 'bold 72px "Consolas", "Microsoft YaHei", monospace';
  ctx.fillText(timeStr, 400, timeY);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function drawScheduleRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** 护士站背墙排班看板贴图（现代医用信息屏风格） */
export function createNurseScheduleBoardTexture(info: NurseStationDisplayInfo): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 400;
  const ctx = canvas.getContext('2d')!;
  const now = new Date();
  const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' });

  const bg = ctx.createLinearGradient(0, 0, 0, 400);
  bg.addColorStop(0, '#f7fafc');
  bg.addColorStop(1, '#edf2f7');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 640, 400);

  const header = ctx.createLinearGradient(0, 0, 640, 0);
  header.addColorStop(0, '#0d47a1');
  header.addColorStop(1, '#1976d2');
  ctx.fillStyle = header;
  drawScheduleRoundRect(ctx, 12, 12, 616, 56, 10);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(44, 40, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('护', 44, 40);

  ctx.textAlign = 'left';
  ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
  ctx.fillText('护士站信息看板', 72, 34);
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText(info.areaName ?? '病区', 72, 54);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Consolas", "Microsoft YaHei", monospace';
  ctx.fillText(timeStr, 620, 34);
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillText(dateStr, 620, 54);

  const drawInfoCard = (x: number, y: number, w: number, h: number, title: string, value: string, accent: string) => {
    ctx.fillStyle = '#ffffff';
    drawScheduleRoundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.fillRect(x, y + 10, 4, h - 20);
    ctx.fillStyle = '#78909c';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 16, y + 26);
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.fillText(value, x + 16, y + 52);
  };

  drawInfoCard(24, 84, 188, 72, '值班护士长', info.dutyNurseName ?? '—', '#43a047');
  drawInfoCard(226, 84, 188, 72, '科室主任', info.dutyDoctorName ?? '—', '#1e88e5');
  drawInfoCard(428, 84, 188, 72, '紧急联系', info.emergencyPhone ?? '暂无数据', '#e53935');

  const drawTimePill = (x: number, y: number, label: string, value: string) => {
    ctx.fillStyle = '#ffffff';
    drawScheduleRoundRect(ctx, x, y, 290, 54, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    ctx.fillStyle = '#546e7a';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 16, y + 27);
    ctx.fillStyle = '#1565c0';
    ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
    ctx.fillText(value, x + 110, y + 27);
  };

  drawTimePill(24, 172, '公告', info.bulletin ?? '暂无公告');
  drawTimePill(326, 172, '静音时段', '12:00 — 14:00');

  if (info.deptName) {
    ctx.fillStyle = '#e3f2fd';
    drawScheduleRoundRect(ctx, 24, 240, 592, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#1565c0';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`科室  ${info.deptName}`, 40, 260);
  }

  const bulletinY = info.deptName ? 292 : 248;
  ctx.fillStyle = '#fff8e1';
  drawScheduleRoundRect(ctx, 24, bulletinY, 592, 48, 8);
  ctx.fill();
  ctx.strokeStyle = '#ffe082';
  ctx.stroke();
  ctx.fillStyle = '#f57c00';
  ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
  ctx.fillText('公告', 40, bulletinY + 24);
  ctx.fillStyle = '#5d4037';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  const bulletin = info.bulletin ?? '暂无公告';
  ctx.fillText(bulletin.length > 38 ? `${bulletin.slice(0, 38)}…` : bulletin, 88, bulletinY + 24);

  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 2;
  drawScheduleRoundRect(ctx, 8, 8, 624, 384, 12);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

let nurseScreenTextureCache: { left?: THREE.CanvasTexture; right?: THREE.CanvasTexture } = {};

/** 护士站工位显示器 UI 贴图 */
export function createNurseWorkstationScreenTexture(side: 'left' | 'right'): THREE.CanvasTexture {
  if (side === 'left' && nurseScreenTextureCache.left)
    return nurseScreenTextureCache.left;
  if (side === 'right' && nurseScreenTextureCache.right)
    return nurseScreenTextureCache.right;

  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 300;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f1724';
  ctx.fillRect(0, 0, 480, 300);

  const topBar = ctx.createLinearGradient(0, 0, 480, 0);
  topBar.addColorStop(0, '#1a237e');
  topBar.addColorStop(1, '#283593');
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, 480, 32);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'left' ? '智慧病房 · 病区一览' : '智慧病房 · 呼叫一览', 12, 16);

  ctx.textAlign = 'right';
  ctx.font = '11px "Consolas", monospace';
  ctx.fillStyle = '#90caf9';
  const t = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  ctx.fillText(t, 468, 16);

  if (side === 'left') {
    const rooms = ['11房', '16房', '18房', '21房', '25房', '28房'];
    const statuses = ['正常', '输液', '呼叫', '正常', '空床', '正常'];
    const colors = ['#4fc3f7', '#ff9800', '#e91e63', '#4fc3f7', '#9e9e9e', '#4fc3f7'];
    let y = 44;
    for (let i = 0; i < rooms.length; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)';
      ctx.fillRect(8, y, 464, 36);
      ctx.fillStyle = colors[i];
      ctx.fillRect(12, y + 10, 4, 16);
      ctx.fillStyle = '#eceff1';
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(rooms[i], 24, y + 20);
      ctx.fillStyle = '#90a4ae';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(`${3 + i % 3}/${4 + i % 2} 床`, 90, y + 20);
      ctx.fillStyle = colors[i];
      ctx.textAlign = 'right';
      ctx.fillText(statuses[i], 468, y + 20);
      y += 38;
    }
  }
  else {
    ctx.fillStyle = 'rgba(229,57,53,0.15)';
    drawScheduleRoundRect(ctx, 12, 40, 456, 48, 6);
    ctx.fill();
    ctx.fillStyle = '#ef5350';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('⚠ 当前呼叫  1', 24, 64);

    const metrics = [
      ['在床患者', '23', '#4fc3f7'],
      ['输液中', '4', '#ff9800'],
      ['设备离线', '1', '#ef5350'],
      ['环境预警', '0', '#ffb74d'],
    ];
    metrics.forEach(([label, val, color], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 12 + col * 234;
      const y = 100 + row * 62;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      drawScheduleRoundRect(ctx, x, y, 220, 52, 6);
      ctx.fill();
      ctx.fillStyle = color as string;
      ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(val as string, x + 14, y + 30);
      ctx.fillStyle = '#90a4ae';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      ctx.fillText(label as string, x + 14, y + 44);
    });

    ctx.strokeStyle = 'rgba(79,195,247,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const py = 228 + i * 12;
      ctx.beginPath();
      ctx.moveTo(20, py);
      ctx.lineTo(460, py);
      ctx.stroke();
    }
    ctx.fillStyle = '#4fc3f7';
    ctx.font = '10px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('呼叫趋势', 20, 220);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  if (side === 'left')
    nurseScreenTextureCache.left = tex;
  else
    nurseScreenTextureCache.right = tex;
  return tex;
}

function addNurseWorkstation(
  parent: THREE.Group,
  x: number,
  z: number,
  counterY: number,
  side: 'left' | 'right',
) {
  const ws = new THREE.Group();
  ws.position.set(x, counterY, z);

  const screenW = 0.46;
  const screenH = 0.29;
  const bezelDepth = 0.024;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.55, roughness: 0.38 });
  const standMat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, metalness: 0.72, roughness: 0.28 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.65, roughness: 0.32 });

  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.012, 0.14), baseMat);
  standBase.position.set(0, 0.006, 0.05);
  ws.add(standBase);

  const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.013, 0.11, 10), standMat);
  standNeck.position.set(0, 0.065, 0.03);
  ws.add(standNeck);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.05), standMat);
  arm.position.set(0, 0.12, -0.01);
  ws.add(arm);

  const monitor = new THREE.Group();
  monitor.position.set(0, 0.24, -0.03);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + 0.02, screenH + 0.028, bezelDepth),
    frameMat,
  );
  monitor.add(housing);

  const chin = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + 0.02, 0.016, bezelDepth + 0.004),
    frameMat,
  );
  chin.position.y = -screenH / 2 - 0.004;
  monitor.add(chin);

  const screenTex = createNurseWorkstationScreenTexture(side);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }),
  );
  screen.position.z = bezelDepth / 2 + 0.002;
  monitor.add(screen);

  const glare = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW * 0.85, screenH * 0.12),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, depthWrite: false }),
  );
  glare.position.set(0, screenH * 0.3, bezelDepth / 2 + 0.003);
  monitor.add(glare);

  const powerLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.004, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x43a047, emissive: 0x76ff03, emissiveIntensity: 0.8 }),
  );
  powerLed.position.set(screenW / 2 - 0.02, -screenH / 2 + 0.01, bezelDepth / 2 + 0.004);
  monitor.add(powerLed);

  ws.add(monitor);

  const keyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.014, 0.13),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.55, metalness: 0.2 }),
  );
  keyboard.position.set(0, 0.018, 0.1);
  keyboard.rotation.x = -0.06;
  ws.add(keyboard);

  const mouse = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.018, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.45 }),
  );
  mouse.position.set(0.24, 0.014, 0.1);
  ws.add(mouse);

  parent.add(ws);
}

/** 走廊侧护士站导向牌贴图 */
export function createNurseStationCorridorSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#e3f2fd';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(0, 0, 256, 36);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('护士站', 128, 18);

  ctx.fillStyle = '#0d47a1';
  ctx.font = 'bold 42px "Microsoft YaHei", sans-serif';
  ctx.fillText('◀', 72, 78);
  ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
  ctx.fillText('NURSE', 148, 72);
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#546e7a';
  ctx.fillText('STATION', 148, 96);

  ctx.strokeStyle = '#90caf9';
  ctx.lineWidth = 3;
  ctx.strokeRect(3, 3, 250, 122);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 走廊正中吊顶悬挂信息发布屏（医院吊杆+双缆），正面朝向护士站 */
export function buildCorridorCeilingDisplay(
  parent: THREE.Group,
  z: number,
  ceilingH: number,
  nurseStationZ: number,
  texture: THREE.CanvasTexture,
): { group: THREE.Group; screen: THREE.Mesh; texture: THREE.CanvasTexture } {
  const group = new THREE.Group();
  group.position.set(0, ceilingH, z);

  const screenW = 1.72;
  const screenH = 0.78;
  const dropLen = 0.62;
  const towardNurse = nurseStationZ > z ? 1 : -1;

  const railMat = new THREE.MeshStandardMaterial({
    color: 0xeceff1,
    metalness: 0.78,
    roughness: 0.22,
  });
  const cableMat = new THREE.MeshStandardMaterial({
    color: 0x90a4ae,
    metalness: 0.88,
    roughness: 0.18,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xcfd8dc,
    metalness: 0.82,
    roughness: 0.2,
  });

  const ceilingRail = new THREE.Mesh(
    new THREE.BoxGeometry(screenW * 0.72, 0.035, 0.14),
    railMat,
  );
  ceilingRail.position.y = -0.02;
  group.add(ceilingRail);

  const anchorL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.04, 10),
    railMat,
  );
  anchorL.position.set(-screenW * 0.36, -0.04, 0);
  group.add(anchorL);
  const anchorR = anchorL.clone();
  anchorR.position.x = screenW * 0.36;
  group.add(anchorR);

  [-1, 1].forEach((side) => {
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, dropLen, 8),
      cableMat,
    );
    cable.position.set(side * screenW * 0.36, -dropLen / 2 - 0.04, 0);
    group.add(cable);
  });

  const housing = new THREE.Group();
  housing.position.y = -dropLen - 0.04;
  housing.rotation.y = towardNurse > 0 ? 0 : Math.PI;
  housing.rotation.x = -0.14 * towardNurse;
  group.add(housing);

  const backPlate = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + 0.08, screenH + 0.08, 0.06),
    frameMat,
  );
  housing.add(backPlate);

  const topLip = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + 0.12, 0.03, 0.08),
    frameMat,
  );
  topLip.position.y = screenH / 2 + 0.015;
  housing.add(topLip);

  const bottomLip = topLip.clone();
  bottomLip.position.y = -screenH / 2 - 0.015;
  housing.add(bottomLip);

  const bezelDepth = 0.022;
  const bezelZ = towardNurse * 0.03;
  const screenZ = towardNurse * (0.03 + bezelDepth / 2 + 0.012);

  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(screenW + 0.02, screenH + 0.02, bezelDepth),
    new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.45, roughness: 0.4 }),
  );
  bezel.position.z = bezelZ;
  housing.add(bezel);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW * 0.96, screenH * 0.9),
    new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    }),
  );
  screen.position.z = screenZ;
  screen.renderOrder = 12;
  housing.add(screen);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW * 0.98, screenH * 0.92),
    new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glow.position.z = screenZ - towardNurse * 0.004;
  glow.renderOrder = 11;
  housing.add(glow);

  const indicator = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0x43a047,
      emissive: 0x76ff03,
      emissiveIntensity: 0.9,
    }),
  );
  indicator.position.set(screenW * 0.44, -screenH * 0.36, screenZ + towardNurse * 0.008);
  housing.add(indicator);

  parent.add(group);
  return { group, screen, texture };
}

/** 医用墙腰色带（浅绿色） */
export function addHospitalWallBand(
  parent: THREE.Group,
  roomW: number,
  roomD: number,
  wallThick = 0.14,
) {
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xc5dcc8,
    roughness: 0.82,
    metalness: 0.02,
  });
  const bandH = 0.55;
  const bandY = 1.15;
  const halfW = roomW / 2;
  const halfD = roomD / 2;

  const back = new THREE.Mesh(new THREE.BoxGeometry(roomW, bandH, 0.04), bandMat);
  back.position.set(0, bandY, -halfD + 0.02);
  parent.add(back);

  const left = new THREE.Mesh(new THREE.BoxGeometry(0.04, bandH, roomD), bandMat);
  left.position.set(-halfW + 0.02, bandY, 0);
  parent.add(left);

  const right = new THREE.Mesh(new THREE.BoxGeometry(0.04, bandH, roomD), bandMat);
  right.position.set(halfW - 0.02, bandY, 0);
  parent.add(right);

  const frontSegW = (roomW - 2.1) / 2;
  const frontL = new THREE.Mesh(new THREE.BoxGeometry(frontSegW, bandH, 0.04), bandMat);
  frontL.position.set(-halfW + frontSegW / 2, bandY, halfD - wallThick / 2);
  parent.add(frontL);
  const frontR = frontL.clone();
  frontR.position.x = halfW - frontSegW / 2;
  parent.add(frontR);
}

/** 输液架 */
export function addIvStand(parent: THREE.Group, x: number, z: number) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.75, roughness: 0.25 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.65, 8), poleMat);
  pole.position.set(x + 0.55, 0.85, z);
  parent.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12), poleMat);
  base.position.set(x + 0.55, 0.02, z);
  parent.add(base);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12), poleMat);
  hook.rotation.x = Math.PI / 2;
  hook.position.set(x + 0.55, 1.62, z);
  parent.add(hook);
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.18, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xe3f2fd, transparent: true, opacity: 0.75 }),
  );
  bag.position.set(x + 0.55, 1.45, z);
  parent.add(bag);
}

/** 床头柜 */
export function addBedsideCabinet(parent: THREE.Group, x: number, z: number) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.55, 0.38),
    new THREE.MeshStandardMaterial({ color: 0xf5f7fa, roughness: 0.65 }),
  );
  body.position.set(x - 0.72, 0.28, z + 0.15);
  body.castShadow = true;
  parent.add(body);
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.03, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  );
  top.position.set(x - 0.72, 0.56, z + 0.15);
  parent.add(top);
}

export interface HospitalWardDoorOptions {
  doorW?: number;
  doorH?: number;
  wallThick?: number;
  corridorSide: -1 | 1;
  isEmpty?: boolean;
  isCalling?: boolean;
}

/** 医院病房走廊门：铝合金框 + 磨砂玻璃门扇 + 拉手/踢脚/闭门器 */
export function buildHospitalWardDoor(
  parent: THREE.Group,
  doorX: number,
  options: HospitalWardDoorOptions,
): THREE.Mesh {
  const doorW = options.doorW ?? 2.1;
  const doorH = options.doorH ?? 2.5;
  const wallThick = options.wallThick ?? 0.12;
  const { corridorSide, isEmpty = false, isCalling = false } = options;
  const towardCorridor = corridorSide < 0 ? 1 : -1;
  const faceOffset = towardCorridor * 0.04;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    metalness: 0.72,
    roughness: 0.28,
  });
  const frameDarkMat = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    metalness: 0.78,
    roughness: 0.22,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: isEmpty ? 0xdce8f0 : 0xc8e6f9,
    transparent: true,
    opacity: isEmpty ? 0.42 : 0.52,
    metalness: 0.12,
    roughness: 0.08,
    emissive: isCalling ? 0xe91e63 : 0x1565c0,
    emissiveIntensity: isCalling ? 0.18 : 0.06,
  });
  const kickPlateMat = new THREE.MeshStandardMaterial({
    color: 0x90a4ae,
    metalness: 0.85,
    roughness: 0.18,
  });

  const threshold = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick + 0.04, 0.04, doorW + 0.28),
    frameDarkMat,
  );
  threshold.position.set(doorX + faceOffset * 0.25, 0.02, 0);
  parent.add(threshold);

  const jambW = 0.1;
  [-1, 1].forEach((side) => {
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick + 0.03, doorH, jambW),
      frameMat,
    );
    jamb.position.set(doorX, doorH / 2, side * (doorW / 2 + jambW / 2 - 0.01));
    parent.add(jamb);
  });

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick + 0.03, 0.1, doorW + jambW * 2 - 0.02),
    frameMat,
  );
  head.position.set(doorX, doorH + 0.05, 0);
  parent.add(head);

  const leafW = doorW - jambW * 2 + 0.04;
  const leafH = doorH - 0.12;
  const doorLeaf = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, leafH, leafW),
    glassMat,
  );
  doorLeaf.position.set(doorX + faceOffset, doorH / 2, 0);
  parent.add(doorLeaf);

  const frostedBand = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, leafH * 0.38, leafW - 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xeceff1,
      transparent: true,
      opacity: 0.72,
      roughness: 0.95,
    }),
  );
  frostedBand.position.set(doorX + faceOffset + towardCorridor * 0.028, doorH * 0.68, 0);
  parent.add(frostedBand);

  const kickPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.22, leafW - 0.06),
    kickPlateMat,
  );
  kickPlate.position.set(doorX + faceOffset + towardCorridor * 0.024, 0.13, 0);
  parent.add(kickPlate);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.05, 0.28),
    frameDarkMat,
  );
  handle.position.set(
    doorX + faceOffset + towardCorridor * 0.035,
    1.02,
    doorW * 0.22,
  );
  parent.add(handle);

  const handleBar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.014, 0.26, 10),
    frameDarkMat,
  );
  handleBar.rotation.x = Math.PI / 2;
  handleBar.position.set(
    doorX + faceOffset + towardCorridor * 0.042,
    1.02,
    doorW * 0.22,
  );
  parent.add(handleBar);

  const closer = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.05, 0.18),
    frameDarkMat,
  );
  closer.position.set(doorX + faceOffset * 0.5, doorH - 0.06, -doorW / 2 + 0.2);
  parent.add(closer);

  const closerArm = new THREE.Mesh(
    new THREE.BoxGeometry(0.025, 0.025, 0.14),
    frameMat,
  );
  closerArm.position.set(doorX + faceOffset * 0.5, doorH - 0.1, -doorW / 2 + 0.28);
  parent.add(closerArm);

  const statusLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 10, 10),
    new THREE.MeshStandardMaterial({
      color: isCalling ? 0xe91e63 : isEmpty ? 0x607d8b : 0x43a047,
      emissive: isCalling ? 0xff1744 : isEmpty ? 0x455a64 : 0x76ff03,
      emissiveIntensity: isCalling ? 1.1 : isEmpty ? 0.25 : 0.85,
    }),
  );
  statusLed.position.set(
    doorX + faceOffset + towardCorridor * 0.05,
    doorH + 0.18,
    -doorW / 2 + 0.18,
  );
  parent.add(statusLed);

  addHandSanitizer(
    parent,
    doorX + faceOffset + towardCorridor * 0.06,
    1.38,
    -doorW / 2 - 0.22,
  );

  return statusLed;
}

export interface CorridorBedChip {
  bedName: string;
  label: string;
  color: string;
  calling?: boolean;
}

const PRIORITY_STATUS_LABEL: Record<string, string> = {
  calling: '呼叫中',
  danger: '环境异常',
  offline: '设备离线',
  infusing: '输液中',
  warning: '环境预警',
  empty: '空房',
  normal: '病房',
};

/** 走廊侧床位状态条贴图（门口下方一览各床态） */
export function createCorridorBedStatusTexture(chips: CorridorBedChip[]): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.beginPath();
  ctx.roundRect(2, 2, 316, 44, 6);
  ctx.fill();
  ctx.strokeStyle = '#cfd8dc';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!chips.length) {
    ctx.fillStyle = '#90a4ae';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂无床位', 160, 24);
  }
  else {
    const gap = 4;
    const chipW = (316 - gap * (chips.length + 1)) / chips.length;
    chips.forEach((chip, index) => {
      const x = gap + index * (chipW + gap);
      const y = 6;
      const h = 36;
      ctx.fillStyle = chip.calling ? '#e91e63' : chip.color;
      ctx.beginPath();
      ctx.roundRect(x, y, chipW, h, 4);
      ctx.fill();

      const bedLabel = chip.bedName.replace(/床$/, '');
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${bedLabel}床`, x + chipW / 2, y + 13);

      ctx.font = '10px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      const statusText = chip.calling ? '呼叫' : chip.label;
      ctx.fillText(statusText, x + chipW / 2, y + 27);
    });
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 病房门口金属房号牌贴图 */
export function createHospitalRoomPlaqueTexture(
  roomName: string,
  bedText: string,
  accentHex: string,
  priority: string = 'normal',
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#eceff1';
  ctx.beginPath();
  ctx.roundRect(4, 4, 312, 88, 6);
  ctx.fill();

  ctx.fillStyle = accentHex;
  ctx.fillRect(4, 4, 312, 26);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PRIORITY_STATUS_LABEL[priority] ?? '病房', 160, 17);

  const roomNo = roomName.replace(/房$/, '');
  ctx.fillStyle = '#263238';
  ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
  ctx.fillText(roomNo, 160, 56);
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#546e7a';
  ctx.fillText(roomName, 160, 76);

  ctx.fillStyle = accentHex;
  ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(bedText, 300, 22);

  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(4, 4, 312, 88, 6);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export interface WardDoorDisplayBoardOptions {
  corridorFaceX: number;
  towardCorridor: number;
  roomIndex: number;
  accentHex?: string;
  priority?: string;
  isCalling?: boolean;
  roomNo?: string;
  occupiedBeds?: number;
  totalBeds?: number;
  doorW?: number;
  doorH?: number;
  isHorizontal?: boolean;
}

/** 统一计算门旁小牌挂载点：门口机对侧、门楣下方 */
export function computeWardDoorDisplayMount(options: {
  doorW: number;
  doorH: number;
  boardH?: number;
  isHorizontal?: boolean;
}) {
  const { doorW, doorH, boardH = 0.4, isHorizontal = false } = options;
  const terminalSideZ = doorW / 2 + (isHorizontal ? 0.42 : 0.48);
  const mountZ = -terminalSideZ;
  const maxCenterY = doorH - boardH / 2 - 0.18;
  const minCenterY = boardH / 2 + 0.55;
  const centerY = Math.min(maxCenterY, Math.max(minCenterY, doorH * 0.52));
  return { centerY, mountZ, terminalSideZ };
}

/** 走廊门旁小牌贴图 */
export function createCorridorBladeTexture(
  roomNo: string,
  accentHex: string,
  occupiedBeds: number,
  totalBeds: number,
  priority = 'normal',
  isCalling = false,
): THREE.CanvasTexture {
  const W = 112;
  const H = 320;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const statusLabel = PRIORITY_STATUS_LABEL[priority] ?? '病房';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#1e2d48');
  bg.addColorStop(0.55, '#121f34');
  bg.addColorStop(1, '#0a1220');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 12);
  ctx.fill();

  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, accentHex);
  headerGrad.addColorStop(1, '#1565c0');
  ctx.fillStyle = headerGrad;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, 28, 12);
  ctx.fill();
  ctx.fillRect(0, 18, W, 10);

  if (isCalling || priority === 'calling') {
    ctx.fillStyle = 'rgba(233, 30, 99, 0.22)';
    ctx.fillRect(0, 28, W, H - 28);
  }
  else if (priority === 'infusing') {
    ctx.fillStyle = 'rgba(255, 152, 0, 0.14)';
    ctx.fillRect(0, 28, W, H - 28);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = '600 11px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(statusLabel, W / 2, 14);

  const gloss = ctx.createLinearGradient(0, 28, 0, 120);
  gloss.addColorStop(0, 'rgba(255,255,255,0.1)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(6, 28, W - 12, 92);

  const dotColor = isCalling ? '#e91e63' : accentHex;
  ctx.shadowColor = dotColor;
  ctx.shadowBlur = isCalling ? 10 : 6;
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(W / 2, 44, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 4;
  if (roomNo.length <= 4) {
    ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
    ctx.fillText(roomNo, W / 2, H * 0.44);
  }
  else {
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    const chars = roomNo.split('');
    const startY = H * 0.38 - (chars.length - 1) * 16;
    chars.forEach((ch, i) => {
      ctx.fillText(ch, W / 2, startY + i * 32);
    });
  }
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, H * 0.58);
  ctx.lineTo(W - 14, H * 0.58);
  ctx.stroke();

  const bedText = `${occupiedBeds}/${totalBeds} 床`;
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  const pillW = Math.max(ctx.measureText(bedText).width + 22, 56);
  const pillH = 24;
  const pillX = (W - pillW) / 2;
  const pillY = H - 38;
  ctx.fillStyle = accentHex;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, 12);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText(bedText, W / 2, pillY + pillH / 2);

  ctx.strokeStyle = accentHex;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, W - 4, H - 4, 11);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** 走廊侧门旁小牌（仅房号 + 床位摘要，可点击进入） */
export function buildWardDoorDisplayBoard(
  parent: THREE.Group,
  options: WardDoorDisplayBoardOptions,
): {
  group: THREE.Group;
  blade: THREE.Mesh;
  hitPad: THREE.Mesh;
  bladeTexture: THREE.CanvasTexture;
} {
  const {
    corridorFaceX,
    towardCorridor,
    roomIndex,
    accentHex = '#4fc3f7',
    priority = 'normal',
    isCalling = false,
    roomNo = '',
    occupiedBeds = 0,
    totalBeds = 0,
    doorW = 2.1,
    doorH = 2.5,
    isHorizontal = false,
  } = options;

  const bladeW = 0.092;
  const bladeH = 0.4;
  const { centerY, mountZ } = computeWardDoorDisplayMount({
    doorW,
    doorH,
    boardH: bladeH,
    isHorizontal,
  });

  const root = new THREE.Group();
  root.userData.roomIndex = roomIndex;
  root.userData.role = 'doorDisplay';
  root.position.set(corridorFaceX + towardCorridor * 0.086, centerY, mountZ);

  const bladeTexture = createCorridorBladeTexture(
    roomNo,
    accentHex,
    occupiedBeds,
    totalBeds,
    priority,
    isCalling,
  );

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x78909c,
    metalness: 0.8,
    roughness: 0.24,
  });
  const frameInnerMat = new THREE.MeshStandardMaterial({
    color: 0x37474f,
    metalness: 0.65,
    roughness: 0.35,
  });

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, bladeH + 0.018, bladeW + 0.014),
    frameMat,
  );
  frame.position.set(towardCorridor * 0.007, 0, 0);
  root.add(frame);

  const frameInner = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, bladeH + 0.008, bladeW + 0.004),
    frameInnerMat,
  );
  frameInner.position.set(towardCorridor * 0.005, 0, 0);
  root.add(frameInner);

  const accentThree = Number.parseInt(accentHex.replace('#', ''), 16);
  const ledColor = isCalling ? 0xe91e63 : priority === 'infusing' ? 0xff9800 : accentThree;
  const topLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.006, 0.006, bladeW * 0.88),
    new THREE.MeshStandardMaterial({
      color: ledColor,
      emissive: ledColor,
      emissiveIntensity: isCalling ? 0.9 : 0.5,
      metalness: 0.2,
      roughness: 0.4,
    }),
  );
  topLed.position.set(towardCorridor * 0.012, bladeH / 2 - 0.006, 0);
  root.add(topLed);

  const blade = new THREE.Mesh(
    new THREE.PlaneGeometry(bladeW * 0.96, bladeH * 0.96),
    new THREE.MeshStandardMaterial({
      map: bladeTexture,
      emissiveMap: bladeTexture,
      emissive: 0xffffff,
      emissiveIntensity: isCalling ? 0.32 : 0.18,
      toneMapped: false,
      transparent: true,
      roughness: 0.12,
      metalness: 0.03,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  blade.position.set(towardCorridor * 0.016, 0, 0);
  blade.renderOrder = 28;
  blade.userData.roomIndex = roomIndex;
  blade.userData.role = 'doorDisplay';
  root.add(blade);

  const hitPad = new THREE.Mesh(
    new THREE.PlaneGeometry(bladeW + 0.03, bladeH + 0.03),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitPad.position.copy(blade.position);
  hitPad.position.x += towardCorridor * 0.005;
  hitPad.userData.roomIndex = roomIndex;
  hitPad.userData.role = 'doorDisplay';
  root.add(hitPad);

  parent.add(root);
  return { group: root, blade, hitPad, bladeTexture };
}

/** 门楣优先级灯带（走廊侧一眼识别病房状态） */
export function buildDoorPriorityLintel(
  parent: THREE.Group,
  doorX: number,
  doorW: number,
  doorH: number,
  corridorSide: -1 | 1,
  accentHex: number,
  isCalling: boolean,
): THREE.Mesh {
  const towardCorridor = corridorSide < 0 ? 1 : -1;
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.06, doorW + 0.14),
    new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: isCalling ? 1.0 : 0.45,
      metalness: 0.35,
      roughness: 0.4,
    }),
  );
  lintel.position.set(
    doorX + towardCorridor * 0.055,
    doorH + 0.03,
    0,
  );
  parent.add(lintel);
  return lintel;
}

let speakerGrilleTexture: THREE.CanvasTexture | null = null;

function getSpeakerGrilleTexture(): THREE.CanvasTexture {
  if (speakerGrilleTexture)
    return speakerGrilleTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 24;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(0, 0, 128, 24);
  for (let x = 6; x < 128; x += 7) {
    ctx.fillStyle = '#90a4ae';
    ctx.fillRect(x, 4, 3, 16);
  }
  speakerGrilleTexture = new THREE.CanvasTexture(canvas);
  speakerGrilleTexture.colorSpace = THREE.SRGBColorSpace;
  speakerGrilleTexture.wrapS = THREE.RepeatWrapping;
  speakerGrilleTexture.wrapT = THREE.RepeatWrapping;
  speakerGrilleTexture.repeat.set(2.5, 1);
  speakerGrilleTexture.needsUpdate = true;
  return speakerGrilleTexture;
}

export interface HospitalDoorTerminalOptions {
  screenW: number;
  screenH: number;
  isHorizontal: boolean;
  isEmpty: boolean;
  isCalling?: boolean;
  texture: THREE.CanvasTexture;
}

/** 医院走廊门口机：薄型白色壁挂外壳 + 顶置摄像头 + 底部扬声器 */
export function buildHospitalDoorTerminal(
  options: HospitalDoorTerminalOptions,
): { group: THREE.Group; screen: THREE.Mesh; led: THREE.Mesh } {
  const { screenW, screenH, isHorizontal, isEmpty, isCalling = false, texture } = options;
  const group = new THREE.Group();

  const mountDepth = 0.006;
  const bodyDepth = 0.014;
  const screenZ = mountDepth + bodyDepth + 0.004;
  const cameraH = isHorizontal ? 0.05 : 0.06;
  const speakerH = 0.045;
  const bodyW = screenW + 0.036;
  const bodyH = screenH + cameraH + speakerH + 0.028;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.08,
    roughness: 0.68,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xd8e0e8,
    metalness: 0.22,
    roughness: 0.42,
  });
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x37474f,
    metalness: 0.35,
    roughness: 0.48,
  });
  const cameraMat = new THREE.MeshStandardMaterial({
    color: 0x212121,
    metalness: 0.55,
    roughness: 0.32,
  });

  const mountPlate = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.01, bodyH + 0.01, mountDepth),
    bodyMat,
  );
  mountPlate.position.set(0, 0, mountDepth / 2);
  group.add(mountPlate);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW, bodyH, bodyDepth),
    bodyMat,
  );
  body.position.set(0, 0, mountDepth + bodyDepth / 2);
  group.add(body);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(bodyW + 0.004, bodyH + 0.004, 0.003),
    trimMat,
  );
  trim.position.set(0, 0, mountDepth + bodyDepth + 0.001);
  group.add(trim);

  const bezelPad = 0.008;
  const bezelThick = 0.005;
  const bezelZ = mountDepth + bodyDepth + bezelThick / 2 + 0.001;
  const frameBars = [
    [screenW + bezelPad * 2, bezelPad, bezelThick, 0, screenH / 2 + bezelPad / 2],
    [screenW + bezelPad * 2, bezelPad, bezelThick, 0, -screenH / 2 - bezelPad / 2],
    [bezelPad, screenH, bezelThick, -screenW / 2 - bezelPad / 2, 0],
    [bezelPad, screenH, bezelThick, screenW / 2 + bezelPad / 2, 0],
  ] as const;
  for (const [w, h, d, x, y] of frameBars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bezelMat);
    bar.position.set(x, y, bezelZ);
    group.add(bar);
  }

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
    }),
  );
  screen.position.z = screenZ;
  screen.renderOrder = 12;
  group.add(screen);

  const screenGlare = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH * 0.18),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  screenGlare.position.set(0, screenH * 0.3, screenZ + 0.002);
  group.add(screenGlare);

  const cameraBase = new THREE.Mesh(
    new THREE.BoxGeometry(isHorizontal ? 0.1 : 0.08, cameraH, 0.018),
    cameraMat,
  );
  cameraBase.position.set(0, screenH / 2 + cameraH / 2 + 0.006, screenZ + 0.003);
  group.add(cameraBase);

  const cameraLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.018, 0.01, 12),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.7, roughness: 0.18 }),
  );
  cameraLens.rotation.x = Math.PI / 2;
  cameraLens.position.set(0, screenH / 2 + cameraH / 2 + 0.006, screenZ + 0.014);
  group.add(cameraLens);

  const speaker = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW * 0.72, speakerH * 0.72),
    new THREE.MeshBasicMaterial({
      map: getSpeakerGrilleTexture(),
      toneMapped: false,
    }),
  );
  speaker.position.set(0, -screenH / 2 - speakerH / 2 - 0.01, screenZ + 0.001);
  group.add(speaker);

  const led = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 8, 8),
    new THREE.MeshStandardMaterial({
      color: isCalling ? 0xe91e63 : isEmpty ? 0x90a4ae : 0x43a047,
      emissive: isCalling ? 0xff1744 : isEmpty ? 0x607d8b : 0x76ff03,
      emissiveIntensity: isCalling ? 1.3 : isEmpty ? 0.3 : 1.0,
    }),
  );
  led.position.set(screenW * 0.4, -screenH / 2 - 0.02, screenZ + 0.005);
  group.add(led);

  return { group, screen, led };
}

function addWaitingChair(parent: THREE.Group, x: number, z: number) {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.72 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.45, roughness: 0.38 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.06, 0.44), seatMat);
  seat.position.set(x, 0.42, z);
  parent.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.05), seatMat);
  back.position.set(x, 0.64, z + 0.2);
  parent.add(back);
  [-0.18, 0.18].forEach((dx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), frameMat);
    leg.position.set(x + dx, 0.2, z - 0.16);
    parent.add(leg);
  });
}

function addMedicineCart(parent: THREE.Group, x: number, z: number) {
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf5f7fa, metalness: 0.15, roughness: 0.55 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.5, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.78, 0.62), bodyMat);
  body.position.set(x, 0.55, z);
  parent.add(body);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.04), bodyMat);
  handle.position.set(x, 0.98, z - 0.28);
  parent.add(handle);
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.48), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.5 }));
  cross.position.set(x, 0.72, z);
  parent.add(cross);
  [[-0.14, -0.22], [0.14, -0.22], [-0.14, 0.22], [0.14, 0.22]].forEach(([dx, dz]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), wheelMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x + dx, 0.12, z + dz);
    parent.add(wheel);
  });
}

/** 护士站白板贴图 */
function createNurseWhiteboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 560;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f4f8fb';
  ctx.fillRect(0, 0, 480, 560);
  ctx.strokeStyle = '#cfd8dc';
  ctx.lineWidth = 1;
  for (let y = 48; y < 540; y += 36) {
    ctx.beginPath();
    ctx.moveTo(16, y);
    ctx.lineTo(464, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#37474f';
  ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
  ctx.fillText('护理白板', 20, 32);
  ctx.fillStyle = '#1565c0';
  ctx.font = '15px "Microsoft YaHei", sans-serif';
  ['晨间巡视 ✓', '输液核对', '换床单', '健康宣教', '交接记录'].forEach((t, i) => ctx.fillText(t, 24, 78 + i * 36));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** 公告栏贴图 */
function createNurseBulletinBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 440;
  canvas.height = 520;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(0, 0, 440, 520);
  const notes = [
    { x: 24, y: 28, w: 170, h: 100, bg: '#fff9c4', title: '探视须知', body: '14:00-19:00\n一次2人' },
    { x: 220, y: 36, w: 180, h: 88, bg: '#ffe0b2', title: '防跌倒', body: '加强巡视\n床栏拉起' },
    { x: 30, y: 150, w: 190, h: 110, bg: '#ffcdd2', title: '感染防控', body: '手卫生\n口罩佩戴' },
    { x: 240, y: 145, w: 160, h: 95, bg: '#c8e6c9', title: '消防通道', body: '保持畅通' },
    { x: 50, y: 280, w: 320, h: 72, bg: '#e1f5fe', title: '优质护理服务', body: '用心护理 · 温暖相伴' },
  ];
  for (const n of notes) {
    ctx.fillStyle = n.bg;
    ctx.fillRect(n.x, n.y, n.w, n.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.strokeRect(n.x, n.y, n.w, n.h);
    ctx.fillStyle = '#37474f';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.fillText(n.title, n.x + 10, n.y + 22);
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#546e7a';
    n.body.split('\n').forEach((line, i) => ctx.fillText(line, n.x + 10, n.y + 42 + i * 18));
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addWallMountedBoard(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  texture: THREE.CanvasTexture,
  frameColor = 0x455a64,
) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.035),
    new THREE.MeshStandardMaterial({ color: frameColor, metalness: 0.35, roughness: 0.45 }),
  );
  frame.position.set(x, y, z - 0.02);
  parent.add(frame);
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
  );
  board.position.set(x, y, z);
  parent.add(board);
}

function addVaseWithFlowers(parent: THREE.Group, x: number, y: number, z: number) {
  const vase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.075, 0.16, 12),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.55 }),
  );
  vase.position.set(x, y + 0.08, z);
  parent.add(vase);
  const colors = [0xf48fb1, 0xffccbc, 0xfff59d, 0xe1bee7, 0xffffff];
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    const petal = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.65 }),
    );
    petal.position.set(x + Math.cos(angle) * 0.05, y + 0.2 + (i % 2) * 0.03, z + Math.sin(angle) * 0.05);
    parent.add(petal);
  }
}

function addPottedPlant(parent: THREE.Group, x: number, z: number, scale = 1, baseY = 0) {
  const group = new THREE.Group();
  group.position.set(x, baseY, z);

  const saucer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.2 * scale, 0.035 * scale, 18),
    new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.78 }),
  );
  saucer.position.y = 0.03 * scale;
  saucer.receiveShadow = true;
  group.add(saucer);

  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18 * scale, 0.13 * scale, 0.34 * scale, 18),
    new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.72 }),
  );
  pot.position.y = 0.2 * scale;
  pot.castShadow = true;
  group.add(pot);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.158 * scale, 0.018 * scale, 12, 24),
    new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.68 }),
  );
  rim.position.y = 0.38 * scale;
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const soil = new THREE.Mesh(
    new THREE.CylinderGeometry(0.145 * scale, 0.145 * scale, 0.018 * scale, 18),
    new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 }),
  );
  soil.position.y = 0.39 * scale;
  group.add(soil);

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.82 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x43a047, roughness: 0.82 }),
    new THREE.MeshStandardMaterial({ color: 0x66bb6a, roughness: 0.8 }),
  ];

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const h = 0.58 + (i % 3) * 0.08;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012 * scale, 0.018 * scale, h * scale, 8),
      stemMat,
    );
    stem.position.set(Math.cos(a) * 0.055 * scale, (0.42 + h / 2) * scale, Math.sin(a) * 0.055 * scale);
    stem.rotation.z = Math.cos(a) * 0.18;
    stem.rotation.x = -Math.sin(a) * 0.18;
    group.add(stem);

    const leaf = new THREE.Mesh(
      new THREE.SphereGeometry(0.095 * scale, 12, 8),
      leafMats[i % leafMats.length],
    );
    leaf.position.set(Math.cos(a) * 0.16 * scale, (0.86 + (i % 3) * 0.08) * scale, Math.sin(a) * 0.16 * scale);
    leaf.rotation.y = -a;
    leaf.rotation.z = Math.cos(a) * 0.45;
    leaf.scale.set(0.65, 1.75, 0.22);
    leaf.castShadow = true;
    group.add(leaf);
  }

  parent.add(group);
}

function addWaterDispenser(parent: THREE.Group, x: number, z: number) {
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.95, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.45 }),
  );
  body.position.set(x, 0.48, z);
  parent.add(body);
  const tank = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.42, 12),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.35 }),
  );
  tank.position.set(x, 1.02, z);
  parent.add(tank);
}

function addWallClock(parent: THREE.Group, x: number, y: number, z: number) {
  const frame = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.03, 24),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
  );
  frame.rotation.x = Math.PI / 2;
  frame.position.set(x, y, z);
  parent.add(frame);
}

function addDeskOrganizer(parent: THREE.Group, x: number, y: number, z: number) {
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.04, 0.18),
    new THREE.MeshStandardMaterial({ color: 0x78909c }),
  );
  tray.position.set(x, y, z);
  parent.add(tray);
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: 0x455a64 }),
  );
  cup.position.set(x - 0.08, y + 0.05, z);
  parent.add(cup);
}

/** 护士站吊顶灯盘：灯罩 + 发光面 + 点光源 */
function addNurseStationCeilingLight(
  parent: THREE.Group,
  x: number,
  z: number,
  ceilingY: number,
  options?: { width?: number; depth?: number; intensity?: number },
) {
  const w = options?.width ?? 1.4;
  const d = options?.depth ?? 0.58;
  const intensity = options?.intensity ?? 0.48;

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.06, d),
    new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.78, metalness: 0.05 }),
  );
  housing.position.set(x, ceilingY, z);
  parent.add(housing);

  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.88, d * 0.86),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff8e1,
      emissiveIntensity: 0.85,
      roughness: 0.32,
    }),
  );
  panel.rotation.x = Math.PI / 2;
  panel.position.set(x, ceilingY - 0.035, z);
  parent.add(panel);

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(w * 0.95, d * 0.92),
    new THREE.MeshBasicMaterial({
      color: 0xfff9c4,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  glow.rotation.x = Math.PI / 2;
  glow.position.set(x, ceilingY - 0.12, z);
  parent.add(glow);

  const light = new THREE.PointLight(0xfff5e0, intensity, 11, 1.65);
  light.position.set(x, ceilingY - 0.45, z);
  parent.add(light);
}

/** 护士站天花板：格栅 + 多组嵌入式平板灯 */
export function addNurseStationCeilingLights(parent: THREE.Group, ceilingY = 2.75) {
  addCeilingGrid(parent, 6.8, 3.8, ceilingY);

  addNurseStationCeilingLight(parent, 0, -0.35, ceilingY, { width: 2.6, depth: 0.68, intensity: 0.52 });
  addNurseStationCeilingLight(parent, -1.55, 0.45, ceilingY, { width: 1.35, depth: 0.52, intensity: 0.38 });
  addNurseStationCeilingLight(parent, 1.45, 0.45, ceilingY, { width: 1.35, depth: 0.52, intensity: 0.38 });
  addNurseStationCeilingLight(parent, 0, 1.05, ceilingY, { width: 1.8, depth: 0.48, intensity: 0.32 });
}

function addCounterPartition(parent: THREE.Group, x: number, z: number, w: number) {
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xe3f2fd,
    transparent: true,
    opacity: 0.35,
    roughness: 0.15,
    metalness: 0.1,
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.55, roughness: 0.35 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, 0.42, 0.02), glassMat);
  panel.position.set(x, 0.92, z);
  parent.add(panel);
  for (const dx of [-w / 2 + 0.04, w / 2 - 0.04]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.04), frameMat);
    post.position.set(x + dx, 0.92, z);
    parent.add(post);
  }
}

function addFilingCabinet(parent: THREE.Group, x: number, z: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.35, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.05, 0.48), mat);
  body.position.set(x, 0.53, z);
  parent.add(body);
  for (let i = 0; i < 3; i++) {
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.02, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.6 }),
    );
    handle.position.set(x + 0.14, 0.28 + i * 0.32, z + 0.245);
    parent.add(handle);
  }
}

function addPrinterOnStand(parent: THREE.Group, x: number, y: number, z: number) {
  const stand = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.72, 0.42),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.55 }),
  );
  stand.position.set(x, y - 0.36, z);
  parent.add(stand);
  const printer = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.14, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.45 }),
  );
  printer.position.set(x, y, z);
  parent.add(printer);
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.02, 0.18),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
  );
  tray.position.set(x, y - 0.05, z + 0.1);
  parent.add(tray);
}

function addWheelchair(parent: THREE.Group, x: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.5, roughness: 0.35 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.7 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.4), seatMat);
  seat.position.y = 0.48;
  g.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.03), seatMat);
  back.position.set(0, 0.68, -0.18);
  g.add(back);
  const wheelL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 12), frameMat);
  wheelL.rotation.z = Math.PI / 2;
  wheelL.position.set(-0.2, 0.18, 0);
  g.add(wheelL);
  const wheelR = wheelL.clone();
  wheelR.position.x = 0.2;
  g.add(wheelR);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.03, 0.32), frameMat);
  foot.position.set(0, 0.12, 0.12);
  g.add(foot);
  parent.add(g);
}

function addFireExtinguisherBox(parent: THREE.Group, x: number, y: number, z: number) {
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.42, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xffebee, roughness: 0.6 }),
  );
  box.position.set(x, y, z);
  parent.add(box);
  const ext = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10),
    new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.5 }),
  );
  ext.position.set(x, y - 0.04, z + 0.04);
  parent.add(ext);
}

function addBrochureStand(parent: THREE.Group, x: number, z: number) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.02, 0.22),
    new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.4 }),
  );
  base.position.set(x, 0.01, z);
  parent.add(base);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.95, 8),
    new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.55 }),
  );
  pole.position.set(x, 0.48, z);
  parent.add(pole);
  const colors = [0xfff9c4, 0xffccbc, 0xc8e6c9, 0xe1bee7];
  for (let i = 0; i < 4; i++) {
    const leaflet = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.22, 0.008),
      new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.75 }),
    );
    leaflet.rotation.y = (i - 1.5) * 0.35;
    leaflet.position.set(x + Math.sin(i) * 0.06, 0.55 + i * 0.08, z + 0.04);
    parent.add(leaflet);
  }
}

function addSideTable(parent: THREE.Group, x: number, z: number) {
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.03, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.55 }),
  );
  top.position.set(x, 0.48, z);
  parent.add(top);
  for (const [dx, dz] of [[-0.16, -0.12], [0.16, -0.12], [-0.16, 0.12], [0.16, 0.12]]) {
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.46, 8),
      new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.45 }),
    );
    leg.position.set(x + dx, 0.23, z + dz);
    parent.add(leg);
  }
  const tissue = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.06, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.6 }),
  );
  tissue.position.set(x, 0.52, z);
  parent.add(tissue);
}

function addMedicalWasteBin(parent: THREE.Group, x: number, z: number) {
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.12, 0.38, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff176, roughness: 0.65 }),
  );
  body.position.set(x, 0.19, z);
  parent.add(body);
  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.14, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0xffd54f, roughness: 0.55 }),
  );
  lid.position.set(x, 0.39, z);
  parent.add(lid);
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x37474f }),
  );
  label.position.set(x, 0.28, z + 0.13);
  parent.add(label);
}

function addSlipperCabinet(parent: THREE.Group, x: number, z: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xefebe9, roughness: 0.72 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.32), mat);
  body.position.set(x, 0.43, z);
  parent.add(body);
  for (let i = 0; i < 3; i++) {
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 0.02, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xd7ccc8 }),
    );
    slot.position.set(x, 0.22 + i * 0.26, z + 0.02);
    parent.add(slot);
  }
}

function addQueueDisplay(parent: THREE.Group, x: number, y: number, z: number) {
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.34, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.45 }),
  );
  frame.position.set(x, y, z);
  parent.add(frame);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0d47a1';
  ctx.fillRect(0, 0, 320, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
  ctx.fillText('叫号屏', 16, 36);
  ctx.font = 'bold 48px "Microsoft YaHei", sans-serif';
  ctx.fillText('A023', 80, 120);
  ctx.font = '16px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#90caf9';
  ctx.fillText('请到护士站办理', 16, 170);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.3),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }),
  );
  screen.position.set(x, y, z + 0.025);
  parent.add(screen);
}

function addOfficeChair(parent: THREE.Group, x: number, z: number) {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.65 });
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.55, roughness: 0.35 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.42), seatMat);
  seat.position.set(x, 0.48, z);
  parent.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.45, 0.05), seatMat);
  back.position.set(x, 0.72, z - 0.18);
  parent.add(back);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.42, 8), baseMat);
  stem.position.set(x, 0.24, z);
  parent.add(stem);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12), baseMat);
  base.position.set(x, 0.02, z);
  parent.add(base);
}

function addFloorMat(parent: THREE.Group, x: number, z: number, w: number, d: number) {
  const mat = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.012, d),
    new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.85 }),
  );
  mat.position.set(x, 0.07, z);
  mat.receiveShadow = true;
  parent.add(mat);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.85, 0.014, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.8 }),
  );
  stripe.position.set(x, 0.075, z - d * 0.35);
  parent.add(stripe);
}

function addSmartFloorAccents(parent: THREE.Group) {
  const guideMat = new THREE.MeshBasicMaterial({
    color: 0x4dd0ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const centerGuide = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.018), guideMat);
  centerGuide.rotation.x = -Math.PI / 2;
  centerGuide.position.set(0, 0.086, 0.98);
  parent.add(centerGuide);

  const sideGuideMat = guideMat.clone();
  sideGuideMat.opacity = 0.11;
  for (const x of [-1.65, 1.65]) {
    const guide = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.012), sideGuideMat);
    guide.rotation.x = -Math.PI / 2;
    guide.rotation.z = Math.PI / 2;
    guide.position.set(x, 0.087, 0.28);
    parent.add(guide);
  }

  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x78e8ff,
    transparent: true,
    opacity: 0.07,
    depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 48), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.088, -0.28);
  parent.add(glow);
}

function addSmartWallLightStrips(parent: THREE.Group) {
  const stripMat = new THREE.MeshBasicMaterial({
    color: 0x6ee8ff,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  const backStrip = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.025), stripMat);
  backStrip.position.set(0, 1.34, -1.385);
  parent.add(backStrip);

  for (const [x, z, rotY] of [[-3.505, 0.15, Math.PI / 2], [3.505, 0.25, -Math.PI / 2]] as const) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.018), stripMat.clone());
    strip.position.set(x, 1.38, z);
    strip.rotation.y = rotY;
    parent.add(strip);
  }
}

function createSmartWallCardTexture(title: string, value: string, accent = '#6ee8ff'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(5, 28, 38, 0.72)';
  ctx.fillRect(0, 0, 256, 144);
  ctx.strokeStyle = 'rgba(110, 232, 255, 0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, 248, 136);
  ctx.fillStyle = accent;
  ctx.fillRect(18, 22, 48, 4);
  ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
  ctx.fillText(title, 18, 54);
  ctx.font = 'bold 38px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(value, 18, 104);
  ctx.fillStyle = 'rgba(144, 224, 239, 0.62)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(146, 46 + i * 18, 74 - i * 10, 5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function addSmartWallDataCards(parent: THREE.Group) {
  const lineMat = new THREE.MeshBasicMaterial({
    color: 0x72ecff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });

  for (const [x, y, w, h, title, value, accent] of [
    [-1.75, 1.92, 0.56, 0.32, 'AI巡视', '24h', '#6ee8ff'],
    [1.72, 1.92, 0.56, 0.32, '床旁联动', '10', '#7cffb2'],
    [-1.78, 1.48, 0.42, 0.2, '呼叫', '0', '#ffd166'],
    [1.76, 1.48, 0.42, 0.2, '环境', 'OK', '#6ee8ff'],
  ] as const) {
    const texture = createSmartWallCardTexture(title, value, accent);
    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    card.position.set(x, y, -1.335);
    parent.add(card);

    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.82, 0.012), lineMat.clone());
    edge.position.set(x, y + h * 0.32, -1.33);
    parent.add(edge);

    const metric = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.38, 0.018), lineMat.clone());
    metric.position.set(x - w * 0.16, y - h * 0.08, -1.329);
    parent.add(metric);
  }
}

function addCeilingTechFrame(parent: THREE.Group) {
  const railMat = new THREE.MeshBasicMaterial({
    color: 0x8cecff,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const rails = [
    { size: [6.4, 0.018, 0.018], pos: [0, 2.665, -1.12] },
    { size: [6.4, 0.018, 0.018], pos: [0, 2.665, 1.38] },
    { size: [0.018, 0.018, 2.48], pos: [-3.1, 2.665, 0.13] },
    { size: [0.018, 0.018, 2.48], pos: [3.1, 2.665, 0.13] },
  ] as const;
  rails.forEach(({ size, pos }) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), railMat.clone());
    rail.position.set(pos[0], pos[1], pos[2]);
    parent.add(rail);
  });
}

function addCounterEdgeLighting(parent: THREE.Group) {
  const edgeMat = new THREE.MeshBasicMaterial({
    color: 0x7beaff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const front = new THREE.Mesh(new THREE.BoxGeometry(4.85, 0.018, 0.018), edgeMat);
  front.position.set(0, 1.145, -0.02);
  parent.add(front);

  const side = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 2.05), edgeMat.clone());
  side.position.set(-2.78, 1.145, -0.22);
  parent.add(side);

  const underGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 0.18),
    new THREE.MeshBasicMaterial({
      color: 0x56d9ff,
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    }),
  );
  underGlow.position.set(0, 0.42, -0.225);
  parent.add(underGlow);
}

function addScreenAmbientGlow(parent: THREE.Group) {
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x4fc3ff,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const boardGlow = new THREE.Mesh(new THREE.PlaneGeometry(2.85, 1.85), glowMat);
  boardGlow.position.set(0, 1.74, -1.345);
  parent.add(boardGlow);

  const light = new THREE.PointLight(0x76dfff, 0.38, 4.8, 1.7);
  light.position.set(0, 1.72, -0.95);
  parent.add(light);
}

function addStatusBeacons(parent: THREE.Group) {
  const colors = [0x4deaff, 0x66bb6a, 0xffb74d];
  colors.forEach((color, index) => {
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 16, 12),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.86,
      }),
    );
    beacon.position.set(-0.18 + index * 0.12, 1.17, -0.06);
    parent.add(beacon);
  });
}

function addWallCoatHooks(parent: THREE.Group, x: number, y: number, z: number) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.03, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.6 }),
  );
  rail.position.set(x, y, z);
  parent.add(rail);
  for (let i = -1; i <= 1; i++) {
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.008, 6, 10, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.65 }),
    );
    hook.rotation.z = Math.PI;
    hook.position.set(x + i * 0.14, y - 0.04, z + 0.02);
    parent.add(hook);
  }
}

function addBloodPressureStand(parent: THREE.Group, x: number, z: number) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, 1.05, 10),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45 }),
  );
  pole.position.set(x, 0.53, z);
  parent.add(pole);
  const unit = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.1, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.5 }),
  );
  unit.position.set(x, 1.02, z);
  parent.add(unit);
  const cuff = new THREE.Mesh(
    new THREE.TorusGeometry(0.05, 0.015, 8, 12),
    new THREE.MeshStandardMaterial({ color: 0x37474f }),
  );
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(x, 0.78, z + 0.04);
  parent.add(cuff);
}

function addSupplyCart(parent: THREE.Group, x: number, z: number) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.55 });
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.6 });
  for (let i = 0; i < 3; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.28), shelfMat);
    shelf.position.set(x, 0.28 + i * 0.32, z);
    parent.add(shelf);
  }
  [[-0.16, -0.1], [0.16, -0.1], [-0.16, 0.1], [0.16, 0.1]].forEach(([dx, dz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.82, 0.03), mat);
    leg.position.set(x + dx, 0.41, z + dz);
    parent.add(leg);
  });
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.6 }),
  );
  box.position.set(x - 0.08, 0.62, z);
  parent.add(box);
}

function addNurseStationInterior(parent: THREE.Group) {
  const WZ = -1.36; // 后墙挂载深度

  // ── 后墙：左中右分区，避免堆在同一竖线 ──
  addWallMountedBoard(parent, -2.35, 1.28, WZ, 0.62, 0.82, createNurseWhiteboardTexture(), 0x607d8b);
  addWallMountedBoard(parent, 2.35, 1.28, WZ, 0.62, 0.82, createNurseBulletinBoardTexture(), 0x5d4037);
  // 排班看板贴图已含「护士站信息看板」标题，不再叠加独立牌子（易遮挡主看板）
  addQueueDisplay(parent, -2.78, 1.92, WZ);
  addWallClock(parent, 2.72, 2.18, WZ);
  addFireExtinguisherBox(parent, 2.72, 0.88, WZ);
  addHandSanitizer(parent, -2.78, 1.02, WZ);

  // ── 侧墙：衣帽钩、走廊指示牌 ──
  addWallCoatHooks(parent, -3.48, 1.65, 0.05);
  const corridorSignTex = createNurseStationCorridorSignTexture();
  const corridorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.38),
    new THREE.MeshBasicMaterial({ map: corridorSignTex, toneMapped: false }),
  );
  corridorSign.position.set(-3.48, 2.05, -0.35);
  corridorSign.rotation.y = Math.PI / 2;
  parent.add(corridorSign);

  // ── 柜台：双工位对称，前台矮隔断 ──
  addCounterPartition(parent, 0, -0.28, 2.85);
  addVaseWithFlowers(parent, -0.46, 1.12, -0.3);
  addDeskOrganizer(parent, -1.5, 1.14, -0.54);
  addDeskOrganizer(parent, 1.18, 1.14, -0.54);

  // ── 工作区左侧（贴墙收纳，不挡主视角）──
  addFilingCabinet(parent, -3.05, -0.55);
  addSupplyCart(parent, -3.05, 0.15);
  addMedicalWasteBin(parent, -2.05, 0.25);
  addOfficeChair(parent, -1.05, -0.08);
  addOfficeChair(parent, 0.88, -0.08);

  // ── 候诊区（右侧集中，与工位分离）──
  addSideTable(parent, 1.78, 0.9);
  addBrochureStand(parent, 3.05, 1.34);
  addWaterDispenser(parent, 2.95, -0.12);
  addSlipperCabinet(parent, 2.95, 0.46);
  addWheelchair(parent, 2.62, 1.78, -0.45);
  addPottedPlant(parent, -0.62, -0.2, 0.86, 1.13);
  addFloorMat(parent, 0.05, 1.62, 1.7, 0.48);
  addBloodPressureStand(parent, 1.34, 1.32);
}

function addNurseStationDecor(parent: THREE.Group) {
  addNurseStationInterior(parent);
}

/** 医院护士站：分区地面 + L 型柜台 + 排班看板 + 候诊椅 + 药车 + 呼叫铃 */
export function buildHospitalNurseStation(
  info: NurseStationDisplayInfo = {},
): {
  group: THREE.Group;
  scheduleBoard: THREE.Mesh;
  scheduleTexture: THREE.CanvasTexture;
  callBell: THREE.Mesh;
} {
  const group = new THREE.Group();
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.5, metalness: 0.1 });
  const workFloorMat = new THREE.MeshStandardMaterial({ color: 0xcdd9e5, roughness: 0.62, metalness: 0.06 });
  const waitFloorMat = new THREE.MeshStandardMaterial({ color: 0xe4ebf1, roughness: 0.68, metalness: 0.03 });

  const baseFloor = new THREE.Mesh(
    new THREE.BoxGeometry(7.8, 0.06, 4.5),
    new THREE.MeshStandardMaterial({ color: 0xdce5ed, roughness: 0.66, metalness: 0.02 }),
  );
  baseFloor.position.y = 0.03;
  baseFloor.receiveShadow = true;
  group.add(baseFloor);

  const workZone = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.018, 2.75), workFloorMat);
  workZone.position.set(0, 0.068, -0.45);
  group.add(workZone);

  const waitZone = new THREE.Mesh(new THREE.BoxGeometry(2.55, 0.018, 1.75), waitFloorMat);
  waitZone.position.set(2.05, 0.068, 1.05);
  group.add(waitZone);

  const zoneLineMat = new THREE.MeshBasicMaterial({ color: 0x90a4ae, transparent: true, opacity: 0.45 });
  const zoneLine = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 2.8), zoneLineMat);
  zoneLine.rotation.x = -Math.PI / 2;
  zoneLine.position.set(0.55, 0.075, 0.35);
  group.add(zoneLine);
  addSmartFloorAccents(group);

  const counterMain = new THREE.Mesh(new THREE.BoxGeometry(4.9, 1.05, 0.62), counterMat);
  counterMain.position.set(0, 0.58, -0.55);
  counterMain.castShadow = true;
  group.add(counterMain);

  const counterWing = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 2.3), counterMat);
  counterWing.position.set(-2.45, 0.58, -0.2);
  counterWing.castShadow = true;
  group.add(counterWing);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(5.0, 0.03, 2.55),
    new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.28, metalness: 0.16 }),
  );
  counterTop.position.set(-0.1, 1.12, -0.35);
  group.add(counterTop);
  addCounterEdgeLighting(group);

  const scheduleTexture = createNurseScheduleBoardTexture(info);
  const boardFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.34, 1.48, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.5, roughness: 0.35 }),
  );
  boardFrame.position.set(0, 1.74, -1.4);
  group.add(boardFrame);

  const scheduleBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(2.28, 1.42),
    new THREE.MeshBasicMaterial({ map: scheduleTexture, toneMapped: false }),
  );
  scheduleBoard.position.set(0, 1.74, -1.37);
  group.add(scheduleBoard);

  const boardGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.32, 1.46),
    new THREE.MeshBasicMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
    }),
  );
  boardGlow.position.set(0, 1.74, -1.365);
  group.add(boardGlow);
  addScreenAmbientGlow(group);

  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 2.75, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.8 }),
  );
  backWall.position.set(0, 1.38, -1.48);
  group.add(backWall);

  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.82 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0xc7e4df, roughness: 0.78 });
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 3.8), sideWallMat);
  leftWall.position.set(-3.55, 1.22, 0.15);
  group.add(leftWall);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.4, 3.6), sideWallMat);
  rightWall.position.set(3.55, 1.22, 0.25);
  group.add(rightWall);
  const leftBand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 3.8), bandMat);
  leftBand.position.set(-3.51, 1.05, 0.15);
  group.add(leftBand);
  const rightBand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 3.6), bandMat);
  rightBand.position.set(3.51, 1.05, 0.25);
  group.add(rightBand);
  const backBand = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.5, 0.04), bandMat);
  backBand.position.set(0, 1.05, -1.44);
  group.add(backBand);
  addSmartWallLightStrips(group);
  addSmartWallDataCards(group);

  const counterTopY = 1.12;
  addNurseWorkstation(group, -1.05, -0.62, counterTopY, 'left');
  addNurseWorkstation(group, 0.92, -0.62, counterTopY, 'right');

  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.04, 0.09),
    new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.55 }),
  );
  phone.position.set(-0.05, counterTopY + 0.03, -0.42);
  group.add(phone);

  const callBell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.045, 0.018, 16),
    new THREE.MeshStandardMaterial({
      color: 0xe53935,
      emissive: 0xff1744,
      emissiveIntensity: 0.55,
      metalness: 0.35,
      roughness: 0.35,
    }),
  );
  callBell.rotation.x = Math.PI / 2;
  callBell.position.set(0.42, counterTopY + 0.04, -0.4);
  group.add(callBell);
  addStatusBeacons(group);

  addWaitingChair(group, 1.55, 0.82);
  addWaitingChair(group, 2.12, 1.06);
  addWaitingChair(group, 1.62, 1.34);

  addMedicineCart(group, -2.15, 0.45);
  addPrinterOnStand(group, -2.95, 1.12, -0.72);

  /** 结构柱：L 型柜台转角 */
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 1.05, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.5, metalness: 0.2 }),
  );
  pillar.position.set(-2.42, 0.58, 0.08);
  group.add(pillar);

  addNurseStationCeilingLights(group, 2.75);
  addCeilingTechFrame(group);
  addNurseStationDecor(group);

  return { group, scheduleBoard, scheduleTexture, callBell };
}

/** 免洗洗手液墙挂 */
export function addHandSanitizer(parent: THREE.Group, x: number, y: number, z: number) {
  const mount = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.28, 0.08),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
  );
  mount.position.set(x, y, z);
  parent.add(mount);
  const bottle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.16, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.85 }),
  );
  bottle.position.set(x, y - 0.02, z + 0.05);
  parent.add(bottle);
}

/** 吸氧终端示意 */
export function addOxygenOutlet(parent: THREE.Group, x: number, y: number, z: number) {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.14, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.6 }),
  );
  panel.position.set(x, y, z);
  parent.add(panel);
  const port = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.03, 10),
    new THREE.MeshStandardMaterial({ color: 0x43a047, metalness: 0.4 }),
  );
  port.rotation.x = Math.PI / 2;
  port.position.set(x - 0.04, y, z + 0.03);
  parent.add(port);
}

/** 吊顶格栅条 */
export function addCeilingGrid(parent: THREE.Group, roomW: number, roomD: number, ceilingY: number) {
  const gridMat = new THREE.MeshStandardMaterial({ color: 0xeceff1, roughness: 0.9 });
  const step = 1.8;
  for (let x = -roomW / 2 + step; x < roomW / 2; x += step) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, roomD - 0.4), gridMat);
    bar.position.set(x, ceilingY - 0.04, 0);
    parent.add(bar);
  }
  for (let z = -roomD / 2 + step; z < roomD / 2; z += step) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(roomW - 0.4, 0.02, 0.03), gridMat);
    bar.position.set(0, ceilingY - 0.04, z);
    parent.add(bar);
  }
}
