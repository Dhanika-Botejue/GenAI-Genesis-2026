import type { ParsedFloorplan } from '@/types/domain';
import { hashFile } from '@/lib/analysis/hash';

export async function analyzeUpload({
  file,
  requestId,
  signal,
}: {
  file: File;
  requestId: string;
  signal: AbortSignal;
}): Promise<{
  parsedFloorplan: ParsedFloorplan;
  mode: 'fallback';
}> {
  const imageHash = await hashFile(file);
  return runFallbackAnalysis(file, requestId, imageHash, signal);
}

async function runFallbackAnalysis(file: File, requestId: string, imageHash: string, signal: AbortSignal) {
  return new Promise<{
    parsedFloorplan: ParsedFloorplan;
    mode: 'fallback';
  }>((resolve, reject) => {
    const worker = new Worker(new URL('../analysis-fallback/worker-entry.ts', import.meta.url), { type: 'module' });

    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      reject(new Error('Analysis was cancelled.'));
    };

    signal.addEventListener('abort', handleAbort);
    worker.onmessage = (event) => {
      if (event.data.requestId !== requestId) {
        return;
      }

      cleanup();
      if (event.data.ok) {
        resolve({
          parsedFloorplan: event.data.parsedFloorplan as ParsedFloorplan,
          mode: 'fallback',
        });
        return;
      }
      reject(new Error(event.data.reason ?? 'Fallback analysis failed.'));
    };

    worker.onerror = () => {
      cleanup();
      reject(new Error('Fallback worker failed to analyze this upload.'));
    };

    worker.postMessage({
      file,
      requestId,
      imageHash,
    });
  });
}

export { validateUploadFile } from '@/lib/analysis/file-validation';
