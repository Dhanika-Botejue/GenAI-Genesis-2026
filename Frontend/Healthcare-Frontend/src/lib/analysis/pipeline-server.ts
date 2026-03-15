import { buildParsedFloorplanFromCandidates } from '@/lib/analysis/scene-json';
import { GeminiCleanupProvider } from '@/lib/ai/gemini-provider';
import type { AnalysisWarning, RoomCandidate } from '@/types/domain';

interface SidecarResponse {
  warnings: AnalysisWarning[];
  roomCandidates: RoomCandidate[];
  labels: [];
  ignoredRegions: [];
  wallHints: [];
}

export async function runRichAnalysis({
  file,
  imageHash,
  useGemini,
}: {
  file: File;
  imageHash: string;
  useGemini: boolean;
}) {
  const serviceUrl = process.env.ANALYSIS_SERVICE_URL;
  if (!serviceUrl) {
    console.warn('[rich-analysis] ANALYSIS_SERVICE_URL is not configured.');
    return null;
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('imageHash', imageHash);

  let serviceResponse: Response;
  try {
    serviceResponse = await fetch(`${serviceUrl.replace(/\/$/, '')}/v1/analyze-floorplan`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('[rich-analysis] Failed to reach analysis service.', error);
    return null;
  }

  if (!serviceResponse.ok) {
    const details = await serviceResponse.text().catch(() => '');
    console.error(
      `[rich-analysis] Analysis service returned ${serviceResponse.status} ${serviceResponse.statusText}.`,
      details || '(no response body)',
    );
    return null;
  }

  const payload = (await serviceResponse.json()) as SidecarResponse;
  let roomCandidates = payload.roomCandidates;
  const warnings = [...payload.warnings];

  if (useGemini && process.env.GEMINI_API_KEY) {
    try {
      const provider = new GeminiCleanupProvider(process.env.GEMINI_API_KEY);
      const suggestions = await provider.enrich({
        rooms: roomCandidates.map((room) => ({
          id: room.id,
          label: room.parsedLabel || room.name,
        })),
      });

      if (suggestions) {
        const suggestionMap = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));
        roomCandidates = roomCandidates.map((candidate) => {
          const suggestion = suggestionMap.get(candidate.id);
          if (!suggestion) {
            return candidate;
          }

          return {
            ...candidate,
            parsedLabel: suggestion.normalizedLabel,
            confidence: Math.max(candidate.confidence, suggestion.confidence),
          };
        });
      }
    } catch {
      warnings.push({
        id: 'gemini-invalid',
        level: 'warning',
        message: 'Gemini cleanup was unavailable or returned invalid JSON. Heuristic labels were kept.',
        code: 'gemini-invalid',
      });
    }
  }

  return buildParsedFloorplanFromCandidates({
    analysisMode: 'rich',
    imageHash,
    sourceImageInfo: {
      name: file.name,
      mimeType: file.type,
      width: 0,
      height: 0,
      size: file.size,
    },
    warnings,
    roomCandidates,
    labels: payload.labels,
    ignoredRegions: payload.ignoredRegions,
    wallHints: payload.wallHints,
  });
}
