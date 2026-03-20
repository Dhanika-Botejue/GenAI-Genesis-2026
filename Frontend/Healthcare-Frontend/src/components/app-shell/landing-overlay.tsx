'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

type LandingPhase = 'intro' | 'transition' | 'revealed';

interface LandingOverlayProps {
  phase: LandingPhase;
  onReveal: () => void;
  animationsArmed?: boolean;
}

export function LandingOverlay({ phase, onReveal, animationsArmed = true }: LandingOverlayProps) {
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    if (phase === 'revealed') {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY > 8 && phase === 'intro') {
        onReveal();
      }
      event.preventDefault();
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const touchStartY = touchStartYRef.current;
      const currentY = event.touches[0]?.clientY ?? null;
      if (touchStartY !== null && currentY !== null && touchStartY - currentY > 16 && phase === 'intro') {
        onReveal();
        touchStartYRef.current = null;
      }
      event.preventDefault();
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [onReveal, phase]);

  if (phase === 'revealed') {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-40 overflow-hidden backdrop-blur-[6px] backdrop-saturate-[1.04]',
        animationsArmed && 'motion-smooth',
        phase === 'intro' || phase === 'transition'
          ? 'bg-[linear-gradient(180deg,rgba(246,244,239,0.5)_0%,rgba(244,241,236,0.38)_100%)] opacity-100'
          : 'pointer-events-none bg-[linear-gradient(180deg,rgba(246,244,239,0.12)_0%,rgba(244,241,236,0.08)_100%)] opacity-0',
        phase === 'transition' && animationsArmed && 'landing-overlay-exit',
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(255,208,98,0.28),transparent_46%),radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.4),transparent_62%)]" />

      <div
        className={cn(
          'relative z-10 flex min-h-screen items-center justify-center px-6 motion-smooth transform-gpu',
          phase === 'intro' || phase === 'transition' ? 'opacity-100' : 'opacity-0',
          phase === 'transition' && animationsArmed && 'landing-hero-exit',
        )}
      >
        <div className="flex max-w-3xl flex-col items-center text-center">
          <div
            className={cn(
              'motion-smooth transform-gpu',
              phase === 'intro' || phase === 'transition' ? 'opacity-100' : 'opacity-0',
              phase === 'transition' && animationsArmed && 'landing-logo-exit',
            )}
          >
            <Image
              src="/branding/halo-logo.svg"
              alt="Halo"
              width={640}
              height={360}
              priority
              className="h-auto w-[min(96vw,48rem)] md:w-[min(90vw,58rem)] drop-shadow-[0_18px_38px_rgba(24,49,63,0.12)]"
            />
          </div>
          <p
            className={cn(
              'motion-smooth mt-4 max-w-lg text-sm font-medium tracking-[0.12em] text-slate-600 transform-gpu sm:text-base',
              phase === 'intro' || phase === 'transition' ? 'opacity-100' : 'opacity-0',
              phase === 'transition' && animationsArmed && 'landing-caption-exit',
            )}
          >
            Uniting the doctor's desk and the hospital floor.
          </p>
          <button
            type="button"
            onClick={onReveal}
            className={cn(
              'motion-smooth mt-7 rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_18px_35px_rgba(15,23,42,0.18)] transform-gpu hover:bg-slate-800',
              phase === 'intro' || phase === 'transition' ? 'opacity-100' : 'opacity-0',
              phase === 'transition' && animationsArmed && 'landing-button-exit',
            )}
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
