'use client';

import { useRef, useState } from 'react';
import { analyzeUpload, validateUploadFile } from '@/lib/analysis/pipeline-client';
import { revokeObjectUrlSafe } from '@/lib/browser/object-url';
import { useAppStore } from '@/store/useAppStore';

export function UploadPanel() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const uploadState = useAppStore((state) => state.uploadState);
  const hydrateMock = useAppStore((state) => state.hydrateMock);
  const resetForUpload = useAppStore((state) => state.resetForUpload);
  const setUploadReady = useAppStore((state) => state.setUploadReady);
  const setUploadError = useAppStore((state) => state.setUploadError);
  const setAnalysisRunning = useAppStore((state) => state.setAnalysisRunning);
  const finishAnalysis = useAppStore((state) => state.finishAnalysis);
  const failAnalysis = useAppStore((state) => state.failAnalysis);

  async function handleFileSelection(nextFile: File | null) {
    if (!nextFile) {
      return;
    }

    try {
      const validated = await validateUploadFile(nextFile);
      revokeObjectUrlSafe(uploadState.previewUrl);
      resetForUpload();
      setFile(validated.file);
      setUploadReady({
        previewUrl: validated.previewUrl,
        fileName: nextFile.name,
      });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Unable to read this upload.');
    }
  }

  async function handleAnalyze() {
    if (!file) {
      setUploadError('Choose a PNG or JPG floor plan before analyzing.');
      return;
    }

    const requestId = crypto.randomUUID();
    const controller = new AbortController();
    setAnalysisRunning(requestId, controller);

    try {
      const result = await analyzeUpload({
        file,
        requestId,
        signal: controller.signal,
      });
      finishAnalysis({
        parsedFloorplan: result.parsedFloorplan,
        requestId,
        mode: result.mode,
      });
    } catch (error) {
      failAnalysis(requestId, error instanceof Error ? error.message : 'Analysis failed.');
    }
  }

  return (
    <section
      className={`overflow-hidden border border-[var(--line)] shadow-[var(--shadow)] transition-[padding,border-radius,background-color] duration-200 ${
        open
          ? 'medical-panel rounded-[28px] p-4'
          : 'rounded-[24px] bg-[var(--panel-strong)] px-4 py-3'
      }`}
      style={{ isolation: 'isolate' }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Upload Floor Plan</h2>
        <span className="text-lg font-semibold leading-none text-slate-500" aria-hidden="true">
          {open ? '^' : 'v'}
        </span>
      </button>

      {open ? (
        <>
          <div className="mt-4 flex items-start justify-end gap-3">
            <button
              type="button"
              onClick={hydrateMock}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Restore layout
            </button>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 flex min-h-[132px] w-full items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white/60 px-4 text-center text-sm text-slate-600 transition hover:border-slate-400 hover:bg-white"
          >
            {uploadState.fileName ? `Selected: ${uploadState.fileName}` : 'Choose a floor-plan image'}
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept="image/png,image/jpeg"
            onChange={(event) => {
              void handleFileSelection(event.target.files?.[0] ?? null);
            }}
          />

          {uploadState.previewUrl ? (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white">
              <img src={uploadState.previewUrl} alt="Floor plan preview" className="h-40 w-full object-cover object-center" />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              void handleAnalyze();
            }}
            className="mt-4 w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Analyze and reconstruct
          </button>
        </>
      ) : (
        <input
          ref={inputRef}
          type="file"
          hidden
          accept="image/png,image/jpeg"
          onChange={(event) => {
            void handleFileSelection(event.target.files?.[0] ?? null);
          }}
        />
      )}
    </section>
  );
}
