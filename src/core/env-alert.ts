import type { DoorEnvParams } from '@/types/ward';

export type EnvAlertLevel = 'normal' | 'warning' | 'danger';

export interface EnvAlertItem {
  field: keyof DoorEnvParams;
  message: string;
  level: EnvAlertLevel;
}

export interface EnvAlertResult {
  level: EnvAlertLevel;
  items: EnvAlertItem[];
  summary: string;
}

const LEVEL_RANK: Record<EnvAlertLevel, number> = {
  normal: 0,
  warning: 1,
  danger: 2,
};

function parseNum(value: string | number | undefined, fallback = 0) {
  if (value === undefined)
    return fallback;
  return Number.parseFloat(String(value).replace(/[^\d.]/g, '')) || fallback;
}

function formatReading(value: string | number | undefined, unit: '℃' | '%' | 'dB') {
  const raw = String(value ?? '').trim();
  const normalized = raw.replace(/℃|°C|%|dB/gi, '').trim();
  return `${normalized}${unit}`;
}

export function analyzeEnvAlert(env?: DoorEnvParams): EnvAlertResult {
  if (!env)
    return { level: 'normal', items: [], summary: '环境正常' };

  const items: EnvAlertItem[] = [];
  const temp = parseNum(env.temp);
  const humid = parseNum(env.relativeHumid);
  const noise = parseNum(env.noiseLevel);

  if (temp > 30) {
    items.push({ field: 'temp', message: `温度过高 ${formatReading(env.temp, '℃')}`, level: 'danger' });
  }
  else if (temp > 28) {
    items.push({ field: 'temp', message: `温度偏高 ${formatReading(env.temp, '℃')}`, level: 'warning' });
  }

  if (humid > 75) {
    items.push({ field: 'relativeHumid', message: `湿度过高 ${formatReading(env.relativeHumid, '%')}`, level: 'danger' });
  }
  else if (humid > 65) {
    items.push({ field: 'relativeHumid', message: `湿度偏高 ${formatReading(env.relativeHumid, '%')}`, level: 'warning' });
  }

  if (env.airQuality === '差') {
    items.push({ field: 'airQuality', message: '空气质量较差', level: 'danger' });
  }
  else if (env.airQuality === '中') {
    items.push({ field: 'airQuality', message: '空气质量下降', level: 'warning' });
  }

  if (noise > 55) {
    items.push({ field: 'noiseLevel', message: `噪音超标 ${formatReading(env.noiseLevel, 'dB')}`, level: 'danger' });
  }
  else if (noise > 50) {
    items.push({ field: 'noiseLevel', message: `噪音偏高 ${formatReading(env.noiseLevel, 'dB')}`, level: 'warning' });
  }

  const level = items.reduce<EnvAlertLevel>(
    (max, item) => LEVEL_RANK[item.level] > LEVEL_RANK[max] ? item.level : max,
    'normal',
  );

  const summary = level === 'normal'
    ? '环境正常'
    : items.map(i => i.message).join('；');

  return { level, items, summary };
}

export function getEnvSceneTint(level: EnvAlertLevel): number {
  switch (level) {
    case 'danger':
      return 0xe8e0de;
    case 'warning':
      return 0xeae8e4;
    default:
      return 0xe8eeea;
  }
}
