import type { Priority, Severity } from '@/types/domain';

export const severityToColor: Record<Severity, string> = {
  low: '#79c68e',
  medium: '#e8ca57',
  high: '#e79653',
  critical: '#df6e62',
};

export const priorityToColor: Record<Priority, string> = {
  none: '#c9d3da',
  low: '#79c68e',
  medium: '#e8ca57',
  high: '#e79653',
  critical: '#df6e62',
};

export const roomFillByType = {
  care: '#dcefee',
  nonCare: '#e4e8eb',
  unknown: '#ece9e2',
};
