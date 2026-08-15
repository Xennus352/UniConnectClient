import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

async function callSpring(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, init);
}

async function refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');
  const data = await res.json();
  return { accessToken: data.accessToken, refreshToken: data.refreshToken };
}

// The university server rotates the refresh token on every refresh call, so a
// burst of concurrent requests that all hit an expired access token must share
// a single refresh result — including requests that arrive AFTER that refresh
// finished but still carry the old (now-revoked) token. Cache the successful
// result keyed by the refresh token that was consumed.
const refreshCache = new Map<string, Promise<{ accessToken: string; refreshToken: string }>>();
async function refreshOnce(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const cached = refreshCache.get(refreshToken);
  if (cached) return cached;
  const pending = refreshTokens(refreshToken);
  refreshCache.set(refreshToken, pending);
  try {
    const tokens = await pending;
    if (refreshCache.size > 16) refreshCache.clear();
    return tokens;
  } catch (err) {
    refreshCache.delete(refreshToken);
    throw err;
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, { params });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, { params });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, { params });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, { params });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handle(request, { params });
}

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathname = `/${path.join('/')}${request.nextUrl.search}`;
  const tokensRaw = request.cookies.get('uniconnect_backend')?.value;
  const responseHeaders: Record<string, string> = {};

  // Buffer the raw body once so binary payloads (e.g. Excel uploads sent as
  // multipart/form-data) survive the proxy intact, including a retry after a
  // token refresh.
  const rawBody =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : new Uint8Array(await request.arrayBuffer());

  const buildInit = (token: string): RequestInit => ({
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(request.headers.get('content-type')
        ? { 'Content-Type': request.headers.get('content-type') as string }
        : {}),
    },
    body: rawBody,
  });

  const execute = async (token: string) => {
    const res = await callSpring(pathname, buildInit(token));
    // The university server reports an expired/invalid access token as 403
    // (Spring's default entry point), so refresh on both 401 and 403.
    if ((res.status === 401 || res.status === 403) && tokensRaw) {
      const tokens = JSON.parse(tokensRaw);
      if (tokens?.refreshToken) {
        const refreshed = await refreshOnce(tokens.refreshToken).catch(() => null);
        if (refreshed) {
          responseHeaders['set-cookie'] = JSON.stringify({ ...tokens, ...refreshed });
          return callSpring(pathname, buildInit(refreshed.accessToken));
        }
      }
      // Refresh failed (revoked/expired refresh token): the session is over,
      // so drop the stored tokens instead of retrying every poll.
      responseHeaders['clear-cookie'] = 'true';
      return NextResponse.json({ message: 'Session expired' }, { status: 401 });
    }
    return res;
  };

  if (!tokensRaw) {
    return NextResponse.json({ message: 'Not authenticated with university server' }, { status: 401 });
  }

  try {
    const tokens = JSON.parse(tokensRaw);
    const res = await execute(tokens.accessToken);

    const body = await res.text();
    const nullBodyStatus = res.status === 204 || res.status === 205 || res.status === 304;
    const response = new NextResponse(nullBodyStatus ? null : body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });

    if (responseHeaders['set-cookie']) {
      const nextTokens = JSON.parse(responseHeaders['set-cookie']);
      response.cookies.set('uniconnect_backend', JSON.stringify(nextTokens), COOKIE_OPTS);
    } else if (responseHeaders['clear-cookie']) {
      response.cookies.set('uniconnect_backend', '', { ...COOKIE_OPTS, maxAge: 0 });
    }
    return response;
  } catch (e) {
    return NextResponse.json({ message: e instanceof Error ? e.message : 'Backend proxy error' }, { status: 502 });
  }
}
