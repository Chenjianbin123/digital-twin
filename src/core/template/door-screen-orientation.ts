import type { ParsedTemplate } from '@/types/template';
import type { TwinWardEntity } from '@/types/twin';

/** 对齐主项目 DeviceInfo.director：'0' 横屏，'1' 竖屏 */
export type DoorDirector = '0' | '1';

export interface DoorScreenLayout {
  director: DoorDirector;
  /** 对齐 deviceStore.windowMode */
  isHorizontal: boolean;
  canvasWidth: number;
  canvasHeight: number;
  meshWidth: number;
  meshHeight: number;
}

const HOR_CANVAS_WIDTH_LG = 960;
const HOR_CANVAS_WIDTH_SM = 640;
const VER_CANVAS_HEIGHT_LG = 720;
const VER_CANVAS_HEIGHT_SM = 540;

export function getDoorTargetCanvasSize(isHorizontal: boolean): {
  width: number;
  height: number;
} {
  return isHorizontal
    ? { width: 960, height: 540 }
    : { width: 480, height: 720 };
}

export function getContainedDoorTemplateRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0)
    return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

/**
 * 解析门口机横竖屏方向。
 * 优先 room.director（对齐 getCacheInfo('director')），否则按模板宽高比推断。
 */
export function resolveDoorDirector(
  room?: Pick<TwinWardEntity, 'director'>,
  template?: Pick<ParsedTemplate, 'width' | 'height'>,
): DoorDirector {
  if (room?.director === '0' || room?.director === '1')
    return room.director;
  if (template && template.width > 0 && template.height > 0)
    return template.width >= template.height ? '0' : '1';
  return '0';
}

export function isDoorHorizontal(director: DoorDirector): boolean {
  return director === '0';
}

/**
 * 对齐主项目 rem.ts 断点：
 * 横屏 1024/1280/1920 → 30/37.5/54
 * 竖屏 600/800/1080 → 30/37.5/54
 */
export function getDoorTemplateRemBase(template: ParsedTemplate, isHorizontal: boolean): number {
  if (isHorizontal) {
    if (template.width >= 1920)
      return 54;
    if (template.width >= 1280)
      return 37.5;
    return 30;
  }
  if (template.height >= 1080)
    return 54;
  if (template.height >= 800)
    return 37.5;
  return 30;
}

export function getDoorCanvasSize(template: ParsedTemplate, isHorizontal: boolean): {
  width: number;
  height: number;
} {
  const aspect = template.width / template.height;
  if (isHorizontal) {
    const width = template.width >= 1280 ? HOR_CANVAS_WIDTH_LG : HOR_CANVAS_WIDTH_SM;
    return { width, height: Math.round(width / aspect) };
  }
  const height = template.height >= 800 ? VER_CANVAS_HEIGHT_LG : VER_CANVAS_HEIGHT_SM;
  return { width: Math.round(height * aspect), height };
}

/** 3D 门口机屏幕平面尺寸（世界单位） */
export function getDoorMeshScreenSize(isHorizontal: boolean, scale = 1.45): {
  width: number;
  height: number;
} {
  if (isHorizontal)
    return { width: 0.92 * scale, height: 0.52 * scale };
  return { width: 0.5 * scale, height: 0.76 * scale };
}

export function resolveDoorScreenLayout(
  room: TwinWardEntity,
  template: ParsedTemplate,
  meshScale = 1.45,
): DoorScreenLayout {
  const director = resolveDoorDirector(room, template);
  const isHorizontal = isDoorHorizontal(director);
  const canvas = getDoorCanvasSize(template, isHorizontal);
  const mesh = getDoorMeshScreenSize(isHorizontal, meshScale);
  return {
    director,
    isHorizontal,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    meshWidth: mesh.width,
    meshHeight: mesh.height,
  };
}
