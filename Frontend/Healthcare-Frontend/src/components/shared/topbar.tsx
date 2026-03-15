'use client';

import { cn } from '@/lib/utils/cn';
import type { AppMode } from '@/types/app-mode';

interface TopBarProps {
  appMode: AppMode;
  onAppModeChange: (mode: AppMode) => void;
  showBackToFloorPlan?: boolean;
  onBackToFloorPlan?: () => void;
}

const modeCopy: Record<AppMode, { title: string; description: string }> = {
  nurse: {
    title: 'Hospital',
    description: '3D floor plan, live room data, and bedside inspection',
  },
  doctor: {
    title: 'Doctor',
    description: 'Twilio follow-ups, patient records, and call history',
  },
};

export function TopBar({
  appMode,
  onAppModeChange,
  showBackToFloorPlan = false,
  onBackToFloorPlan,
}: TopBarProps) {
  const currentMode = modeCopy[appMode];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 px-4 py-4 md:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="pointer-events-auto medical-panel rounded-[24px] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">Integrated Care Workspace</p>
          <div className="mt-1.5 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
            <p className="text-base font-semibold text-slate-900">{currentMode.title}</p>
            <p className="text-xs text-slate-500">{currentMode.description}</p>
          </div>
        </div>

        <div className="pointer-events-auto medical-panel flex w-fit items-center gap-1 rounded-full p-1.5">
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

        <div className="pointer-events-auto flex min-h-11 items-center justify-start lg:min-w-[190px] lg:justify-end">
          {showBackToFloorPlan ? (
            <button
              type="button"
              onClick={onBackToFloorPlan}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:bg-slate-800"
            >
              Back to Floor Plan
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
