'use client';

import { useEffect, useMemo, useState } from 'react';
import { isNarrowViewport } from '@/lib/browser/viewport';
import { getBodyAreaLabel } from '@/lib/scene/body-anchors';
import { useAppStore } from '@/store/useAppStore';
import type { Condition } from '@/types/domain';

function normalizeConditionText(value: string | null | undefined) {
  return String(value ?? '').trim();
}

export function ConditionPopup() {
  const sceneMode = useAppStore((state) => state.sceneMode);
  const selectedPatientId = useAppStore((state) => state.selectedPatientId);
  const selectedConditionId = useAppStore((state) => state.selectedConditionId);
  const patients = useAppStore((state) => state.patients);
  const popupPosition = useAppStore((state) => state.popupScreenPosition);
  const selectCondition = useAppStore((state) => state.selectCondition);
  const [narrow, setNarrow] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900 });
  const [generatedGuidance, setGeneratedGuidance] = useState<{ monitoring: string; recommendedSupport: string } | null>(null);
  const [loadingGuidance, setLoadingGuidance] = useState(false);

  useEffect(() => {
    const update = () => {
      setNarrow(isNarrowViewport(window.innerWidth));
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const patient = useMemo(
    () => patients.find((entry) => entry.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );
  const condition = useMemo(
    () => patient?.conditions.find((entry) => entry.id === selectedConditionId) ?? null,
    [patient, selectedConditionId],
  );
  const monitoringText = useMemo(
    () => normalizeConditionText(condition?.monitoring) || normalizeConditionText(generatedGuidance?.monitoring),
    [condition?.monitoring, generatedGuidance?.monitoring],
  );
  const recommendedSupportText = useMemo(
    () =>
      normalizeConditionText(condition?.recommendedSupport) ||
      normalizeConditionText(generatedGuidance?.recommendedSupport),
    [condition?.recommendedSupport, generatedGuidance?.recommendedSupport],
  );

  useEffect(() => {
    if (!patient || !condition) {
      setGeneratedGuidance(null);
      setLoadingGuidance(false);
      return;
    }

    if (condition.monitoring.trim() && condition.recommendedSupport.trim()) {
      setGeneratedGuidance(null);
      setLoadingGuidance(false);
      return;
    }

    let cancelled = false;
    setLoadingGuidance(true);
    setGeneratedGuidance(null);

    void fetch('/api/condition-guidance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label: condition.label,
        bodyArea: condition.bodyArea,
        severity: condition.severity,
        shortDescription: condition.shortDescription,
        detailedNotes: condition.detailedNotes,
        patientSummary: patient.summary,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as { monitoring?: string; recommendedSupport?: string } | null;
      })
      .then((payload) => {
        if (cancelled || !payload) {
          return;
        }
        setGeneratedGuidance({
          monitoring: String(payload.monitoring ?? '').trim(),
          recommendedSupport: String(payload.recommendedSupport ?? '').trim(),
        });
      })
      .catch(() => null)
      .finally(() => {
        if (!cancelled) {
          setLoadingGuidance(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [condition, patient]);

  if (sceneMode !== 'patient' || !patient || !condition || !popupPosition.visible) {
    return null;
  }

  if (narrow) {
    return (
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-40 flex max-h-[60vh] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-2xl">
        <PopupBody
          condition={condition}
          monitoring={monitoringText}
          recommendedSupport={recommendedSupportText}
          loadingGuidance={loadingGuidance}
          onClose={() => selectCondition(null)}
        />
      </div>
    );
  }

  const left = Math.min(Math.max(popupPosition.x - 160, 20), viewport.width - 360);
  const top = Math.min(Math.max(popupPosition.y - 70, 90), viewport.height - viewport.height * 0.5 - 20);

  return (
    <div
      className="pointer-events-auto absolute z-40 flex w-[340px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white/96 p-4 shadow-2xl"
      style={{ left, top, maxHeight: '50vh' }}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <PopupBody
        condition={condition}
        monitoring={monitoringText}
        recommendedSupport={recommendedSupportText}
        loadingGuidance={loadingGuidance}
        onClose={() => selectCondition(null)}
      />
    </div>
  );
}

function PopupBody({
  condition,
  monitoring,
  recommendedSupport,
  loadingGuidance,
  onClose,
}: {
  condition: Condition;
  monitoring: string;
  recommendedSupport: string;
  loadingGuidance: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Condition</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{condition.label}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {getBodyAreaLabel(condition.bodyArea)} | <span style={{ color: condition.color }}>{condition.severity}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
        >
          Close
        </button>
      </div>
      <div className="scrollbar-thin mt-4 min-h-0 flex-1 space-y-3 overflow-auto pr-2">
        <Section label="Summary">{condition.shortDescription}</Section>
        <Section label="Care Notes">{condition.detailedNotes}</Section>
        <Section label="Monitoring">{monitoring || (loadingGuidance ? 'Generating guidance...' : 'No guidance available.')}</Section>
        <Section label="Recommended Support">{recommendedSupport || (loadingGuidance ? 'Generating guidance...' : 'No guidance available.')}</Section>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{children}</p>
    </div>
  );
}
