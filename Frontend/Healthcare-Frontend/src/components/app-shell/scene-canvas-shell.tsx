'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { HospitalScene } from '@/components/hospital/hospital-scene';
import { PatientScene } from '@/components/patient/patient-scene';
import { getHospitalCameraPreset, patientCameraPreset } from '@/lib/scene/camera-presets';
import { useAppStore } from '@/store/useAppStore';

export function SceneCanvasShell() {
  const sceneMode = useAppStore((state) => state.sceneMode);
  const selectRoom = useAppStore((state) => state.selectRoom);
  const selectCondition = useAppStore((state) => state.selectCondition);
  const selectAnchor = useAppStore((state) => state.selectAnchor);

  useEffect(() => {
    const warmAsset = async () => {
      try {
        await Promise.all([
          fetch('/models/human-body/scene.gltf', { cache: 'force-cache' }),
          fetch('/models/human-body/scene.bin', { cache: 'force-cache' }),
        ]);
      } catch {
        // Keep startup resilient even if model warmup fails.
      }
    };

    void warmAsset();
  }, []);

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 2]}
        shadows={false}
        camera={{ position: [14, 11, 15], fov: 36, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={(event) => {
          if (event.type !== 'click') {
            return;
          }

          if (sceneMode === 'patient') {
            selectCondition(null);
            selectAnchor(null);
          } else {
            selectRoom(null);
          }
        }}
      >
        <SceneCanvasContent />
      </Canvas>
    </div>
  );
}

function SceneCanvasContent() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const sceneMode = useAppStore((state) => state.sceneMode);
  const parsedFloorplan = useAppStore((state) => state.parsedFloorplan);
  const cameraResetNonce = useAppStore((state) => state.cameraResetNonce);
  const { scene } = useThree();

  const hospitalPreset = useMemo(() => getHospitalCameraPreset(parsedFloorplan), [parsedFloorplan]);
  const preset = sceneMode === 'hospital' ? hospitalPreset : patientCameraPreset;
  const desiredPosition = useRef(new THREE.Vector3(...preset.position));
  const desiredTarget = useRef(new THREE.Vector3(...preset.target));
  const isAnimatingRef = useRef(true);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    scene.background = new THREE.Color(sceneMode === 'hospital' ? '#f5f1ed' : '#edf2f0');
  }, [scene, sceneMode]);

  useEffect(() => {
    desiredPosition.current.set(...preset.position);
    desiredTarget.current.set(...preset.target);
    isAnimatingRef.current = true;

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
    }
  }, [preset.position, preset.target]);

  useEffect(() => {
    desiredPosition.current.set(...preset.position);
    desiredTarget.current.set(...preset.target);
    isAnimatingRef.current = true;
  }, [cameraResetNonce, preset.position, preset.target]);

  useFrame(({ camera }, delta) => {
    if (!hasInitializedRef.current) {
      camera.position.set(...preset.position);
      controlsRef.current?.target.set(...preset.target);
      controlsRef.current?.update();
      return;
    }

    if (isAnimatingRef.current) {
      const easing = 1 - Math.exp(-delta * 3.25);
      camera.position.lerp(desiredPosition.current, easing);
      controlsRef.current?.target.lerp(desiredTarget.current, easing);

      const positionDone = camera.position.distanceToSquared(desiredPosition.current) < 0.0025;
      const targetDone = controlsRef.current
        ? controlsRef.current.target.distanceToSquared(desiredTarget.current) < 0.0025
        : true;

      if (positionDone && targetDone) {
        camera.position.copy(desiredPosition.current);
        controlsRef.current?.target.copy(desiredTarget.current);
        isAnimatingRef.current = false;
      }
    }

    controlsRef.current?.update();
  });

  return (
    <>
      <fog attach="fog" args={[sceneMode === 'hospital' ? '#f5f1ed' : '#edf2f0', 18, 38]} />
      <ambientLight intensity={1.1} />
      <hemisphereLight intensity={0.9} groundColor="#cfdbe3" color="#ffffff" />
      <directionalLight position={[9, 16, 8]} intensity={1.2} color="#fff8ef" />
      <directionalLight position={[-7, 10, 12]} intensity={0.45} color="#dff6ff" />

      {sceneMode === 'hospital' ? (
        <Suspense fallback={<HospitalSceneFallback />}>
          <HospitalScene />
        </Suspense>
      ) : null}
      {sceneMode === 'patient' ? (
        <Suspense fallback={null}>
          <PatientScene />
        </Suspense>
      ) : null}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan
        minDistance={preset.minDistance}
        maxDistance={Math.max(preset.maxDistance, sceneMode === 'hospital' ? 42 : preset.maxDistance)}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2 - 0.03}
        enableDamping
        dampingFactor={0.11}
        rotateSpeed={0.72}
        zoomSpeed={0.84}
        panSpeed={0.7}
      />
    </>
  );
}

function HospitalSceneFallback() {
  return (
    <group>
      <mesh position={[10, -0.09, 7]}>
        <boxGeometry args={[28, 0.12, 22]} />
        <meshStandardMaterial color="#f7fbfb" />
      </mesh>
      <mesh position={[10, 0.03, 7]}>
        <boxGeometry args={[14, 0.18, 9]} />
        <meshStandardMaterial color="#dbe7eb" transparent opacity={0.55} />
      </mesh>
    </group>
  );
}
