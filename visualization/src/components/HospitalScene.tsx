import { ContactShadows, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { hospitalRooms, type RoomRecord } from '../data/hospitalData';
import { useHospitalStore } from '../store/useHospitalStore';
import { FloorPlan } from './FloorPlan';

const defaultCameraPosition: [number, number, number] = [13.8, 11.2, 15.2];
const defaultCameraTarget: [number, number, number] = [2.45, 0.7, 0.8];

export function HospitalScene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const selectedRoom = useHospitalStore((state) => state.selectedRoom);
  const resetSelection = useHospitalStore((state) => state.resetSelection);
  const activeRoom = hospitalRooms.find((room) => room.id === selectedRoom) ?? null;

  return (
    <Canvas
      className="!absolute inset-0"
      shadows
      dpr={[1, 2]}
      camera={{ position: defaultCameraPosition, fov: 38, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={(event) => {
        if (event.type === 'click') {
          resetSelection();
        }
      }}
    >
      <color attach="background" args={['#f4f9fd']} />
      <fog attach="fog" args={['#f4f9fd', 18, 34]} />

      <ambientLight intensity={0.9} />
      <hemisphereLight intensity={0.65} groundColor="#dbeafe" color="#ffffff" />
      <directionalLight
        castShadow
        position={[9, 14, 8]}
        intensity={1.35}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.00012}
      />
      <spotLight
        castShadow
        position={[-8, 16, 8]}
        intensity={0.45}
        angle={0.38}
        penumbra={0.8}
        color="#d8f3ff"
      />

      <CameraRig controlsRef={controlsRef} selectedRoom={activeRoom} />
      <FloorPlan />

      <ContactShadows
        position={[2.3, 0.01, 0.55]}
        opacity={0.32}
        scale={32}
        blur={2.6}
        far={22}
        resolution={1024}
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enablePan={false}
        minDistance={6}
        maxDistance={23}
        minPolarAngle={0.58}
        maxPolarAngle={Math.PI / 2.15}
        target={defaultCameraTarget}
      />
    </Canvas>
  );
}

interface CameraRigProps {
  controlsRef: MutableRefObject<OrbitControlsImpl | null>;
  selectedRoom: RoomRecord | null;
}

function CameraRig({ controlsRef, selectedRoom }: CameraRigProps) {
  const { camera } = useThree();
  const desiredPosition = useRef(new THREE.Vector3(...defaultCameraPosition));
  const desiredTarget = useRef(new THREE.Vector3(...defaultCameraTarget));

  useFrame((_, delta) => {
    if (selectedRoom) {
      desiredTarget.current.set(...selectedRoom.scene.focusTarget);
      desiredPosition.current.set(
        selectedRoom.scene.focusTarget[0] + selectedRoom.scene.cameraOffset[0],
        selectedRoom.scene.focusTarget[1] + selectedRoom.scene.cameraOffset[1],
        selectedRoom.scene.focusTarget[2] + selectedRoom.scene.cameraOffset[2],
      );
    } else {
      desiredTarget.current.set(...defaultCameraTarget);
      desiredPosition.current.set(...defaultCameraPosition);
    }

    const easing = 1 - Math.exp(-delta * 2.4);
    camera.position.lerp(desiredPosition.current, easing);
    controlsRef.current?.target.lerp(desiredTarget.current, easing);
    controlsRef.current?.update();
  });

  return null;
}
