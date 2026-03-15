import type { BodyAnchorId } from '@/types/domain';

export function getMarkerSpread(anchorId: BodyAnchorId, index: number, count: number, selected: boolean) {
  if (count <= 1) {
    return [0, 0, selected ? 0.04 : 0] as const;
  }

  const baseAngle = anchorId.length * 0.41;
  const angle = baseAngle + (index / count) * Math.PI * 2;
  const radius = 0.07 + Math.min(count, 4) * 0.018 + (selected ? 0.025 : 0);
  return [
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.35,
    selected ? 0.05 : 0.018,
  ] as const;
}
