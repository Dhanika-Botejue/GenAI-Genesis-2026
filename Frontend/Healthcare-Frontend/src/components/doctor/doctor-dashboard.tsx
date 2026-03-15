'use client';

import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import {
  createDoctorPatient,
  deleteDoctorPatient,
  fetchDoctorPatient,
  fetchDoctorPatientHistory,
  fetchDoctorPatients,
  fetchDoctorSession,
  startDoctorCall,
  updateDoctorPatient,
} from '@/lib/doctor/api';
import type { DoctorCallSession, DoctorEmergencyContact, DoctorPatient } from '@/lib/doctor/types';
import { getRoomAvailability, isRealRoomNumber, isRoomAvailableForPatient } from '@/lib/doctor/room-availability';
import { refreshSceneViaGemini } from '@/lib/doctor/refresh-scene';
import { buildSceneFeedFromDoctorPatients } from '@/lib/doctor/sync-to-scene';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils/cn';

type DoctorTab = 'profile' | 'call' | 'history';

const emptyEmergencyContact: DoctorEmergencyContact = { name: '', relationship: '', phone: '' };

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : 'Doctor workspace request failed.';
}

function splitList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const inputClassName =
  'w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/80';
const primaryButtonClassName =
  'rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800';
const ghostButtonClassName =
  'rounded-full border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white';

export function DoctorDashboard() {
  const applyLiveRoomData = useAppStore((state) => state.applyLiveRoomData);
  const storeParsedFloorplan = useAppStore((state) => state.parsedFloorplan);

  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<DoctorPatient | null>(null);
  const [profileDraft, setProfileDraft] = useState<Partial<DoctorPatient>>({});
  const [tab, setTab] = useState<DoctorTab>('profile');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const [questions, setQuestions] = useState<string[]>(['']);
  const [calling, setCalling] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [liveGreetingNotes, setLiveGreetingNotes] = useState('');
  const [liveAnswers, setLiveAnswers] = useState<DoctorCallSession['answers']>([]);

  const [history, setHistory] = useState<DoctorCallSession[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [editingSidebarId, setEditingSidebarId] = useState<string | null>(null);
  const [editingSidebarFirstName, setEditingSidebarFirstName] = useState('');
  const [editingSidebarLastName, setEditingSidebarLastName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomAvailability = useMemo(
    () => getRoomAvailability(storeParsedFloorplan, patients),
    [storeParsedFloorplan, patients],
  );

  function clearPolling() {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  async function loadPatients(selectedId?: string | null) {
    setPatientsLoading(true);
    setLoadError(null);

    try {
      const nextPatients = await fetchDoctorPatients();
      setPatients(nextPatients);
      if (selectedId && !nextPatients.some((patient) => patient._id === selectedId)) {
        setSelectedPatient(null);
        setProfileDraft({});
        setHistory([]);
      }
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setPatientsLoading(false);
    }
  }

  async function loadHistory(patientId: string) {
    setHistoryError(null);
    try {
      setHistory(await fetchDoctorPatientHistory(patientId));
    } catch (error) {
      setHistory([]);
      setHistoryError(getErrorMessage(error));
    }
  }

  async function selectPatient(patient: DoctorPatient) {
    clearPolling();
    setCalling(false);
    setActiveSessionId(null);
    setLiveGreetingNotes('');
    setLiveAnswers([]);
    setCallError(null);
    setProfileError(null);
    setEditingProfile(false);
    setEditingSidebarId(null);
    setConfirmDeleteId(null);
    setQuestions(['']);
    setTab('profile');

    try {
      const fullPatient = await fetchDoctorPatient(patient._id);
      setSelectedPatient(fullPatient);
      setProfileDraft(fullPatient);
    } catch (error) {
      setSelectedPatient(patient);
      setProfileDraft(patient);
      setProfileError(getErrorMessage(error));
    }

    await loadHistory(patient._id);
  }

  useEffect(() => {
    void loadPatients();
    return () => clearPolling();
  }, []);

  // Immediately sync rooms whenever the patient list changes.
  // Read floorplan via getState() to avoid infinite loop: including storeParsedFloorplan
  // in deps would re-run when applyLiveRoomData updates the store.
  useEffect(() => {
    if (patientsLoading) return;
    const currentFloorplan = useAppStore.getState().parsedFloorplan;
    const payload = buildSceneFeedFromDoctorPatients(patients, currentFloorplan);
    if (payload) applyLiveRoomData(payload);
  }, [patients, patientsLoading, applyLiveRoomData]);

  async function handleAddPatient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAddError(null);

    if (roomAvailability.allOccupied) {
      setAddError('All rooms are occupied. Cannot add new patients.');
      return;
    }

    try {
      const created = await createDoctorPatient({
        firstName: newFirstName.trim(),
        lastName: newLastName.trim(),
        phone: newPhone.trim(),
      });

      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setShowAddForm(false);
      await loadPatients(created._id);
      await selectPatient(created);
    } catch (error) {
      setAddError(getErrorMessage(error));
    }
  }

  async function saveProfile() {
    if (!selectedPatient) {
      return;
    }

    setProfileError(null);

    const roomStr = profileDraft.room?.trim();
    if (roomStr) {
      const roomNum = parseInt(roomStr.replace(/\D+/g, ''), 10);
      if (Number.isNaN(roomNum)) {
        setProfileError('Room must be a valid room number.');
        return;
      }
      if (!isRealRoomNumber(roomNum, roomAvailability.careRoomNumbers)) {
        setProfileError(`Room ${roomNum} is not a valid care room.`);
        return;
      }
      if (!isRoomAvailableForPatient(roomNum, selectedPatient._id, roomAvailability.roomToPatientId)) {
        setProfileError(`Room ${roomNum} is already occupied by another patient.`);
        return;
      }
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      const updated = await updateDoctorPatient(selectedPatient._id, profileDraft);
      setSelectedPatient(updated);
      setProfileDraft(updated);
      setEditingProfile(false);
      await loadPatients(updated._id);
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setProfileSaving(false);
    }
  }

  function setProfileField<Key extends keyof DoctorPatient>(key: Key, value: DoctorPatient[Key]) {
    setProfileDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
  }

  function setEmergencyContactField<Key extends keyof DoctorEmergencyContact>(key: Key, value: string) {
    setProfileDraft((currentDraft) => ({
      ...currentDraft,
      emergencyContact: { ...(currentDraft.emergencyContact ?? emptyEmergencyContact), [key]: value },
    }));
  }

  async function saveSidebarEdit(patientId: string) {
    try {
      const updated = await updateDoctorPatient(patientId, {
        firstName: editingSidebarFirstName.trim(),
        lastName: editingSidebarLastName.trim(),
      });

      setEditingSidebarId(null);
      setPatients((currentPatients) =>
        currentPatients.map((patient) => (patient._id === patientId ? { ...patient, ...updated } : patient)),
      );

      if (selectedPatient?._id === patientId) {
        setSelectedPatient((currentPatient) =>
          currentPatient ? { ...currentPatient, firstName: updated.firstName, lastName: updated.lastName } : currentPatient,
        );
        setProfileDraft((currentDraft) => ({
          ...currentDraft,
          firstName: updated.firstName,
          lastName: updated.lastName,
        }));
      }
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }

  async function handleDeletePatient(patientId: string) {
    try {
      await deleteDoctorPatient(patientId);
      if (selectedPatient?._id === patientId) {
        setSelectedPatient(null);
        setProfileDraft({});
        setHistory([]);
        clearPolling();
        setCalling(false);
        setActiveSessionId(null);
        setLiveGreetingNotes('');
        setLiveAnswers([]);
      }
      setConfirmDeleteId(null);
      setEditingSidebarId(null);
      await loadPatients(selectedPatient?._id === patientId ? null : selectedPatient?._id ?? null);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    }
  }

  function updateQuestion(index: number, value: string) {
    setQuestions((currentQuestions) =>
      currentQuestions.map((question, currentIndex) => (currentIndex === index ? value : question)),
    );
  }

  function addQuestion() {
    setQuestions((currentQuestions) => [...currentQuestions, '']);
  }

  function removeQuestion(index: number) {
    setQuestions((currentQuestions) =>
      currentQuestions.length === 1 ? currentQuestions : currentQuestions.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  async function triggerGeminiRefresh() {
    try {
      const result = await refreshSceneViaGemini(storeParsedFloorplan);
      if (result) applyLiveRoomData(result);
    } catch {
      // best-effort
    }
  }

  async function initiateCall() {
    if (!selectedPatient) {
      return;
    }

    const validQuestions = questions.map((question) => question.trim()).filter(Boolean);
    if (validQuestions.length === 0) {
      setCallError('Add at least one question before starting a call.');
      return;
    }

    clearPolling();
    setCalling(true);
    setCallError(null);
    setActiveSessionId(null);
    setLiveGreetingNotes('');
    setLiveAnswers([]);

    try {
      const session = await startDoctorCall({
        patient_id: selectedPatient._id,
        questions: validQuestions,
      });

      const patientId = selectedPatient._id;
      setActiveSessionId(session.session_id);
      setTab('call');

      pollIntervalRef.current = setInterval(async () => {
        try {
          const nextSession = await fetchDoctorSession(session.session_id);
          setLiveGreetingNotes(nextSession.greeting_notes ?? '');
          setLiveAnswers(nextSession.answers ?? []);

          if (nextSession.status === 'completed') {
            clearPolling();
            setCalling(false);
            await loadHistory(patientId);
            void triggerGeminiRefresh();
          }
        } catch (error) {
          clearPolling();
          setCalling(false);
          setCallError(getErrorMessage(error));
        }
      }, 2000);

      pollTimeoutRef.current = setTimeout(async () => {
        clearPolling();
        setCalling(false);
        await loadHistory(patientId);
        void triggerGeminiRefresh();
      }, 120000);
    } catch (error) {
      setCalling(false);
      setCallError(getErrorMessage(error));
    }
  }

  const selectedPatientName = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}`.trim() : '';

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="relative min-h-full px-4 pb-6 pt-24 md:px-5 md:pb-8 md:pt-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(193,228,234,0.48),transparent_35%),radial-gradient(circle_at_top_right,rgba(250,211,176,0.22),transparent_28%),linear-gradient(180deg,#f8f5ef_0%,#ecf4f2_100%)]" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-4">
          <section className="medical-panel rounded-[32px] border-sky-200/70 px-5 py-5 md:px-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Doctor Workspace</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Twilio-guided patient follow-ups</h2>
          </section>

          {loadError ? (
            <div className="medical-panel rounded-[24px] border-red-200/80 bg-red-50/90 px-5 py-4 text-sm text-red-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p>{loadError}</p>
                <button type="button" onClick={() => void loadPatients(selectedPatient?._id ?? null)} className={primaryButtonClassName}>Retry</button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="medical-panel flex min-h-[640px] flex-col rounded-[30px] p-4 md:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Patient Registry</p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">{patientsLoading ? 'Loading...' : `${patients.length} patients`}</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() => { setShowAddForm((currentValue) => !currentValue); setAddError(null); }}
                    disabled={roomAvailability.allOccupied}
                    className={cn(ghostButtonClassName, roomAvailability.allOccupied && 'cursor-not-allowed opacity-60')}
                  >
                    {showAddForm ? 'Close' : 'Add'}
                  </button>
                  {roomAvailability.allOccupied ? (
                    <span className="text-[11px] text-amber-700">All rooms are occupied</span>
                  ) : null}
                </div>
              </div>

              {showAddForm ? (
                <form onSubmit={handleAddPatient} className="mt-4 rounded-[24px] border border-slate-200/80 bg-white/80 p-4">
                  <StackLabel label="First name"><input value={newFirstName} onChange={(event) => setNewFirstName(event.target.value)} className={cn(inputClassName, 'mt-2')} required /></StackLabel>
                  <StackLabel label="Last name"><input value={newLastName} onChange={(event) => setNewLastName(event.target.value)} className={cn(inputClassName, 'mt-3')} required /></StackLabel>
                  <StackLabel label="Phone"><input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} placeholder="16471234567" className={cn(inputClassName, 'mt-3')} required /></StackLabel>
                  {addError ? <p className="mt-3 text-sm text-red-700">{addError}</p> : null}
                  <button type="submit" className={cn(primaryButtonClassName, 'mt-4')}>Create patient</button>
                </form>
              ) : null}

              <div className="scrollbar-thin mt-4 flex max-h-[calc(100vh-18rem)] flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {patientsLoading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-[24px] bg-white/70" />) : null}
                {!patientsLoading && patients.length === 0 ? <div className="rounded-[24px] border border-dashed border-slate-300/80 bg-white/65 px-4 py-6 text-center text-sm text-slate-500">Add a patient to begin.</div> : null}
                {!patientsLoading ? patients.map((patient) => {
                  const isSelected = selectedPatient?._id === patient._id;
                  const isEditing = editingSidebarId === patient._id;
                  const isConfirmingDelete = confirmDeleteId === patient._id;
                  return (
                    <div key={patient._id} className="relative">
                      <div className={cn('rounded-[24px] border px-4 py-3 transition', isSelected ? 'border-sky-300/90 bg-sky-50/90' : 'border-transparent bg-white/75 hover:border-slate-200 hover:bg-white')}>
                        {isEditing ? (
                          <div className="grid gap-3">
                            <input value={editingSidebarFirstName} onChange={(event) => setEditingSidebarFirstName(event.target.value)} className={inputClassName} placeholder="First name" />
                            <input value={editingSidebarLastName} onChange={(event) => setEditingSidebarLastName(event.target.value)} className={inputClassName} placeholder="Last name" />
                          </div>
                        ) : (
                          <button type="button" onClick={() => void selectPatient(patient)} className="w-full text-left">
                            <p className="text-sm font-semibold text-slate-900">{patient.firstName} {patient.lastName}</p>
                            <p className="mt-1 text-sm text-slate-500">{patient.phone}</p>
                          </button>
                        )}
                        <div className="mt-3 flex items-center justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button type="button" onClick={() => setEditingSidebarId(null)} className={ghostButtonClassName}>Cancel</button>
                              <button type="button" onClick={() => void saveSidebarEdit(patient._id)} className={primaryButtonClassName}>Save</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => { setEditingSidebarId(patient._id); setEditingSidebarFirstName(patient.firstName); setEditingSidebarLastName(patient.lastName); setConfirmDeleteId(null); }} className={ghostButtonClassName}>Edit</button>
                              <button type="button" onClick={() => { setConfirmDeleteId(patient._id); setEditingSidebarId(null); }} className="rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100">Delete</button>
                            </>
                          )}
                        </div>
                      </div>
                      {isConfirmingDelete ? <div className="absolute inset-3 flex items-center justify-center rounded-[20px] bg-white/95 backdrop-blur"><div className="text-center"><p className="text-sm font-semibold text-slate-900">Delete this patient?</p><div className="mt-3 flex items-center justify-center gap-2"><button type="button" onClick={() => setConfirmDeleteId(null)} className={ghostButtonClassName}>Cancel</button><button type="button" onClick={() => void handleDeletePatient(patient._id)} className="rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">Confirm</button></div></div></div> : null}
                    </div>
                  );
                }) : null}
              </div>
            </aside>

            <section className="flex min-h-[640px] flex-col gap-4">
              {!selectedPatient ? <div className="medical-panel flex min-h-[640px] flex-col items-center justify-center rounded-[32px] px-6 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">DR</div><h3 className="mt-5 text-xl font-semibold text-slate-900">Choose a patient to open Doctor mode</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Patient editing, question authoring, Twilio call launch, live polling, and history all appear here.</p></div> : <DoctorMain
                selectedPatient={selectedPatient}
                selectedPatientName={selectedPatientName}
                tab={tab}
                setTab={setTab}
                calling={calling}
                editingProfile={editingProfile}
                setEditingProfile={setEditingProfile}
                profileDraft={profileDraft}
                setProfileDraft={setProfileDraft}
                profileError={profileError}
                profileSaving={profileSaving}
                saveProfile={saveProfile}
                setProfileField={setProfileField}
                setEmergencyContactField={setEmergencyContactField}
                questions={questions}
                updateQuestion={updateQuestion}
                addQuestion={addQuestion}
                removeQuestion={removeQuestion}
                initiateCall={initiateCall}
                callError={callError}
                activeSessionId={activeSessionId}
                liveGreetingNotes={liveGreetingNotes}
                liveAnswers={liveAnswers}
                history={history}
                historyError={historyError}
              />}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function DoctorMain({
  selectedPatient,
  selectedPatientName,
  tab,
  setTab,
  calling,
  editingProfile,
  setEditingProfile,
  profileDraft,
  setProfileDraft,
  profileError,
  profileSaving,
  saveProfile,
  setProfileField,
  setEmergencyContactField,
  questions,
  updateQuestion,
  addQuestion,
  removeQuestion,
  initiateCall,
  callError,
  activeSessionId,
  liveGreetingNotes,
  liveAnswers,
  history,
  historyError,
}: {
  selectedPatient: DoctorPatient;
  selectedPatientName: string;
  tab: DoctorTab;
  setTab: (tab: DoctorTab) => void;
  calling: boolean;
  editingProfile: boolean;
  setEditingProfile: (value: boolean) => void;
  profileDraft: Partial<DoctorPatient>;
  setProfileDraft: Dispatch<SetStateAction<Partial<DoctorPatient>>>;
  profileError: string | null;
  profileSaving: boolean;
  saveProfile: () => Promise<void>;
  setProfileField: <Key extends keyof DoctorPatient>(key: Key, value: DoctorPatient[Key]) => void;
  setEmergencyContactField: <Key extends keyof DoctorEmergencyContact>(key: Key, value: string) => void;
  questions: string[];
  updateQuestion: (index: number, value: string) => void;
  addQuestion: () => void;
  removeQuestion: (index: number) => void;
  initiateCall: () => Promise<void>;
  callError: string | null;
  activeSessionId: string | null;
  liveGreetingNotes: string;
  liveAnswers: DoctorCallSession['answers'];
  history: DoctorCallSession[];
  historyError: string | null;
}) {
  return (
    <>
      <div className="medical-panel rounded-[32px] px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Selected Patient</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{selectedPatientName}</h3>
            <p className="mt-1 text-sm text-slate-500">{selectedPatient.phone}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {selectedPatient.room ? <Chip>{`Room ${selectedPatient.room}`}</Chip> : null}
              {selectedPatient.primaryDiagnosis ? <Chip tone="accent">{selectedPatient.primaryDiagnosis}</Chip> : null}
              {calling ? <Chip tone="success">Call in progress</Chip> : null}
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-600">
            Nurse keeps the 3D floor plan. Doctor owns phone outreach and follow-up history.
          </div>
        </div>
      </div>

      <div className="medical-panel flex items-center gap-2 rounded-full p-1.5">
        {(['profile', 'call', 'history'] as const).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            onClick={() => setTab(nextTab)}
            className={cn(
              'flex-1 rounded-full px-4 py-2.5 text-sm font-semibold capitalize transition',
              tab === nextTab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
            )}
          >
            {nextTab === 'history' ? 'Call History' : nextTab}
          </button>
        ))}
      </div>

      {tab === 'profile' ? (
        <div className="medical-panel rounded-[32px] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Profile</p>
              <h4 className="mt-2 text-xl font-semibold text-slate-900">Patient details and contact context</h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {editingProfile ? (
                <>
                  <button type="button" onClick={() => { setEditingProfile(false); setProfileDraft(selectedPatient); }} className={ghostButtonClassName}>Cancel</button>
                  <button type="button" onClick={() => void saveProfile()} className={primaryButtonClassName}>{profileSaving ? 'Saving...' : 'Save changes'}</button>
                </>
              ) : (
                <button type="button" onClick={() => setEditingProfile(true)} className={ghostButtonClassName}>Edit profile</button>
              )}
            </div>
          </div>

          {profileError ? <p className="mt-4 text-sm text-red-700">{profileError}</p> : null}

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <ProfileField label="Phone number" value={String(profileDraft.phone ?? '')} editing={editingProfile} onChange={(value) => setProfileField('phone', value)} placeholder="16471234567" />
            <ProfileField label="Date of birth" value={String(profileDraft.dateOfBirth ?? '')} editing={editingProfile} onChange={(value) => setProfileField('dateOfBirth', value)} placeholder="1942-03-14" />
            <ProfileField label="Room / ward" value={String(profileDraft.room ?? '')} editing={editingProfile} onChange={(value) => setProfileField('room', value)} placeholder="3B" />
            <ProfileField label="Primary diagnosis" value={String(profileDraft.primaryDiagnosis ?? '')} editing={editingProfile} onChange={(value) => setProfileField('primaryDiagnosis', value)} placeholder="Type 2 Diabetes" />
            <ProfileField label="Allergies" value={(profileDraft.allergies ?? []).join(', ')} editing={editingProfile} onChange={(value) => setProfileField('allergies', splitList(value))} placeholder="Penicillin, Aspirin" />
            <ProfileField label="Secondary diagnoses" value={(profileDraft.secondaryDiagnoses ?? []).join(', ')} editing={editingProfile} onChange={(value) => setProfileField('secondaryDiagnoses', splitList(value))} placeholder="Hypertension, Arthritis" />
          </div>

          <div className="mt-5">
            <ProfileField label="Current medications" value={(profileDraft.medications ?? []).join(', ')} editing={editingProfile} onChange={(value) => setProfileField('medications', splitList(value))} placeholder="Metformin 500mg, Lisinopril 10mg" />
          </div>

          <div className="mt-8 border-t border-slate-200/80 pt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Emergency Contact</p>
            <div className="mt-4 grid gap-5 lg:grid-cols-3">
              <ProfileField label="Name" value={profileDraft.emergencyContact?.name ?? ''} editing={editingProfile} onChange={(value) => setEmergencyContactField('name', value)} placeholder="Full name" />
              <ProfileField label="Relationship" value={profileDraft.emergencyContact?.relationship ?? ''} editing={editingProfile} onChange={(value) => setEmergencyContactField('relationship', value)} placeholder="Daughter" />
              <ProfileField label="Phone" value={profileDraft.emergencyContact?.phone ?? ''} editing={editingProfile} onChange={(value) => setEmergencyContactField('phone', value)} placeholder="16471234567" />
            </div>
          </div>

          <div className="mt-8 border-t border-slate-200/80 pt-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">General Notes</p>
            {editingProfile ? <textarea value={profileDraft.notes ?? ''} onChange={(event) => setProfileField('notes', event.target.value)} placeholder="Any additional notes about this patient..." className={cn(inputClassName, 'mt-3 min-h-28 resize-y')} /> : <div className="mt-3 rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-700">{profileDraft.notes || 'No notes yet.'}</div>}
          </div>
        </div>
      ) : null}

      {tab === 'call' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="medical-panel rounded-[32px] px-6 py-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Question Builder</p>
                <h4 className="mt-2 text-xl font-semibold text-slate-900">Author the outbound call</h4>
              </div>
              <button type="button" onClick={() => void initiateCall()} disabled={calling} className={cn(primaryButtonClassName, calling && 'cursor-not-allowed bg-slate-400 hover:bg-slate-400')}>{calling ? 'Calling...' : 'Call patient'}</button>
            </div>

            {callError ? <p className="mt-4 text-sm text-red-700">{callError}</p> : null}

            <div className="mt-6 flex flex-col gap-3">
              {questions.map((question, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500">{index + 1}</span>
                  <input value={question} onChange={(event) => updateQuestion(index, event.target.value)} disabled={calling} placeholder="Type a question for the patient..." className={cn(inputClassName, 'flex-1')} />
                  {questions.length > 1 ? <button type="button" onClick={() => removeQuestion(index)} disabled={calling} className="flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-lg font-semibold text-red-600 transition hover:bg-red-100">-</button> : null}
                </div>
              ))}
            </div>

            <button type="button" onClick={addQuestion} disabled={calling} className={cn(ghostButtonClassName, 'mt-5')}>Add question</button>
          </div>

          <div className="medical-panel rounded-[32px] px-6 py-6">
            <div className="flex items-center gap-3">
              <span className={cn('inline-flex h-3.5 w-3.5 rounded-full', calling ? 'bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.14)]' : 'bg-slate-300')} />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">Live Session</p>
                <h4 className="mt-1 text-xl font-semibold text-slate-900">{activeSessionId ? (calling ? 'Live transcription' : 'Call complete') : 'Waiting for a call'}</h4>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3">
              {liveGreetingNotes ? <div className="rounded-[24px] border border-violet-200 bg-violet-50/80 px-4 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-500">Greeting Notes</p><p className="mt-2 text-sm leading-6 text-violet-900">&ldquo;{liveGreetingNotes}&rdquo;</p></div> : null}
              {!activeSessionId ? <div className="rounded-[24px] border border-dashed border-slate-300/80 bg-white/65 px-4 py-8 text-center text-sm text-slate-500">Start a call to watch answers stream in.</div> : null}
              {activeSessionId && liveAnswers.length === 0 && calling ? <div className="rounded-[24px] border border-slate-200/80 bg-white/70 px-4 py-8 text-center"><div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" /><p className="mt-3 text-sm font-medium text-slate-700">Waiting for the patient to respond...</p></div> : null}
              {liveAnswers.map((answer, index) => <div key={`${answer.question}-${index}`} className="rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-4"><p className="text-sm font-semibold text-slate-900">Q. {answer.question}</p><p className="mt-2 text-sm leading-6 text-slate-600">{answer.answer}</p></div>)}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="medical-panel rounded-[32px] px-6 py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">History</p>
              <h4 className="mt-2 text-xl font-semibold text-slate-900">Previous sessions and saved answers</h4>
            </div>
            <p className="text-sm text-slate-500">{history.length} session{history.length === 1 ? '' : 's'}</p>
          </div>

          {historyError ? <p className="mt-4 text-sm text-red-700">{historyError}</p> : null}
          {history.length === 0 ? <div className="mt-6 rounded-[24px] border border-dashed border-slate-300/80 bg-white/65 px-4 py-8 text-center text-sm text-slate-500">No previous calls have been recorded for this patient.</div> : <div className="mt-6 flex flex-col gap-4">{history.map((session) => <article key={session._id} className="rounded-[28px] border border-slate-200/80 bg-white/75 px-5 py-5"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="text-sm font-semibold text-slate-900">{formatDate(session.created_at)}</p><p className="mt-1 text-sm text-slate-500">{session.questions_asked.length} questions asked</p></div><Chip tone={session.status === 'completed' ? 'success' : 'warning'}>{session.status}</Chip></div>{session.greeting_used ? <div className="mt-4 rounded-[20px] bg-violet-50/70 px-4 py-4 text-sm leading-6 text-violet-900"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-violet-500">Greeting Used</p><p className="mt-2">{session.greeting_used}</p></div> : null}{session.greeting_notes ? <div className="mt-4 rounded-[20px] bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700"><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">Patient replied during greeting</p><p className="mt-2">&ldquo;{session.greeting_notes}&rdquo;</p></div> : null}{session.answers.length > 0 ? <div className="mt-4 grid gap-3">{session.answers.map((answer, index) => <div key={`${session._id}-${index}`} className="rounded-[20px] border border-slate-200/80 bg-white px-4 py-4"><p className="text-sm font-semibold text-slate-900">Q. {answer.question}</p><p className="mt-2 text-sm leading-6 text-slate-600">{answer.answer}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No answers were saved for this session.</p>}</article>)}</div>}
        </div>
      ) : null}
    </>
  );
}

function ProfileField({ label, value, editing, onChange, placeholder }: { label: string; value: string; editing: boolean; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</label>
      {editing ? <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn(inputClassName, 'mt-2')} /> : <div className="mt-2 rounded-[20px] border border-slate-200/80 bg-white/70 px-4 py-3 text-sm text-slate-700">{value || 'Not provided'}</div>}
    </div>
  );
}

function StackLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Chip({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'accent' | 'success' | 'warning' }) {
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', tone === 'default' && 'bg-slate-100 text-slate-700', tone === 'accent' && 'bg-sky-100 text-sky-800', tone === 'success' && 'bg-emerald-100 text-emerald-800', tone === 'warning' && 'bg-amber-100 text-amber-800')}>{children}</span>;
}
