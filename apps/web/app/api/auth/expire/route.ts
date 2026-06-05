import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

// Force-expires the NextAuth session and bounces the user to /login.
//
// Called when an API request from a logged-in page comes back 401. That means
// the NextAuth session cookie is still cryptographically valid (so middleware
// lets the user through) but the API JWT stored inside it has expired and
// every protected backend call is now failing silently. Without this route,
// the user sees "Unable to load profile" everywhere in /account and has no
// way out short of clearing cookies manually.
//
// Cookie names cover NextAuth v5 default + `__Secure-` prefix for HTTPS
// production and `__Host-` prefix where used. CSRF and callback cookies are
// cleared too so the next sign-in starts from a clean slate.
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
  '__Host-authjs.session-token',
  'authjs.csrf-token',
  '__Host-authjs.csrf-token',
  'authjs.callback-url',
  '__Secure-authjs.callback-url',
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    jar.delete(name);
  }
  const target = new URL('/login', req.nextUrl);
  target.searchParams.set('reason', 'session-expired');
  return NextResponse.redirect(target);
}
