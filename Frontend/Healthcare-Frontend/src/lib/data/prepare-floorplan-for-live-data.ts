import { mockFloorplan } from '@/lib/data/mock-floorplan';
import { priorityToColor } from '@/lib/scene/priority-colors';
import type { ParsedFloorplan } from '@/types/domain';

export function prepareFloorplanForLiveData(parsedFloorplan: ParsedFloorplan) {
  const safe =
    parsedFloorplan?.classifiedRooms && Array.isArray(parsedFloorplan.classifiedRooms)
      ? parsedFloorplan
      : mockFloorplan;
  const next = structuredClone(safe);

  next.classifiedRooms = next.classifiedRooms.map((room) => {
    if (room.type !== 'care') {
      return {
        ...room,
        patientId: undefined,
      };
    }

    return {
      ...room,
      priority: 'none',
      displayColor: priorityToColor.none,
      occupancyStatus: 'unknown',
      patientId: undefined,
    };
  });

  return next;
}
