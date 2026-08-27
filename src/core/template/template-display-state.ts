export type TemplateDisplayKind = 'door' | 'bed';
export type TemplateDisplayStatus = 'loading' | 'missing' | 'error' | 'image-error';
export type TemplateDisplayOrientation = 'horizontal' | 'vertical';

export interface TemplateDisplayState {
  title: string;
  detail: string;
  tone: 'info' | 'muted' | 'error' | 'warning';
}

const DEFAULT_DETAILS: Record<TemplateDisplayStatus, string> = {
  loading: '正在获取最新模板',
  missing: '请在平台中配置模板',
  error: '请稍后重试或联系管理员',
  'image-error': '模板内容已显示，部分图片暂不可用',
};

export function getTemplateStatusCanvasSize(orientation: TemplateDisplayOrientation) {
  return orientation === 'horizontal'
    ? { width: 960, height: 540 }
    : { width: 480, height: 720 };
}

export function fitDisplayText(text: string, maxLength: number): string {
  const normalized = text.trim();
  if (normalized.length <= maxLength)
    return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1))}…`;
}

export function getImagePlaceholderLabel(label = ''): string {
  const normalized = fitDisplayText(label, 7);
  return normalized ? `${normalized}暂不可用` : '图片暂不可用';
}

export function drawTemplateImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  rect: { x: number; y: number; w: number; h: number },
  label = '',
) {
  if (rect.w < 2 || rect.h < 2)
    return;
  ctx.save();
  ctx.fillStyle = '#e8eef2';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = '#b7c5ce';
  ctx.lineWidth = Math.max(1, Math.min(rect.w, rect.h) * 0.015);
  ctx.strokeRect(rect.x + 1, rect.y + 1, Math.max(0, rect.w - 2), Math.max(0, rect.h - 2));
  if (rect.w >= 54 && rect.h >= 28) {
    ctx.fillStyle = '#758892';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `500 ${Math.max(9, Math.min(16, rect.h * 0.18))}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText(getImagePlaceholderLabel(label), rect.x + rect.w / 2, rect.y + rect.h / 2, rect.w - 8);
  }
  ctx.restore();
}

function sanitizeErrorDetail(detail?: string): string {
  if (!detail)
    return DEFAULT_DETAILS.error;
  const status = detail.match(/HTTP\s+\d{3}/i)?.[0]?.toUpperCase();
  if (status)
    return `${status}，请检查模板接口或模板编号`;
  if (/JSON|Unexpected token|解析/i.test(detail))
    return '模板内容格式错误，请检查模板配置';
  if (/network|fetch|网络|timeout|超时/i.test(detail))
    return '网络连接异常，请稍后重试';
  return '请稍后重试或联系管理员';
}

export function buildTemplateDisplayState(
  status: TemplateDisplayStatus,
  kind: TemplateDisplayKind,
  detail?: string,
): TemplateDisplayState {
  const deviceName = kind === 'door' ? '门口机' : '床头屏';
  const title = status === 'loading'
    ? '模板加载中'
    : status === 'missing'
      ? `未配置${deviceName}模板`
      : status === 'image-error'
        ? '图片资源加载失败'
        : `${deviceName}模板加载失败`;

  return {
    title,
    detail: status === 'error' ? sanitizeErrorDetail(detail) : (detail || DEFAULT_DETAILS[status]),
    tone: status === 'loading' ? 'info' : status === 'missing' ? 'muted' : status === 'image-error' ? 'warning' : 'error',
  };
}

export function createTemplateStatusCanvas(
  state: TemplateDisplayState,
  orientation: TemplateDisplayOrientation,
  contextLabel = '',
): HTMLCanvasElement {
  const { width, height } = getTemplateStatusCanvasSize(orientation);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const colors = {
    info: { accent: '#4f83cc', title: '#eaf3ff' },
    muted: { accent: '#78909c', title: '#e2e8ec' },
    error: { accent: '#d85858', title: '#ffecec' },
    warning: { accent: '#d89a3d', title: '#fff3dc' },
  }[state.tone];
  const scale = width / 960;

  ctx.fillStyle = '#10202b';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(0, 0, width, Math.max(8, 12 * scale));

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(width / 2, height * 0.32, Math.max(10, 18 * scale), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.title;
  ctx.font = `700 ${Math.max(24, 42 * scale)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(fitDisplayText(state.title, orientation === 'horizontal' ? 18 : 12), width / 2, height * 0.48);
  ctx.fillStyle = '#9fb0ba';
  ctx.font = `400 ${Math.max(15, 24 * scale)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillText(fitDisplayText(state.detail, orientation === 'horizontal' ? 32 : 18), width / 2, height * 0.59);

  if (contextLabel) {
    ctx.fillStyle = '#6f838e';
    ctx.font = `400 ${Math.max(13, 19 * scale)}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    ctx.fillText(fitDisplayText(contextLabel, orientation === 'horizontal' ? 28 : 16), width / 2, height * 0.82);
  }
  return canvas;
}
