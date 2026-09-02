import type { AreaViewPhase, TwinSceneType } from '@/types/twin';

export type AreaPhaseTransitionDirection = 'enter-corridor' | 'return-station' | 'none';

export interface AreaPhaseTransition {
  animate: boolean;
  direction: AreaPhaseTransitionDirection;
}

export interface SceneSwitchFeedback {
  title: string;
  subtitle: string;
  tone: 'station' | 'ward' | 'interior';
  fromLabel: string;
  toLabel: string;
  durationMs: number;
}

const SCENE_LABELS: Record<TwinSceneType, string> = {
  'nurse-station': '护士站',
  ward: '病房走廊',
  'ward-interior': '病房内',
};

export function resolveAreaPhaseTransition(
  from: AreaViewPhase | undefined,
  to: AreaViewPhase,
): AreaPhaseTransition {
  if (!from || from === to)
    return { animate: false, direction: 'none' };
  if (from === 'station' && to === 'corridor')
    return { animate: true, direction: 'enter-corridor' };
  if (from === 'corridor' && to === 'station')
    return { animate: true, direction: 'return-station' };
  return { animate: true, direction: 'none' };
}

export function resolveSceneSwitchFeedback(
  from: TwinSceneType,
  to: TwinSceneType,
): SceneSwitchFeedback | null {
  if (from === to)
    return null;
  if (from === 'nurse-station' && to === 'ward') {
    return {
      title: '进入病房走廊',
      subtitle: '正在展开病区总览与房间状态',
      tone: 'ward',
      fromLabel: SCENE_LABELS[from],
      toLabel: SCENE_LABELS[to],
      durationMs: 820,
    };
  }
  if (to === 'nurse-station') {
    return {
      title: '返回护士站',
      subtitle: '正在回到护理指挥视角',
      tone: 'station',
      fromLabel: SCENE_LABELS[from],
      toLabel: SCENE_LABELS[to],
      durationMs: 760,
    };
  }
  if (to === 'ward-interior') {
    return {
      title: '进入病房内',
      subtitle: '正在定位房间与床旁设备',
      tone: 'interior',
      fromLabel: SCENE_LABELS[from],
      toLabel: SCENE_LABELS[to],
      durationMs: 720,
    };
  }
  if (to === 'ward') {
    return {
      title: '切换病房走廊',
      subtitle: '正在同步病区总览视角',
      tone: 'ward',
      fromLabel: SCENE_LABELS[from],
      toLabel: SCENE_LABELS[to],
      durationMs: 700,
    };
  }
  return null;
}
