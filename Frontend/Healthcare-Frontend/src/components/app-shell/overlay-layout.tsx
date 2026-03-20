'use client';

import { AnchorAdjusterPopup } from '@/components/patient/anchor-adjuster-popup';
import { Legend } from '@/components/hospital/legend';
import { SelectedPatientCard } from '@/components/hospital/selected-patient-card';
import { ConditionPopup } from '@/components/patient/condition-popup';
import { UploadPanel } from '@/components/shared/upload-panel';
import { WarningStack } from '@/components/shared/warning-stack';
import { cn } from '@/lib/utils/cn';

interface OverlayLayoutProps {
  topInset?: boolean;
  controlsVisible?: boolean;
  animationsArmed?: boolean;
}

export function OverlayLayout({
  topInset = false,
  controlsVisible = true,
  animationsArmed = true,
}: OverlayLayoutProps) {
  return (
    <div
      aria-hidden={!controlsVisible}
      className={cn(
        'motion-smooth pointer-events-none absolute inset-0 z-20 flex flex-col transform-gpu',
        animationsArmed && 'transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
        topInset && 'pt-24 md:pt-28',
        controlsVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
      )}
    >
      <div className="grid flex-1 gap-4 px-4 pb-4 md:grid-cols-[320px_minmax(0,1fr)_320px] md:px-5 md:pb-5">
        <div className="pointer-events-auto order-2 flex max-h-[calc(100vh-6.5rem)] flex-col gap-4 overflow-hidden md:order-1">
          <UploadPanel />
        </div>

        <div className="order-1 md:order-2" />

        <div className="pointer-events-auto order-3 mt-6 flex max-h-[calc(100vh-6.5rem)] flex-col gap-4 overflow-hidden pr-8 md:mt-2 md:pr-4">
          <Legend />
          <SelectedPatientCard />
        </div>
      </div>

      <WarningStack />
      <ConditionPopup />
      <AnchorAdjusterPopup />
    </div>
  );
}
