import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { startTransition, useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { Condition, Vector3Tuple } from '../data/hospitalData';

interface PriorityPulseProps {
  condition: Condition;
  position: Vector3Tuple;
  selected: boolean;
  onSelect: (conditionId: string | null) => void;
}

export function PriorityPulse({
  condition,
  position,
  selected,
  onSelect,
}: PriorityPulseProps) {
  const groupRef = useRef<Group>(null);
  const outerRingRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);
  const haloRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);

  const phase = condition.id.charCodeAt(condition.id.length - 1) * 0.07;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() + phase;
    const emphasis = selected ? 0.1 : 0;

    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(time * 1.8) * 0.01;
    }

    outerRingRef.current?.scale.setScalar(1.05 + Math.sin(time * 1.25) * 0.08 + emphasis);
    innerRingRef.current?.scale.setScalar(0.94 + Math.sin(time * 2.8 + 0.6) * 0.05 + emphasis * 0.55);
    haloRef.current?.scale.setScalar(selected ? 1.08 + Math.sin(time * 4.1) * 0.05 : 1);
    coreRef.current?.scale.setScalar(1 + Math.sin(time * 4.6) * 0.05 + emphasis * 0.3);
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        startTransition(() => onSelect(selected ? null : condition.id));
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <Billboard>
        <group>
          <mesh ref={haloRef}>
            <ringGeometry args={[0.12, 0.17, 40]} />
            <meshBasicMaterial
              color={condition.color}
              transparent
              opacity={selected ? 0.4 : 0.14}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={outerRingRef}>
            <ringGeometry args={[0.18, 0.24, 40]} />
            <meshBasicMaterial
              color={condition.color}
              transparent
              opacity={selected ? 0.28 : 0.18}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={innerRingRef}>
            <ringGeometry args={[0.09, 0.12, 36]} />
            <meshBasicMaterial
              color={condition.color}
              transparent
              opacity={selected ? 0.82 : 0.62}
              depthWrite={false}
            />
          </mesh>
          <mesh ref={coreRef}>
            <circleGeometry args={[0.055, 24]} />
            <meshBasicMaterial
              color={condition.color}
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
