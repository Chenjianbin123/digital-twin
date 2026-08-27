import { BED_HEAD_Z, BED_WIDTH, MIN_BED_CLEARANCE, resolveBedVisualScale } from './ward-bed-geometry.ts';

export interface WardBedPose {
  x: number;
  z: number;
  rotationY: number;
}

export function resolveWardBedPose(index: number, total: number, roomW: number, roomD: number): WardBedPose {
  const count = Math.max(1, total);
  const safeIndex = Math.min(Math.max(0, index), count - 1);
  const minCenterSpacing = BED_WIDTH + MIN_BED_CLEARANCE;
  const visualScale = resolveBedVisualScale(count);
  const spacing = count === 1
    ? 0
    : Math.min(2.95, Math.max(minCenterSpacing, (roomW - 4.2) / (count - 1)));
  const totalSpan = spacing * (count - 1);

  return {
    x: -totalSpan / 2 + safeIndex * spacing,
    z: -roomD / 2 + Math.abs(BED_HEAD_Z) * visualScale + 0.32,
    rotationY: 0,
  };
}
