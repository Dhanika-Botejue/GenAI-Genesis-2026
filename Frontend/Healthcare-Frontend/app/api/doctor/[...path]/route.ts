import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const fallbackDoctorApiBaseUrl = 'http://127.0.0.1:5000';

type RouteContext = {
  params: Promise<{ path: string[] }> | { path: string[] };
};

function getDoctorApiBaseUrl() {
  return process.env.DOCTOR_API_BASE_URL ?? process.env.NEXT_PUBLIC_DOCTOR_API_BASE_URL ?? fallbackDoctorApiBaseUrl;
}

async function resolveParams(context: RouteContext) {
  return Promise.resolve(context.params);
}

async function proxyDoctorRequest(request: Request, context: RouteContext) {
  const { path } = await resolveParams(context);
  const baseUrl = getDoctorApiBaseUrl();
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const targetUrl = new URL(path.join('/'), normalizedBaseUrl);
  const incomingUrl = new URL(request.url);

  targetUrl.search = incomingUrl.search;

  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (accept) {
    headers.set('accept', accept);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, init);
    const payload = await response.arrayBuffer();
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('content-type');

    if (responseContentType) {
      responseHeaders.set('content-type', responseContentType);
    }

    return new Response(payload, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Doctor API proxy failed', error);

    return NextResponse.json(
      {
        error: `Doctor backend unavailable at ${baseUrl}. Start the FastAPI service from the integrated GenAI-Genesis repo or update DOCTOR_API_BASE_URL.`,
      },
      { status: 502 },
    );
  }
}

export async function GET(request: Request, context: RouteContext) {
  return proxyDoctorRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyDoctorRequest(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return proxyDoctorRequest(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return proxyDoctorRequest(request, context);
}
