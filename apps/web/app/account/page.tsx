import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ProfileForm } from './profile-form';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type ProfileResult =
  | { ok: true; data: { id: string; email: string; firstName: string; lastName: string; phones?: string[] } }
  | { ok: false; status: number | 'network' };

async function getProfile(accessToken: string): Promise<ProfileResult> {
  try {
    const res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const json = await res.json();
    if (!json.success) return { ok: false, status: res.status };
    return { ok: true, data: json.data };
  } catch {
    return { ok: false, status: 'network' };
  }
}

export default async function ProfilePage() {
  // Layout guarantees session is non-null (it redirects to /login otherwise).
  // Still, defensively coerce in case a Google sign-in produced a session
  // without an API accessToken — bounce to the expire route so the broken
  // session is cleared instead of looping back here forever.
  const session = await auth();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  if (!accessToken) {
    redirect('/api/auth/expire');
  }

  const result = await getProfile(accessToken);

  // 401 means the API JWT inside the NextAuth session has expired. The
  // session cookie itself is still cryptographically valid so middleware
  // keeps letting the user through to /account, but every API call now
  // returns 401 and the user sees "Unable to load profile" everywhere with
  // no way out. Force-expire the session and bounce to /login.
  if (!result.ok && result.status === 401) {
    redirect('/api/auth/expire');
  }

  if (!result.ok) {
    return (
      <p className="text-sm text-muted">
        We couldn&apos;t load your profile right now. Please refresh the page or try again shortly.
      </p>
    );
  }

  const { data: profile } = result;
  return (
    <ProfileForm
      profile={{
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phones: Array.isArray(profile.phones) ? profile.phones : [],
      }}
      accessToken={accessToken}
    />
  );
}
