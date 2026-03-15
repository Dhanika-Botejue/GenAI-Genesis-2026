import { describe, expect, it } from 'vitest';
import { assignPatientsToFloorplan } from '@/lib/data/patient-assignment';
import { mockFloorplan } from '@/lib/data/mock-floorplan';

describe('assignPatientsToFloorplan', () => {
  it('assigns patients to every care room in the parsed floor plan', () => {
    const { parsedFloorplan, patients } = assignPatientsToFloorplan(structuredClone(mockFloorplan), 'seed-a');
    const careRooms = parsedFloorplan.classifiedRooms.filter((room) => room.type === 'care');

    expect(careRooms.length).toBeGreaterThan(0);
    expect(careRooms.every((room) => room.patientId)).toBe(true);
    expect(patients.filter((patient) => patient.roomId).length).toBe(careRooms.length);
  });
});
