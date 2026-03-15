'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--background)] p-6 text-[var(--foreground)]">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-md text-center text-sm opacity-80">
            A client-side error occurred. Try refreshing the page. If the problem persists, check the
            browser console for details.
          </p>
          <pre className="max-w-2xl overflow-auto rounded bg-black/10 p-3 text-left text-xs">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm text-[var(--background)]"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
