'use client';

import { useGLTF } from '@react-three/drei';
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { Box3, Color, Vector3 } from 'three';

interface NormalizedHumanModelProps {
  children?: React.ReactNode;
}

const MODEL_CORRECTION_ROTATION: [number, number, number] = [0, 0, 0];

export const NormalizedHumanModel = forwardRef<Group, NormalizedHumanModelProps>(
  function NormalizedHumanModel({ children }, forwardedRef) {
    const { scene } = useGLTF('/models/human-body/scene.gltf');
    const correctedRef = useRef<Group>(null);
    const modelRef = useRef<Group>(null);
    const [transform, setTransform] = useState({
      scale: 1,
      position: [0, 0, 0] as [number, number, number],
    });

    const model = useMemo(() => {
      const cloned = scene.clone(true);
      cloned.traverse((node) => {
        const mesh = node as Mesh;
        if (!mesh.isMesh) {
          return;
        }

        mesh.castShadow = false;
        mesh.receiveShadow = false;

        const material = mesh.material as MeshStandardMaterial;
        if (material && 'clone' in material) {
          const nextMaterial = material.clone();
          nextMaterial.color = new Color('#f2f7fa');
          nextMaterial.roughness = 0.58;
          nextMaterial.metalness = 0.02;
          mesh.material = nextMaterial;
        }
      });
      return cloned;
    }, [scene]);

    useLayoutEffect(() => {
      if (!correctedRef.current || !modelRef.current) {
        return;
      }

      const correctedBox = new Box3().setFromObject(correctedRef.current);
      const size = correctedBox.getSize(new Vector3());
      const center = correctedBox.getCenter(new Vector3());
      const scale = 2.115 / Math.max(size.y, 0.001);

      setTransform({
        scale,
        position: [-center.x * scale, -correctedBox.min.y * scale, -center.z * scale],
      });
    }, [model]);

    useImperativeHandle(forwardedRef, () => correctedRef.current as Group, []);

    return (
      <group position={transform.position}>
        <group ref={correctedRef} rotation={MODEL_CORRECTION_ROTATION} scale={transform.scale}>
          <group ref={modelRef}>
            <primitive object={model} />
          </group>
          {children}
        </group>
      </group>
    );
  },
);
