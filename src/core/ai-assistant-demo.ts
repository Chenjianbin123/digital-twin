import type { TwinAreaEntity } from '../types/twin';

export interface AssistantTarget {
  scope: string;
  roomCode: string;
  roomName: string;
  bedCode: string;
  bedName: string;
}

export interface AssistantDemoReply {
  text: string;
  targets: AssistantTarget[];
}

export function assistantTargets(area: TwinAreaEntity, scope: string): AssistantTarget[] {
  return area.rooms.flatMap(room => room.beds.map(bed => ({
    scope, roomCode: room.sickroomCode, roomName: room.sickroomName,
    bedCode: bed.bedCode, bedName: bed.bedName,
  })));
}

// Resolve against the current area again: a displayed snapshot must never select a new area's bed.
export function resolveAssistantTarget(area: TwinAreaEntity, scope: string, target: AssistantTarget) {
  if (scope !== target.scope) return null;
  const matches = area.rooms.flatMap((room, roomIndex) => room.sickroomCode === target.roomCode
    ? room.beds.filter(bed => bed.bedCode === target.bedCode).map(bed => ({ roomIndex, bed }))
    : []);
  return matches.length === 1 ? matches[0] : null;
}

export function buildAssistantDemoReply(question: string, targets: AssistantTarget[]): AssistantDemoReply {
  const text = question.trim();
  if (/概况|总结/.test(text)) return {
    text: '下方床位来自当前场景，可定位查看床位详情。病区状态请查看信息面板。',
    targets: targets.slice(0, 2),
  };
  if (/呼叫|未处理/.test(text)) return {
    text: targets.length ? '呼叫状态请查看待处理事件列表。以下床位仅供定位查看，不代表正在呼叫。' : '当前场景没有可定位的床位。',
    targets: targets.slice(0, 3),
  };
  const query = text.replace(/查找床位|查找|定位|床位|房间|病房|帮我|请/g, '').trim();
  const matched = query ? targets.filter(target => `${target.roomName} ${target.bedName} ${target.roomCode} ${target.bedCode}`.includes(query)) : targets;
  return {
    text: matched.length ? '以下是当前场景中的床位，可定位查看详情。' : '没有找到匹配的床位。可输入当前场景的房间名称或床位编码。',
    targets: matched.slice(0, 6),
  };
}
