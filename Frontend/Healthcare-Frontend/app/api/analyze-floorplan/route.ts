import { NextResponse } from 'next/server';
import type { AnalyzeApiResponse } from '@/types/api';

export const runtime = 'nodejs';

export async function POST() {
  const payload: AnalyzeApiResponse = {
    ok: false,
    mode: 'deprecated',
    reason: 'Rich/server-side analysis has been deprecated. The app now uses the local browser heuristic pipeline only.',
  };
  return NextResponse.json(payload, { status: 410 });
}
