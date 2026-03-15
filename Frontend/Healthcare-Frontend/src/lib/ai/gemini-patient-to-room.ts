import { z } from 'zod';
import { extractJsonPayload } from '@/lib/ai/json';
import { formatResidentDisplayId } from '@/lib/data/patient-identity';
import type { PatientContext } from '@/lib/live-data/fetch-patient-context';
import type { LiveRoomPayload } from '@/types/live-data';

const MAX_TRANSCRIPT_LENGTH = 2000;

const conditionSchema = z.object({
  id: z.string(),
  label: z.string(),
  bodyArea: z.string(),
  severity: z.string(),
  color: z.string(),
  shortDescription: z.string(),
  detailedNotes: z.string(),
  monitoring: z.string(),
  recommendedSupport: z.string(),
}).passthrough();

const patientSchema = z.object({
  id: z.string(),
  displayId: z.string(),
  age: z.number(),
  summary: z.string(),
  conditions: z.array(conditionSchema),
}).passthrough();

const roomSchema = z.object({
  roomNumber: z.number().nullable(),
  roomType: z.string(),
  priority: z.string(),
  occupancyStatus: z.string(),
  confidence: z.number(),
  displayColor: z.string(),
  patient: patientSchema,
}).passthrough();

const responseSchema = z.array(roomSchema);

function buildPatientBlock(ctx: PatientContext): string {
  const lines: string[] = [];
  const displayId = formatResidentDisplayId(ctx.residentId);

  lines.push(`--- PATIENT: ${displayId} (full id: ${ctx.residentId}) ---`);

  if (ctx.patient) {
    const p = ctx.patient;
    const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unknown';
    lines.push(`Name: ${name}`);
    if (p.dateOfBirth) lines.push(`Date of Birth: ${p.dateOfBirth}`);
    if (p.primaryDiagnosis) lines.push(`Primary Diagnosis: ${p.primaryDiagnosis}`);
    if (p.secondaryDiagnoses?.length) lines.push(`Secondary Diagnoses: ${p.secondaryDiagnoses.join(', ')}`);
    if (p.allergies?.length) lines.push(`Allergies: ${p.allergies.join(', ')}`);
    if (p.medications?.length) lines.push(`Medications: ${p.medications.join(', ')}`);
    if (p.notes) lines.push(`Notes: ${p.notes}`);
  } else {
    lines.push('Demographics: not available');
  }

  for (const session of ctx.sessions) {
    lines.push('');
    lines.push(`Call session (${session.created_at}):`);

    if (session.answers?.length) {
      for (const a of session.answers) {
        lines.push(`  Q: ${a.question}`);
        lines.push(`  A: ${a.answer}`);
      }
    }

    if (session.history?.length) {
      for (const h of session.history) {
        if (h.classification?.type && h.classification.type !== 'normal') {
          lines.push(`  [Classification: ${h.classification.type}] Q: ${h.question}`);
        }
      }
    }

    if (session.raw_transcript) {
      const truncated = session.raw_transcript.length > MAX_TRANSCRIPT_LENGTH
        ? session.raw_transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '...(truncated)'
        : session.raw_transcript;
      lines.push(`  Full transcript: ${truncated}`);
    }
  }

  return lines.join('\n');
}

function buildMasterPrompt(contexts: PatientContext[]): string {
  const patientBlocks = contexts.map(buildPatientBlock).join('\n\n');

  return `You are a hospital triage system that converts patient call transcripts into structured room data JSON.

TASK:
Analyze the patient data below and produce a JSON array of room objects for each patient.

RULES:

1. OUTPUT FORMAT: Return ONLY a JSON array. No markdown fences, no explanation, no commentary. Each element is a room object.

2. ROOM OBJECT SHAPE (follow exactly):
{
  "roomNumber": null,
  "roomType": "care",
  "priority": "<priority>",
  "occupancyStatus": "occupied",
  "confidence": 1,
  "displayColor": "<priority color>",
  "patient": {
    "id": "<full resident_id>",
    "displayId": "PT-<first 4 characters of resident_id, ignoring dashes>",
    "age": <number or 0 if unknown>,
    "summary": "<comprehensive summary of ALL patient information>",
    "conditions": [<only body-area-specific conditions>]
  }
}

3. CONDITION OBJECT SHAPE (for each physical symptom with a body location):
{
  "id": "<displayId>-<bodyArea>-<n>",
  "label": "<short clinical label>",
  "bodyArea": "<one of the allowed values>",
  "severity": "<severity>",
  "color": "<severity color>",
  "shortDescription": "<brief description using 'potential' framing>",
  "detailedNotes": "<clinical support notes, never diagnose>",
  "monitoring": "<suggested monitoring approach>",
  "recommendedSupport": "<recommended care actions>"
}

4. CONDITIONS vs SUMMARY:
   - The "conditions" array is ONLY for symptoms that map to a SPECIFIC BODY AREA on a 3D human model. These create visual anchors.
   - The "summary" field should mention EVERYTHING about the patient: allergies, medications, emotional state, general concerns — even things with no body anchor.
   - Non-body-area information (allergies, medications, lifestyle) must NOT create condition entries but CAN influence room priority.

5. ALLOWED BODY AREAS — HARD REQUIREMENT:
   You MUST ONLY use one of these EXACT 9 values for bodyArea. No other values are permitted:
   "head", "heart", "lungs", "liver", "abdomen", "leftArm", "rightArm", "leftLeg", "rightLeg"

   Do NOT use "chest" — it is not a valid body area. Map chest-related symptoms to "heart", "lungs", or "abdomen" depending on the symptom.

   If the patient describes a body part that is NOT in this list, you MUST map it to the CLOSEST match. Examples:
   - "right knee", "right ankle", "right foot", "right toe", "right hip" -> "rightLeg"
   - "left knee", "left ankle", "left foot", "left toe", "left hip" -> "leftLeg"
   - "right shoulder", "right elbow", "right wrist", "right hand", "right finger" -> "rightArm"
   - "left shoulder", "left elbow", "left wrist", "left hand", "left finger" -> "leftArm"
   - "upper back", "spine", "ribs", "chest wall" -> "lungs"
   - "lower back", "stomach", "belly", "lower abdomen", "groin", "pelvis", "waist" -> "abdomen"
   - "neck", "face", "jaw", "ear", "eye", "throat", "temple", "forehead" -> "head"
   - "heart", "palpitations", "chest tightness", "cardiac", "chest pain" -> "heart"
   - "breathing", "cough", "shortness of breath", "wheeze", "chest congestion" -> "lungs"
   - "side pain", "flank" -> "abdomen"
   Do NOT invent body area values like "chest", "lowerBack", "back", "knee", "foot", etc. They will be rejected.

6. PRIORITY VALUES: "none", "low", "medium", "high", "critical"
   Priority is determined by ALL patient information (conditions + allergies + medications + context):
   - Pain rated 8-10 or multiple serious conditions -> "high" or "critical"
   - Pain rated 5-7 or moderate concerns -> "medium"
   - Pain rated 1-4 or mild concerns -> "low"
   - No concerns at all -> "none"
   - Severe allergies or dangerous medication interactions can raise priority even without body conditions.

7. SEVERITY VALUES for conditions: "low", "medium", "high", "critical"

8. COLOR MAPPING (use exactly these hex values):
   Priority colors: none="#c9d3da", low="#79c68e", medium="#e8ca57", high="#e79653", critical="#df6e62"
   Severity colors: low="#79c68e", medium="#e8ca57", high="#e79653", critical="#df6e62"
   The room "displayColor" must match the room "priority" color.
   Each condition "color" must match its "severity" color.

9. DESCRIPTION LANGUAGE: Always use "potential" framing. Never diagnose with a specific condition.
   Good: "Potential acute joint discomfort in right knee area"
   Bad: "Arthritis in right knee"

10. MISSING DATA: If age cannot be determined, use 0. If a patient has no Q&A data, set priority to "low", summary to "No assessment data available.", and conditions to an empty array.

11. Set roomNumber to null for every entry. Room assignment is handled server-side.

PATIENT DATA:

${patientBlocks}

Return the JSON array now.`;
}

async function callGemini(prompt: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini API returned ${response.status}: ${text.slice(0, 200)}`);
  }

  const json = await response.json();
  const rawText: string | undefined = json.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? '')
    .join('');

  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(extractJsonPayload(rawText));
}

function unwrapRoomsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.rooms)) return obj.rooms;
  }
  return [];
}

export async function generateRoomsFromPatients(
  contexts: PatientContext[],
): Promise<LiveRoomPayload[]> {
  if (contexts.length === 0) return [];

  const prompt = buildMasterPrompt(contexts);
  const raw = await callGemini(prompt);
  const rooms = unwrapRoomsArray(raw);
  const validated = responseSchema.parse(rooms);

  return validated as unknown as LiveRoomPayload[];
}
