import type { ParsedFloorplan, Rect2D, RoomCandidate, WallHint } from '@/types/domain';

export interface ValidatedUpload {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
  size: number;
  mimeType: string;
}

export interface PreprocessedImage {
  width: number;
  height: number;
  imageData: ImageData;
  grayscale: Uint8ClampedArray;
  thresholded: Uint8ClampedArray;
  deskewAngle: number;
}

export interface PlanRegion {
  id: string;
  bounds: Rect2D;
  confidence: number;
}

export interface StructuralResult {
  wallHints: WallHint[];
  roomCandidates: RoomCandidate[];
  ignoredRegions: {
    id: string;
    reason: string;
    bounds: Rect2D;
  }[];
}

export interface FallbackAnalysisResult {
  parsedFloorplan: ParsedFloorplan;
}
