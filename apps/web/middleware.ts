import { auth } from '@/lib/auth';
import { NextResponse, type NextRequest } from 'next/server';

// Auth guard for `/account/*` paths.
//
// The same check lives in `app/account/layout.tsx` for defense-in-depth, but
// when the layout fires `redirect('/login')` mid-stream Next.js emits an
// HTTP 200 with an embedded meta-refresh tag instead of a proper 307 with
// `Location`. Real browsers honor the meta-refresh after ~1s, but the brief
// account-shell flash is poor UX and non-browser tooling (curl, Postman,
// security scanners) reads the 200 as "the page is accessible without auth"
// — which it isn't, but the appearance matters.
//
// Middleware runs before any streaming begins, so we can return a real 307
// with `Location: /login?callbackUrl=...` and skip the flash entirely.
export default async function middleware(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    const loginUrl = new URL('/login', req.nextUrl);
    loginUrl.searchParams.set(
      'callbackUrl',
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/account/:path*'],
};
