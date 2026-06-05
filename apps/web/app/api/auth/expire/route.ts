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
// (annoyance only, no data exfiltration), but still real. Two defenses,
// both fail-closed:
//
//   1. `Sec-Fetch-Site` MUST be `same-origin` (server-side redirect from
//      our own page.tsx) or `none` (direct user navigation). Anything else
//      — `cross-site`, `same-site` (different subdomain), or missing
//      entirely — gets a plain redirect with no Set-Cookie. Old browsers
//      that don't send the header are treated as untrusted; users on those
//      browsers re-login via the normal flow rather than getting a CSRF
//      bypass. Modern browsers (Chrome 76+, Firefox 90+, Safari 16.4+)
//      attach this header automatically.
//   2. An active NextAuth session must exist before any cookie touches —
//      unauthenticated scanners and pre-warming bots get a plain redirect
//      with no Set-Cookie noise.
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
  // Allowlist (fail-closed): only requests the browser explicitly marks as
  // same-origin or user-initiated are trusted. Cross-site, same-site, and
  // missing-header requests all fall through to a plain redirect with no
  // Set-Cookie. This blocks `<img>`/`<iframe>`/`<a>` CSRF and any caller
  // that can't be positively identified as us or the user.
  const fetchSite = req.headers.get('sec-fetch-site');
  const isTrustedSource = fetchSite === 'same-origin' || fetchSite === 'none';
  if (!isTrustedSource) {
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
