import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_OPTS = {
  path: '/',
  maxAge: 60 * 60 * 24 * 30,
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
};

export async function GET() {
  const store = await cookies();
  const raw = store.get('uniconnect_session')?.value;
  if (!raw) return NextResponse.json({ user: null });
  try {
    const session = JSON.parse(raw);
    if (!session?.role || !session?.email) return NextResponse.json({ user: null });
    return NextResponse.json({ user: session });
  } catch {
    return NextResponse.json({ user: null });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const store = await cookies();
  const raw = store.get('uniconnect_session')?.value;
  if (!raw) return NextResponse.json({ user: null });
  try {
    const session = JSON.parse(raw);
    const user = { ...session, ...body };
    const response = NextResponse.json({ user });
    response.cookies.set('uniconnect_session', JSON.stringify(user), COOKIE_OPTS);
    return response;
  } catch {
    return NextResponse.json({ user: null });
  }
}
