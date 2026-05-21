import NextAuth from 'next-auth';
import type { NextAuthResult } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import './auth-types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN']);

type JwtPayload = {
  sub?: string;
  email?: string;
  role?: string;
  exp?: number;
};

function base64UrlDecode(input: string): string | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return Buffer.from(padded + pad, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const json = base64UrlDecode(parts[1]);
  if (!json) return null;
  try {
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

const nextAuth: NextAuthResult = NextAuth({
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

          const body = (await res.json().catch(() => null)) as
            | { data?: { accessToken?: string }; accessToken?: string }
            | null;
          const accessToken = body?.data?.accessToken ?? body?.accessToken;
          if (!accessToken) return null;

          const payload = decodeJwt(accessToken);
          if (!payload?.role || !payload.sub || !payload.email) return null;
          if (!ALLOWED_ROLES.has(payload.role)) return null;

          return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            accessToken,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.accessToken = token.accessToken;
        session.user.role = token.role;
        if (typeof token.sub === 'string') {
          session.user.id = token.sub;
        }
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7,   // 7 days — keeps admin signed in across a work week
    updateAge: 60 * 60 * 24,    // rotate the cookie once a day
  },
  // Namespace the cookie so admin (3002) and web (3000) don't clobber each
  // other's sessions on localhost (cookies are scoped by domain, not port).
  cookies: {
    sessionToken: {
      name: 'denimisia-admin.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    csrfToken: {
      name: 'denimisia-admin.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: false },
    },
    callbackUrl: {
      name: 'denimisia-admin.callback-url',
      options: { sameSite: 'lax', path: '/', secure: false },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export const handlers: NextAuthResult['handlers'] = nextAuth.handlers;
export const signIn: NextAuthResult['signIn'] = nextAuth.signIn;
export const signOut: NextAuthResult['signOut'] = nextAuth.signOut;
export const auth: NextAuthResult['auth'] = nextAuth.auth;
