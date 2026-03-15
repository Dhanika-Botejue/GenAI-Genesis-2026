'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function useHistorySync() {
  const sceneMode = useAppStore((state) => state.sceneMode);
  const selectedPatientId = useAppStore((state) => state.selectedPatientId);
  const returnToHospital = useAppStore((state) => state.returnToHospital);
  const pushedRef = useRef(false);

  useEffect(() => {
    const handlePopState = () => {
      if (useAppStore.getState().sceneMode === 'patient') {
        returnToHospital();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [returnToHospital]);

  useEffect(() => {
    if (sceneMode === 'patient' && selectedPatientId && !pushedRef.current) {
      window.history.pushState({ sceneMode: 'patient', patientId: selectedPatientId }, '', `#patient-${selectedPatientId}`);
      pushedRef.current = true;
      return;
    }

    if (sceneMode === 'hospital' && pushedRef.current) {
      if (window.location.hash.startsWith('#patient-')) {
        window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
      }
      pushedRef.current = false;
    }
  }, [sceneMode, selectedPatientId]);
}
