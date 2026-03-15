import { buildMockPatientPool } from '@/lib/data/mock-patients';
import { getPatientDisplayId } from '@/lib/data/patient-identity';
import type { ParsedFloorplan, Patient, Priority, Severity } from '@/types/domain';

const priorityOrder: Record<Severity, Priority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  critical: 'critical',
};

function hashSeed(seed: string) {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (value * 31 + seed.charCodeAt(index)) % 1_000_003;
  }
  return value;
}

export function assignPatientsToFloorplan(parsedFloorplan: ParsedFloorplan, seed = 'default') {
  const basePatients = buildMockPatientPool(20);
  const careRooms = parsedFloorplan.classifiedRooms.filter((room) => room.type === 'care');
  const seedOffset = hashSeed(seed) % Math.max(basePatients.length, 1);
  const rotatedPatients = Array.from({ length: basePatients.length }, (_, index) => basePatients[(index + seedOffset) % basePatients.length]);
  const extraCount = Math.max(0, careRooms.length - rotatedPatients.length);
  const extraPatients = Array.from({ length: extraCount }, (_, index) => {
    const template = buildMockPatientPool(1)[0];
    return {
      ...template,
      id: `generated-patient-${index + 1}`,
      name: getPatientDisplayId({ id: `generated-patient-${index + 1}` }),
      age: 80 + (index % 8),
      summary: `Anonymous patient record under active elderly-care monitoring with ${template.conditions.length} tracked condition${template.conditions.length > 1 ? 's' : ''}.`,
    };
  });

  const patients: Patient[] = [...rotatedPatients, ...extraPatients].map((patient) => ({ ...patient, roomId: undefined }));

  careRooms.forEach((room, index) => {
    const patient = patients[index];
    if (!patient) {
      return;
    }

    patient.roomId = room.id;
    room.patientId = patient.id;
    room.occupancyStatus = 'occupied';
    room.priority = getRoomPriority(patient);
  });

  return {
    parsedFloorplan,
    patients,
  };
}

function getRoomPriority(patient: Patient): Priority {
  const highest = patient.conditions.reduce<Severity>(
    (current, condition) => {
      const order = ['low', 'medium', 'high', 'critical'];
      return order.indexOf(condition.severity) > order.indexOf(current) ? condition.severity : current;
    },
    'low',
  );

  return priorityOrder[highest];
}
