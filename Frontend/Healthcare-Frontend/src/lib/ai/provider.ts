export interface GeminiRoomSuggestion {
  id: string;
  normalizedLabel: string;
  type: 'care' | 'nonCare' | 'unknown';
  confidence: number;
}

export interface SemanticCleanupProvider {
  enrich(input: {
    rooms: Array<{ id: string; label: string }>;
  }): Promise<GeminiRoomSuggestion[] | null>;
}
