import { NextResponse } from 'next/server';
import { extractJsonPayload } from '@/lib/ai/json';

export const runtime = 'nodejs';

interface ConditionGuidanceRequest {
  label?: string;
  bodyArea?: string;
  severity?: string;
  shortDescription?: string;
  detailedNotes?: string;
  patientSummary?: string;
}

interface ConditionGuidanceResponse {
  ok: boolean;
  monitoring: string;
  recommendedSupport: string;
}

function buildPrompt(input: ConditionGuidanceRequest) {
  return `You are helping populate a clinical UI card for a hospital demo.

Return ONLY JSON with this exact shape:
{
  "monitoring": "<1-2 concise sentences>",
  "recommendedSupport": "<1-2 concise sentences>"
}

Rules:
- Keep language practical, professional, and concise.
- Do not diagnose. Use "potential" framing where appropriate.
- Focus on bedside monitoring and supportive care actions.
- No markdown. No extra keys.

Condition label: ${input.label ?? ''}
Body area: ${input.bodyArea ?? ''}
Severity: ${input.severity ?? ''}
Summary: ${input.shortDescription ?? ''}
Care notes: ${input.detailedNotes ?? ''}
Patient summary: ${input.patientSummary ?? ''}`;
}

function buildFallbackGuidance(input: ConditionGuidanceRequest) {
  const area = (input.bodyArea ?? 'condition').toLowerCase();
  const severity = (input.severity ?? 'medium').toLowerCase();

  if (area === 'lungs') {
    return {
      monitoring:
        severity === 'high' || severity === 'critical'
          ? 'Monitor respiratory effort, oxygen saturation trends, and any increase in shortness of breath.'
          : 'Track breathing comfort, respiratory rate, and any change in exertional tolerance.',
      recommendedSupport:
        'Encourage upright positioning, paced breathing, and reduce exertion-heavy tasks during care rounds.',
    };
  }

  if (area === 'head') {
    return {
      monitoring:
        'Track reported pain level, note any worsening sensitivity or dizziness, and reassess symptom changes regularly.',
      recommendedSupport:
        'Keep the environment calm, support hydration, and provide low-stimulation comfort measures as tolerated.',
    };
  }

  return {
    monitoring:
      'Monitor symptom progression, comfort level, and any change in severity during routine bedside checks.',
    recommendedSupport:
      'Use supportive positioning, paced activity, and comfort-focused care based on the current symptom pattern.',
  };
}

async function generateGuidance(input: ConditionGuidanceRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallbackGuidance(input);
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    return buildFallbackGuidance(input);
  }

  const json = await response.json();
  const rawText: string | undefined = json.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('');

  if (!rawText) {
    return buildFallbackGuidance(input);
  }

  try {
    const parsed = JSON.parse(extractJsonPayload(rawText)) as Partial<ConditionGuidanceResponse>;
    return {
      monitoring: String(parsed.monitoring ?? '').trim() || buildFallbackGuidance(input).monitoring,
      recommendedSupport:
        String(parsed.recommendedSupport ?? '').trim() || buildFallbackGuidance(input).recommendedSupport,
    };
  } catch {
    return buildFallbackGuidance(input);
  }
}

export async function POST(request: Request) {
  let body: ConditionGuidanceRequest;

  try {
    body = (await request.json()) as ConditionGuidanceRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        monitoring: '',
        recommendedSupport: '',
      } satisfies ConditionGuidanceResponse,
      { status: 400 },
    );
  }

  const guidance = await generateGuidance(body);

  return NextResponse.json({
    ok: true,
    monitoring: guidance.monitoring,
    recommendedSupport: guidance.recommendedSupport,
  } satisfies ConditionGuidanceResponse);
}
