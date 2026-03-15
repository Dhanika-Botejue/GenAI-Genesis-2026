'use client';

import { useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

export function WarningStack() {
  const parsedFloorplan = useAppStore((state) => state.parsedFloorplan);
  const uploadError = useAppStore((state) => state.uploadState.error);

  const warnings = useMemo(() => {
    const items = (parsedFloorplan?.warnings ?? []).filter((warning) => warning.level !== 'info');
    if (uploadError) {
      items.unshift({
        id: 'upload-error-inline',
        level: 'error' as const,
        message: uploadError,
        code: 'upload-invalid' as const,
      });
    }
    return items.slice(0, 4);
  }, [parsedFloorplan?.warnings, uploadError]);

  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 z-30 flex max-w-[min(520px,calc(100vw-2rem))] flex-col gap-2 md:bottom-5 md:left-5">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          className={`medical-panel rounded-2xl px-4 py-3 text-sm ${
            warning.level === 'error' ? 'border-red-200/80 bg-red-50/90 text-red-900' : 'text-slate-700'
          }`}
        >
          {warning.message}
        </div>
      ))}
    </div>
  );
}
