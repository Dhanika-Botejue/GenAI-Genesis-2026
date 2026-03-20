'use client';

import { cn } from '@/lib/utils/cn';

export function DisclosureIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180', className)}
    >
      <path
        d="M4.5 7.5 10 13l5.5-5.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
