import type { ParsedFloorplan } from '@/types/domain';
import type { Patient } from '@/types/domain';
import type { LiveAvailableRoomPayload, LiveRoomFeedTemplate } from '@/types/live-data';

export interface AnalyzeApiSuccess {
  ok: true;
  mode: 'rich';
  parsedFloorplan: ParsedFloorplan;
}

export interface AnalyzeApiFallback {
  ok: false;
  mode: 'fallback-required';
  reason: string;
}

export interface AnalyzeApiDeprecated {
  ok: false;
  mode: 'deprecated';
  reason: string;
}

export interface AnalyzeApiError {
  ok: false;
  mode: 'error';
  reason: string;
}

export type AnalyzeApiResponse = AnalyzeApiSuccess | AnalyzeApiFallback | AnalyzeApiDeprecated | AnalyzeApiError;

export interface LiveRoomDataApiSuccess {
  ok: true;
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  assignedRoomIds: string[];
  unassignedRoomIds: string[];
  availableRooms: LiveAvailableRoomPayload[];
  availableRoomIds: string[];
}

export interface LiveRoomDataApiTemplate {
  ok: true;
  template: LiveRoomFeedTemplate;
}

export interface LiveRoomDataApiError {
  ok: false;
  reason: string;
}

export type LiveRoomDataApiResponse = LiveRoomDataApiSuccess | LiveRoomDataApiError;
export type LiveRoomDataTemplateApiResponse = LiveRoomDataApiTemplate;
