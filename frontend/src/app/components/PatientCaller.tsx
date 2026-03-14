"use client";

import React, { useState, useEffect, useRef } from "react";

type ResponseItem = {
  question: string;
  answer: string;
};

export default function PatientCaller() {
  const [phoneNumber] = useState<string>("+12265058825"); // ("+16479150931")
  const [calling, setCalling] = useState<boolean>(false);
  const [responses, setResponses] = useState<ResponseItem[]>([]);
  const [callEnded, setCallEnded] = useState<boolean>(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const initiateCall = async () => {
    setCalling(true);
    setCallEnded(false);
    setResponses([]);

    try {
      const res = await fetch("http://127.0.0.1:5000/api/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient: phoneNumber }),
      });

      if (!res.ok) {
        const errData = await res.json();
        alert("Error initiating call: " + errData.error);
        setCalling(false);
        return;
      }

      // Start polling
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(pollResponses, 2000);

      // Stop after 60 seconds (max length of demo call)
      setTimeout(() => {
        setCalling(false);
        setCallEnded(true);
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      }, 60000);
    } catch (err) {
      alert("Network error: " + err);
      setCalling(false);
    }
  };

  const pollResponses = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/api/data?t=" + Date.now().toString(), { cache: "no-store" });
      const data = await res.json();

      if (data[phoneNumber] !== undefined) {
        setResponses(data[phoneNumber]);
      }
    } catch (err) {
      console.error("Error polling data:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  return (
    <div className="w-full">
      {/* Patient Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8 transform transition hover:shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              Patient #1 (Demo)
            </h2>
            <div className="flex items-center text-gray-500 font-medium">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2 text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              {phoneNumber}
            </div>
          </div>

          <div className="flex items-center space-x-4 w-full sm:w-auto">
            {calling && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800 animate-pulse">
                Calling...
              </span>
            )}
            {callEnded && !calling && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-600">
                Call Ended
              </span>
            )}
            <button
              onClick={initiateCall}
              disabled={calling}
              className="w-full sm:w-auto flex items-center justify-center bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 focus:ring-4 focus:ring-indigo-300 text-white font-semibold rounded-xl px-5 py-3 transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              Call Patient
            </button>
          </div>
        </div>
      </div>

      {/* Responses Section */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 min-h-[300px]">
        <h3 className="text-xl font-bold border-b border-gray-100 pb-4 mb-6 flex items-center text-gray-800">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 mr-3 text-indigo-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          Live Transcription
        </h3>

        {responses.length === 0 && !calling ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 border border-dashed border-gray-200 rounded-xl h-full">
            <p className="text-gray-500 font-medium text-lg">
              No active call data.
            </p>
            <p className="text-gray-400 mt-1">
              Click &quot;Call Patient&quot; to begin a new AI-driven evaluation.
            </p>
          </div>
        ) : responses.length === 0 && calling ? (
          <div className="flex flex-col items-center justify-center text-center p-8 bg-indigo-50 border border-indigo-100 rounded-xl h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-indigo-800 font-semibold text-lg">
              Call in progress...
            </p>
            <p className="text-indigo-600 mt-1 max-w-sm">
              Waiting for patient to answer. Their responses will appear here dynamically as evaluated by OpenAI.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {responses.map((res, index) => (
              <div
                key={index}
                className="p-5 bg-gray-50 border-l-4 border-indigo-500 rounded-r-xl shadow-sm animate-fade-in-up"
              >
                <div className="font-semibold text-gray-800 text-lg mb-2">
                  <span className="text-indigo-600">AI:</span> &quot;{res.question}&quot;
                </div>
                <div className="text-gray-700 text-base flex">
                  <span className="font-bold mr-2">Patient:</span>
                  <span className="italic text-gray-600">
                    &quot;{res.answer}&quot;
                  </span>
                </div>
              </div>
            ))}
            {calling && (
              <div className="p-4 flex items-center justify-center text-indigo-500 space-x-2 animate-pulse mt-4">
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
