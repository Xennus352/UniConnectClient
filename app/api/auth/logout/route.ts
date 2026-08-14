import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set('uniconnect_session', '', { path: '/', maxAge: 0 });
  response.cookies.set('uniconnect_backend', '', { path: '/', maxAge: 0 });
  return response;
}
