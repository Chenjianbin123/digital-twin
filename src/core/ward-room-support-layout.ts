export interface WardSupportPose {
  x: number;
  y: number;
  z: number;
  rotationY?: number;
}

export interface WardSupportLayout {
  nursingCart: WardSupportPose;
  familyChair: WardSupportPose;
  cleanStorage: WardSupportPose;
  medCabinet: WardSupportPose;
  wasteStation: WardSupportPose;
}

export interface WardRoomDataCardInput {
  occupied: number;
  total: number;
  calling: number;
  temp?: string | number;
  humidity?: string | number;
}

export interface WardRoomDataCard {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  value: string;
  sub: string;
  accent: string;
}

export function resolveWardSupportLayout(bedCount: number, roomW: number, roomD: number): WardSupportLayout {
  const frontZ = roomD / 2;
  const leftX = -roomW / 2;
  const rightX = roomW / 2;
  const isMultiBed = bedCount >= 4;

  return {
    nursingCart: {
      x: leftX + (isMultiBed ? 2.05 : 1.55),
      y: 0,
      z: isMultiBed ? 0.72 : frontZ - 2.5,
      rotationY: Math.PI * 0.05,
    },
    familyChair: {
      x: rightX - (isMultiBed ? 2.35 : 2.05),
      y: 0,
      z: isMultiBed ? 1.1 : frontZ - 2.1,
      rotationY: -Math.PI * 0.08,
    },
    cleanStorage: {
      x: leftX + 1.15,
      y: 0,
      z: isMultiBed ? -0.72 : frontZ - 3.35,
    },
    medCabinet: {
      x: rightX - 1.08,
      y: 0,
      z: -roomD / 2 + 0.42,
    },
    wasteStation: {
      x: leftX + 2.85,
      y: 0,
      z: isMultiBed ? 1.62 : frontZ - 1.34,
    },
  };
}

export function resolveWardRoomDataCards(input: WardRoomDataCardInput): WardRoomDataCard[] {
  const hasTemp = input.temp !== undefined && input.temp !== null && input.temp !== '';
  const hasHumidity = input.humidity !== undefined && input.humidity !== null && input.humidity !== '';
  const temp = hasTemp ? `${input.temp}C` : '--';
  const humidity = hasHumidity ? `${input.humidity}%` : '--';

  return [
    {
      x: -1.55,
      y: 2.52,
      w: 1.28,
      h: 0.62,
      title: '床位概览',
      value: `${input.occupied}/${input.total}`,
      sub: '在床 / 总床位',
      accent: '#4fc3f7',
    },
    {
      x: 0,
      y: 2.52,
      w: 1.28,
      h: 0.62,
      title: '环境监测',
      value: temp,
      sub: `湿度 ${humidity}`,
      accent: '#5fd08d',
    },
    {
      x: 1.55,
      y: 2.52,
      w: 1.28,
      h: 0.62,
      title: '呼叫状态',
      value: `${input.calling}`,
      sub: '当前待处理',
      accent: '#ffb74d',
    },
  ];
}
