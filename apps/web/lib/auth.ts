import NextAuth from 'next-auth';
import type { NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const nextAuth: NextAuthResult = NextAuth({
  // Required when the app runs behind a reverse proxy / CDN (Vercel,
  // Cloudflare, custom load balancer). Without this, NextAuth v5
  // rejects the callback host on first sign-in and login silently
  // fails. The admin app already sets this; mirroring here.
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const json = await res.json();
          if (!json.success) return null;

          const { accessToken, user } = json.data;

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
            accessToken,
            role: user.role,
          };
        } catch {
          return null;
        }
      },
    }),
    // Google sign-in. The actual session minting happens in the `jwt` callback
    // below — Google's id_token is forwarded to our API, which verifies it
    // against Google's JWKS and returns our own JWT pair. NextAuth v5
    // auto-reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env.
    Google({
      // Force ID-token issuance even on subsequent sign-ins (some auth flows
      // skip it after the first). Without an id_token the exchange below
      // can't run.
      authorization: {
        params: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // First sign-in via Google: exchange the verified Google ID token for
      // our API's JWT pair. On all subsequent calls `account` is undefined
      // and we just pass the cached token through.
      if (account?.provider === 'google' && account.id_token) {
        try {
          const res = await fetch(`${API}/auth/oauth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: account.id_token }),
          });
          if (!res.ok) {
            throw new Error(`oauth/google exchange failed: ${res.status}`);
          }
          const json = await res.json();
          if (!json.success) {
            throw new Error('oauth/google exchange returned success=false');
          }
          const { accessToken, user: apiUser } = json.data;
          token.id = apiUser.id;
          token.email = apiUser.email;
          token.name = `${apiUser.firstName} ${apiUser.lastName}`.trim();
          token.accessToken = accessToken;
          token.role = apiUser.role;
          return token;
        } catch (err) {
          // Throwing here causes NextAuth to send the user back to the login
          // page with ?error=Configuration. Surfacing a real diagnostic in
          // dev only — production users just see the redirect.
          if (process.env.NODE_ENV !== 'production') {
            console.error('Google OAuth exchange failed:', err);
          }
          throw err;
        }
      }
      if (user) {
        token.id = user.id;
        token.accessToken = (user as any).accessToken;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session as any).accessToken = token.accessToken;
        (session as any).user.role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  // Namespace the cookie so admin (3002) and web (3000) don't clobber each
  // other's sessions on localhost (cookies are scoped by domain, not port).
  cookies: {
    sessionToken: {
      name: 'denimisia-web.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    csrfToken: {
      name: 'denimisia-web.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    callbackUrl: {
      name: 'denimisia-web.callback-url',
      options: { sameSite: 'lax', path: '/', secure: false },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  logger: {
    // NextAuth log spew is dev-only. Production swallows everything that
    // would otherwise hit the user's browser console — server-side logs
    // remain available via the runtime's own logging.
    error(error) {
      if (error?.name === 'JWTSessionError') return;
      if (process.env.NODE_ENV !== 'production') {
        console.error(error);
      }
    },
    warn(code) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(code);
      }
    },
    debug() {},
  },
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
