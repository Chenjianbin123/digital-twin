import type { CanvasTexture } from 'three';
import type { TwinAreaEntity, TwinWardEntity } from '../types/twin';
import type { RoomSummary } from './area-summary';
import { loadParsedTemplate } from './template/template-cache';
import { createDoorTemplateStatusTexture, getDoorTerminalScreenLayout, renderDoorTerminalTexture } from './template/door-terminal-texture';

/** Include all template inputs: staff/patient-only changes must invalidate the screen too. */
export function corridorScreenSignature(room: TwinWardEntity, area: TwinAreaEntity, aspect?: number) {
  return JSON.stringify([room, area.areaName, area.deptName, aspect]);
}

export async function renderCorridorScreen(room: TwinWardEntity, summary: RoomSummary,
  area: TwinAreaEntity, aspect?: number): Promise<{ texture: CanvasTexture; horizontal: boolean }> {
  if (!room.templateId) return { texture: createDoorTemplateStatusTexture(room, 'missing'), horizontal: false };
  const parsed = await loadParsedTemplate(room.templateId);
  const horizontal = getDoorTerminalScreenLayout(room, parsed).isHorizontal;
  const texture = await renderDoorTerminalTexture(room, summary, parsed, {
    requireTemplateImages: true,
    areaName: area.areaName, deptName: area.deptName,
    targetAspect: aspect ? (horizontal ? aspect : 1 / aspect) : undefined,
    fit: aspect ? 'fill' : 'contain',
  });
  return { texture, horizontal };
}
