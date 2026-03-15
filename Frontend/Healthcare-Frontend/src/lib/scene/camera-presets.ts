import type { ParsedFloorplan } from '@/types/domain';

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
  enablePan: boolean;
  minPolarAngle: number;
  maxPolarAngle: number;
}

const DEFAULT_BOUNDS = { minX: 0, minY: 0, maxX: 16, maxY: 12 };

export function getHospitalCameraPreset(parsed: ParsedFloorplan): CameraPreset {
  const b = parsed?.bounds ?? DEFAULT_BOUNDS;
  const width = b.maxX - b.minX;
  const depth = b.maxY - b.minY;
  const longestSide = Math.max(width, depth);
  const centerX = b.minX + width / 2;
  const centerZ = b.minY + depth / 2;
  const distance = Math.max(10, longestSide * 1.05);

  return {
    position: [centerX + distance * 0.48, Math.max(8.5, longestSide * 0.62), centerZ + distance * 0.62],
    target: [centerX, 0.42, centerZ],
    minDistance: Math.max(6, longestSide * 0.35),
    maxDistance: Math.max(16, longestSide * 1.4),
    enablePan: true,
    minPolarAngle: 0.55,
    maxPolarAngle: Math.PI / 2.22,
  };
}

export const patientCameraPreset: CameraPreset = {
  position: [0.28, 1.18, 4.15],
  target: [0, 1.08, 0.06],
  minDistance: 2.4,
  maxDistance: 5.8,
  enablePan: false,
  minPolarAngle: 0.95,
  maxPolarAngle: 1.72,
};
