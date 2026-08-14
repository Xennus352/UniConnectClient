import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const SESSION_COOKIE = 'uniconnect_session';
const BACKEND_COOKIE = 'uniconnect_backend';

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

function clientRole(roleName: string, unitName?: string): string {
  switch (roleName) {
    case 'SYSTEM_ADMIN':
      return 'admin';
    case 'STUDENT':
      return 'student';
    case 'STAFF':
      return unitName && unitName.toLowerCase().includes('student affair') ? 'student-affair' : 'lecturer';
    default:
      return 'student';
  }
}

function rolePath(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'student-affair':
      return '/student-affair';
    case 'lecturer':
      return '/lecturer';
    default:
      return '/student';
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
  }

  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ message: err?.message || `Login failed (${res.status})` }, { status: res.status });
  }
  const data = await res.json();

  const tokens = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.userId,
    roleName: data.roleName,
  };

  let name = (body.email as string).split('@')[0];
  let unitName: string | undefined;
  try {
    const authHeader = { Authorization: `Bearer ${data.accessToken}` };
    if (data.roleName === 'STUDENT') {
      const students = await fetch(`${BASE}/api/students`, { headers: authHeader }).then((r) => r.json());
      const mine = (students || []).find((s: { userId: string }) => String(s.userId) === String(data.userId));
      if (mine?.studentName) name = mine.studentName;
    } else if (data.roleName === 'STAFF') {
      const staff = await fetch(`${BASE}/api/staff`, { headers: authHeader }).then((r) => r.json());
      const mine = (staff || []).find((s: { userId: string }) => String(s.userId) === String(data.userId));
      if (mine?.staffName) name = mine.staffName;
      if (mine?.unitName) unitName = mine.unitName;
    }
  } catch {
    // name/unit lookup is best-effort
  }

  const role = clientRole(data.roleName, unitName);
  const session = { role, email: body.email, name };

  const response = NextResponse.json(
    { role, email: body.email, name, path: rolePath(role) },
    { status: 200 }
  );
  response.cookies.set(SESSION_COOKIE, JSON.stringify(session), COOKIE_OPTS);
  response.cookies.set(BACKEND_COOKIE, JSON.stringify(tokens), COOKIE_OPTS);
  return response;
}
