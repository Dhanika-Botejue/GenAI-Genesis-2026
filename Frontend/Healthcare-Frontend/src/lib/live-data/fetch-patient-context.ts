import type { DoctorCallSession, DoctorPatient } from '@/lib/doctor/types';

const FALLBACK_BASE_URL = 'http://127.0.0.1:5000';
const MAX_PATIENTS = 20;
const MAX_SESSIONS_PER_PATIENT = 5;

export interface PatientContext {
  patient: DoctorPatient | null;
  residentId: string;
  sessions: DoctorCallSession[];
}

function getDoctorApiBaseUrl() {
  return (
    process.env.DOCTOR_API_BASE_URL ??
    process.env.NEXT_PUBLIC_DOCTOR_API_BASE_URL ??
    FALLBACK_BASE_URL
  );
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function getResidentId(session: DoctorCallSession): string {
  return session.resident_id ?? session.patient_id ?? '';
}

function isCompleted(session: DoctorCallSession): boolean {
  return session.status === 'completed' || session.call_status === 'completed';
}

export async function fetchPatientContexts(): Promise<PatientContext[]> {
  const baseUrl = getDoctorApiBaseUrl().replace(/\/+$/, '');

  const patients = (await fetchJson<DoctorPatient[]>(`${baseUrl}/api/patients`)) ?? [];

  const sessionsByResident = new Map<string, DoctorCallSession[]>();
  const patientByResident = new Map<string, DoctorPatient>();

  for (const patient of patients.slice(0, MAX_PATIENTS)) {
    patientByResident.set(patient._id, patient);

    const history =
      (await fetchJson<DoctorCallSession[]>(`${baseUrl}/api/patients/${patient._id}/history`)) ?? [];

    for (const session of history) {
      if (!isCompleted(session)) continue;
      const rid = getResidentId(session) || patient._id;
      const existing = sessionsByResident.get(rid) ?? [];
      existing.push(session);
      sessionsByResident.set(rid, existing);
    }
  }

  const contexts: PatientContext[] = [];

  for (const [residentId, sessions] of sessionsByResident) {
    const sorted = sessions
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, MAX_SESSIONS_PER_PATIENT);

    contexts.push({
      patient: patientByResident.get(residentId) ?? null,
      residentId,
      sessions: sorted,
    });
  }

  return contexts;
}
