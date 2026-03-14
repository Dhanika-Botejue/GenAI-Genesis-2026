"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

const API = "http://127.0.0.1:5000";

// ── Types ───────────────────────────────────────────────────────────────────

type Patient = {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  created_at: string;
};

type AnswerItem = {
  question: string;
  answer: string;
};

type CallSession = {
  _id: string;
  patient_id: string;
  questions_asked: string[];
  answers: AnswerItem[];
  greeting_used: string;
  status: string;
  created_at: string;
  completed_at?: string;
};

// ── Main Component ──────────────────────────────────────────────────────────

export default function PatientCaller() {
  // Patient list
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Add patient form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [addError, setAddError] = useState("");

  // Custom questions
  const [questions, setQuestions] = useState<string[]>([""]);

  // Call state
  const [calling, setCalling] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [liveAnswers, setLiveAnswers] = useState<AnswerItem[]>([]);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Call history
  const [history, setHistory] = useState<CallSession[]>([]);

  // ── Fetch patients ──────────────────────────────────────────────────────

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch(API + "/api/patients");
      const data = await res.json();
      setPatients(data);
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // ── Fetch call history when patient is selected ─────────────────────────

  const fetchHistory = useCallback(async (patientId: string) => {
    try {
      const res = await fetch(API + "/api/patients/" + patientId + "/history");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, []);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setQuestions([""]);
    setCalling(false);
    setActiveSessionId(null);
    setLiveAnswers([]);
    fetchHistory(p._id);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  // ── Add patient ─────────────────────────────────────────────────────────

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
      setNewFirst("");
      setNewLast("");
      setNewPhone("");
      setShowAddForm(false);
      fetchPatients();
    } catch (err) {
      setAddError("Network error");
    }
  };

  // ── Question builder ────────────────────────────────────────────────────

  const updateQuestion = (idx: number, value: string) => {
    const updated = [...questions];
    updated[idx] = value;
    setQuestions(updated);
  };

  const addQuestion = () => setQuestions([...questions, ""]);

  const removeQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  // ── Initiate call ───────────────────────────────────────────────────────

  const initiateCall = async () => {
    if (!selectedPatient) return;
    const validQs = questions.filter((q) => q.trim());
    if (validQs.length === 0) {
      alert("Please enter at least one question.");
      return;
    }

    setCalling(true);
    setLiveAnswers([]);
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
        setCalling(false);
        return;
      }

      const data = await res.json();
      const sid = data.session_id;
      setActiveSessionId(sid);

      // Poll for live answers
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(API + "/api/sessions/" + sid + "?t=" + Date.now(), { cache: "no-store" });
          const session = await r.json();
          if (session.answers) {
            setLiveAnswers(session.answers);
          }
          if (session.status === "completed") {
            setCalling(false);
            if (pollRef.current) clearInterval(pollRef.current);
            // Refresh history
            fetchHistory(selectedPatient._id);
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 2000);

      // Safety timeout after 120s
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

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-6 w-full max-w-6xl mx-auto">
      {/* ── Left: Patient List ── */}
      <div className="w-80 shrink-0">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Patients</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition text-xl font-bold"
            >
              {showAddForm ? "×" : "+"}
            </button>
          </div>

          {/* Add Patient Form */}
          {showAddForm && (
            <form onSubmit={handleAddPatient} className="mb-4 p-3 bg-gray-50 rounded-xl space-y-2">
              <input
                type="text"
                placeholder="First Name"
                value={newFirst}
                onChange={(e) => setNewFirst(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
              <input
                type="text"
                placeholder="Last Name"
                value={newLast}
                onChange={(e) => setNewLast(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
              <input
                type="tel"
                placeholder="Phone (+1234567890)"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
              {addError && <p className="text-red-500 text-xs">{addError}</p>}
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-indigo-700 transition"
              >
                Add Patient
              </button>
            </form>
          )}

          {/* Patient List */}
          <div className="space-y-1">
            {patients.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No patients yet. Add one above.</p>
            )}
            {patients.map((p) => (
              <button
                key={p._id}
                onClick={() => selectPatient(p)}
                className={
                  "w-full text-left px-3 py-3 rounded-xl transition " +
                  (selectedPatient?._id === p._id
                    ? "bg-indigo-50 border border-indigo-200"
                    : "hover:bg-gray-50")
                }
              >
                <div className="font-semibold text-gray-800 text-sm">
                  {p.firstName} {p.lastName}
                </div>
                <div className="text-gray-400 text-xs">{p.phone}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Selected Patient ── */}
      <div className="flex-1 min-w-0">
        {!selectedPatient ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-gray-600 font-semibold text-lg">Select a Patient</h3>
            <p className="text-gray-400 mt-1 text-sm">Choose a patient from the list to start a call or view their history.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Patient Info Header */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedPatient.firstName} {selectedPatient.lastName}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">{selectedPatient.phone}</p>
                </div>
                {calling && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                    Call in Progress
                  </span>
                )}
              </div>
            </div>

            {/* Question Builder */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Questions to Ask</h3>
              <div className="space-y-2">
                {questions.map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-gray-400 text-sm font-mono w-6 text-right">{idx + 1}.</span>
                    <input
                      type="text"
                      value={q}
                      onChange={(e) => updateQuestion(idx, e.target.value)}
                      placeholder="Type a question..."
                      disabled={calling}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    {questions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(idx)}
                        disabled={calling}
                        className="w-8 h-8 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-600 transition text-lg font-bold disabled:opacity-30"
                      >
                        −
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <button
                  onClick={addQuestion}
                  disabled={calling}
                  className="flex items-center gap-1 text-indigo-600 text-sm font-semibold hover:text-indigo-700 transition disabled:opacity-30"
                >
                  <span className="text-lg">+</span> Add Question
                </button>
                <button
                  onClick={initiateCall}
                  disabled={calling || questions.every((q) => !q.trim())}
                  className="flex items-center bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 text-white font-semibold rounded-xl px-5 py-2.5 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                  Call Patient
                </button>
              </div>
            </div>

            {/* Live Transcription (during active call) */}
            {(calling || liveAnswers.length > 0) && activeSessionId && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
                <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                  <span className={calling ? "w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" : "w-2 h-2 rounded-full bg-gray-300 mr-2"} />
                  {calling ? "Live Transcription" : "Call Complete"}
                </h3>
                {liveAnswers.length === 0 && calling ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-indigo-50 rounded-xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mb-3" />
                    <p className="text-indigo-700 font-medium text-sm">Waiting for patient to answer...</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {liveAnswers.map((a, i) => (
                      <div key={i} className="p-4 bg-gray-50 border-l-4 border-indigo-500 rounded-r-xl">
                        <div className="text-sm font-semibold text-gray-700 mb-1">
                          <span className="text-indigo-600">Q:</span> {a.question}
                        </div>
                        <div className="text-sm text-gray-600">
                          <span className="font-bold text-gray-700">A:</span>{" "}
                          <span className="italic">{a.answer}</span>
                        </div>
                      </div>
                    ))}
                    {calling && (
                      <div className="flex justify-center gap-1 py-2">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Call History */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Call History</h3>
              {history.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">No previous calls for this patient.</p>
              ) : (
                <div className="space-y-4">
                  {history.map((session) => (
                    <div key={session._id} className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-gray-400">
                          {new Date(session.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span
                          className={
                            "text-xs px-2 py-0.5 rounded-full font-medium " +
                            (session.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700")
                          }
                        >
                          {session.status}
                        </span>
                      </div>
                      {session.greeting_used && (
                        <p className="text-xs text-indigo-500 italic mb-2 border-l-2 border-indigo-200 pl-2">
                          {session.greeting_used}
                        </p>
                      )}
                      {session.answers.length > 0 ? (
                        <div className="space-y-2">
                          {session.answers.map((a, i) => (
                            <div key={i} className="text-sm">
                              <p className="text-gray-500">
                                <span className="font-semibold text-gray-600">Q:</span> {a.question}
                              </p>
                              <p className="text-gray-700 font-medium ml-4">
                                → {a.answer}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-xs">No answers recorded</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
