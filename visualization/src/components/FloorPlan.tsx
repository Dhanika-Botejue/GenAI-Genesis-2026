import { Grid, Html, RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { MeshStandardMaterial } from 'three';
import { hospitalRooms, nurseStation } from '../data/hospitalData';
import { useHospitalStore } from '../store/useHospitalStore';
import { RoomMesh } from './RoomMesh';

const corridorSegments = [
  {
    position: [2.9, 0.025, 0.7] as [number, number, number],
    size: [10.8, 0.05, 2.1] as [number, number, number],
  },
  {
    position: [9.25, 0.025, 2.95] as [number, number, number],
    size: [1.8, 0.05, 2.5] as [number, number, number],
  },
  {
    position: [-2.2, 0.025, 2.65] as [number, number, number],
    size: [3.2, 0.05, 3.7] as [number, number, number],
  },
];

export function FloorPlan() {
  const selectedRoom = useHospitalStore((state) => state.selectedRoom);

  return (
    <group>
      <mesh receiveShadow position={[2.2, -0.06, 0.55]}>
        <boxGeometry args={[30, 0.08, 18]} />
        <meshStandardMaterial color="#f6f9fc" />
      </mesh>

      <Grid
        args={[26, 18]}
        position={[2.2, 0.01, 0.55]}
        cellColor="#cfdbe7"
        sectionColor="#b8c7d8"
        cellSize={0.8}
        cellThickness={0.5}
        sectionSize={4}
        sectionThickness={1.2}
        fadeDistance={32}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={false}
      />

      {corridorSegments.map((segment) => (
        <mesh key={segment.position.join('-')} receiveShadow position={segment.position}>
          <boxGeometry args={segment.size} />
          <meshStandardMaterial color="#eef4fa" transparent opacity={0.95} />
        </mesh>
      ))}

      <NurseStationMesh />

      {hospitalRooms.map((room) => (
        <RoomMesh key={room.id} room={room} isSelected={selectedRoom === room.id} />
      ))}
    </group>
  );
}

function NurseStationMesh() {
  const screenMaterialRef = useRef<MeshStandardMaterial>(null);
  const beaconMaterialRef = useRef<MeshStandardMaterial>(null);
  const [width, depth] = nurseStation.size;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();

    if (screenMaterialRef.current) {
      screenMaterialRef.current.emissiveIntensity = 0.7 + Math.sin(time * 1.3) * 0.12;
    }

    if (beaconMaterialRef.current) {
      beaconMaterialRef.current.emissiveIntensity = 0.9 + Math.sin(time * 2.1) * 0.2;
    }
  });

  return (
    <group position={[nurseStation.position[0], 0, nurseStation.position[1]]}>
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial
          color={nurseStation.tint}
          emissive={nurseStation.tint}
          emissiveIntensity={0.08}
          transparent
          opacity={0.28}
        />
      </mesh>

      <mesh castShadow receiveShadow position={[0, 0.68, -depth / 2]}>
        <boxGeometry args={[width, 1.36, 0.08]} />
        <meshStandardMaterial color="#4e87c7" transparent opacity={0.22} />
      </mesh>
      <mesh castShadow receiveShadow position={[-width / 2, 0.68, 0]}>
        <boxGeometry args={[0.08, 1.36, depth]} />
        <meshStandardMaterial color="#4e87c7" transparent opacity={0.22} />
      </mesh>
      <mesh castShadow receiveShadow position={[width / 2, 0.68, 0]}>
        <boxGeometry args={[0.08, 1.36, depth]} />
        <meshStandardMaterial color="#4e87c7" transparent opacity={0.22} />
      </mesh>

      <RoundedBox args={[2.6, 0.42, 1.45]} position={[1.05, 0.3, -0.25]} radius={0.08}>
        <meshStandardMaterial color="#dce9f8" roughness={0.74} />
      </RoundedBox>
      <RoundedBox args={[1.85, 0.16, 0.55]} position={[1.1, 0.66, -0.25]} radius={0.04}>
        <meshStandardMaterial color="#f7fbff" roughness={0.62} />
      </RoundedBox>
      <RoundedBox args={[0.62, 0.3, 0.06]} position={[0.72, 0.95, -0.22]} radius={0.03}>
        <meshStandardMaterial
          ref={screenMaterialRef}
          color="#0f172a"
          emissive="#67e8f9"
          emissiveIntensity={0.78}
        />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.24, 0.06]} position={[1.45, 0.92, -0.1]} radius={0.03}>
        <meshStandardMaterial color="#0f172a" emissive="#93c5fd" emissiveIntensity={0.65} />
      </RoundedBox>

      <mesh castShadow position={[-0.55, 0.22, 0.8]}>
        <cylinderGeometry args={[0.22, 0.28, 0.42, 24]} />
        <meshStandardMaterial color="#d7e3f0" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[0.1, 0.22, 1.1]}>
        <cylinderGeometry args={[0.22, 0.28, 0.42, 24]} />
        <meshStandardMaterial color="#d7e3f0" roughness={0.6} />
      </mesh>
      <mesh castShadow position={[-1.4, 1.05, 1.6]}>
        <sphereGeometry args={[0.14, 28, 28]} />
        <meshStandardMaterial
          ref={beaconMaterialRef}
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={1}
        />
      </mesh>

      <Html position={[0, 1.58, 0]} center distanceFactor={14}>
        <div className="pointer-events-none rounded-full border border-sky-300/80 bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700 shadow-lg backdrop-blur">
          {nurseStation.name}
        </div>
      </Html>
    </group>
  );
}
