/// <reference lib="webworker" />

import { buildParsedFloorplanFromCandidates } from '@/lib/analysis/scene-json';
import { getFallbackWarnings } from '@/lib/analysis-fallback/classify-lite';
import { runLiteOcr } from '@/lib/analysis-fallback/ocr-lite';
import { preprocessImage, findNonWhiteBounds } from '@/lib/analysis-fallback/preprocess';
import { buildHeuristicRoomCandidates } from '@/lib/analysis-fallback/regions-lite';

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = async (event: MessageEvent<{ file: File; requestId: string; imageHash: string }>) => {
  try {
    const { file, requestId, imageHash } = event.data;
    const preprocessed = await preprocessImage(file);
    const { bounds, darkRatio } = findNonWhiteBounds(preprocessed);
    const warnings = getFallbackWarnings();
    const labels = await runLiteOcr();

    if (darkRatio < 0.004) {
      const parsedFloorplan = buildParsedFloorplanFromCandidates({
        analysisMode: 'fallback',
        imageHash,
        sourceImageInfo: {
          name: file.name,
          mimeType: file.type,
          width: preprocessed.width,
          height: preprocessed.height,
          size: file.size,
        },
        warnings: [
          ...warnings,
          {
            id: 'no-structure',
            level: 'warning',
            message: 'No strong structural features were found, so the app is showing a degraded neutral floor plate.',
            code: 'no-structure',
          },
        ],
        roomCandidates: [],
        labels,
        ignoredRegions: [],
        wallHints: [],
      });

      workerScope.postMessage({
        ok: true,
        requestId,
        parsedFloorplan,
      });
      return;
    }

    const { roomCandidates, ignoredRegions } = buildHeuristicRoomCandidates({
      preprocessed,
      contentBounds: bounds,
    });

    const parsedFloorplan = buildParsedFloorplanFromCandidates({
      analysisMode: 'fallback',
      imageHash,
      sourceImageInfo: {
        name: file.name,
        mimeType: file.type,
        width: preprocessed.width,
        height: preprocessed.height,
        size: file.size,
      },
      warnings,
      roomCandidates,
      labels,
      ignoredRegions,
      wallHints: [],
    });

    workerScope.postMessage({
      ok: true,
      requestId,
      parsedFloorplan,
    });
  } catch (error) {
    workerScope.postMessage({
      ok: false,
      requestId: event.data.requestId,
      reason: error instanceof Error ? error.message : 'Fallback worker failed.',
    });
  }
};
