'use client';

import { useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/app-shell/dashboard-shell';
import { DoctorDashboard } from '@/components/doctor/doctor-dashboard';
import { TopBar } from '@/components/shared/topbar';
import { refreshSceneFromPatients } from '@/lib/doctor/refresh-scene';
import { useAppStore } from '@/store/useAppStore';
import type { AppMode } from '@/types/app-mode';

const appModeStorageKey = 'healthcare-frontend.active-mode';

export function ExperienceShell() {
  const [appMode, setAppMode] = useState<AppMode>('nurse');
  const sceneMode = useAppStore((state) => state.sceneMode);
  const returnToHospital = useAppStore((state) => state.returnToHospital);
  const applyLiveRoomData = useAppStore((state) => state.applyLiveRoomData);
  const patientRefreshNonce = useAppStore((state) => state.patientRefreshNonce);

  useEffect(() => {
    const storedMode = window.localStorage.getItem(appModeStorageKey);
    if (storedMode === 'nurse' || storedMode === 'doctor') {
      setAppMode(storedMode);
      return;
    }

    // Backward compatibility for previously stored display labels.
    if (storedMode === 'Hospital') {
      setAppMode('nurse');
      return;
    }

    if (storedMode === 'Doctor') {
      setAppMode('doctor');
    }
  }, []);

  // Fetch real patients from the backend on mount and after every floor plan analysis.
  useEffect(() => {
    void (async () => {
      try {
        const result = await refreshSceneFromPatients();
        if (result) applyLiveRoomData(result);
      } catch (err) {
        console.warn('[ExperienceShell] Patient refresh failed:', err);
      }
    })();
  }, [patientRefreshNonce]);

  useEffect(() => {
    window.localStorage.setItem(appModeStorageKey, appMode);
  }, [appMode]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <TopBar
        appMode={appMode}
        onAppModeChange={setAppMode}
        showBackToFloorPlan={appMode === 'nurse' && sceneMode === 'patient'}
        onBackToFloorPlan={returnToHospital}
      />

      {appMode === 'nurse' ? <DashboardShell topInset /> : <DoctorDashboard />}
    </main>
  );
}
