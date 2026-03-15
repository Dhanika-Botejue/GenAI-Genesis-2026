import { NextResponse } from 'next/server';
import { applyLiveRoomFeed, getNextAvailableRoom } from '@/lib/live-data/apply-live-room-data';
import { liveRoomFeedTemplate } from '@/lib/live-data/template';
import { fetchPatientContexts } from '@/lib/live-data/fetch-patient-context';
import { generateRoomsFromPatients } from '@/lib/ai/gemini-patient-to-room';
import type { LiveAvailableRoomEntry, LiveRoomFeedRequest, LiveRoomPayload } from '@/types/live-data';
import type { LiveRoomDataApiError, LiveRoomDataApiResponse, LiveRoomDataTemplateApiResponse } from '@/types/api';

export const runtime = 'nodejs';

const PRIORITY_ORDER = ['critical', 'high', 'medium', 'low', 'none'] as const;

function priorityRank(priority: string | undefined): number {
  const idx = PRIORITY_ORDER.indexOf(priority as (typeof PRIORITY_ORDER)[number]);
  return idx === -1 ? PRIORITY_ORDER.length : idx;
}

function assignRoomsFromAvailablePool(
  rooms: LiveRoomPayload[],
  availableRooms: LiveAvailableRoomEntry[],
  existingAssignments?: Record<string, number>,
): { assigned: LiveRoomPayload[]; remainingAvailable: LiveAvailableRoomEntry[] } {
  const sorted = [...rooms].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const assigned: LiveRoomPayload[] = [];
  const occupiedSoFar: LiveRoomPayload[] = [];

  const occupiedRoomNumbers = new Set(
    existingAssignments ? Object.values(existingAssignments) : [],
  );
  let pool = [...availableRooms].filter((entry) => {
    const num = typeof entry === 'number' ? entry : entry.roomNumber;
    return num === undefined || !occupiedRoomNumbers.has(num);
  });

  for (const room of sorted) {
    const patientId = room.patient?.id;
    const existingRoom = patientId && existingAssignments?.[patientId];

    if (typeof existingRoom === 'number') {
      assigned.push({ ...room, roomNumber: existingRoom });
      occupiedSoFar.push({ ...room, roomNumber: existingRoom });
      continue;
    }

    const nextRoom = getNextAvailableRoom({ rooms: occupiedSoFar, availableRooms: pool });
    if (nextRoom === null) break;

    const withRoom: LiveRoomPayload = { ...room, roomNumber: nextRoom };
    assigned.push(withRoom);
    occupiedSoFar.push(withRoom);

    pool = pool.filter((entry) => {
      const num = typeof entry === 'number' ? entry : entry.roomNumber;
      return num !== nextRoom;
    });
  }

  return { assigned, remainingAvailable: pool };
}

export async function GET() {
  const payload: LiveRoomDataTemplateApiResponse = {
    ok: true,
    template: liveRoomFeedTemplate,
  };

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  let body: LiveRoomFeedRequest;

  try {
    body = (await request.json()) as LiveRoomFeedRequest;
  } catch {
    const payload: LiveRoomDataApiError = {
      ok: false,
      reason: 'Invalid JSON payload.',
    };
    return NextResponse.json(payload, { status: 400 });
  }

  if (body.generateFromPatients) {
    return handleGenerateFromPatients(body);
  }

  if (!Array.isArray(body.rooms)) {
    const payload: LiveRoomDataApiError = {
      ok: false,
      reason: 'Expected a rooms array in the request body.',
    };
    return NextResponse.json(payload, { status: 400 });
  }

  const result = applyLiveRoomFeed(body);
  const payload: LiveRoomDataApiResponse = {
    ok: true,
    parsedFloorplan: result.parsedFloorplan,
    patients: result.patients,
    assignedRoomIds: result.assignedRoomIds,
    unassignedRoomIds: result.unassignedRoomIds,
    availableRooms: result.availableRooms,
    availableRoomIds: result.availableRoomIds,
  };

  return NextResponse.json(payload);
}

async function handleGenerateFromPatients(body: LiveRoomFeedRequest) {
  if (!process.env.GEMINI_API_KEY) {
    const payload: LiveRoomDataApiError = {
      ok: false,
      reason: 'Gemini API key is not configured. Set the GEMINI_API_KEY environment variable.',
    };
    return NextResponse.json(payload, { status: 503 });
  }

  const inputAvailableRooms = body.availableRooms ?? [];

  let contexts;
  try {
    contexts = await fetchPatientContexts();
  } catch (error) {
    console.error('Failed to fetch patient contexts:', error);
    const payload: LiveRoomDataApiError = {
      ok: false,
      reason: 'Doctor backend unavailable. Could not fetch patient data.',
    };
    return NextResponse.json(payload, { status: 502 });
  }

  if (contexts.length === 0) {
    const result = applyLiveRoomFeed({
      rooms: [],
      availableRooms: inputAvailableRooms,
      baseFloorplan: body.baseFloorplan,
    });
    const payload: LiveRoomDataApiResponse = {
      ok: true,
      parsedFloorplan: result.parsedFloorplan,
      patients: result.patients,
      assignedRoomIds: result.assignedRoomIds,
      unassignedRoomIds: result.unassignedRoomIds,
      availableRooms: result.availableRooms,
      availableRoomIds: result.availableRoomIds,
    };
    return NextResponse.json(payload);
  }

  let geminiRooms: LiveRoomPayload[];
  try {
    geminiRooms = await generateRoomsFromPatients(contexts);
  } catch (error) {
    console.error('Gemini room generation failed:', error);
    const payload: LiveRoomDataApiError = {
      ok: false,
      reason: `Gemini processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
    return NextResponse.json(payload, { status: 502 });
  }

  const { assigned, remainingAvailable } = assignRoomsFromAvailablePool(
    geminiRooms,
    inputAvailableRooms,
    body.existingAssignments,
  );

  const feedRequest: LiveRoomFeedRequest = {
    rooms: assigned,
    availableRooms: remainingAvailable,
    baseFloorplan: body.baseFloorplan,
  };

  const result = applyLiveRoomFeed(feedRequest);
  const payload: LiveRoomDataApiResponse = {
    ok: true,
    parsedFloorplan: result.parsedFloorplan,
    patients: result.patients,
    assignedRoomIds: result.assignedRoomIds,
    unassignedRoomIds: result.unassignedRoomIds,
    availableRooms: result.availableRooms,
    availableRoomIds: result.availableRoomIds,
  };

  return NextResponse.json(payload);
}
