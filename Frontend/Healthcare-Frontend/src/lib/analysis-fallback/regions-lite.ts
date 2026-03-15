import type { PreprocessedImage } from '@/lib/analysis/types';
import type { Rect2D, RoomCandidate } from '@/types/domain';

const OCCUPIED = 255;

export function buildHeuristicRoomCandidates({
  preprocessed,
  contentBounds,
}: {
  preprocessed: PreprocessedImage;
  contentBounds: Rect2D;
}): {
  roomCandidates: RoomCandidate[];
  ignoredRegions: Array<{ id: string; reason: string; bounds: Rect2D }>;
} {
  const legendBand = detectLegendBand(preprocessed, contentBounds);
  const effectiveBounds = {
    x: contentBounds.x,
    y: contentBounds.y,
    width: Math.max(60, contentBounds.width - legendBand.width),
    height: contentBounds.height,
  };

  const padX = Math.max(8, effectiveBounds.width * 0.028);
  const padY = Math.max(8, effectiveBounds.height * 0.03);
  const topBand = rect(
    effectiveBounds.x + padX,
    effectiveBounds.y + padY,
    effectiveBounds.width - padX * 2,
    effectiveBounds.height * 0.23,
  );
  const bottomBand = rect(
    effectiveBounds.x + padX,
    effectiveBounds.y + effectiveBounds.height * 0.7,
    effectiveBounds.width - padX * 2,
    effectiveBounds.height * 0.22,
  );
  const leftBand = rect(
    effectiveBounds.x + padX * 0.4,
    effectiveBounds.y + effectiveBounds.height * 0.2,
    effectiveBounds.width * 0.19,
    effectiveBounds.height * 0.52,
  );
  const rightBand = rect(
    effectiveBounds.x + effectiveBounds.width * 0.75,
    effectiveBounds.y + effectiveBounds.height * 0.28,
    effectiveBounds.width * 0.17,
    effectiveBounds.height * 0.34,
  );

  const topCount = clamp(estimateColumnSegments(preprocessed, topBand, 0.14), 2, 6);
  const bottomCount = clamp(estimateColumnSegments(preprocessed, bottomBand, 0.14), 2, 6);
  const leftCount = clamp(estimateRowSegments(preprocessed, leftBand, 0.14), 1, 4);
  const serviceCount = clamp(estimateRowSegments(preprocessed, rightBand, 0.12), 2, 5);

  const topRange = getOccupiedRangeX(preprocessed, topBand) ?? { min: topBand.x, max: topBand.x + topBand.width };
  const bottomRange = getOccupiedRangeX(preprocessed, bottomBand) ?? {
    min: bottomBand.x + bottomBand.width * 0.34,
    max: bottomBand.x + bottomBand.width,
  };
  const leftRange = getOccupiedRangeY(preprocessed, leftBand) ?? { min: leftBand.y, max: leftBand.y + leftBand.height };
  const serviceRange = getOccupiedRangeY(preprocessed, rightBand) ?? { min: rightBand.y, max: rightBand.y + rightBand.height };

  const rightServiceWidth = Math.max(effectiveBounds.width * 0.14, 44);
  const commonX = effectiveBounds.x + Math.max(effectiveBounds.width * 0.18, leftBand.width + padX * 1.1);
  const commonRight = effectiveBounds.x + effectiveBounds.width - rightServiceWidth - padX * 1.1;
  const commonY = effectiveBounds.y + effectiveBounds.height * 0.27;
  const commonBottom = effectiveBounds.y + effectiveBounds.height * 0.68;
  const commonRect = rect(commonX, commonY, Math.max(90, commonRight - commonX), Math.max(90, commonBottom - commonY));

  const roomCandidates: RoomCandidate[] = [
    createRect('common-area', 'Common Area', commonRect),
    createRect(
      'dining-room',
      'Dining Room',
      rect(
        commonRect.x + commonRect.width * 0.3,
        commonRect.y + commonRect.height * 0.16,
        commonRect.width * 0.18,
        commonRect.height * 0.25,
      ),
    ),
    createRect(
      'kitchen',
      'Kitchen',
      rect(
        commonRect.x + commonRect.width * 0.65,
        commonRect.y + commonRect.height * 0.18,
        commonRect.width * 0.18,
        commonRect.height * 0.22,
      ),
    ),
  ];

  roomCandidates.push(
    ...buildHorizontalBandRooms({
      prefix: 'resident-top',
      labelStart: 101,
      band: topBand,
      occupiedRange: topRange,
      count: topCount,
      y: topBand.y + topBand.height * 0.1,
      height: topBand.height * 0.72,
    }),
  );

  roomCandidates.push(
    ...buildVerticalBandRooms({
      prefix: 'resident-left',
      labelStart: 201,
      band: leftBand,
      occupiedRange: leftRange,
      count: leftCount,
      x: leftBand.x,
      width: leftBand.width * 0.92,
    }),
  );

  roomCandidates.push(
    ...buildHorizontalBandRooms({
      prefix: 'resident-bottom',
      labelStart: 301,
      band: bottomBand,
      occupiedRange: bottomRange,
      count: bottomCount,
      y: bottomBand.y + bottomBand.height * 0.08,
      height: bottomBand.height * 0.72,
    }),
  );

  roomCandidates.push(
    ...buildVerticalServices({
      band: rightBand,
      occupiedRange: serviceRange,
      count: serviceCount,
      width: rightServiceWidth,
    }),
  );

  return {
    roomCandidates,
    ignoredRegions: legendBand.width > 0
      ? [
          {
            id: 'legend-band',
            reason: 'Legend or title block',
            bounds: legendBand,
          },
        ]
      : [],
  };
}

function buildHorizontalBandRooms({
  prefix,
  labelStart,
  band,
  occupiedRange,
  count,
  y,
  height,
}: {
  prefix: string;
  labelStart: number;
  band: Rect2D;
  occupiedRange: { min: number; max: number };
  count: number;
  y: number;
  height: number;
}) {
  const totalWidth = Math.max(60, occupiedRange.max - occupiedRange.min);
  const gap = Math.max(8, totalWidth * 0.03);
  const roomWidth = Math.max(34, (totalWidth - gap * (count - 1)) / count);

  return Array.from({ length: count }, (_, index) =>
    createRect(
      `${prefix}-${index + 1}`,
      `Room ${labelStart + index}`,
      rect(occupiedRange.min + index * (roomWidth + gap), y, roomWidth, height),
    ),
  );
}

function buildVerticalBandRooms({
  prefix,
  labelStart,
  band,
  occupiedRange,
  count,
  x,
  width,
}: {
  prefix: string;
  labelStart: number;
  band: Rect2D;
  occupiedRange: { min: number; max: number };
  count: number;
  x: number;
  width: number;
}) {
  const totalHeight = Math.max(60, occupiedRange.max - occupiedRange.min);
  const gap = Math.max(8, totalHeight * 0.04);
  const roomHeight = Math.max(38, (totalHeight - gap * (count - 1)) / count);

  return Array.from({ length: count }, (_, index) =>
    createRect(
      `${prefix}-${index + 1}`,
      `Room ${labelStart + index}`,
      rect(x, occupiedRange.min + index * (roomHeight + gap), width, roomHeight),
    ),
  );
}

function buildVerticalServices({
  band,
  occupiedRange,
  count,
  width,
}: {
  band: Rect2D;
  occupiedRange: { min: number; max: number };
  count: number;
  width: number;
}) {
  const labels = ['Storage', 'Utility', 'Mechanical', 'Pantry', 'Office'];
  const totalHeight = Math.max(50, occupiedRange.max - occupiedRange.min);
  const gap = Math.max(7, totalHeight * 0.04);
  const roomHeight = Math.max(26, (totalHeight - gap * (count - 1)) / count);

  return Array.from({ length: count }, (_, index) =>
    createRect(
      `service-${index + 1}`,
      labels[index] ?? `Service ${index + 1}`,
      rect(band.x + band.width * 0.08, occupiedRange.min + index * (roomHeight + gap), width, roomHeight),
    ),
  );
}

function detectLegendBand(preprocessed: PreprocessedImage, bounds: Rect2D): Rect2D {
  const candidateWidth = Math.round(bounds.width * 0.2);
  if (candidateWidth < 70) {
    return rect(bounds.x + bounds.width, bounds.y, 0, 0);
  }

  const strip = rect(bounds.x + bounds.width - candidateWidth, bounds.y, candidateWidth, bounds.height);
  const fullDensity = getDensity(preprocessed, bounds);
  const stripDensity = getDensity(preprocessed, strip);
  const separator = getLowestDensityColumn(preprocessed, rect(bounds.x + bounds.width - candidateWidth * 1.4, bounds.y, candidateWidth * 0.5, bounds.height));

  if (stripDensity < fullDensity * 0.72 && separator !== null) {
    return rect(separator, bounds.y, bounds.x + bounds.width - separator, bounds.height);
  }

  return rect(bounds.x + bounds.width, bounds.y, 0, 0);
}

function estimateColumnSegments(preprocessed: PreprocessedImage, band: Rect2D, threshold: number) {
  const densities = smooth(buildColumnDensities(preprocessed, band), 5);
  return countSegments(densities, threshold, 3);
}

function estimateRowSegments(preprocessed: PreprocessedImage, band: Rect2D, threshold: number) {
  const densities = smooth(buildRowDensities(preprocessed, band), 5);
  return countSegments(densities, threshold, 3);
}

function buildColumnDensities(preprocessed: PreprocessedImage, band: Rect2D) {
  const densities: number[] = [];
  for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
    let occupied = 0;
    let total = 0;
    for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
      total += 1;
      if (preprocessed.thresholded[y * preprocessed.width + x] === OCCUPIED) {
        occupied += 1;
      }
    }
    densities.push(occupied / Math.max(total, 1));
  }
  return densities;
}

function buildRowDensities(preprocessed: PreprocessedImage, band: Rect2D) {
  const densities: number[] = [];
  for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
    let occupied = 0;
    let total = 0;
    for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
      total += 1;
      if (preprocessed.thresholded[y * preprocessed.width + x] === OCCUPIED) {
        occupied += 1;
      }
    }
    densities.push(occupied / Math.max(total, 1));
  }
  return densities;
}

function getOccupiedRangeX(preprocessed: PreprocessedImage, band: Rect2D) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
    for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
      if (preprocessed.thresholded[y * preprocessed.width + x] !== OCCUPIED) {
        continue;
      }
      min = Math.min(min, x);
      max = Math.max(max, x);
      break;
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

function getOccupiedRangeY(preprocessed: PreprocessedImage, band: Rect2D) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
      if (preprocessed.thresholded[y * preprocessed.width + x] !== OCCUPIED) {
        continue;
      }
      min = Math.min(min, y);
      max = Math.max(max, y);
      break;
    }
  }

  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

function getDensity(preprocessed: PreprocessedImage, band: Rect2D) {
  let occupied = 0;
  let total = 0;

  for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
    for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
      total += 1;
      if (preprocessed.thresholded[y * preprocessed.width + x] === OCCUPIED) {
        occupied += 1;
      }
    }
  }

  return occupied / Math.max(total, 1);
}

function getLowestDensityColumn(preprocessed: PreprocessedImage, band: Rect2D) {
  let lowestDensity = Number.POSITIVE_INFINITY;
  let lowestColumn: number | null = null;

  for (let x = Math.max(0, Math.floor(band.x)); x < Math.min(preprocessed.width, Math.ceil(band.x + band.width)); x += 1) {
    let occupied = 0;
    let total = 0;
    for (let y = Math.max(0, Math.floor(band.y)); y < Math.min(preprocessed.height, Math.ceil(band.y + band.height)); y += 1) {
      total += 1;
      if (preprocessed.thresholded[y * preprocessed.width + x] === OCCUPIED) {
        occupied += 1;
      }
    }

    const density = occupied / Math.max(total, 1);
    if (density < lowestDensity) {
      lowestDensity = density;
      lowestColumn = x;
    }
  }

  return lowestDensity < 0.08 ? lowestColumn : null;
}

function countSegments(values: number[], threshold: number, minLength: number) {
  let count = 0;
  let runLength = 0;

  values.forEach((value) => {
    if (value >= threshold) {
      runLength += 1;
      return;
    }

    if (runLength >= minLength) {
      count += 1;
    }
    runLength = 0;
  });

  if (runLength >= minLength) {
    count += 1;
  }

  return count;
}

function smooth(values: number[], radius: number) {
  return values.map((_, index) => {
    let total = 0;
    let samples = 0;
    for (let offset = -radius; offset <= radius; offset += 1) {
      const next = values[index + offset];
      if (next === undefined) {
        continue;
      }
      total += next;
      samples += 1;
    }
    return total / Math.max(samples, 1);
  });
}

function createRect(id: string, name: string, nextRect: Rect2D): RoomCandidate {
  return {
    id,
    name,
    parsedLabel: name,
    labelSource: 'heuristic',
    confidence: name.startsWith('Room') ? 0.72 : 0.78,
    kind: 'rect',
    rect: nextRect,
    source: 'fallback',
  };
}

function rect(x: number, y: number, width: number, height: number): Rect2D {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
