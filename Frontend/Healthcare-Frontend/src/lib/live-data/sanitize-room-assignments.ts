import { priorityToColor } from '@/lib/scene/priority-colors';
import type { ParsedFloorplan, Patient } from '@/types/domain';

/**
 * Ensures at most one patient per room. If duplicate assignments are detected
 * (two patients in the same room, or one patient in multiple rooms), keeps the
 * first assignment and clears the rest.
 */
export function sanitizeRoomAssignments(payload: {
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  assignedCount: number;
}): { parsedFloorplan: ParsedFloorplan; patients: Patient[]; assignedCount: number } {
  const { parsedFloorplan, patients } = payload;
  const roomToPatient = new Map<string, string>();
  const patientToRoom = new Map<string, string>();

  // Resolve floorplan: one patient per room, one room per patient
  for (const room of parsedFloorplan.classifiedRooms) {
    if (room.type !== 'care' || !room.patientId) continue;
    const pid = room.patientId;
    const existingRoom = patientToRoom.get(pid);
    if (existingRoom) {
      room.patientId = undefined;
      room.occupancyStatus = 'vacant';
      room.priority = 'none';
      room.displayColor = priorityToColor.none;
    } else {
      roomToPatient.set(room.id, pid);
      patientToRoom.set(pid, room.id);
    }
  }

  // Resolve patients: no two patients in the same room
  for (const patient of patients) {
    const roomId = patient.roomId;
    if (!roomId) continue;
    const occupant = roomToPatient.get(roomId);
    if (occupant && occupant !== patient.id) {
      patient.roomId = undefined;
    } else if (!occupant) {
      roomToPatient.set(roomId, patient.id);
      patientToRoom.set(patient.id, roomId);
    }
  }

  const assignedCount = roomToPatient.size;
  return {
    parsedFloorplan,
    patients,
    assignedCount: assignedCount > 0 ? assignedCount : payload.assignedCount,
  };
}
