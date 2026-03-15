'use client';

import { useAppStore } from '@/store/useAppStore';

export function AnalysisDiagnostics() {
  const analysisState = useAppStore((state) => state.analysisState);
  const parsedFloorplan = useAppStore((state) => state.parsedFloorplan);

  const summary = parsedFloorplan?.confidenceSummary ?? { structure: 0, labels: 0, classification: 0 };
  return (
    <section className="medical-panel rounded-[28px] p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Analysis Status</h2>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <MetricCard label="Structure" value={`${Math.round((summary.structure ?? 0) * 100)}%`} />
        <MetricCard label="Labels" value={`${Math.round((summary.labels ?? 0) * 100)}%`} />
        <MetricCard label="Semantics" value={`${Math.round((summary.classification ?? 0) * 100)}%`} />
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Mode: <span className="font-medium text-slate-900">{analysisState.mode ?? 'pending'}</span>
      </p>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
