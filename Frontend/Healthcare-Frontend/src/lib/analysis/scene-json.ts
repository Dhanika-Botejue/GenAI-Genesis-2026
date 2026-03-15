import type { AnalysisWarning, ParsedFloorplan, RoomCandidate, RoomRecord } from '@/types/domain';

const nonCareRegex = /\b(nurse|station|storage|utility|hall|corridor|office|kitchen|dining|common|library|mechanical|pantry|bath|spa)\b/i;
const numberedCareRegex = /\b(?:room|rm)\s*[a-z-]*\d+[a-z]?\b/i;
const careLabelRegex = /\b(resident|patient|bed(?:room)?|ward|suite)\b/i;

export function buildParsedFloorplanFromCandidates({
  analysisMode,
  imageHash,
  sourceImageInfo,
  warnings,
  roomCandidates,
  labels,
  ignoredRegions,
  wallHints,
}: {
  analysisMode: 'rich' | 'fallback' | 'mock';
  imageHash?: string;
  sourceImageInfo?: ParsedFloorplan['sourceImageInfo'];
  warnings: AnalysisWarning[];
  roomCandidates: RoomCandidate[];
  labels: ParsedFloorplan['labels'];
  ignoredRegions: ParsedFloorplan['ignoredRegions'];
  wallHints: ParsedFloorplan['wallHints'];
}) {
  const safeCandidates = roomCandidates.length > 0 ? roomCandidates : [buildFallbackPlate()];
  const bounds = getCandidateBounds(safeCandidates);
  const longestSide = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1);
  const targetExtent = 16;

  const classifiedRooms: RoomRecord[] = safeCandidates.map((candidate) => {
    const label = candidate.parsedLabel || candidate.name || 'Unknown Zone';
    const type = classifyRoomType(label);
    const priority = type === 'care' ? 'medium' : 'none';
    const rect = candidate.rect ?? { x: bounds.minX, y: bounds.minY, width: longestSide, height: longestSide };

    const worldWidth = Math.max((rect.width / longestSide) * targetExtent, type === 'care' ? 1.35 : 1);
    const worldDepth = Math.max((rect.height / longestSide) * targetExtent, 0.95);
    const worldX = ((rect.x + rect.width / 2 - bounds.minX) / longestSide) * targetExtent + 2;
    const worldZ = ((rect.y + rect.height / 2 - bounds.minY) / longestSide) * targetExtent + 1.4;

    return {
      id: candidate.id,
      name: candidate.name,
      parsedLabel: label,
      type,
      priority,
      confidence: candidate.confidence,
      occupancyStatus: type === 'care' ? 'occupied' : 'observation',
      visual: {
        kind: 'rect',
        rect: {
          x: worldX,
          y: 0.03,
          z: worldZ,
          width: worldWidth,
          depth: worldDepth,
          height: 0.18,
        },
      },
    };
  });

  const visualBounds = getVisualBounds(classifiedRooms);

  return {
    metadata: {
      id: imageHash ?? `${analysisMode}-analysis`,
      analysisMode,
      createdAt: new Date().toISOString(),
      imageHash,
    },
    sourceImageInfo,
    warnings,
    confidenceSummary: {
      structure: Math.max(0.16, Math.min(0.95, roomCandidates.length > 0 ? 0.66 : 0.22)),
      labels: Math.max(0.14, Math.min(0.94, labels.length > 0 ? 0.58 : 0.18)),
      classification: Math.max(0.2, Math.min(0.92, classifiedRooms.length > 0 ? 0.71 : 0.28)),
    },
    roomCandidates,
    classifiedRooms,
    labels,
    ignoredRegions,
    wallHints,
    debugOverlays: [],
    bounds: visualBounds,
  } satisfies ParsedFloorplan;
}

function classifyRoomType(label: string) {
  if (nonCareRegex.test(label)) {
    return 'nonCare' as const;
  }

  if (numberedCareRegex.test(label) || careLabelRegex.test(label)) {
    return 'care' as const;
  }

  return 'unknown' as const;
}

function getCandidateBounds(candidates: RoomCandidate[]) {
  return candidates.reduce(
    (accumulator, candidate) => {
      const rect = candidate.rect;
      if (!rect) {
        return accumulator;
      }
      return {
        minX: Math.min(accumulator.minX, rect.x),
        maxX: Math.max(accumulator.maxX, rect.x + rect.width),
        minY: Math.min(accumulator.minY, rect.y),
        maxY: Math.max(accumulator.maxY, rect.y + rect.height),
      };
    },
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
    },
  );
}

function buildFallbackPlate(): RoomCandidate {
  return {
    id: 'fallback-floor-plate',
    name: 'Approximate Floor Plate',
    parsedLabel: 'Approximate Floor Plate',
    labelSource: 'generated',
    confidence: 0.22,
    kind: 'rect',
    rect: { x: 0, y: 0, width: 12, height: 8 },
    source: 'fallback',
  };
}

function getVisualBounds(classifiedRooms: RoomRecord[]) {
  const bounds = classifiedRooms.reduce(
    (accumulator, room) => {
      if (room.visual.kind !== 'rect') {
        return accumulator;
      }

      const { x, z, width, depth } = room.visual.rect;
      return {
        minX: Math.min(accumulator.minX, x - width / 2),
        maxX: Math.max(accumulator.maxX, x + width / 2),
        minY: Math.min(accumulator.minY, z - depth / 2),
        maxY: Math.max(accumulator.maxY, z + depth / 2),
      };
    },
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) {
    return {
      minX: 0,
      maxX: 22,
      minY: 0,
      maxY: 18,
    };
  }

  const pad = 1.4;
  return {
    minX: bounds.minX - pad,
    maxX: bounds.maxX + pad,
    minY: bounds.minY - pad,
    maxY: bounds.maxY + pad,
  };
}
