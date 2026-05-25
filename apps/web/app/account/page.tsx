import { auth } from '@/lib/auth';
import { ProfileForm } from './profile-form';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function getProfile(accessToken: string) {
  try {
    const res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  // Layout guarantees session is non-null (it redirects to /login otherwise).
  // Still, defensively coerce in case a Google sign-in produced a session
  // without an API accessToken — degrade to a friendly empty state instead
  // of throwing, which would trigger the global "Something came loose" page.
  const session = await auth();
  const accessToken = (session as { accessToken?: string } | null)?.accessToken;

  if (!accessToken) {
    return (
      <p className="text-sm text-muted">
        Your session is missing API credentials. Please sign out and sign in again.
      </p>
    );
  }

  const profile = await getProfile(accessToken);
  if (!profile) {
    return <p className="text-sm text-muted">Unable to load profile.</p>;
  }

  return (
    <ProfileForm
      profile={{
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone ?? null,
      }}
      accessToken={accessToken}
    />
  );
}
