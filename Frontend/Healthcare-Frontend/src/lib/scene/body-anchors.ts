import { getMarkerSpread } from '@/lib/scene/marker-layout';
import type { BodyAnchorId } from '@/types/domain';

export interface BodyAnchor {
  id: BodyAnchorId;
  label: string;
  position: [number, number, number];
  forwardOffset: number;
  allowedOffset: [number, number, number];
  popupDirection?: 'left' | 'right' | 'center';
  severityScale?: number;
  confidence: 'high' | 'medium';
}

export interface BodyAnchorPlacement {
  anchor: BodyAnchor;
  position: [number, number, number];
  spread: [number, number, number];
  scaleMultiplier: number;
}

const DEFAULT_FRONT_PLANE_Z = 0.2;

export type BodyAnchorOverrideMap = Partial<
  Record<
    BodyAnchorId,
    {
      x?: number;
      y?: number;
      z?: number;
    }
  >
>;

// Derived from the current upright front-facing mesh after reading the live GLTF
// vertex positions and normalizing the body height to 2.115 units.
// In this corrected space:
// - +Y is up
// - feet rest near y = 0
// - the face/chest point toward +Z
// - +X is viewer-right, which is the patient's anatomical left
export const normalizedBodySpace = {
  bounds: {
    minX: -0.858,
    maxX: 0.858,
    minY: 0,
    maxY: 2.115,
    minZ: -0.214,
    maxZ: 0.214,
  },
  sampledSections: {
    headY: [1.75, 2.115],
    chestY: [1.35, 1.62],
    abdomenY: [0.92, 1.18],
    thighY: [0.35, 0.72],
  },
} as const;

export const bodyAnchors: Record<BodyAnchorId, BodyAnchor> = {
  head: {
    id: 'head',
    label: 'Head',
    position: [0, 4.33, DEFAULT_FRONT_PLANE_Z],
    forwardOffset: 0,
    allowedOffset: [0.06, 0.05, 0.03],
    popupDirection: 'right',
    severityScale: 1,
    confidence: 'high',
  },
  chest: {
    id: 'chest',
    label: 'Chest',
    position: [0, 3.45, DEFAULT_FRONT_PLANE_Z],
    forwardOffset: 0.04,
    allowedOffset: [0.07, 0.05, 0.035],
    popupDirection: 'center',
    severityScale: 1.04,
    confidence: 'high',
  },
  heart: {
    id: 'heart',
    label: 'Heart',
    position: [0.255, 3.525, -0.01],
    forwardOffset: 0,
    allowedOffset: [0.045, 0.04, 0.03],
    popupDirection: 'left',
    severityScale: 1.08,
    confidence: 'medium',
  },
  lungs: {
    id: 'lungs',
    label: 'Lungs',
    position: [-0.3, 3.55, -0.04],
    forwardOffset: 0,
    allowedOffset: [0.09, 0.05, 0.03],
    popupDirection: 'center',
    severityScale: 1.08,
    confidence: 'high',
  },
  liver: {
    id: 'liver',
    label: 'Liver',
    position: [-0.175, 3.34, -0.02],
    forwardOffset: 0,
    allowedOffset: [0.05, 0.04, 0.03],
    popupDirection: 'right',
    severityScale: 1,
    confidence: 'medium',
  },
  abdomen: {
    id: 'abdomen',
    label: 'Abdomen',
    position: [0, 2.8, DEFAULT_FRONT_PLANE_Z],
    forwardOffset: 0,
    allowedOffset: [0.07, 0.05, 0.03],
    popupDirection: 'center',
    severityScale: 0.96,
    confidence: 'high',
  },
  leftArm: {
    id: 'leftArm',
    label: 'Left Arm',
    position: [0.8, 3.3, -0.05],
    forwardOffset: 0,
    allowedOffset: [0.08, 0.05, 0.025],
    popupDirection: 'left',
    severityScale: 0.92,
    confidence: 'medium',
  },
  rightArm: {
    id: 'rightArm',
    label: 'Right Arm',
    position: [-0.8, 3.3, -0.05],
    forwardOffset: 0,
    allowedOffset: [0.08, 0.05, 0.025],
    popupDirection: 'right',
    severityScale: 0.92,
    confidence: 'medium',
  },
  leftLeg: {
    id: 'leftLeg',
    label: 'Left Leg',
    position: [0.3, 1.5, DEFAULT_FRONT_PLANE_Z],
    forwardOffset: 0,
    allowedOffset: [0.05, 0.08, 0.03],
    popupDirection: 'left',
    severityScale: 0.9,
    confidence: 'high',
  },
  rightLeg: {
    id: 'rightLeg',
    label: 'Right Leg',
    position: [-0.3, 1.5, DEFAULT_FRONT_PLANE_Z],
    forwardOffset: 0,
    allowedOffset: [0.05, 0.08, 0.03],
    popupDirection: 'right',
    severityScale: 0.9,
    confidence: 'high',
  },
};

export const visibleBodyAnchorIds: BodyAnchorId[] = [
  'head',
  'heart',
  'lungs',
  'liver',
  'abdomen',
  'leftArm',
  'rightArm',
  'leftLeg',
  'rightLeg',
];

export function getBodyAnchor(anchorId: BodyAnchorId, overrides?: BodyAnchorOverrideMap) {
  const anchor = bodyAnchors[anchorId];
  const override = overrides?.[anchorId];

  if (!override) {
    return anchor;
  }

  return {
    ...anchor,
    position: [
      override.x ?? anchor.position[0],
      override.y ?? anchor.position[1],
      override.z ?? anchor.position[2],
    ] as [number, number, number],
  };
}

export function getBodyAreaLabel(anchorId: BodyAnchorId) {
  return bodyAnchors[anchorId].label;
}

export function getBodyAnchorPlacement({
  anchorId,
  index = 0,
  count = 1,
  selected = false,
  overrides,
}: {
  anchorId: BodyAnchorId;
  index?: number;
  count?: number;
  selected?: boolean;
  overrides?: BodyAnchorOverrideMap;
}): BodyAnchorPlacement {
  const anchor = getBodyAnchor(anchorId, overrides);
  const rawSpread = getMarkerSpread(anchorId, index, count, selected);
  const spread: [number, number, number] = [
    clamp(rawSpread[0], -anchor.allowedOffset[0], anchor.allowedOffset[0]),
    clamp(rawSpread[1], -anchor.allowedOffset[1], anchor.allowedOffset[1]),
    clamp(rawSpread[2], -anchor.allowedOffset[2], anchor.allowedOffset[2]),
  ];

  return {
    anchor,
    spread,
    position: [
      anchor.position[0] + spread[0],
      anchor.position[1] + spread[1],
      anchor.position[2] + anchor.forwardOffset + spread[2],
    ],
    scaleMultiplier: anchor.severityScale ?? 1,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
