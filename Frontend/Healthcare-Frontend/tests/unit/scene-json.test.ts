import { describe, expect, it } from 'vitest';
import { buildParsedFloorplanFromCandidates } from '@/lib/analysis/scene-json';

describe('buildParsedFloorplanFromCandidates', () => {
  it('creates a degraded floor plate when no room candidates are available', () => {
    const parsed = buildParsedFloorplanFromCandidates({
      analysisMode: 'fallback',
      imageHash: 'test-hash',
      warnings: [],
      roomCandidates: [],
      labels: [],
      ignoredRegions: [],
      wallHints: [],
    });

    expect(parsed.classifiedRooms).toHaveLength(1);
    expect(parsed.classifiedRooms[0]?.name).toBe('Approximate Floor Plate');
  });

  it('classifies room labels using simple care/non-care heuristics', () => {
    const parsed = buildParsedFloorplanFromCandidates({
      analysisMode: 'fallback',
      imageHash: 'test-hash',
      warnings: [],
      roomCandidates: [
        {
          id: 'room-1',
          name: 'Room 101',
          parsedLabel: 'Room 101',
          labelSource: 'generated',
          confidence: 0.7,
          kind: 'rect',
          rect: { x: 0, y: 0, width: 100, height: 80 },
          source: 'fallback',
        },
        {
          id: 'storage-1',
          name: 'Storage',
          parsedLabel: 'Storage',
          labelSource: 'generated',
          confidence: 0.7,
          kind: 'rect',
          rect: { x: 120, y: 0, width: 80, height: 80 },
          source: 'fallback',
        },
      ],
      labels: [],
      ignoredRegions: [],
      wallHints: [],
    });

    expect(parsed.classifiedRooms[0]?.type).toBe('care');
    expect(parsed.classifiedRooms[1]?.type).toBe('nonCare');
  });

  it('does not classify support spaces with the word room as care', () => {
    const parsed = buildParsedFloorplanFromCandidates({
      analysisMode: 'fallback',
      imageHash: 'test-hash',
      warnings: [],
      roomCandidates: [
        {
          id: 'dining-room',
          name: 'Dining Room',
          parsedLabel: 'Dining Room',
          labelSource: 'generated',
          confidence: 0.7,
          kind: 'rect',
          rect: { x: 0, y: 0, width: 100, height: 80 },
          source: 'fallback',
        },
      ],
      labels: [],
      ignoredRegions: [],
      wallHints: [],
    });

    expect(parsed.classifiedRooms[0]?.type).toBe('nonCare');
  });
});
