import type { BodyAnchorId, OccupancyStatus, ParsedFloorplan, Priority, RoomType, Severity } from '@/types/domain';

export interface LiveConditionPayload {
  id?: string;
  label?: string;
  bodyArea?: BodyAnchorId;
  severity?: Severity;
  color?: string;
  shortDescription?: string;
  detailedNotes?: string;
  monitoring?: string;
  recommendedSupport?: string;
}

export interface LivePatientPayload {
  id?: string;
  displayId?: string;
  age?: number;
  summary?: string;
  conditions?: LiveConditionPayload[];
}

export interface LiveAvailableRoomPayload {
  roomNumber?: number;
  roomExternalId?: string;
  roomName?: string;
  roomLabel?: string;
  parsedLabel?: string;
  roomType?: RoomType;
  confidence?: number;
  displayColor?: string;
}

export interface LiveRoomPayload {
  roomNumber?: number;
  roomExternalId?: string;
  roomName?: string;
  roomLabel?: string;
  parsedLabel?: string;
  roomType?: RoomType;
  priority?: Priority;
  occupancyStatus?: OccupancyStatus;
  confidence?: number;
  displayColor?: string;
  patient?: LivePatientPayload | null;
}

export type LiveAvailableRoomEntry = number | LiveAvailableRoomPayload;

export interface LiveRoomFeedRequest {
  rooms: LiveRoomPayload[];
  availableRooms?: LiveAvailableRoomEntry[];
  baseFloorplan?: ParsedFloorplan;
  generateFromPatients?: boolean;
  /** Maps patient id → room number for patients already placed on the scene. */
  existingAssignments?: Record<string, number>;
}

export interface LiveRoomFeedTemplate {
  templateVersion: string;
  defaults: {
    missingStrings: '';
    missingRoomPriority: Priority;
    missingRoomColor: string;
    missingRoomType: RoomType;
    missingOccupancyStatus: OccupancyStatus;
    missingConditionSeverity: Severity;
    missingConditionColor: string;
    missingConditionBodyArea: BodyAnchorId;
  };
  options: {
    priority: Priority[];
    roomType: RoomType[];
    occupancyStatus: OccupancyStatus[];
    severity: Severity[];
    bodyArea: BodyAnchorId[];
  };
  rooms: LiveRoomPayload[];
  availableRooms: LiveAvailableRoomEntry[];
}
