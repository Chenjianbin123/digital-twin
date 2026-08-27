import * as THREE from 'three';

import { renderTemplateToCanvas } from '@/core/template/canvas-renderer';
import { displayPatientName } from '@/utils/mask-patient';
import type { ParsedTemplate } from '@/types/template';
import type { BedStatusMeta, TwinBedEntity } from '@/types/twin';
import {
  buildTemplateDisplayState,
  createTemplateStatusCanvas,
  type TemplateDisplayStatus,
} from '@/core/template/template-display-state';

export function createFallbackBedTerminalTexture(bed: TwinBedEntity, status: BedStatusMeta): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const isEmpty = !bed.isOccupied;
  const patientName = displayPatientName(bed.sickInfo?.sickName, bed.isOccupied);
  const accent = isEmpty ? '#546e7a' : '#1565c0';

  ctx.fillStyle = isEmpty ? '#141c28' : '#061018';
  ctx.fillRect(0, 0, 480, 320);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 480, 54);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`${bed.bedName}`, 18, 36);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('床头机', 390, 34);
  ctx.fillStyle = isEmpty ? '#90a4ae' : '#e3f2fd';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(patientName, 18, 108);

  if (bed.nursingLevel) {
    const chipW = ctx.measureText(bed.nursingLevel).width + 28;
    ctx.fillStyle = 'rgba(255,183,77,0.22)';
    ctx.fillRect(18, 122, chipW, 34);
    ctx.strokeStyle = 'rgba(255,183,77,0.45)';
    ctx.strokeRect(18, 122, chipW, 34);
    ctx.fillStyle = '#ffb74d';
    ctx.font = '18px sans-serif';
    ctx.fillText(bed.nursingLevel, 30, 145);
  }

  ctx.fillStyle = isEmpty ? '#607d8b' : '#4fc3f7';
  ctx.font = '20px sans-serif';
  ctx.fillText(status.label, 18, 196);
  ctx.fillStyle = '#607d8b';
  ctx.font = '15px monospace';
  ctx.fillText(bed.deviceCode, 18, 278);

  const dotColor = isEmpty ? '#78909c' : bed.isOnline ? '#76ff03' : '#ff5252';
  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(448, 272, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8fa3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText(isEmpty ? '待入住' : bed.isOnline ? '在线' : '离线', 400, 278);

  if (bed.isCalling) {
    ctx.fillStyle = 'rgba(233,30,99,0.85)';
    ctx.fillRect(340, 8, 130, 38);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('呼叫中', 365, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createBedTemplateStatusTexture(
  bed: TwinBedEntity,
  displayStatus: TemplateDisplayStatus,
  detail?: string,
): THREE.CanvasTexture {
  const canvas = createTemplateStatusCanvas(
    buildTemplateDisplayState(displayStatus, 'bed', detail),
    'horizontal',
    `${bed.bedName} ${bed.deviceCode}`.trim(),
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function renderBedTerminalTexture(
  bed: TwinBedEntity,
  template: ParsedTemplate,
  status: BedStatusMeta,
): Promise<THREE.CanvasTexture> {
  void status;
  const canvas = await renderTemplateToCanvas(bed, template, { outputWidth: 512 });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
