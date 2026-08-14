import 'server-only';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

export interface SessionIdentity {
  email: string;
  name: string;
  role: string;
  initials: string;
}

const COOKIE_NAME = 'uniconnect_session';

export async function getSessionIdentity(req?: NextRequest): Promise<SessionIdentity | null> {
  let raw: string | undefined;
  if (req) {
    raw = req.cookies.get(COOKIE_NAME)?.value;
  } else {
    raw = (await cookies()).get(COOKIE_NAME)?.value;
  }
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (!s?.email || !s?.role) return null;
    return {
      email: s.email,
      name: s.name ?? s.email.split('@')[0],
      role: s.role,
      initials: s.initials ?? s.email.slice(0, 2).toUpperCase(),
    };
  } catch {
    return null;
  }
}
