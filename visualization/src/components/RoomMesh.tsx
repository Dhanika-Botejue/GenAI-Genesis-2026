import { Html, RoundedBox } from '@react-three/drei';
import { startTransition, useState } from 'react';
import type { RoomRecord } from '../data/hospitalData';
import { priorityMeta } from '../data/hospitalData';
import { useHospitalStore } from '../store/useHospitalStore';
import { PatientModel } from './PatientModel';

interface RoomMeshProps {
  room: RoomRecord;
  isSelected: boolean;
}

export function RoomMesh({ room, isSelected }: RoomMeshProps) {
  const [hovered, setHovered] = useState(false);
  const selectRoom = useHospitalStore((state) => state.selectRoom);
  const selectedCondition = useHospitalStore((state) => state.selectedCondition);
  const selectCondition = useHospitalStore((state) => state.selectCondition);

  const [width, depth] = room.scene.size;
  const meta = priorityMeta[room.priorityColor];
  const roomScale = isSelected ? 1.015 : hovered ? 1.01 : 1;
  const floorOpacity = isSelected ? 0.48 : hovered ? 0.38 : 0.28;
  const wallOpacity = isSelected ? 0.35 : hovered ? 0.28 : 0.18;
  const labelPosition: [number, number, number] = isSelected
    ? [0, 1.62, -depth / 2 + 0.35]
    : [0, 1.55, 0];

  return (
    <group
      position={[room.scene.position[0], 0, room.scene.position[1]]}
      scale={[roomScale, 1, roomScale]}
      onClick={(event) => {
        event.stopPropagation();
        startTransition(() => selectRoom(room.id));
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial
          color={meta.fill}
          emissive={meta.fill}
          emissiveIntensity={isSelected ? 0.2 : hovered ? 0.1 : 0.04}
          transparent
          opacity={floorOpacity}
        />
      </mesh>

      <Walls depth={depth} meta={meta} wallOpacity={wallOpacity} width={width} />

      {isSelected ? (
        <>
          <RoomInterior room={room} />
          <pointLight color={meta.fill} intensity={0.55} distance={6} position={[0, 2.2, 0]} />
          <PatientModel
            patient={room.patient}
            position={room.scene.patientOffset}
            selectedCondition={selectedCondition}
            onSelectCondition={selectCondition}
          />
        </>
      ) : null}

      <Html position={labelPosition} center distanceFactor={18}>
        <div
          className="pointer-events-none whitespace-nowrap rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] shadow-lg backdrop-blur"
          style={{
            borderColor: meta.line,
            backgroundColor: isSelected ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.9)',
            color: hovered || isSelected ? '#0f172a' : '#475569',
          }}
        >
          {room.name}
        </div>
      </Html>
    </group>
  );
}

interface WallsProps {
  width: number;
  depth: number;
  wallOpacity: number;
  meta: (typeof priorityMeta)[keyof typeof priorityMeta];
}

function Walls({ width, depth, wallOpacity, meta }: WallsProps) {
  const wallHeight = 1.35;
  const wallThickness = 0.08;
  const doorWidth = Math.min(1.05, width * 0.38);
  const frontSegmentWidth = (width - doorWidth) / 2;

  return (
    <>
      <mesh castShadow receiveShadow position={[0, wallHeight / 2, -depth / 2]}>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshStandardMaterial color={meta.line} transparent opacity={wallOpacity} />
      </mesh>
      <mesh castShadow receiveShadow position={[-width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={meta.line} transparent opacity={wallOpacity} />
      </mesh>
      <mesh castShadow receiveShadow position={[width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color={meta.line} transparent opacity={wallOpacity} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[-doorWidth / 2 - frontSegmentWidth / 2, wallHeight / 2, depth / 2]}
      >
        <boxGeometry args={[frontSegmentWidth, wallHeight, wallThickness]} />
        <meshStandardMaterial color={meta.line} transparent opacity={wallOpacity} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        position={[doorWidth / 2 + frontSegmentWidth / 2, wallHeight / 2, depth / 2]}
      >
        <boxGeometry args={[frontSegmentWidth, wallHeight, wallThickness]} />
        <meshStandardMaterial color={meta.line} transparent opacity={wallOpacity} />
      </mesh>
    </>
  );
}

function RoomInterior({ room }: { room: RoomRecord }) {
  const [width, depth] = room.scene.size;
  const accent = priorityMeta[room.priorityColor].fill;

  const bedWidth = Math.min(1.42, width * 0.42);
  const bedLength = Math.min(2.1, depth * 0.62);
  const bedX = -width / 2 + bedWidth / 2 + 0.42;
  const bedZ = -depth / 2 + bedLength / 2 + 0.34;

  return (
    <group>
      <mesh receiveShadow position={[0, 0.015, 0]}>
        <boxGeometry args={[width - 0.16, 0.02, depth - 0.16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.72} />
      </mesh>

      <RoundedBox
        args={[bedWidth + 0.14, 0.16, bedLength + 0.16]}
        position={[bedX, 0.18, bedZ]}
        radius={0.05}
      >
        <meshStandardMaterial color="#dbe4ef" roughness={0.88} />
      </RoundedBox>
      <RoundedBox args={[bedWidth, 0.18, bedLength]} position={[bedX, 0.3, bedZ]} radius={0.06}>
        <meshStandardMaterial color="#f8fbff" roughness={0.72} />
      </RoundedBox>
      <RoundedBox
        args={[bedWidth - 0.08, 0.08, bedLength - 0.1]}
        position={[bedX, 0.43, bedZ]}
        radius={0.05}
      >
        <meshStandardMaterial color={accent} transparent opacity={0.66} roughness={0.76} />
      </RoundedBox>
      <RoundedBox
        args={[0.55, 0.12, 0.45]}
        position={[bedX, 0.48, bedZ - bedLength / 2 + 0.28]}
        radius={0.06}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </RoundedBox>

      <RoundedBox
        args={[0.42, 0.5, 0.42]}
        position={[width / 2 - 0.55, 0.26, depth / 2 - 0.6]}
        radius={0.06}
      >
        <meshStandardMaterial color="#c9d4e4" roughness={0.7} />
      </RoundedBox>
      <RoundedBox
        args={[0.7, 0.12, 0.72]}
        position={[width / 2 - 0.88, 0.3, -depth / 2 + 0.88]}
        radius={0.08}
      >
        <meshStandardMaterial color="#e5edf6" roughness={0.68} />
      </RoundedBox>
      <RoundedBox
        args={[0.5, 0.72, 0.5]}
        position={[width / 2 - 0.8, 0.55, -depth / 2 + 1.42]}
        radius={0.08}
      >
        <meshStandardMaterial color="#f7fafc" roughness={0.8} />
      </RoundedBox>
      <mesh castShadow position={[width / 2 - 0.2, 1.1, -depth / 2 + 0.78]}>
        <boxGeometry args={[0.06, 1.05, 0.06]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <RoundedBox
        args={[0.48, 0.28, 0.06]}
        position={[width / 2 - 0.2, 1.65, -depth / 2 + 0.78]}
        radius={0.03}
      >
        <meshStandardMaterial color="#0f172a" emissive="#7dd3fc" emissiveIntensity={0.55} />
      </RoundedBox>

      <RoundedBox
        args={[0.58, 0.06, 0.38]}
        position={[-width / 2 + 0.55, 0.88, depth / 2 - 0.52]}
        radius={0.04}
      >
        <meshStandardMaterial color="#d7e3ef" roughness={0.6} />
      </RoundedBox>
      <mesh castShadow position={[-width / 2 + 0.55, 0.58, depth / 2 - 0.52]}>
        <cylinderGeometry args={[0.1, 0.1, 0.55, 24]} />
        <meshStandardMaterial color="#d7e3ef" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-width / 2 + 0.55, 0.34, depth / 2 - 0.28]}>
        <cylinderGeometry args={[0.16, 0.18, 0.18, 24]} />
        <meshStandardMaterial color="#95a7bd" roughness={0.5} />
      </mesh>
    </group>
  );
}
