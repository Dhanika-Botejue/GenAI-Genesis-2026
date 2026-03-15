import type { Patient } from '@/types/domain';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_24_PATTERN = /^[0-9a-f]{24}$/i;

export function formatResidentDisplayId(residentId: string) {
  const stripped = residentId.replace(/-/g, '');
  return `PT-${stripped.slice(0, 4)}`;
}

export function getPatientDisplayId(patient: Pick<Patient, 'id'>) {
  if (UUID_PATTERN.test(patient.id) || HEX_24_PATTERN.test(patient.id)) {
    return formatResidentDisplayId(patient.id);
  }

  const numericSuffix = patient.id.match(/(\d+)$/)?.[1];

  if (numericSuffix) {
    return `Patient ID ${numericSuffix.padStart(3, '0')}`;
  }

  return `Patient ID ${patient.id.replace(/[^a-zA-Z0-9]+/g, '-').toUpperCase()}`;
}
