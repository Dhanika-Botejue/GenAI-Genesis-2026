import { ErrorBoundary } from '@/components/shared/error-boundary';
import { ExperienceShell } from '@/components/app-shell/experience-shell';

export default function Page() {
  return (
    <ErrorBoundary>
      <ExperienceShell />
    </ErrorBoundary>
  );
}
