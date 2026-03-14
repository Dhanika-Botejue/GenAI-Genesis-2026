"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const API = "http://127.0.0.1:5000";


type EmergencyContact = { name: string; relationship: string; phone: string };

type Patient = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  room?: string;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  allergies?: string[];
  medications?: string[];
  emergencyContact?: EmergencyContact;
  notes?: string;
  created_at: string;
  updated_at?: string;
};

type AnswerItem = { question: string; answer: string };

type CallSession = {
  _id: string;
  patient_id: string;
  questions_asked: string[];
  answers: AnswerItem[];
  greeting_used: string;
  greeting_notes?: string;
  status: string;
  created_at: string;
  completed_at?: string;
};


type Tab = "profile" | "call" | "history";

export default function PatientCaller() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [tab, setTab] = useState<Tab>("profile");

  // Add patient form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [addError, setAddError] = useState("");

  // Profile editor
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Partial<Patient>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  // Call
  const [questions, setQuestions] = useState<string[]>([""]);
  const [calling, setCalling] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [liveAnswers, setLiveAnswers] = useState<AnswerItem[]>([]);
  const [liveGreetingNotes, setLiveGreetingNotes] = useState("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // History
  const [history, setHistory] = useState<CallSession[]>([]);

  // Fetch patients 
  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(API + "/api/patients");
      setPatients(await res.json());
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    }
  }, []);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const fetchHistory = useCallback(async (patientId: string) => {
    try {
      const res = await fetch(API + "/api/patients/" + patientId + "/history");
      setHistory(await res.json());
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  const selectPatient = useCallback(async (p: Patient) => {
    // Fetch full patient object (includes all profile fields)
    try {
      const res = await fetch(API + "/api/patients/" + p._id);
      const full = await res.json();
      setSelectedPatient(full);
      setProfileDraft(full);
    } catch {
      setSelectedPatient(p);
      setProfileDraft(p);
    }
    setTab("profile");
    setEditingProfile(false);
    setQuestions([""]);
    setCalling(false);
    setActiveSessionId(null);
    setLiveAnswers([]);
    setLiveGreetingNotes("");
    fetchHistory(p._id);
    if (pollRef.current) clearInterval(pollRef.current);
  }, [fetchHistory]);

  // ── Add patient ─────────────────────────────────────────────────────

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    try {
      const res = await fetch(API + "/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: newFirst, lastName: newLast, phone: newPhone }),
      });
      if (!res.ok) {
        const err = await res.json();
        setAddError(err.error || "Failed to add patient");
        return;
      }
      const created = await res.json();
      setNewFirst(""); setNewLast(""); setNewPhone("");
      setShowAddForm(false);
      await fetchPatients();
      selectPatient(created);
    } catch {
      setAddError("Network error");
    }
  };

  // ── Profile save ────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (!selectedPatient) return;
    setSaveStatus("saving");
    try {
      const res = await fetch(API + "/api/patients/" + selectedPatient._id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileDraft),
      });
      const updated = await res.json();
      setSelectedPatient(updated);
      setProfileDraft(updated);
      setEditingProfile(false);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      fetchPatients();
    } catch {
      setSaveStatus("idle");
    }
  };

  const setProfileField = (key: keyof Patient, val: unknown) => {
    setProfileDraft((d) => ({ ...d, [key]: val }));
  };

  const setECField = (key: keyof EmergencyContact, val: string) => {
    setProfileDraft((d) => ({
      ...d,
      emergencyContact: { ...(d.emergencyContact || { name: "", relationship: "", phone: "" }), [key]: val },
    }));
  };

  // ── Question builder ────────────────────────────────────────────────

  const updateQuestion = (idx: number, val: string) => {
    const u = [...questions]; u[idx] = val; setQuestions(u);
  };
  const addQuestion = () => setQuestions([...questions, ""]);
  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  // ── Initiate call ───────────────────────────────────────────────────

  const initiateCall = async () => {
    if (!selectedPatient) return;
    const validQs = questions.filter((q) => q.trim());
    if (!validQs.length) { alert("Please enter at least one question."); return; }
    setCalling(true);
    setLiveAnswers([]);
    setLiveGreetingNotes("");
    setActiveSessionId(null);

    try {
      const res = await fetch(API + "/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id: selectedPatient._id, questions: validQs }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("Call failed: " + (err.error || "Unknown error"));
        setCalling(false); return;
      }
      const data = await res.json();
      const sid = data.session_id;
      setActiveSessionId(sid);
      setTab("call");

      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(API + "/api/sessions/" + sid + "?t=" + Date.now(), { cache: "no-store" });
          const session = await r.json();
          if (session.answers) setLiveAnswers(session.answers);
          if (session.greeting_notes) setLiveGreetingNotes(session.greeting_notes);
          if (session.status === "completed") {
            setCalling(false);
            if (pollRef.current) clearInterval(pollRef.current);
            fetchHistory(selectedPatient._id);
          }
        } catch (err) { console.error("Poll error:", err); }
      }, 2000);

      setTimeout(() => {
        setCalling(false);
        if (pollRef.current) clearInterval(pollRef.current);
        fetchHistory(selectedPatient._id);
      }, 120000);
    } catch (err) {
      alert("Network error: " + err);
      setCalling(false);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      {/* Sidebar */}
      <div style={{ width: 260, flexShrink: 0 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={label}>Patients</span>
            <button onClick={() => setShowAddForm(!showAddForm)} style={iconBtn} title="Add patient">
              {showAddForm ? "×" : "+"}
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleAddPatient} style={{ marginBottom: 12, padding: 12, background: "#f8f9fb", borderRadius: 10, border: "1px solid #ebebf0" }}>
              <div style={fieldLabel}>First Name</div>
              <input style={inputStyle} type="text" value={newFirst} onChange={(e) => setNewFirst(e.target.value)} required />
              <div style={{ ...fieldLabel, marginTop: 8 }}>Last Name</div>
              <input style={inputStyle} type="text" value={newLast} onChange={(e) => setNewLast(e.target.value)} required />
              <div style={{ ...fieldLabel, marginTop: 8 }}>Phone</div>
              <input style={inputStyle} type="tel" placeholder="+1..." value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
              {addError && <p style={{ color: "#dc2626", fontSize: 11, marginTop: 4 }}>{addError}</p>}
              <button type="submit" style={{ ...primaryBtn, width: "100%", marginTop: 10, justifyContent: "center" }}>
                Add Patient
              </button>
            </form>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {patients.length === 0 && (
              <p style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", padding: "16px 0" }}>No patients yet</p>
            )}
            {patients.map((p) => (
              <button
                key={p._id}
                onClick={() => selectPatient(p)}
                style={{
                  ...sidebarItem,
                  background: selectedPatient?._id === p._id ? "#eef2ff" : "transparent",
                  borderColor: selectedPatient?._id === p._id ? "#c7d2fe" : "transparent",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13, color: "#1a1a2e" }}>{p.firstName} {p.lastName}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{p.phone}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selectedPatient ? (
          <div style={{ ...card, textAlign: "center", padding: 48 }}>
            <div style={emptyIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a0a0b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p style={{ fontWeight: 600, fontSize: 15, color: "#4a4a68" }}>Select a Patient</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>Choose from the sidebar to view details or start a call.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Patient header */}
            <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a2e", margin: 0 }}>
                  {selectedPatient.firstName} {selectedPatient.lastName}
                </h2>
                <p style={{ fontSize: 13, color: "#9ca3af", margin: "2px 0 0" }}>{selectedPatient.phone}</p>
              </div>
              {calling && <span style={badge("#dcfce7", "#166534")}>● Call in Progress</span>}
            </div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 0, border: "1px solid #e8e8ef", borderRadius: 10, overflow: "hidden", background: "#fff" }}>
              {(["profile", "call", "history"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    flex: 1,
                    padding: "10px 0",
                    fontSize: 13,
                    fontWeight: tab === t ? 600 : 400,
                    color: tab === t ? "#4f46e5" : "#6b7280",
                    background: tab === t ? "#f5f3ff" : "#fff",
                    border: "none",
                    borderBottom: tab === t ? "2px solid #4f46e5" : "2px solid transparent",
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {t === "call" ? "Call" : t === "profile" ? "Profile" : "Call History"}
                </button>
              ))}
            </div>

            {/* Profile tab */}
            {tab === "profile" && (
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                  <span style={sectionTitle}>Patient Profile</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {editingProfile ? (
                      <>
                        <button onClick={() => { setEditingProfile(false); setProfileDraft(selectedPatient); }} style={ghostBtn}>Cancel</button>
                        <button onClick={saveProfile} style={primaryBtn} disabled={saveStatus === "saving"}>
                          {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved ✓" : "Save Changes"}
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setEditingProfile(true)} style={ghostBtn}>Edit Profile</button>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <ProfileField label="Date of Birth" value={profileDraft.dateOfBirth || ""} editing={editingProfile} onChange={(v) => setProfileField("dateOfBirth", v)} placeholder="e.g. 1942-03-14" />
                  <ProfileField label="Room / Ward" value={profileDraft.room || ""} editing={editingProfile} onChange={(v) => setProfileField("room", v)} placeholder="e.g. 3B" />
                  <ProfileField label="Primary Diagnosis" value={profileDraft.primaryDiagnosis || ""} editing={editingProfile} onChange={(v) => setProfileField("primaryDiagnosis", v)} placeholder="e.g. Type 2 Diabetes" />
                  <ProfileField label="Allergies" value={(profileDraft.allergies || []).join(", ")} editing={editingProfile} onChange={(v) => setProfileField("allergies", v.split(",").map(s => s.trim()).filter(Boolean))} placeholder="Comma-separated, e.g. Penicillin, Aspirin" />
                </div>

                <div style={{ marginTop: 16 }}>
                  <ProfileField label="Secondary Diagnoses" value={(profileDraft.secondaryDiagnoses || []).join(", ")} editing={editingProfile} onChange={(v) => setProfileField("secondaryDiagnoses", v.split(",").map(s => s.trim()).filter(Boolean))} placeholder="Comma-separated" />
                </div>

                <div style={{ marginTop: 16 }}>
                  <ProfileField label="Current Medications" value={(profileDraft.medications || []).join(", ")} editing={editingProfile} onChange={(v) => setProfileField("medications", v.split(",").map(s => s.trim()).filter(Boolean))} placeholder="Comma-separated, e.g. Metformin 500mg, Lisinopril 10mg" />
                </div>

                {/* Emergency Contact */}
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f0f0f5" }}>
                  <div style={{ ...fieldLabel, fontSize: 12, fontWeight: 600, color: "#4a4a68", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>Emergency Contact</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <ProfileField label="Name" value={profileDraft.emergencyContact?.name || ""} editing={editingProfile} onChange={(v) => setECField("name", v)} placeholder="Full name" />
                    <ProfileField label="Relationship" value={profileDraft.emergencyContact?.relationship || ""} editing={editingProfile} onChange={(v) => setECField("relationship", v)} placeholder="e.g. Daughter" />
                    <ProfileField label="Phone" value={profileDraft.emergencyContact?.phone || ""} editing={editingProfile} onChange={(v) => setECField("phone", v)} placeholder="+1..." />
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginTop: 16 }}>
                  <div style={fieldLabel}>General Notes</div>
                  {editingProfile ? (
                    <textarea
                      style={{ ...inputStyle, minHeight: 80, resize: "vertical" as const }}
                      value={profileDraft.notes || ""}
                      onChange={(e) => setProfileField("notes", e.target.value)}
                      placeholder="Any additional notes about this patient..."
                    />
                  ) : (
                    <p style={{ fontSize: 13, color: profileDraft.notes ? "#1a1a2e" : "#c0c0cc", margin: "4px 0 0", lineHeight: 1.6 }}>
                      {profileDraft.notes || "No notes yet."}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Call tab */}
            {tab === "call" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={card}>
                  <span style={sectionTitle}>Questions to Ask</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                    {questions.map((q, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "monospace", width: 20, textAlign: "right" }}>{idx + 1}.</span>
                        <input
                          style={{ ...inputStyle, flex: 1 }}
                          type="text"
                          value={q}
                          onChange={(e) => updateQuestion(idx, e.target.value)}
                          placeholder="Type a question..."
                          disabled={calling}
                        />
                        {questions.length > 1 && (
                          <button onClick={() => removeQuestion(idx)} disabled={calling} style={{ ...iconBtn, color: "#ef4444", background: "#fef2f2", borderColor: "#fee2e2", fontSize: 18 }}>−</button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <button onClick={addQuestion} disabled={calling} style={{ background: "none", border: "none", color: "#4f46e5", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                      <span style={{ fontSize: 16 }}>+</span> Add Question
                    </button>
                    <button onClick={initiateCall} disabled={calling || questions.every((q) => !q.trim())} style={{ ...primaryBtn, opacity: (calling || questions.every((q) => !q.trim())) ? 0.5 : 1, cursor: (calling || questions.every((q) => !q.trim())) ? "not-allowed" : "pointer" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: 6 }}>
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      Call Patient
                    </button>
                  </div>
                </div>

                {/* Live transcription */}
                {activeSessionId && (
                  <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                      <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: calling ? "#22c55e" : "#d1d5db" }} />
                      <span style={sectionTitle}>{calling ? "Live Transcription" : "Call Complete"}</span>
                    </div>

                    {liveGreetingNotes && (
                      <div style={{ ...noteCard, borderLeftColor: "#a78bfa", marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>Patient Notes (from greeting)</div>
                        <p style={{ fontSize: 13, color: "#4a4a68", fontStyle: "italic", margin: 0 }}>&ldquo;{liveGreetingNotes}&rdquo;</p>
                      </div>
                    )}

                    {liveAnswers.length === 0 && calling ? (
                      <div style={{ textAlign: "center", padding: 24, background: "#fafbfc", borderRadius: 8 }}>
                        <div style={{ width: 22, height: 22, border: "2px solid #e5e7eb", borderTopColor: "#4f46e5", borderRadius: "50%", margin: "0 auto 10px", animation: "spin 1s linear infinite" }} />
                        <p style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>Waiting for patient to answer...</p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {liveAnswers.map((a, i) => (
                          <div key={i} style={noteCard}>
                            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}><span style={{ fontWeight: 600, color: "#4f46e5" }}>Q:</span> {a.question}</div>
                            <div style={{ fontSize: 13, color: "#1a1a2e", fontWeight: 500 }}>→ {a.answer}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {tab === "history" && (
              <div style={card}>
                <span style={sectionTitle}>Call History</span>
                {history.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: "24px 0" }}>No previous calls for this patient.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                    {history.map((session) => (
                      <div key={session._id} style={historyCard}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>
                            {new Date(session.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <span style={badge(session.status === "completed" ? "#dcfce7" : "#fef3c7", session.status === "completed" ? "#166534" : "#92400e")}>
                            {session.status}
                          </span>
                        </div>
                        {session.greeting_used && (
                          <p style={{ fontSize: 12, color: "#7c3aed", fontStyle: "italic", margin: "0 0 8px", paddingLeft: 8, borderLeft: "2px solid #ddd6fe" }}>
                            {session.greeting_used}
                          </p>
                        )}
                        {session.greeting_notes && (
                          <div style={{ fontSize: 12, background: "#faf5ff", padding: "6px 8px", borderLeft: "2px solid #c4b5fd", borderRadius: "0 6px 6px 0", marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, color: "#7c3aed", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Patient said: </span>
                            &ldquo;{session.greeting_notes}&rdquo;
                          </div>
                        )}
                        {session.answers.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {session.answers.map((a, i) => (
                              <div key={i} style={{ fontSize: 13 }}>
                                <p style={{ color: "#6b7280", margin: 0 }}><span style={{ fontWeight: 600, color: "#4a4a68" }}>Q:</span> {a.question}</p>
                                <p style={{ color: "#1a1a2e", fontWeight: 500, margin: "2px 0 0 14px" }}>→ {a.answer}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ color: "#9ca3af", fontSize: 12 }}>No answers recorded</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── ProfileField helper ──────────────────────────────────────────────

function ProfileField({
  label, value, editing, onChange, placeholder,
}: { label: string; value: string; editing: boolean; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div style={fieldLabel}>{label}</div>
      {editing ? (
        <input style={inputStyle} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || ""} />
      ) : (
        <p style={{ fontSize: 13, color: value ? "#1a1a2e" : "#c0c0cc", margin: "3px 0 0", lineHeight: 1.5 }}>{value || "—"}</p>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────

const card: React.CSSProperties = { background: "#fff", border: "1px solid #e8e8ef", borderRadius: 12, padding: 20 };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#1a1a2e", letterSpacing: "-0.01em" };
const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#1a1a2e" };
const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, outline: "none", color: "#1a1a2e", background: "#fff", boxSizing: "border-box" as const };
const primaryBtn: React.CSSProperties = { display: "flex", alignItems: "center", background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, color: "#4a4a68", cursor: "pointer" };
const iconBtn: React.CSSProperties = { width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: "1px solid #e5e7eb", background: "#fafbfc", color: "#4a4a68", fontSize: 16, cursor: "pointer", fontWeight: 600 };
const sidebarItem: React.CSSProperties = { width: "100%", textAlign: "left" as const, padding: "9px 10px", borderRadius: 8, border: "1px solid transparent", cursor: "pointer", background: "transparent" };
const badge = (bg: string, color: string): React.CSSProperties => ({ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6, background: bg, color });
const noteCard: React.CSSProperties = { padding: "10px 12px", background: "#fafbfc", borderLeft: "3px solid #4f46e5", borderRadius: "0 8px 8px 0" };
const historyCard: React.CSSProperties = { border: "1px solid #f0f0f5", borderRadius: 10, padding: 14 };
const emptyIcon: React.CSSProperties = { width: 48, height: 48, borderRadius: "50%", background: "#f0f0f8", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" };
