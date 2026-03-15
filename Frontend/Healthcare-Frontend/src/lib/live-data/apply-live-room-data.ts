import { getPatientDisplayId } from '@/lib/data/patient-identity';
import { mockFloorplan } from '@/lib/data/mock-floorplan';
import { priorityToColor } from '@/lib/scene/priority-colors';
import type { Condition, ParsedFloorplan, Patient, Priority, RoomRecord, RoomType, Severity } from '@/types/domain';
import type {
  LiveAvailableRoomEntry,
  LiveAvailableRoomPayload,
  LiveConditionPayload,
  LivePatientPayload,
  LiveRoomFeedRequest,
  LiveRoomPayload,
} from '@/types/live-data';

const priorityValues: Priority[] = ['none', 'low', 'medium', 'high', 'critical'];
const roomTypeValues: RoomType[] = ['care', 'nonCare', 'unknown'];
const occupancyValues = ['occupied', 'vacant', 'observation', 'unknown'] as const;
const severityValues: Severity[] = ['low', 'medium', 'high', 'critical'];
const bodyAreaValues = ['head', 'chest', 'heart', 'lungs', 'liver', 'abdomen', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'] as const;

type BodyAreaValue = (typeof bodyAreaValues)[number];
type NormalizedLiveRoomPayload = Required<
  Pick<LiveRoomPayload, 'roomName' | 'roomLabel' | 'parsedLabel' | 'priority' | 'occupancyStatus' | 'confidence' | 'displayColor'>
> &
  Pick<LiveRoomPayload, 'roomNumber' | 'roomExternalId' | 'roomType' | 'patient'>;
type NormalizedLiveAvailableRoomPayload = Required<
  Pick<LiveAvailableRoomPayload, 'roomName' | 'roomLabel' | 'parsedLabel' | 'confidence' | 'displayColor'>
> &
  Pick<LiveAvailableRoomPayload, 'roomNumber' | 'roomExternalId' | 'roomType'>;

export interface ApplyLiveRoomDataResult {
  parsedFloorplan: ParsedFloorplan;
  patients: Patient[];
  assignedRoomIds: string[];
  unassignedRoomIds: string[];
  availableRooms: LiveAvailableRoomPayload[];
  availableRoomIds: string[];
}

export function applyLiveRoomFeed(request: LiveRoomFeedRequest): ApplyLiveRoomDataResult {
  const baseFloorplan = structuredClone(request.baseFloorplan ?? mockFloorplan);
  const normalizedRooms = Array.isArray(request.rooms) ? request.rooms.map(normalizeLiveRoomPayload) : [];
  const normalizedAvailableRooms = getNormalizedAvailableRooms(request, normalizedRooms);
  const slotCandidates = getSlotCandidates(baseFloorplan.classifiedRooms);
  const patients: Patient[] = [];
  const assignedRoomIds: string[] = [];
  const availableRoomIds: string[] = [];

  resetRoomAssignments(baseFloorplan.classifiedRooms);

  normalizedRooms.slice(0, slotCandidates.length).forEach((payload, index) => {
    const targetRoom = slotCandidates[index];
    if (!targetRoom) {
      return;
    }

    const patient = normalizePatientPayload(payload.patient, index);
    const derivedPriority = payload.priority;
    const resolvedRoomType = payload.roomType ?? 'care';

    targetRoom.name = payload.roomName || payload.roomLabel || '';
    targetRoom.parsedLabel = payload.parsedLabel || payload.roomLabel || payload.roomName || '';
    targetRoom.type = resolvedRoomType;
    targetRoom.priority = derivedPriority;
    targetRoom.displayColor = payload.displayColor || (derivedPriority === 'none' ? priorityToColor.none : undefined);
    targetRoom.occupancyStatus = payload.occupancyStatus;
    targetRoom.confidence = payload.confidence;
    targetRoom.patientId = patient.id;

    patient.roomId = targetRoom.id;
    patients.push(patient);
    assignedRoomIds.push(targetRoom.id);
  });

  const remainingSlotCandidates = slotCandidates.slice(assignedRoomIds.length);
  normalizedAvailableRooms.slice(0, remainingSlotCandidates.length).forEach((payload, index) => {
    const targetRoom = remainingSlotCandidates[index];
    if (!targetRoom) {
      return;
    }

    targetRoom.name = payload.roomName || payload.roomLabel || '';
    targetRoom.parsedLabel = payload.parsedLabel || payload.roomLabel || payload.roomName || '';
    targetRoom.type = payload.roomType ?? 'care';
    targetRoom.priority = 'none';
    targetRoom.displayColor = payload.displayColor || priorityToColor.none;
    targetRoom.occupancyStatus = 'vacant';
    targetRoom.confidence = payload.confidence;
    targetRoom.patientId = undefined;

    availableRoomIds.push(targetRoom.id);
  });

  const stillUnassignedCandidates = remainingSlotCandidates.slice(availableRoomIds.length);
  const unassignedRoomIds = stillUnassignedCandidates.map((room) => room.id);
  markUnassignedRooms(stillUnassignedCandidates);

  return {
    parsedFloorplan: baseFloorplan,
    patients,
    assignedRoomIds,
    unassignedRoomIds,
    availableRooms: normalizedAvailableRooms,
    availableRoomIds,
  };
}

export function getNextAvailableRoom(request: Pick<LiveRoomFeedRequest, 'rooms' | 'availableRooms'>): number | null {
  const normalizedRooms = Array.isArray(request.rooms) ? request.rooms.map(normalizeLiveRoomPayload) : [];
  const [nextAvailableRoom] = getNormalizedAvailableRooms(request, normalizedRooms);

  return nextAvailableRoom?.roomNumber ?? null;
}

function getSlotCandidates(rooms: RoomRecord[]) {
  const careRooms = rooms.filter((room) => room.visual.kind === 'rect' && room.type === 'care');
  const fallbackRooms = rooms.filter((room) => room.visual.kind === 'rect' && room.type !== 'care');

  return [...careRooms, ...fallbackRooms];
}

function resetRoomAssignments(rooms: RoomRecord[]) {
  rooms.forEach((room) => {
    room.patientId = undefined;
    if (room.type === 'care') {
      room.priority = 'none';
      room.displayColor = priorityToColor.none;
      room.occupancyStatus = 'unknown';
    }
  });
}

function markUnassignedRooms(rooms: RoomRecord[]) {
  rooms.forEach((room) => {
    room.patientId = undefined;
    room.priority = 'none';
    room.displayColor = priorityToColor.none;
    room.occupancyStatus = 'unknown';
  });
}

function normalizeLiveRoomPayload(payload: LiveRoomPayload): NormalizedLiveRoomPayload {
  const roomNumber = normalizeRoomNumber(payload.roomNumber);
  const roomLabel = normalizeString(payload.roomLabel) || formatRoomLabel(roomNumber);
  const roomName = normalizeString(payload.roomName) || formatRoomName(roomNumber);
  const parsedLabel = normalizeString(payload.parsedLabel) || roomName || roomLabel;
  return {
    roomNumber,
    roomExternalId: normalizeString(payload.roomExternalId),
    roomName,
    roomLabel,
    parsedLabel,
    roomType: normalizeRoomType(payload.roomType),
    priority: normalizePriority(payload.priority),
    occupancyStatus: normalizeOccupancy(payload.occupancyStatus),
    confidence: normalizeConfidence(payload.confidence),
    displayColor: normalizeString(payload.displayColor),
    patient: payload.patient ?? null,
  };
}

function normalizeLiveAvailableRoomPayload(
  payload: LiveAvailableRoomEntry,
): NormalizedLiveAvailableRoomPayload {
  const source = typeof payload === 'number' ? { roomNumber: payload } : payload;
  const roomNumber = normalizeRoomNumber(source.roomNumber);
  const roomLabel = normalizeString(source.roomLabel) || formatRoomLabel(roomNumber);
  const roomName = normalizeString(source.roomName) || formatRoomName(roomNumber);
  const parsedLabel = normalizeString(source.parsedLabel) || roomName || roomLabel;
  return {
    roomNumber,
    roomExternalId: normalizeString(source.roomExternalId),
    roomName,
    roomLabel,
    parsedLabel,
    roomType: normalizeRoomType(source.roomType),
    confidence: normalizeConfidence(source.confidence),
    displayColor: normalizeString(source.displayColor),
  };
}

function normalizePatientPayload(payload: LivePatientPayload | null | undefined, index: number): Patient {
  const fallbackId = `live-patient-${index + 1}`;
  const id = normalizeString(payload?.id) || fallbackId;
  const displayId = normalizeString(payload?.displayId) || getPatientDisplayId({ id });
  const conditions = Array.isArray(payload?.conditions)
    ? payload!.conditions.map((condition, conditionIndex) => normalizeConditionPayload(condition, id, conditionIndex))
    : [];

  return {
    id,
    name: displayId,
    age: Number.isFinite(payload?.age) ? Math.max(0, Math.round(Number(payload?.age))) : 0,
    summary: normalizeString(payload?.summary),
    roomId: undefined,
    conditions,
  };
}

function normalizeConditionPayload(payload: LiveConditionPayload, patientId: string, index: number): Condition {
  const severity = normalizeSeverity(payload.severity);
  return {
    id: normalizeString(payload.id) || `${patientId}-condition-${index + 1}`,
    label: normalizeString(payload.label),
    bodyArea: normalizeBodyArea(payload.bodyArea),
    severity,
    color: normalizeColor(payload.color, priorityToColor.none),
    shortDescription: normalizeString(payload.shortDescription),
    detailedNotes: normalizeString(payload.detailedNotes),
    monitoring: normalizeString(payload.monitoring),
    recommendedSupport: normalizeString(payload.recommendedSupport),
  };
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeRoomNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
}

function normalizePriority(value: unknown): Priority {
  return priorityValues.includes(value as Priority) ? (value as Priority) : 'none';
}

function normalizeRoomType(value: unknown): RoomType {
  return roomTypeValues.includes(value as RoomType) ? (value as RoomType) : 'care';
}

function normalizeOccupancy(value: unknown): RoomRecord['occupancyStatus'] {
  return occupancyValues.includes(value as RoomRecord['occupancyStatus']) ? (value as RoomRecord['occupancyStatus']) : 'unknown';
}

function normalizeSeverity(value: unknown): Severity {
  return severityValues.includes(value as Severity) ? (value as Severity) : 'low';
}

function normalizeBodyArea(value: unknown): BodyAreaValue {
  return bodyAreaValues.includes(value as BodyAreaValue) ? (value as BodyAreaValue) : 'abdomen';
}

function normalizeConfidence(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

function normalizeColor(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function filterAvailableRooms(
  availableRooms: NormalizedLiveAvailableRoomPayload[],
  occupiedRooms: NormalizedLiveRoomPayload[],
) {
  const occupiedTokenSet = new Set(occupiedRooms.flatMap((room) => getRoomTokens(room)));
  return availableRooms.filter((room) => {
    const tokens = getRoomTokens(room);
    return tokens.length === 0 || !tokens.some((token) => occupiedTokenSet.has(token));
  });
}

function getNormalizedAvailableRooms(
  request: Pick<LiveRoomFeedRequest, 'rooms' | 'availableRooms'>,
  normalizedRooms: NormalizedLiveRoomPayload[],
) {
  const normalizedAvailableRooms = Array.isArray(request.availableRooms)
    ? request.availableRooms.map(normalizeLiveAvailableRoomPayload)
    : [];

  return sortAvailableRooms(filterAvailableRooms(normalizedAvailableRooms, normalizedRooms));
}

function sortAvailableRooms(availableRooms: NormalizedLiveAvailableRoomPayload[]) {
  return [...availableRooms].sort((left, right) => {
    if (left.roomNumber !== undefined && right.roomNumber !== undefined && left.roomNumber !== right.roomNumber) {
      return left.roomNumber - right.roomNumber;
    }

    if (left.roomNumber !== undefined) {
      return -1;
    }

    if (right.roomNumber !== undefined) {
      return 1;
    }

    return getRoomSortValue(left).localeCompare(getRoomSortValue(right));
  });
}

function getRoomTokens(room: Pick<LiveAvailableRoomPayload, 'roomNumber' | 'roomExternalId' | 'roomName' | 'roomLabel' | 'parsedLabel'>) {
  return Array.from(
    new Set(
      [room.roomNumber, room.roomExternalId, room.roomName, room.roomLabel, room.parsedLabel]
        .map((value) => normalizeRoomToken(value))
        .filter((value) => value.length > 0),
    ),
  );
}

function normalizeRoomToken(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.max(0, Math.round(value)));
  }
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function formatRoomLabel(roomNumber: number | undefined) {
  return roomNumber === undefined ? '' : String(roomNumber);
}

function formatRoomName(roomNumber: number | undefined) {
  return roomNumber === undefined ? '' : `Room ${roomNumber}`;
}

function getRoomSortValue(room: Pick<LiveAvailableRoomPayload, 'roomExternalId' | 'roomName' | 'roomLabel' | 'parsedLabel'>) {
  return room.parsedLabel || room.roomLabel || room.roomName || room.roomExternalId || '';
}
