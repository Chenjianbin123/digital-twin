import * as THREE from 'three';

import type { RoomSummary } from '@/core/area-summary';
import { buildMainStaffList } from '@/core/door-staff';
import { renderDoorTemplateToCanvas } from '@/core/template/door-canvas-renderer';
import { buildDoorTemplateData } from '@/core/template/door-data-mapper';
import {
  getContainedDoorTemplateRect,
  getDoorTargetCanvasSize,
  isDoorHorizontal,
  resolveDoorDirector,
  resolveDoorScreenLayout,
} from '@/core/template/door-screen-orientation';
import type { ParsedTemplate } from '@/types/template';
import type { TwinWardEntity } from '@/types/twin';
import {
  buildTemplateDisplayState,
  createTemplateStatusCanvas,
  type TemplateDisplayStatus,
} from '@/core/template/template-display-state';

const HOSPITAL_BLUE = '#456BAF';
const HOSPITAL_BG = '#F0F5FD';
const warnedTemplateDirectionMismatch = new Set<string>();

function containDoorTemplateCanvas(
  source: HTMLCanvasElement,
  isHorizontal: boolean,
  background: string,
) {
  const targetSize = getDoorTargetCanvasSize(isHorizontal);
  const target = document.createElement('canvas');
  target.width = targetSize.width;
  target.height = targetSize.height;
  const ctx = target.getContext('2d')!;
  ctx.fillStyle = background || HOSPITAL_BG;
  ctx.fillRect(0, 0, target.width, target.height);
  const rect = getContainedDoorTemplateRect(
    source.width,
    source.height,
    target.width,
    target.height,
  );
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height);
  return target;
}

function fillDoorTemplateCanvas(
  source: HTMLCanvasElement,
  targetAspect: number,
  background: string,
) {
  const target = document.createElement('canvas');
  target.width = targetAspect < 1 ? 1080 : 1920;
  target.height = Math.max(1, Math.round(target.width / targetAspect));
  const ctx = target.getContext('2d')!;
  ctx.fillStyle = background || HOSPITAL_BG;
  ctx.fillRect(0, 0, target.width, target.height);
  ctx.drawImage(source, 0, 0, target.width, target.height);
  return target;
}

function drawRoundedRect(
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

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  base: number,
  min: number,
  weight = 'bold',
) {
  let size = base;
  while (size >= min) {
    ctx.font = `${weight} ${size}px "Microsoft YaHei", sans-serif`;
    if (ctx.measureText(text).width <= maxW)
      break;
    size -= 1;
  }
  return size;
}

function drawStaffRow(
  ctx: CanvasRenderingContext2D,
  room: TwinWardEntity,
  y: number,
  w: number,
) {
  const staff = buildMainStaffList(room.doorStaff, { primaryOnly: true }).slice(0, 3);
  if (!staff.length)
    return;

  const colW = w / staff.length;
  staff.forEach((item, index) => {
    const cx = colW * index + colW / 2;
    ctx.fillStyle = '#e3eaf3';
    ctx.beginPath();
    ctx.arc(cx, y + 22, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78909c';
    ctx.font = 'bold 11px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.role.slice(0, 2), cx, y + 22);

    ctx.fillStyle = '#455a64';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(item.name, cx, y + 48);
  });
}

function drawBedCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bedName: string,
  sickName: string,
  nursingColor: string,
  occupied: boolean,
) {
  drawRoundedRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#d0dae4';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = nursingColor || (occupied ? '#4CAF50' : '#b0bec5');
  ctx.fillRect(x, y + 6, 5, h - 12);

  ctx.fillStyle = occupied ? '#263238' : '#90a4ae';
  ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(bedName, x + 14, y + h * 0.36);

  ctx.font = '14px "Microsoft YaHei", sans-serif';
  ctx.fillStyle = occupied ? '#37474f' : '#b0bec5';
  ctx.fillText(occupied ? sickName : '空床', x + 14, y + h * 0.68);
}

function drawHospitalDoorVertical(
  ctx: CanvasRenderingContext2D,
  room: TwinWardEntity,
  summary: RoomSummary,
  data: ReturnType<typeof buildDoorTemplateData>,
) {
  const w = 320;
  const h = 480;
  const isCalling = summary.priority === 'calling';

  ctx.fillStyle = HOSPITAL_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = isCalling ? '#c62828' : HOSPITAL_BLUE;
  ctx.fillRect(0, 0, w, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('医护门口机', 14, 26);

  ctx.textAlign = 'right';
  ctx.font = '13px "Microsoft YaHei", sans-serif';
  ctx.fillText(data.timer.time.replace(/\s/g, ''), w - 12, 18);
  ctx.font = '11px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${data.timer.date} ${data.timer.week}`, w - 12, 36);

  const roomName = data.doorDeviceInfo.sickroomName;
  ctx.fillStyle = '#37474f';
  ctx.fillRect(12, 64, w - 24, 52);
  ctx.fillStyle = '#ffffff';
  const roomSize = fitFontSize(ctx, roomName, w - 40, 30, 20);
  ctx.font = `bold ${roomSize}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(roomName, w / 2, 90);

  if (data.bedNum) {
    ctx.fillStyle = '#607d8b';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.fillText(data.bedNum, w / 2, 132);
  }

  const envLine = [data.doorEnvData.temp, data.doorEnvData.relativeHumid, data.doorEnvData.airQuality]
    .filter(Boolean)
    .join('  ');
  if (envLine) {
    ctx.fillStyle = '#78909c';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(envLine, w / 2, 154);
  }

  drawStaffRow(ctx, room, 168, w);

  const beds = data.bedDeviceList;
  const cardX = 14;
  const cardW = w - 28;
  const cardH = beds.length > 2 ? 58 : 64;
  const cardGap = 8;
  let cardY = 248;
  for (const bed of beds.slice(0, 4)) {
    const occupied = !!bed.sickInfo?.sickNo;
    drawBedCard(
      ctx,
      cardX,
      cardY,
      cardW,
      cardH,
      bed.bedName,
      bed.sickInfo?.sickName || '空床',
      bed.sickInfo?.nursingColor || '',
      occupied,
    );
    cardY += cardH + cardGap;
  }

  if (isCalling) {
    ctx.fillStyle = 'rgba(233, 30, 99, 0.92)';
    drawRoundedRect(ctx, w / 2 - 58, 8, 116, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('呼叫中', w / 2, 24);
  }
}

function drawHospitalDoorHorizontal(
  ctx: CanvasRenderingContext2D,
  room: TwinWardEntity,
  summary: RoomSummary,
  data: ReturnType<typeof buildDoorTemplateData>,
) {
  const w = 480;
  const h = 270;
  const isCalling = summary.priority === 'calling';

  ctx.fillStyle = HOSPITAL_BG;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = isCalling ? '#c62828' : HOSPITAL_BLUE;
  ctx.fillRect(0, 0, w, 42);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('医护门口机', 12, 21);
  ctx.textAlign = 'right';
  ctx.font = '12px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${data.timer.time.replace(/\s/g, '')}  ${data.timer.date}`, w - 12, 21);

  ctx.fillStyle = '#37474f';
  ctx.fillRect(10, 50, 150, 40);
  ctx.fillStyle = '#ffffff';
  const roomSize = fitFontSize(ctx, data.doorDeviceInfo.sickroomName, 140, 22, 16);
  ctx.font = `bold ${roomSize}px "Microsoft YaHei", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(data.doorDeviceInfo.sickroomName, 85, 70);

  drawStaffRow(ctx, room, 96, 160);

  const beds = data.bedDeviceList.slice(0, 4);
  const cardW = (w - 188) / Math.max(beds.length, 1) - 6;
  beds.forEach((bed, index) => {
    const occupied = !!bed.sickInfo?.sickNo;
    drawBedCard(
      ctx,
      178 + index * (cardW + 6),
      108,
      cardW,
      h - 118,
      bed.bedName,
      bed.sickInfo?.sickName || '空床',
      bed.sickInfo?.nursingColor || '',
      occupied,
    );
  });

  if (isCalling) {
    ctx.fillStyle = 'rgba(233, 30, 99, 0.92)';
    ctx.fillRect(w / 2 - 50, 6, 100, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('呼叫中', w / 2, 20);
  }
}

export function createFallbackDoorTerminalTexture(
  room: TwinWardEntity,
  summary: RoomSummary,
  template?: ParsedTemplate,
): THREE.CanvasTexture {
  const director = resolveDoorDirector(room, template);
  const horizontal = isDoorHorizontal(director);
  const canvas = document.createElement('canvas');
  canvas.width = horizontal ? 480 : 320;
  canvas.height = horizontal ? 270 : 480;
  const ctx = canvas.getContext('2d')!;
  const data = buildDoorTemplateData(room, summary);

  if (horizontal)
    drawHospitalDoorHorizontal(ctx, room, summary, data);
  else
    drawHospitalDoorVertical(ctx, room, summary, data);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createDoorTemplateStatusTexture(
  room: TwinWardEntity,
  status: TemplateDisplayStatus,
  detail?: string,
): THREE.CanvasTexture {
  const horizontal = isDoorHorizontal(resolveDoorDirector(room));
  const canvas = createTemplateStatusCanvas(
    buildTemplateDisplayState(status, 'door', detail),
    horizontal ? 'horizontal' : 'vertical',
    room.sickroomName || room.sickroomCode || '',
  );
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export async function renderDoorTerminalTexture(
  room: TwinWardEntity,
  summary: RoomSummary,
  template: ParsedTemplate,
  areaMeta?: {
    areaName?: string;
    deptName?: string;
    targetAspect?: number;
    fit?: 'contain' | 'fill';
  },
): Promise<THREE.CanvasTexture> {
  const data = buildDoorTemplateData(room, summary, areaMeta);
    const layout = resolveDoorScreenLayout(room, template);
    const sourceCanvas = await renderDoorTemplateToCanvas(data, template, {
      room,
      isHorizontal: layout.isHorizontal,
      outputWidth: layout.canvasWidth,
      outputHeight: layout.canvasHeight,
    });
    const templateIsHorizontal = template.width >= template.height;
    if (templateIsHorizontal !== layout.isHorizontal) {
      const key = `${room.sickroomCode || room.sickroomName}:${room.templateId || 0}`;
      if (!warnedTemplateDirectionMismatch.has(key)) {
        warnedTemplateDirectionMismatch.add(key);
        console.warn('[DoorTemplate] 模板方向与门口机方向不一致，已等比留边显示', {
          room: room.sickroomName,
          director: layout.director,
          templateSize: `${template.width}x${template.height}`,
        });
      }
    }
    const canvas = areaMeta?.fit === 'fill' && areaMeta.targetAspect
      ? fillDoorTemplateCanvas(sourceCanvas, areaMeta.targetAspect, template.background)
      : containDoorTemplateCanvas(sourceCanvas, layout.isHorizontal, template.background);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
  return tex;
}

/** 供 3D 场景判断门口机屏幕宽高比 */
export function getDoorTerminalScreenLayout(room: TwinWardEntity, template: ParsedTemplate) {
  return resolveDoorScreenLayout(room, template);
}
