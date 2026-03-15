import { buildSceneFeedFromDoctorPatients } from '@/lib/doctor/sync-to-scene';
import { fetchDoctorPatients } from '@/lib/doctor/api';
import { useAppStore } from '@/store/useAppStore';
import type { LiveRoomDataApiResponse } from '@/types/api';
import type { ParsedFloorplan, Patient } from '@/types/domain';

const ALL_CARE_ROOMS = [101, 102, 103, 104, 105, 106];

export interface RefreshSceneResult {
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  assignedCount: number;
}

/**
 * Calls the Gemini-powered /api/live-room-data endpoint to generate room data
 * from real backend patient call sessions. Preserves existing room assignments.
 */
export async function refreshSceneViaGemini(
  currentFloorplan: ParsedFloorplan,
): Promise<RefreshSceneResult | null> {
  const existingAssignments: Record<string, number> = {};
  for (const room of currentFloorplan.classifiedRooms) {
    if (room.patientId && room.type === 'care') {
      const labelNum = room.parsedLabel?.match(/(\d+)/)?.[1];
      if (labelNum) existingAssignments[room.patientId] = parseInt(labelNum, 10);
    }
  }

  const res = await fetch('/api/live-room-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      generateFromPatients: true,
      availableRooms: ALL_CARE_ROOMS,
      existingAssignments,
    }),
  });

  if (!res.ok) {
    console.warn('[refresh-scene] Gemini API returned', res.status);
    return null;
  }

  const data = (await res.json()) as LiveRoomDataApiResponse;
  if (!data.ok) {
    console.warn('[refresh-scene] Gemini API error:', (data as { reason?: string }).reason);
    return null;
  }

  return {
    parsedFloorplan: data.parsedFloorplan,
    patients: data.patients,
    assignedCount: data.patients.length,
  };
}

/**
 * Fetches patients directly from the doctor backend and maps them to scene
 * data using the keyword-based mapper. No Gemini needed — fast fallback.
 */
export async function refreshSceneFromPatients(): Promise<RefreshSceneResult | null> {
  try {
    const patients = await fetchDoctorPatients();
    if (!patients || !Array.isArray(patients) || patients.length === 0) return null;
    const currentFloorplan = useAppStore.getState().parsedFloorplan;
    return buildSceneFeedFromDoctorPatients(patients, currentFloorplan);
  } catch {
    return null;
  }
}
