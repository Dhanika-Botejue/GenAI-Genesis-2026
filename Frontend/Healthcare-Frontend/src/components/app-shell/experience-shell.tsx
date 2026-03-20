'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DashboardShell } from '@/components/app-shell/dashboard-shell';
import { LandingOverlay } from '@/components/app-shell/landing-overlay';
import { DoctorDashboard } from '@/components/doctor/doctor-dashboard';
import { TopBar } from '@/components/shared/topbar';
import { refreshSceneFromPatients } from '@/lib/doctor/refresh-scene';
import { useAppStore } from '@/store/useAppStore';
import type { AppMode } from '@/types/app-mode';

const appModeStorageKey = 'healthcare-frontend.active-mode';
const LANDING_REVEAL_MS = 2200;

type LandingPhase = 'intro' | 'transition' | 'revealed';

export function ExperienceShell() {
  const [appMode, setAppMode] = useState<AppMode>('nurse');
  const [animationsArmed, setAnimationsArmed] = useState(false);
  const [landingPhase, setLandingPhase] = useState<LandingPhase>('intro');
  const sceneMode = useAppStore((state) => state.sceneMode);
  const returnToHospital = useAppStore((state) => state.returnToHospital);
  const applyLiveRoomData = useAppStore((state) => state.applyLiveRoomData);
  const patientRefreshNonce = useAppStore((state) => state.patientRefreshNonce);
  const revealTimerRef = useRef<number | null>(null);
  const animationArmRef = useRef<number | null>(null);

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

  useEffect(() => {
    const armAnimations = () => {
      setAnimationsArmed(true);
      animationArmRef.current = null;
    };

    if (typeof window.requestIdleCallback === 'function') {
      animationArmRef.current = window.requestIdleCallback(armAnimations, { timeout: 320 }) as unknown as number;
      return () => {
        if (animationArmRef.current !== null) {
          window.cancelIdleCallback?.(animationArmRef.current);
        }
      };
    }

    animationArmRef.current = window.setTimeout(armAnimations, 80);

    return () => {
      if (animationArmRef.current !== null) {
        window.clearTimeout(animationArmRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current !== null) {
        window.clearTimeout(revealTimerRef.current);
      }
      if (animationArmRef.current !== null) {
        window.clearTimeout(animationArmRef.current);
      }
    };
  }, []);

  const handleLandingReveal = useCallback(() => {
    if (landingPhase !== 'intro') {
      return;
    }

    if (!animationsArmed) {
      setAnimationsArmed(true);
    }
    setLandingPhase('transition');
    revealTimerRef.current = window.setTimeout(() => {
      setLandingPhase('revealed');
      revealTimerRef.current = null;
    }, LANDING_REVEAL_MS);
  }, [animationsArmed, landingPhase]);

  const controlsVisible = landingPhase !== 'intro';
  const backgroundSoftened = landingPhase === 'intro';

  return (
    <main className="relative min-h-screen overflow-hidden">
      <LandingOverlay phase={landingPhase} onReveal={handleLandingReveal} animationsArmed={animationsArmed} />
      <TopBar
        appMode={appMode}
        onAppModeChange={setAppMode}
        showBackToFloorPlan={appMode === 'nurse' && sceneMode === 'patient'}
        onBackToFloorPlan={returnToHospital}
        controlsVisible={controlsVisible}
        animationsArmed={animationsArmed}
      />

      {appMode === 'nurse' ? (
        <DashboardShell
          topInset
          controlsVisible={controlsVisible}
          backgroundSoftened={backgroundSoftened}
          animationsArmed={animationsArmed}
        />
      ) : (
        <DoctorDashboard />
      )}
    </main>
  );
}
