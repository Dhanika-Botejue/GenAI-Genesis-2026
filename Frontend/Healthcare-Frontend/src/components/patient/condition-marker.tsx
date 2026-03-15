'use client';

import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { Group, Mesh } from 'three';
import type { Condition } from '@/types/domain';

const HIT_TARGET_CAMERA_OFFSET = 0.12;
const HIT_TARGET_RADIUS = 0.24;

export function ConditionMarker({
  condition,
  position,
  scaleMultiplier = 1,
  selected,
  onSelect,
}: {
  condition: Condition;
  position: [number, number, number];
  scaleMultiplier?: number;
  selected: boolean;
  onSelect: (conditionId: string | null) => void;
}) {
  const groupRef = useRef<Group>(null);
  const outerRingRef = useRef<Mesh>(null);
  const innerRingRef = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const phase = condition.id.length * 0.21;

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime() + phase;
    const emphasis = selected ? 0.12 : hovered ? 0.06 : 0;
    groupRef.current?.position.set(position[0], position[1] + Math.sin(time * 1.6) * 0.008, position[2]);
    outerRingRef.current?.scale.setScalar((1.04 + Math.sin(time * 1.2) * 0.09 + emphasis) * scaleMultiplier);
    innerRingRef.current?.scale.setScalar((0.94 + Math.sin(time * 2.8 + 0.3) * 0.05 + emphasis * 0.5) * scaleMultiplier);
    coreRef.current?.scale.setScalar((1 + Math.sin(time * 4.2) * 0.04 + emphasis * 0.3) * scaleMultiplier);
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(selected ? null : condition.id);
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
      <Billboard>
        <group>
          <group position={[0, 0, 0.04]}>
            <mesh ref={outerRingRef}>
              <ringGeometry args={[0.18, 0.24, 40]} />
              <meshBasicMaterial
                color={condition.color}
                transparent
                opacity={selected ? 0.34 : 0.18}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh ref={innerRingRef}>
              <ringGeometry args={[0.1, 0.14, 36]} />
              <meshBasicMaterial
                color={condition.color}
                transparent
                opacity={selected ? 0.75 : 0.54}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh ref={coreRef}>
              <circleGeometry args={[0.06, 28]} />
              <meshBasicMaterial color={condition.color} transparent opacity={0.96} depthWrite={false} depthTest={false} />
            </mesh>
          </group>
          <mesh position={[0, 0, HIT_TARGET_CAMERA_OFFSET]}>
            <sphereGeometry args={[HIT_TARGET_RADIUS, 20, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
          </mesh>
        </group>
      </Billboard>
    </group>
  );
}
