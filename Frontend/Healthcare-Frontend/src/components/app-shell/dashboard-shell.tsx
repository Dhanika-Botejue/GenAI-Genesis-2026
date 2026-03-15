'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { OverlayLayout } from '@/components/app-shell/overlay-layout';
import { useHistorySync } from '@/lib/browser/history-sync';
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
}

export function DashboardShell({ topInset = false }: DashboardShellProps) {
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
    <div className="absolute inset-0">
      <SceneCanvasShell />
      <OverlayLayout topInset={topInset} />
    </div>
  );
}
