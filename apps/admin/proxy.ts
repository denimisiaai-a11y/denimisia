import type { NextMiddleware } from 'next/server';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

const middleware = auth((req) => {
  const { pathname, search } = req.nextUrl;

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isPublic) return NextResponse.next();

  const session = req.auth;
  const role = session?.user?.role;
  const isAuthed = !!session?.user && typeof role === 'string' && ALLOWED_ROLES.has(role);

  if (isAuthed) return NextResponse.next();

  // Safety net: if Next.js ever surfaces a prefetch header to middleware
  // (it currently strips RSC/Next-Router-Prefetch before the handler runs),
  // short-circuit with a plain 401 so the prefetch doesn't turn into a
  // disruptive 307→/login bounce mid-session. No-op in current Next 16 but
  // cheap to keep.
  const isPrefetch =
    req.headers.get('next-router-prefetch') === '1' ||
    req.headers.get('next-router-segment-prefetch') === '1' ||
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('rsc') === '1';
  if (isPrefetch) {
    return new NextResponse(null, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}) as unknown as NextMiddleware;

export default middleware;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
