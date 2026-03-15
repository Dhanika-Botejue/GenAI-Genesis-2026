'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store/useAppStore';

interface ResidentName {
  firstName: string;
  lastName: string;
}

export function SelectedPatientCard() {
  const selectedPatientId = useAppStore((state) => state.selectedPatientId);
  const patients = useAppStore((state) => state.patients);
  const [residentName, setResidentName] = useState<ResidentName | null>(null);
  const [loading, setLoading] = useState(false);

  const patient = useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  useEffect(() => {
    if (!selectedPatientId) {
      setResidentName(null);
      return;
    }

    setLoading(true);
    setResidentName(null);

    fetch(`/api/doctor/patients/${selectedPatientId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.firstName) {
          setResidentName({ firstName: data.firstName, lastName: data.lastName ?? '' });
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [selectedPatientId]);

  if (!selectedPatientId || !patient) return null;

  const displayName = residentName
    ? `${residentName.firstName} ${residentName.lastName}`.trim()
    : loading
      ? patient.name
      : patient.name;

  const fullName = residentName
    ? `${residentName.firstName} ${residentName.lastName}`.trim()
    : null;

  const showRealName = fullName && fullName !== patient.name;

  return (
    <div className="medical-panel mt-auto rounded-[28px] p-4 shadow-[var(--shadow)]">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Selected Patient
      </p>
      {showRealName ? (
        <>
          <p className="text-base font-semibold leading-tight text-slate-800">{fullName}</p>
          <p className="mt-0.5 text-xs text-slate-400">{patient.name}</p>
        </>
      ) : (
        <p className="text-base font-semibold leading-tight text-slate-800">
          {loading ? patient.name : displayName}
        </p>
      )}
      {patient.age ? (
        <p className="mt-1 text-xs text-slate-500">Age {patient.age}</p>
      ) : null}
    </div>
  );
}
