import type { ParsedFloorplan } from '@/types/domain';
import type { DoctorPatient } from './types';

function parseRoomNumber(room?: string): number | null {
  if (!room) return null;
  const n = parseInt(room.replace(/\D+/g, ''), 10);
  return isNaN(n) ? null : n;
}

function extractCareRoomNumbers(floorplan: ParsedFloorplan): number[] {
  const numbers: number[] = [];
  for (const room of floorplan?.classifiedRooms ?? []) {
    if (room.type !== 'care') continue;
    const label = (room.parsedLabel ?? room.name ?? '') + '';
    const match = label.match(/(\d+)/);
    if (match) numbers.push(parseInt(match[1], 10));
  }
  return [...new Set(numbers)];
}

export interface RoomAvailability {
  totalCareRooms: number;
  careRoomNumbers: number[];
  occupiedRoomNumbers: Set<number>;
  availableRoomNumbers: number[];
  allOccupied: boolean;
  roomToPatientId: Map<number, string>;
}

/**
 * Computes which care rooms exist, which are occupied, and whether any are available.
 */
export function getRoomAvailability(
  floorplan: ParsedFloorplan,
  patients: DoctorPatient[],
): RoomAvailability {
  const careRoomNumbers = extractCareRoomNumbers(floorplan);
  const roomToPatientId = new Map<number, string>();

  for (const p of patients) {
    const n = parseRoomNumber(p.room);
    if (n !== null) roomToPatientId.set(n, p._id);
  }

  const occupiedRoomNumbers = new Set(roomToPatientId.keys());
  const availableRoomNumbers = careRoomNumbers.filter((n) => !occupiedRoomNumbers.has(n));
  const allOccupied = careRoomNumbers.length > 0 && availableRoomNumbers.length === 0;

  return {
    totalCareRooms: careRoomNumbers.length,
    careRoomNumbers,
    occupiedRoomNumbers,
    availableRoomNumbers,
    allOccupied,
    roomToPatientId,
  };
}

/**
 * Returns true if the room number exists in the floorplan's care rooms.
 */
export function isRealRoomNumber(roomNumber: number, careRoomNumbers: number[]): boolean {
  return careRoomNumbers.includes(roomNumber);
}

/**
 * Returns true if the room is available for the given patient (either vacant or already assigned to this patient).
 */
export function isRoomAvailableForPatient(
  roomNumber: number,
  patientId: string,
  roomToPatientId: Map<number, string>,
): boolean {
  const occupant = roomToPatientId.get(roomNumber);
  return occupant === undefined || occupant === patientId;
}
