import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { BodyArea, Condition, Patient, Vector3Tuple } from '../data/hospitalData';
import { PriorityPulse } from './PriorityPulse';

interface PatientModelProps {
  patient: Patient;
  position: Vector3Tuple;
  selectedCondition: string | null;
  onSelectCondition: (conditionId: string | null) => void;
}

const bodyAreaAnchors: Record<BodyArea, Vector3Tuple> = {
  heart: [0, 1.58, 0.28],
  lungs: [-0.14, 1.56, 0.3],
  liver: [0.18, 1.18, 0.24],
  legs: [0.01, 0.52, 0.18],
  kidney: [0.18, 1.04, 0.22],
  abdomen: [0, 1.12, 0.24],
  head: [0, 2.15, 0.16],
};

export function PatientModel({
  patient,
  position,
  selectedCondition,
  onSelectCondition,
}: PatientModelProps) {
  const groupRef = useRef<Group>(null);
  const activeCondition =
    patient.conditions.find((condition) => condition.id === selectedCondition) ?? null;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(time * 1.35) * 0.03;
      groupRef.current.rotation.y = Math.sin(time * 0.35) * 0.04;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Structured so a GLTF mannequin can replace these primitives later without changing pulse logic. */}
      <group castShadow receiveShadow position={[0, 0.04, 0]} scale={[0.84, 0.92, 0.76]}>
        <mesh castShadow position={[0, 2.25, 0]} scale={[0.78, 1.08, 0.78]}>
          <sphereGeometry args={[0.24, 48, 48]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.42} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0, 1.98, 0]} scale={[0.78, 1.08, 0.72]}>
          <capsuleGeometry args={[0.06, 0.16, 10, 18]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.42} metalness={0.02} />
        </mesh>

        <mesh castShadow position={[0, 1.77, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.34, 0.78, 0.7]}>
          <capsuleGeometry args={[0.16, 0.38, 10, 24]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.48} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0, 1.46, 0]} scale={[1.1, 1.1, 0.82]}>
          <capsuleGeometry args={[0.2, 0.62, 10, 24]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.48} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0, 1.03, 0.01]} scale={[0.95, 1.02, 0.76]}>
          <capsuleGeometry args={[0.16, 0.48, 10, 24]} />
          <meshStandardMaterial color="#f6f9fc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0, 0.64, 0.01]} scale={[1.04, 0.88, 0.84]}>
          <capsuleGeometry args={[0.18, 0.26, 10, 24]} />
          <meshStandardMaterial color="#f5f8fb" roughness={0.52} metalness={0.02} />
        </mesh>

        <mesh castShadow position={[-0.31, 1.47, 0]} rotation={[0, 0, 0.18]} scale={[0.92, 1, 0.88]}>
          <capsuleGeometry args={[0.07, 0.68, 8, 18]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.31, 1.47, 0]} rotation={[0, 0, -0.18]} scale={[0.92, 1, 0.88]}>
          <capsuleGeometry args={[0.07, 0.68, 8, 18]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[-0.42, 0.9, 0.01]} rotation={[0, 0, 0.08]} scale={[0.8, 1, 0.78]}>
          <capsuleGeometry args={[0.055, 0.62, 8, 18]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.42, 0.9, 0.01]} rotation={[0, 0, -0.08]} scale={[0.8, 1, 0.78]}>
          <capsuleGeometry args={[0.055, 0.62, 8, 18]} />
          <meshStandardMaterial color="#f7fafc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[-0.44, 0.47, 0.03]} scale={[0.58, 1.16, 0.48]}>
          <capsuleGeometry args={[0.04, 0.16, 8, 14]} />
          <meshStandardMaterial color="#f6f9fc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.44, 0.47, 0.03]} scale={[0.58, 1.16, 0.48]}>
          <capsuleGeometry args={[0.04, 0.16, 8, 14]} />
          <meshStandardMaterial color="#f6f9fc" roughness={0.5} metalness={0.02} />
        </mesh>

        <mesh castShadow position={[-0.13, 0.04, 0]} rotation={[0, 0, 0.025]} scale={[0.9, 1.06, 0.86]}>
          <capsuleGeometry args={[0.09, 0.98, 10, 20]} />
          <meshStandardMaterial color="#f6f9fc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.13, 0.04, 0]} rotation={[0, 0, -0.025]} scale={[0.9, 1.06, 0.86]}>
          <capsuleGeometry args={[0.09, 0.98, 10, 20]} />
          <meshStandardMaterial color="#f6f9fc" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[-0.11, -0.92, 0.02]} rotation={[0, 0, 0.012]} scale={[0.76, 1.1, 0.74]}>
          <capsuleGeometry args={[0.078, 0.86, 10, 20]} />
          <meshStandardMaterial color="#f5f8fb" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.11, -0.92, 0.02]} rotation={[0, 0, -0.012]} scale={[0.76, 1.1, 0.74]}>
          <capsuleGeometry args={[0.078, 0.86, 10, 20]} />
          <meshStandardMaterial color="#f5f8fb" roughness={0.5} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[-0.12, -1.64, 0.14]} rotation={[Math.PI / 2.1, 0, 0]} scale={[0.62, 1, 0.44]}>
          <capsuleGeometry args={[0.07, 0.3, 8, 16]} />
          <meshStandardMaterial color="#eef3f8" roughness={0.42} metalness={0.02} />
        </mesh>
        <mesh castShadow position={[0.12, -1.64, 0.14]} rotation={[Math.PI / 2.1, 0, 0]} scale={[0.62, 1, 0.44]}>
          <capsuleGeometry args={[0.07, 0.3, 8, 16]} />
          <meshStandardMaterial color="#eef3f8" roughness={0.42} metalness={0.02} />
        </mesh>
      </group>

      {patient.conditions.map((condition) => {
        const anchor = bodyAreaAnchors[condition.bodyArea];
        const pulseOffset = condition.pulseOffset ?? [0, 0, 0];
        const pulsePosition: Vector3Tuple = [
          anchor[0] + pulseOffset[0],
          anchor[1] + pulseOffset[1],
          anchor[2] + pulseOffset[2],
        ];

        return (
          <PriorityPulse
            key={condition.id}
            condition={condition}
            position={pulsePosition}
            selected={selectedCondition === condition.id}
            onSelect={onSelectCondition}
          />
        );
      })}

      {activeCondition ? (
        <ConditionCallout
          condition={activeCondition}
          position={getConditionCalloutPosition(activeCondition)}
        />
      ) : null}
    </group>
  );
}

function getConditionCalloutPosition(condition: Condition): Vector3Tuple {
  const anchor = bodyAreaAnchors[condition.bodyArea];
  const offset = condition.pulseOffset ?? [0, 0, 0];
  const lateralOffset = anchor[0] >= 0 ? 0.24 : -0.24;

  return [
    anchor[0] + offset[0] + lateralOffset,
    anchor[1] + offset[1] + 0.08,
    anchor[2] + offset[2] - 0.03,
  ];
}

function ConditionCallout({
  condition,
  position,
}: {
  condition: Condition;
  position: Vector3Tuple;
}) {
  const shortDescription =
    condition.description.length > 24
      ? `${condition.description.slice(0, 24).trimEnd()}...`
      : condition.description;

  return (
    <Html position={position} transform occlude distanceFactor={22}>
      <div className="w-[68px] rounded-[10px] border border-white/90 bg-white/94 p-1 text-left shadow-[0_8px_16px_rgba(15,23,42,0.1)] backdrop-blur">
        <div className="flex items-start justify-between gap-1.5">
          <div>
            <h4 className="text-[7px] font-semibold leading-[10px] text-slate-950">
              {condition.label}
            </h4>
            <p className="mt-0.5 text-[6px] font-medium uppercase leading-[8px] tracking-[0.08em] text-slate-500">
              {condition.severity}
            </p>
          </div>
          <span
            className="mt-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-white"
            style={{ backgroundColor: condition.color }}
          />
        </div>

        <div className="mt-1 rounded-md border border-slate-200/80 bg-slate-50/90 p-1">
          <p className="text-[6px] leading-[8px] text-slate-700">{shortDescription}</p>
        </div>

        <div className="mt-1 flex flex-wrap gap-1">
          <span
            className="rounded-full px-1 py-0.5 text-[6px] font-semibold uppercase tracking-[0.08em]"
            style={{
              backgroundColor: `${condition.color}18`,
              color: condition.color,
            }}
          >
            {condition.organ}
          </span>
        </div>
      </div>
    </Html>
  );
}
