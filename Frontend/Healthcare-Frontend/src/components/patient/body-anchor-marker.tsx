'use client';

import { Billboard, Html } from '@react-three/drei';
import { useMemo, useState } from 'react';
import type { BodyAnchorId } from '@/types/domain';

const HIT_TARGET_CAMERA_OFFSET = 0.12;
const HIT_TARGET_RADIUS = 0.26;

export function BodyAnchorMarker({
  anchorId,
  label,
  position,
  scaleMultiplier = 1,
  selected = false,
  coordinates,
  editMode = false,
  onSelect,
}: {
  anchorId: BodyAnchorId;
  label: string;
  position: [number, number, number];
  scaleMultiplier?: number;
  selected?: boolean;
  coordinates: [number, number, number];
  editMode?: boolean;
  onSelect: (anchorId: BodyAnchorId | null) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const outerScale = 0.72 * scaleMultiplier;
  const innerScale = 0.62 * scaleMultiplier;
  const coreScale = 0.54 * scaleMultiplier;
  const labelText = useMemo(
    () => `${label}\nx ${coordinates[0].toFixed(2)}  y ${coordinates[1].toFixed(2)}  z ${coordinates[2].toFixed(2)}`,
    [coordinates, label],
  );
  const showLabel = editMode && hovered;
  const outerOpacity = selected ? 0.42 : hovered ? 0.3 : 0.24;
  const innerOpacity = selected ? 0.58 : hovered ? 0.48 : 0.38;
  const coreOpacity = selected ? 0.94 : hovered ? 0.88 : 0.78;

  return (
    <group
      position={position}
      onClick={(event) => {
        if (!editMode) {
          return;
        }
        event.stopPropagation();
        onSelect(selected ? null : anchorId);
      }}
      onPointerOver={(event) => {
        if (editMode) {
          event.stopPropagation();
        }
        setHovered(true);
        document.body.style.cursor = editMode ? 'pointer' : 'default';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <Billboard>
        <group renderOrder={2}>
          <group position={[0, 0, 0.04]}>
            <mesh scale={outerScale}>
              <ringGeometry args={[0.18, 0.24, 40]} />
              <meshBasicMaterial
                color={selected ? '#7c9cff' : '#c7d3df'}
                transparent
                opacity={outerOpacity}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh scale={innerScale}>
              <ringGeometry args={[0.1, 0.14, 36]} />
              <meshBasicMaterial
                color={selected ? '#5e83ff' : '#b7c7d6'}
                transparent
                opacity={innerOpacity}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh scale={coreScale}>
              <circleGeometry args={[0.06, 28]} />
              <meshBasicMaterial
                color={selected ? '#e4ebff' : '#d9e4ee'}
                transparent
                opacity={coreOpacity}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
          </group>
          <mesh position={[0, 0, HIT_TARGET_CAMERA_OFFSET]}>
            <sphereGeometry args={[HIT_TARGET_RADIUS, 18, 18]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
          </mesh>
          {showLabel ? (
            <Html
              center
              position={[0, 0.46, 0]}
              sprite
              transform
              distanceFactor={8}
              style={{ pointerEvents: 'none' }}
            >
              <div className="rounded-2xl border border-slate-200/80 bg-white/95 px-3 py-2 text-center text-xs font-medium leading-5 text-slate-700 shadow-lg whitespace-pre">
                {labelText}
              </div>
            </Html>
          ) : null}
        </group>
      </Billboard>
    </group>
  );
}
