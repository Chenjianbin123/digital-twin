import type { CanvasTexture } from 'three';
import type { TwinAreaEntity, TwinWardEntity } from '../types/twin';
import type { RoomSummary } from './area-summary';
import type { ParsedTemplate } from '../types/template';
import { loadParsedTemplate } from './template/template-cache';
import { createDoorTemplateStatusTexture, getDoorTerminalScreenLayout, renderDoorTerminalTexture } from './template/door-terminal-texture';

/** Include all template inputs: staff/patient-only changes must invalidate the screen too. */
export function corridorScreenSignature(room: TwinWardEntity, area: TwinAreaEntity, aspect?: number) {
  return JSON.stringify([room, area.areaName, area.deptName, aspect]);
}

/** Corridor content follows the template, never an optional/stale device direction. */
export function corridorTemplateRoom(room: TwinWardEntity, template: Pick<ParsedTemplate, 'width' | 'height'>): TwinWardEntity {
  if (!Number.isFinite(template.width) || !Number.isFinite(template.height)
    || template.width <= 0 || template.height <= 0)
    throw new Error('门口屏模板宽高无效，无法判断横竖屏');
  // A square has no portrait/landscape distinction; retain the horizontal fallback.
  return { ...room, director: template.width >= template.height ? '0' : '1' };
}

export async function renderCorridorScreen(room: TwinWardEntity, summary: RoomSummary,
  area: TwinAreaEntity, aspect?: number): Promise<{ texture: CanvasTexture; horizontal: boolean }> {
  if (!room.templateId) return { texture: createDoorTemplateStatusTexture(room, 'missing'), horizontal: false };
  const parsed = await loadParsedTemplate(room.templateId);
  const templateRoom = corridorTemplateRoom(room, parsed);
  const horizontal = getDoorTerminalScreenLayout(templateRoom, parsed).isHorizontal;
  const texture = await renderDoorTerminalTexture(templateRoom, summary, parsed, {
    requireTemplateImages: true,
    areaName: area.areaName, deptName: area.deptName,
    targetAspect: aspect,
    fit: 'contain',
  });
  return { texture, horizontal };
}
