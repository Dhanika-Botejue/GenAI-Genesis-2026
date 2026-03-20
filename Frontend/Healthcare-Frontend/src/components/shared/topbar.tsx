'use client';

import { cn } from '@/lib/utils/cn';
import type { AppMode } from '@/types/app-mode';

interface TopBarProps {
  appMode: AppMode;
  onAppModeChange: (mode: AppMode) => void;
  showBackToFloorPlan?: boolean;
  onBackToFloorPlan?: () => void;
  controlsVisible?: boolean;
  animationsArmed?: boolean;
}

const modeCopy: Record<AppMode, { title: string; description: string }> = {
  nurse: {
    title: 'Hospital',
    description: '3D floor plan, live room data, and bedside inspection',
  },
  doctor: {
    title: 'Doctor',
    description: 'Patient follow-ups, symptom triage, and response history',
  },
};

export function TopBar({
  appMode,
  onAppModeChange,
  showBackToFloorPlan = false,
  onBackToFloorPlan,
  controlsVisible = true,
  animationsArmed = true,
}: TopBarProps) {
  const currentMode = modeCopy[appMode];

  return (
    <div
      aria-hidden={!controlsVisible}
      className={cn(
        'motion-smooth absolute inset-x-0 top-0 z-30 px-4 py-4 transform-gpu md:px-5',
        animationsArmed && 'transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        controlsVisible ? 'pointer-events-none translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0',
      )}
    >
      <div className="relative md:min-h-[86px]">
        <div className="pointer-events-auto w-full max-w-[440px] medical-panel rounded-[24px] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">Integrated Care Workspace</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="text-base font-semibold text-slate-900">{currentMode.title}</p>
            <p className={cn('text-xs text-slate-500', !currentMode.description && 'invisible')} aria-hidden={!currentMode.description}>
              {currentMode.description || modeCopy.nurse.description}
            </p>
          </div>
        </div>

        <div className="pointer-events-auto mt-6 flex justify-end pr-8 md:absolute md:right-4 md:top-2 md:mt-0 md:pr-0">
          <div className="flex items-center justify-end gap-3">
            <div className="medical-panel flex w-fit items-center gap-1 rounded-full p-1.5">
              {(['nurse', 'doctor'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onAppModeChange(mode)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition sm:px-5',
                    appMode === mode
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                  )}
                >
                  {modeCopy[mode].title}
                </button>
              ))}
            </div>
            {showBackToFloorPlan ? (
              <div className="flex min-h-11 items-center justify-end">
                <button
                  type="button"
                  onClick={onBackToFloorPlan}
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-slate-800"
                >
                  Back to Floor Plan
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
