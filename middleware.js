import { NextResponse } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(req) {
  const ok = await verifyToken(req.cookies.get('session')?.value);
  if (!ok) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|_next|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
