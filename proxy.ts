import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/student', '/lecturer', '/student-affair', '/admin'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  if (!isProtected) return NextResponse.next();

  const raw = request.cookies.get('uniconnect_session')?.value;
  let session: { email?: string; role?: string } | null = null;
  if (raw) {
    try {
      session = JSON.parse(decodeURIComponent(raw));
    } catch {
      session = null;
    }
  }
  if (session?.email && session?.role) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/student/:path*', '/lecturer/:path*', '/student-affair/:path*', '/admin/:path*'],
};
