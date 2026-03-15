'use client';

import { Text } from '@react-three/drei';
import { getBodyAnchor, visibleBodyAnchorIds } from '@/lib/scene/body-anchors';
import { useAppStore } from '@/store/useAppStore';

export function AnchorDebug() {
  const anchorOverrides = useAppStore((state) => state.anchorOverrides);

  return (
    <group>
      {visibleBodyAnchorIds.map((anchorId) => {
        const anchor = getBodyAnchor(anchorId, anchorOverrides);
        return (
        <group key={anchor.id} position={anchor.position}>
          <mesh>
            <sphereGeometry args={[0.035, 14, 14]} />
            <meshBasicMaterial color="#0f172a" />
          </mesh>
          <Text position={[0, 0.1, 0]} fontSize={0.055} color="#0f172a" anchorX="center" anchorY="middle">
            {`${anchor.label} (${anchor.position.map((value) => value.toFixed(2)).join(', ')})`}
          </Text>
        </group>
        );
      })}
    </group>
  );
}
