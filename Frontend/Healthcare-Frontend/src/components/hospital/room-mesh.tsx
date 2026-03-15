'use client';

import { RoundedBox } from '@react-three/drei';
import { useMemo, useState } from 'react';
import { Color } from 'three';
import type { Patient, RoomRecord } from '@/types/domain';
import { priorityToColor, roomFillByType } from '@/lib/scene/priority-colors';
import { useAppStore } from '@/store/useAppStore';
import { RoomLabel } from '@/components/hospital/room-label';

export function RoomMesh({ room, patient }: { room: RoomRecord; patient?: Patient }) {
  const [hovered, setHovered] = useState(false);
  const enterPatientMode = useAppStore((state) => state.enterPatientMode);

  if (room.visual.kind !== 'rect') {
    return null;
  }

  const { x, y, z, width, depth, height } = room.visual.rect;
  const baseColor = room.displayColor ?? (room.type === 'care' ? priorityToColor[room.priority] : roomFillByType[room.type]);
  const wallColor = useMemo(() => new Color(baseColor).lerp(new Color('#ffffff'), 0.34).getStyle(), [baseColor]);
  const interactive = room.type === 'care' && !!room.patientId;
  const accentOpacity = interactive ? 0.62 : 0.28;
  const wallOpacity = hovered ? 0.94 : interactive ? 0.88 : 0.82;
  const labelSize = Math.max(0.22, Math.min(width, depth) * 0.11);

  return (
    <group
      position={[x, y, z]}
      onClick={(event) => {
        event.stopPropagation();
        if (!interactive || !patient) {
          return;
        }
        enterPatientMode(room.id, patient.id);
      }}
      onPointerOver={(event) => {
        if (!interactive) {
          return;
        }
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh receiveShadow position={[0, 0, 0]} renderOrder={1}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={hovered ? Math.min(accentOpacity + 0.08, 0.82) : accentOpacity}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <Walls width={width} depth={depth} color={wallColor} opacity={wallOpacity} />
      <RoomContents room={room} />

      {room.name.trim().length > 0 && width > 1.1 && depth > 0.9 ? (
        <RoomLabel label={room.name} position={[0, height + 0.05, 0]} fontSize={labelSize} />
      ) : null}
    </group>
  );
}

function Walls({
  width,
  depth,
  color,
  opacity,
}: {
  width: number;
  depth: number;
  color: string;
  opacity: number;
}) {
  return (
    <>
      <mesh position={[0, 0.42, -depth / 2]}>
        <boxGeometry args={[width, 0.84, 0.08]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[-width / 2, 0.42, 0]}>
        <boxGeometry args={[0.08, 0.84, depth]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[width / 2, 0.42, 0]}>
        <boxGeometry args={[0.08, 0.84, depth]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.42, depth / 2]}>
        <boxGeometry args={[Math.max(width * 0.6, 0.4), 0.84, 0.08]} />
        <meshStandardMaterial color={color} transparent opacity={opacity} />
      </mesh>
    </>
  );
}

function RoomContents({ room }: { room: RoomRecord }) {
  if (room.visual.kind !== 'rect') {
    return null;
  }

  const { width, depth, height } = room.visual.rect;

  if (room.type === 'care') {
    return (
      <group position={[0, height / 2, 0]}>
        <RoundedBox args={[Math.min(1.1, width * 0.42), 0.16, Math.min(1.9, depth * 0.58)]} position={[-width * 0.16, 0.16, -depth * 0.1]} radius={0.04}>
          <meshStandardMaterial color="#f6fafc" />
        </RoundedBox>
        <RoundedBox args={[Math.min(0.52, width * 0.2), 0.08, Math.min(0.42, depth * 0.16)]} position={[-width * 0.16, 0.28, -depth * 0.58]} radius={0.03}>
          <meshStandardMaterial color="#ffffff" />
        </RoundedBox>
        <RoundedBox args={[0.34, 0.38, 0.34]} position={[width * 0.26, 0.19, depth * 0.16]} radius={0.05}>
          <meshStandardMaterial color="#d8e2ea" />
        </RoundedBox>
      </group>
    );
  }

  return (
    <group position={[0, height / 2, 0]}>
      <RoundedBox args={[Math.min(width * 0.38, 1.3), 0.14, Math.min(depth * 0.24, 0.9)]} position={[0, 0.18, 0]} radius={0.05}>
        <meshStandardMaterial color="#e8edf1" />
      </RoundedBox>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.42, 18]} />
        <meshStandardMaterial color="#d2dce4" />
      </mesh>
    </group>
  );
}
