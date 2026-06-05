import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

// Force-expires the NextAuth session and bounces the user to /login.
//
// Called when an API request from a logged-in page comes back 401. The
// NextAuth session cookie is still cryptographically valid (so middleware
// lets the user through) but the API JWT stored inside it has expired and
// every protected backend call is failing. Without this route the user
// sees "Unable to load profile" everywhere in /account with no way out.
//
// CSRF posture: this is a GET handler that clears the session cookie, which
// is the classic "forced logout" CSRF vector — an attacker could embed
// `<img src=".../api/auth/expire">` on a malicious page and any logged-in
// denimisia user loading that page gets force-logged-out. Impact is DoS
// (annoyance only, no data exfiltration), but still real. Two defenses:
//
//   1. Require `Sec-Fetch-Site` to be `same-origin` or `none`. Modern
//      browsers (Chrome 76+, Firefox 90+, Safari 16.4+) attach this header
//      automatically; cross-origin `<img>`/`<iframe>`/`<a>` triggers send
//      `cross-site` and get rejected. Same-origin server-side redirects
//      from page.tsx (`redirect('/api/auth/expire')`) and direct user
//      navigation both pass.
//   2. Require an active session before clearing cookies — unauthenticated
//      scanners hitting this URL get a plain redirect, no Set-Cookie noise.
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
  const fetchSite = req.headers.get('sec-fetch-site');
  const isCrossOrigin = fetchSite === 'cross-site' || fetchSite === 'same-site';

  // CSRF defense: refuse to clear cookies on cross-origin triggers. The
  // attacker still gets a 307 back (no enumeration value), but the session
  // survives.
  if (isCrossOrigin) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  // No-op for unauthenticated callers — nothing to clear, just redirect.
  const session = await auth();
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  const jar = await cookies();
  for (const name of SESSION_COOKIES) {
    jar.delete(name);
  }
  const target = new URL('/login', req.nextUrl);
  target.searchParams.set('reason', 'session-expired');
  return NextResponse.redirect(target);
}
