'use client';

import { useMemo } from 'react';
import { RoomMesh } from '@/components/hospital/room-mesh';
import { priorityToColor } from '@/lib/scene/priority-colors';
import { useAppStore } from '@/store/useAppStore';

export function HospitalScene() {
  const parsedFloorplan = useAppStore((state) => state.parsedFloorplan);
  const patients = useAppStore((state) => state.patients);
  const debug = useAppStore((state) => state.debug);

  const patientMap = useMemo(() => new Map(patients.map((patient) => [patient.id, patient])), [patients]);
  const bounds = parsedFloorplan?.bounds ?? { minX: 0, minY: 0, maxX: 16, maxY: 12 };
  const rooms = parsedFloorplan?.classifiedRooms ?? [];

  const floorFrame = useMemo(() => {
    const width = Math.max(8, bounds.maxX - bounds.minX);
    const depth = Math.max(8, bounds.maxY - bounds.minY);
    const centerX = bounds.minX + width / 2;
    const centerZ = bounds.minY + depth / 2;

    return {
      centerX,
      centerZ,
      outerWidth: width + 3.2,
      outerDepth: depth + 3.2,
      innerWidth: width + 1.2,
      innerDepth: depth + 1.2,
    };
  }, [bounds.maxX, bounds.minX, bounds.maxY, bounds.minY]);

  return (
    <group>
      <mesh position={[floorFrame.centerX, -0.09, floorFrame.centerZ]}>
        <boxGeometry args={[floorFrame.outerWidth, 0.12, floorFrame.outerDepth]} />
        <meshStandardMaterial color="#f7fbfb" />
      </mesh>

      <mesh position={[floorFrame.centerX, -0.02, floorFrame.centerZ]}>
        <boxGeometry args={[floorFrame.innerWidth, 0.01, floorFrame.innerDepth]} />
        <meshStandardMaterial color="#eef3f5" transparent opacity={0.85} />
      </mesh>

      {rooms.map((room) => (
        <RoomMesh key={room.id} room={room} patient={room.patientId ? patientMap.get(room.patientId) : undefined} />
      ))}

      {debug.showAnalysis
        ? rooms
            .filter((room) => room.visual.kind === 'rect' && room.type === 'care')
            .map((room) => {
              if (room.visual.kind !== 'rect') {
                return null;
              }

              return (
                <mesh
                  key={`${room.id}-outline`}
                  position={[room.visual.rect.x, room.visual.rect.height + 0.02, room.visual.rect.z]}
                >
                  <boxGeometry args={[room.visual.rect.width + 0.06, 0.02, room.visual.rect.depth + 0.06]} />
                  <meshStandardMaterial color={priorityToColor[room.priority]} transparent opacity={0.18} />
                </mesh>
              );
            })
        : null}
    </group>
  );
}
