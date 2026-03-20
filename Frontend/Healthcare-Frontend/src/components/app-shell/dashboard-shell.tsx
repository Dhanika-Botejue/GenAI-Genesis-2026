'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { OverlayLayout } from '@/components/app-shell/overlay-layout';
import { useHistorySync } from '@/lib/browser/history-sync';
import { cn } from '@/lib/utils/cn';
import { useAppStore } from '@/store/useAppStore';

const SceneCanvasShell = dynamic(
  () => import('@/components/app-shell/scene-canvas-shell').then((module) => module.SceneCanvasShell),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-white/40" />,
  },
);

interface DashboardShellProps {
  topInset?: boolean;
  controlsVisible?: boolean;
  backgroundSoftened?: boolean;
  animationsArmed?: boolean;
}

export function DashboardShell({
  topInset = false,
  controlsVisible = true,
  backgroundSoftened = false,
  animationsArmed = true,
}: DashboardShellProps) {
  useHistorySync();
  const requestCameraReset = useAppStore((state) => state.requestCameraReset);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      requestCameraReset();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestCameraReset]);

  return (
    <div
      className={cn(
        'absolute inset-0 motion-smooth transform-gpu',
        animationsArmed && 'transition-[transform,opacity] duration-[2200ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        backgroundSoftened ? 'scale-[1.008] opacity-[0.985]' : 'scale-100 opacity-100',
      )}
    >
      <SceneCanvasShell />
      <OverlayLayout topInset={topInset} controlsVisible={controlsVisible} animationsArmed={animationsArmed} />
    </div>
  );
}
