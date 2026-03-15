'use client';

import { useAppStore } from '@/store/useAppStore';
import type { ParsedFloorplan, Patient } from '@/types/domain';
import type { LiveRoomDataApiResponse, LiveRoomDataTemplateApiResponse } from '@/types/api';
import type { LiveAvailableRoomPayload, LiveRoomFeedRequest } from '@/types/live-data';

export async function fetchLiveRoomFeedTemplate() {
  const response = await fetch('/api/live-room-data', {
    method: 'GET',
  });

  const payload = (await response.json()) as LiveRoomDataTemplateApiResponse;
  return payload.template;
}

export async function applyLiveRoomFeedFromClient(request: LiveRoomFeedRequest): Promise<{
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  assignedRoomIds: string[];
  unassignedRoomIds: string[];
  availableRooms: LiveAvailableRoomPayload[];
  availableRoomIds: string[];
}> {
  const response = await fetch('/api/live-room-data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as LiveRoomDataApiResponse;
  if (!payload.ok) {
    throw new Error(payload.reason || 'Unable to apply live room data.');
  }

  return {
    parsedFloorplan: payload.parsedFloorplan,
    patients: payload.patients,
    assignedRoomIds: payload.assignedRoomIds,
    unassignedRoomIds: payload.unassignedRoomIds,
    availableRooms: payload.availableRooms,
    availableRoomIds: payload.availableRoomIds,
  };
}

export async function syncLiveRoomFeedToStore(request: LiveRoomFeedRequest) {
  const baseFloorplan = request.baseFloorplan ?? useAppStore.getState().parsedFloorplan;
  const result = await applyLiveRoomFeedFromClient({
    ...request,
    baseFloorplan,
  });
  useAppStore.getState().applyLiveRoomData({
    parsedFloorplan: result.parsedFloorplan,
    patients: result.patients,
    assignedCount: result.assignedRoomIds.length,
  });
  return result;
}
