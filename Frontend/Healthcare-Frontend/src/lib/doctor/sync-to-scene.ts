import { mockFloorplan } from '@/lib/data/mock-floorplan';
import { prepareFloorplanForLiveData } from '@/lib/data/prepare-floorplan-for-live-data';
import { formatResidentDisplayId } from '@/lib/data/patient-identity';
import { priorityToColor } from '@/lib/scene/priority-colors';
import type { BodyAnchorId, Condition, ParsedFloorplan, Patient, Priority, Severity } from '@/types/domain';
import type { DoctorPatient } from './types';

// ---------- constants ----------

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#df6e62',
  high: '#e79653',
  medium: '#e8ca57',
  low: '#79c68e',
};

const KEYWORD_TO_AREA: [string, BodyAnchorId][] = [
  ['cardiac', 'heart'],
  ['heart', 'heart'],
  ['atrial', 'heart'],
  ['coronary', 'heart'],
  ['arrhythmia', 'heart'],
  ['lung', 'lungs'],
  ['respiratory', 'lungs'],
  ['copd', 'lungs'],
  ['pulmonary', 'lungs'],
  ['asthma', 'lungs'],
  ['pneumonia', 'lungs'],
  ['stroke', 'head'],
  ['brain', 'head'],
  ['dementia', 'head'],
  ['alzheimer', 'head'],
  ['parkinson', 'head'],
  ['cognitive', 'head'],
  ['neurological', 'head'],
  ['seizure', 'head'],
  ['thyroid', 'head'],
  ['knee', 'rightLeg'],
  ['leg', 'rightLeg'],
  ['hip', 'rightLeg'],
  ['femur', 'rightLeg'],
  ['arm', 'rightArm'],
  ['shoulder', 'rightArm'],
  ['elbow', 'rightArm'],
  ['wrist', 'rightArm'],
  ['liver', 'liver'],
  ['hepatic', 'liver'],
  ['abdomen', 'abdomen'],
  ['gastro', 'abdomen'],
  ['stomach', 'abdomen'],
  ['bowel', 'abdomen'],
  ['colon', 'abdomen'],
  ['kidney', 'abdomen'],
  ['renal', 'abdomen'],
  ['diabetes', 'abdomen'],
  ['back', 'abdomen'],
  ['spine', 'abdomen'],
  ['lumbar', 'abdomen'],
  ['chest', 'chest'],
  ['rib', 'chest'],
];

// ---------- helpers ----------

function guessBodyArea(diagnosis: string): BodyAnchorId {
  const lower = diagnosis.toLowerCase();
  for (const [keyword, area] of KEYWORD_TO_AREA) {
    if (lower.includes(keyword)) return area;
  }
  return 'chest';
}

function calcAge(dob?: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1e3)));
}

function parseRoomNumber(room?: string): number | null {
  if (!room) return null;
  const n = parseInt(room.replace(/\D+/g, ''), 10);
  return isNaN(n) ? null : n;
}

const CRITICAL_KEYWORDS = [
  'stroke', 'heart failure', 'cardiac arrest', 'sepsis', 'pulmonary embolism',
  'congestive heart failure', 'atrial fibrillation', 'seizure', 'aneurysm',
  'respiratory failure', 'renal failure', 'kidney failure',
];
const HIGH_KEYWORDS = [
  'copd', 'parkinson', 'alzheimer', 'dementia', 'diabetes', 'hypertension',
  'chronic kidney', 'cancer', 'tumor', 'fracture', 'pneumonia', 'arrhythmia',
  'coronary', 'dysphagia', 'post-stroke',
];
const LOW_KEYWORDS = [
  'mild', 'minor', 'slight', 'observation', 'stable', 'resolved', 'anxiety',
  'insomnia', 'constipation',
];

function guessSeverity(diagnosis: string): Severity {
  const lower = diagnosis.toLowerCase();
  if (CRITICAL_KEYWORDS.some((kw) => lower.includes(kw))) return 'critical';
  if (HIGH_KEYWORDS.some((kw) => lower.includes(kw))) return 'high';
  if (LOW_KEYWORDS.some((kw) => lower.includes(kw))) return 'low';
  return 'medium';
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

function averagePriority(conditions: Condition[]): Priority {
  if (conditions.length === 0) return 'low';
  const avg = conditions.reduce((sum, c) => sum + SEVERITY_RANK[c.severity], 0) / conditions.length;
  if (avg >= 2.5) return 'critical';
  if (avg >= 1.5) return 'high';
  if (avg >= 0.5) return 'medium';
  return 'low';
}

function buildConditions(p: DoctorPatient): { conditions: Condition[]; topPriority: Priority } {
  const diagnoses = [p.primaryDiagnosis, ...(p.secondaryDiagnoses ?? [])].filter(Boolean) as string[];

  const conditions: Condition[] = diagnoses.map((diag, i) => {
    const severity = guessSeverity(diag);
    return {
      id: `${p._id}-cond-${i}`,
      label: diag,
      bodyArea: guessBodyArea(diag),
      severity,
      color: SEVERITY_COLORS[severity],
      shortDescription: diag,
      detailedNotes: p.notes ?? '',
      monitoring: '',
      recommendedSupport: '',
    };
  });

  if (conditions.length === 0) {
    conditions.push({
      id: `${p._id}-cond-0`,
      label: 'Under observation',
      bodyArea: 'abdomen',
      severity: 'low',
      color: SEVERITY_COLORS.low,
      shortDescription: 'Patient admitted — no diagnosis recorded yet.',
      detailedNotes: p.notes ?? '',
      monitoring: '',
      recommendedSupport: '',
    });
  }

  return { conditions, topPriority: averagePriority(conditions) };
}

// ---------- public ----------

export interface SceneSyncPayload {
  parsedFloorplan: ReturnType<typeof prepareFloorplanForLiveData>;
  patients: Patient[];
  assignedCount: number;
}

/**
 * Converts doctor-page patients into scene-ready state.
 * Rooms are matched by number extracted from the floorplan's parsedLabel ("Room 101" → 101).
 * Returns null when no patients have a room number, so the caller can keep mock data.
 * Uses baseFloorplan when provided (e.g. analyzed layout); otherwise falls back to mockFloorplan.
 */
export function buildSceneFeedFromDoctorPatients(
  doctorPatients: DoctorPatient[],
  baseFloorplan?: ParsedFloorplan,
): SceneSyncPayload | null {
  const withRooms = doctorPatients.filter((p) => parseRoomNumber(p.room) !== null);
  if (withRooms.length === 0) return null;

  // room-number → first patient with that room
  const roomMap = new Map<number, DoctorPatient>();
  for (const p of withRooms) {
    const n = parseRoomNumber(p.room)!;
    if (!roomMap.has(n)) roomMap.set(n, p);
  }

  const floorplan = prepareFloorplanForLiveData(baseFloorplan ?? mockFloorplan);
  const patients: Patient[] = [];
  let assignedCount = 0;

  for (const room of floorplan.classifiedRooms) {
    if (room.type !== 'care') continue;

    const label = (room.parsedLabel ?? room.name ?? '') + '';
    const labelNum = label.match(/(\d+)/)?.[1];
    const roomNum = labelNum ? parseInt(labelNum, 10) : null;
    const doctor = roomNum !== null ? roomMap.get(roomNum) : undefined;

    if (!doctor) {
      room.occupancyStatus = 'vacant';
      room.priority = 'none';
      room.displayColor = priorityToColor.none;
      continue;
    }

    const { conditions, topPriority } = buildConditions(doctor);

    const patient: Patient = {
      id: doctor._id,
      name: formatResidentDisplayId(doctor._id),
      age: calcAge(doctor.dateOfBirth),
      summary:
        [doctor.primaryDiagnosis, doctor.notes].filter(Boolean).join('. ') ||
        `${doctor.firstName} ${doctor.lastName}`,
      roomId: room.id,
      conditions,
    };

    room.priority = topPriority;
    room.displayColor = SEVERITY_COLORS[topPriority] ?? priorityToColor.none;
    room.occupancyStatus = 'occupied';
    room.patientId = patient.id;

    patients.push(patient);
    assignedCount++;
  }

  return { parsedFloorplan: floorplan, patients, assignedCount };
}
