import { describe, expect, it } from 'vitest';
import { extractJsonPayload } from '@/lib/ai/json';

describe('extractJsonPayload', () => {
  it('extracts a fenced json array', () => {
    const raw = '```json\n[{"id":"room-1"}]\n```';

    expect(extractJsonPayload(raw)).toBe('[{"id":"room-1"}]');
  });

  it('extracts the first json payload from surrounding text', () => {
    const raw = 'Here is the result:\n[\n  {"id":"room-1","type":"care"}\n]\nThanks.';

    expect(extractJsonPayload(raw)).toBe('[\n  {"id":"room-1","type":"care"}\n]');
  });
});
