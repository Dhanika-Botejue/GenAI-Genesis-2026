import { z } from 'zod';
import type { GeminiRoomSuggestion, SemanticCleanupProvider } from '@/lib/ai/provider';
import { extractJsonPayload } from '@/lib/ai/json';

const suggestionSchema = z.array(
  z.object({
    id: z.string(),
    normalizedLabel: z.string(),
    type: z.enum(['care', 'nonCare', 'unknown']),
    confidence: z.number().min(0).max(1),
  }),
);

export class GeminiCleanupProvider implements SemanticCleanupProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
  ) {}

  async enrich(input: { rooms: Array<{ id: string; label: string }> }): Promise<GeminiRoomSuggestion[] | null> {
    if (!this.apiKey || input.rooms.length === 0) {
      return null;
    }

    const prompt = [
      'You classify elderly-care floor-plan room labels.',
      'Return JSON only.',
      'Do not invent geometry.',
      'For each room id, normalize the label and classify as care, nonCare, or unknown.',
      'Return exactly one JSON array of objects with keys: id, normalizedLabel, type, confidence.',
      JSON.stringify(input.rooms),
    ].join('\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const rawText = json.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('\n');
    if (!rawText) {
      return null;
    }

    const parsed = JSON.parse(extractJsonPayload(rawText));
    return suggestionSchema.parse(normalizeSuggestions(parsed));
  }
}

function normalizeSuggestions(input: unknown): GeminiRoomSuggestion[] {
  const candidates = Array.isArray(input)
    ? input
    : input && typeof input === 'object'
      ? Array.isArray((input as { suggestions?: unknown }).suggestions)
        ? ((input as { suggestions: unknown[] }).suggestions ?? [])
        : Array.isArray((input as { rooms?: unknown }).rooms)
          ? ((input as { rooms: unknown[] }).rooms ?? [])
          : []
      : [];

  return candidates
    .map((candidate) => normalizeSuggestion(candidate))
    .filter((candidate): candidate is GeminiRoomSuggestion => candidate !== null);
}

function normalizeSuggestion(input: unknown): GeminiRoomSuggestion | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? candidate.id : null;
  const normalizedLabel =
    typeof candidate.normalizedLabel === 'string'
      ? candidate.normalizedLabel
      : typeof candidate.label === 'string'
        ? candidate.label
        : typeof candidate.name === 'string'
          ? candidate.name
          : null;

  if (!id || !normalizedLabel) {
    return null;
  }

  return {
    id,
    normalizedLabel,
    type: normalizeType(candidate.type),
    confidence: normalizeConfidence(candidate.confidence),
  };
}

function normalizeType(input: unknown): GeminiRoomSuggestion['type'] {
  const value = typeof input === 'string' ? input.toLowerCase().replace(/[^a-z]/g, '') : '';

  if (['care', 'patient', 'resident', 'bedroom'].includes(value)) {
    return 'care';
  }

  if (['noncare', 'support', 'service', 'common', 'utility', 'staff'].includes(value)) {
    return 'nonCare';
  }

  return 'unknown';
}

function normalizeConfidence(input: unknown) {
  const numeric = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
  if (!Number.isFinite(numeric)) {
    return 0.55;
  }

  return Math.max(0, Math.min(1, numeric));
}
