'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { AnchorDebug } from '@/components/patient/anchor-debug';
import { BodyAnchorMarker } from '@/components/patient/body-anchor-marker';
import { ConditionMarker } from '@/components/patient/condition-marker';
import { NormalizedHumanModel } from '@/components/patient/normalized-human-model';
import { getBodyAnchor, getBodyAnchorPlacement, visibleBodyAnchorIds } from '@/lib/scene/body-anchors';
import { useAppStore } from '@/store/useAppStore';

export function PatientScene() {
  const modelSpaceRef = useRef<Group>(null);
  const patients = useAppStore((state) => state.patients);
  const selectedPatientId = useAppStore((state) => state.selectedPatientId);
  const selectedConditionId = useAppStore((state) => state.selectedConditionId);
  const selectedAnchorId = useAppStore((state) => state.selectedAnchorId);
  const anchorOverrides = useAppStore((state) => state.anchorOverrides);
  const anchorEditMode = useAppStore((state) => state.debug.anchorEditMode);
  const selectCondition = useAppStore((state) => state.selectCondition);
  const selectAnchor = useAppStore((state) => state.selectAnchor);
  const debug = useAppStore((state) => state.debug);
  const setPopupScreenPosition = useAppStore((state) => state.setPopupScreenPosition);
  const setAnchorEditorScreenPosition = useAppStore((state) => state.setAnchorEditorScreenPosition);

  const patient = useMemo(
    () => patients.find((entry) => entry.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  const anchorLayouts = useMemo(
    () =>
      visibleBodyAnchorIds.map((anchorId) => {
        const anchor = getBodyAnchor(anchorId, anchorOverrides);
        const placement = getBodyAnchorPlacement({
          anchorId,
          overrides: anchorOverrides,
        });

        return {
          id: anchor.id,
          label: anchor.label,
          position: [placement.position[0], placement.position[1], placement.position[2] - 0.012] as [number, number, number],
          scaleMultiplier: Math.max(0.58, placement.scaleMultiplier * 0.76),
          selected: selectedAnchorId === anchor.id,
          coordinates: anchor.position,
        };
      }),
    [anchorOverrides, selectedAnchorId],
  );

  const markerLayouts = useMemo(() => {
    if (!patient) {
      return [];
    }

    return patient.conditions.map((condition) => {
      const siblings = patient.conditions.filter((entry) => entry.bodyArea === condition.bodyArea);
      const index = siblings.findIndex((entry) => entry.id === condition.id);
      const placement = getBodyAnchorPlacement({
        anchorId: condition.bodyArea,
        index,
        count: siblings.length,
        selected: selectedConditionId === condition.id,
        overrides: anchorOverrides,
      });
      return {
        condition,
        position: placement.position,
        scaleMultiplier: placement.scaleMultiplier,
      };
    });
  }, [anchorOverrides, patient, selectedConditionId]);

  useFrame(({ camera, size }) => {
    if (!modelSpaceRef.current) {
      return;
    }

    if (selectedConditionId) {
      const selected = markerLayouts.find((entry) => entry.condition.id === selectedConditionId);
      if (selected) {
        const worldPosition = new Vector3(...selected.position);
        modelSpaceRef.current.localToWorld(worldPosition);
        worldPosition.project(camera);
        setPopupScreenPosition({
          x: (worldPosition.x * 0.5 + 0.5) * size.width,
          y: (-worldPosition.y * 0.5 + 0.5) * size.height,
          visible: worldPosition.z < 1,
        });
      }
    }

    if (anchorEditMode && selectedAnchorId) {
      const selectedAnchor = anchorLayouts.find((entry) => entry.id === selectedAnchorId);
      if (selectedAnchor) {
        const worldPosition = new Vector3(...selectedAnchor.position);
        modelSpaceRef.current.localToWorld(worldPosition);
        worldPosition.project(camera);
        setAnchorEditorScreenPosition({
          x: (worldPosition.x * 0.5 + 0.5) * size.width,
          y: (-worldPosition.y * 0.5 + 0.5) * size.height,
          visible: worldPosition.z < 1,
        });
      }
    } else {
      setAnchorEditorScreenPosition({
        x: 0,
        y: 0,
        visible: false,
      });
    }
  });

  if (!patient) {
    return null;
  }

  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[3.6, 3.9, 0.12, 48]} />
        <meshStandardMaterial color="#2a2a2e" />
      </mesh>

      <NormalizedHumanModel ref={modelSpaceRef}>
        {anchorEditMode
          ? anchorLayouts.map((entry) => (
              <BodyAnchorMarker
                key={entry.id}
                anchorId={entry.id}
                label={entry.label}
                position={entry.position}
                scaleMultiplier={entry.scaleMultiplier}
                selected={entry.selected}
                coordinates={entry.coordinates}
                editMode={anchorEditMode}
                onSelect={(anchorId) => {
                  selectCondition(null);
                  selectAnchor(anchorId);
                }}
              />
            ))
          : null}
        {markerLayouts.map((entry) => (
          <ConditionMarker
            key={entry.condition.id}
            condition={entry.condition}
            position={entry.position}
            scaleMultiplier={entry.scaleMultiplier}
            selected={selectedConditionId === entry.condition.id}
            onSelect={selectCondition}
          />
        ))}
        {debug.showAnchors ? <AnchorDebug /> : null}
      </NormalizedHumanModel>
    </group>
  );
}
