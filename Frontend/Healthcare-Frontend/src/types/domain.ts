export type SceneMode = 'hospital' | 'patient';
export type TransitionState = 'idle' | 'toPatient' | 'toHospital' | 'analyzing';
export type RoomType = 'care' | 'nonCare' | 'unknown';
export type Priority = 'low' | 'medium' | 'high' | 'critical' | 'none';
export type OccupancyStatus = 'occupied' | 'vacant' | 'observation' | 'unknown';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type BodyAnchorId =
  | 'head'
  | 'chest'
  | 'heart'
  | 'lungs'
  | 'liver'
  | 'abdomen'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg';

export interface Point2D {
  x: number;
  y: number;
}

export interface Rect2D {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

export interface Rect3D {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

export interface AnalysisWarning {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  code:
    | 'upload-invalid'
    | 'ocr-weak'
    | 'ocr-skipped'
    | 'no-care-rooms'
    | 'no-rooms'
    | 'no-structure'
    | 'fallback-analysis'
    | 'sidecar-unavailable'
    | 'gemini-unavailable'
    | 'gemini-invalid'
    | 'geometry-approximate'
    | 'debug';
}

export interface Condition {
  id: string;
  label: string;
  bodyArea: BodyAnchorId;
  severity: Severity;
  color: string;
  shortDescription: string;
  detailedNotes: string;
  monitoring: string;
  recommendedSupport: string;
}

export interface Patient {
  id: string;
  name: string;
  age: number;
  roomId?: string;
  summary: string;
  conditions: Condition[];
}

export interface OcrLabel {
  id: string;
  text: string;
  confidence: number;
  bbox: Rect2D;
  normalized?: string;
}

export interface IgnoredRegion {
  id: string;
  reason: string;
  bounds: Rect2D;
}

export interface WallHint {
  id: string;
  points: Point2D[];
  confidence: number;
}

export interface RoomCandidate {
  id: string;
  name: string;
  parsedLabel: string;
  labelSource: 'ocr' | 'heuristic' | 'generated';
  confidence: number;
  kind: 'rect' | 'polygon';
  rect?: Rect2D;
  points?: Point2D[];
  source: 'rich' | 'fallback' | 'mock';
}

export interface RoomRecord {
  id: string;
  name: string;
  parsedLabel: string;
  type: RoomType;
  priority: Priority;
  displayColor?: string;
  confidence: number;
  occupancyStatus: OccupancyStatus;
  patientId?: string;
  visual:
    | {
        kind: 'rect';
        rect: Rect3D;
      }
    | {
        kind: 'polygon';
        points: Point2D[];
        height: number;
      };
}

export interface DebugOverlay {
  id: string;
  kind: 'imageBounds' | 'candidateRect' | 'ignoredRect' | 'wallPath';
  color: string;
  rect?: Rect2D;
  points?: Point2D[];
  label?: string;
}

export interface ParsedFloorplan {
  metadata: {
    id: string;
    analysisMode: 'mock' | 'rich' | 'fallback';
    createdAt: string;
    imageHash?: string;
  };
  sourceImageInfo?: {
    name: string;
    mimeType: string;
    width: number;
    height: number;
    size: number;
  };
  warnings: AnalysisWarning[];
  confidenceSummary: {
    structure: number;
    labels: number;
    classification: number;
  };
  roomCandidates: RoomCandidate[];
  classifiedRooms: RoomRecord[];
  labels: OcrLabel[];
  ignoredRegions: IgnoredRegion[];
  wallHints: WallHint[];
  debugOverlays?: DebugOverlay[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}
