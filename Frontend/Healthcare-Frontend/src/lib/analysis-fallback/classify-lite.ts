import type { AnalysisWarning } from '@/types/domain';

export function getFallbackWarnings(): AnalysisWarning[] {
  return [
    {
      id: 'fallback-analysis-active',
      level: 'info',
      message: 'Running in browser fallback analysis mode. Layout structure is best-effort unless the optional Python analyzer is running.',
      code: 'fallback-analysis',
    },
    {
      id: 'geometry-approximate',
      level: 'info',
      message: 'Room geometry and labels are approximate and optimized for interaction rather than metric accuracy.',
      code: 'geometry-approximate',
    },
  ];
}
