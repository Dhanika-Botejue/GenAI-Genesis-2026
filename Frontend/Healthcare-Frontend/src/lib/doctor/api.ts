import type {
  CreateDoctorPatientInput,
  DoctorCallSession,
  DoctorPatient,
  StartDoctorCallInput,
  StartDoctorCallResponse,
} from '@/lib/doctor/types';

const doctorApiPrefix = '/api/doctor';

async function requestDoctorApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${doctorApiPrefix}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : typeof payload === 'object' && payload !== null && 'detail' in payload
          ? String(payload.detail)
        : `Doctor API request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return payload as T;
}

export function fetchDoctorPatients() {
  return requestDoctorApi<DoctorPatient[]>('/api/patients');
}

export function fetchDoctorPatient(patientId: string) {
  return requestDoctorApi<DoctorPatient>(`/api/patients/${patientId}`);
}

export function createDoctorPatient(input: CreateDoctorPatientInput) {
  return requestDoctorApi<DoctorPatient>('/api/patients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDoctorPatient(patientId: string, input: Partial<DoctorPatient>) {
  return requestDoctorApi<DoctorPatient>(`/api/patients/${patientId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteDoctorPatient(patientId: string) {
  return requestDoctorApi<{ message: string }>(`/api/patients/${patientId}`, {
    method: 'DELETE',
  });
}

export function fetchDoctorPatientHistory(patientId: string) {
  return requestDoctorApi<DoctorCallSession[]>(`/api/patients/${patientId}/history`);
}

export function startDoctorCall(input: StartDoctorCallInput) {
  return requestDoctorApi<StartDoctorCallResponse>('/api/call', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchDoctorSession(sessionId: string) {
  return requestDoctorApi<DoctorCallSession>(`/api/sessions/${sessionId}`);
}
