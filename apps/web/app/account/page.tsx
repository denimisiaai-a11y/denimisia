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
  const session = await auth();
  const profile = session?.accessToken ? await getProfile(session.accessToken) : null;

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
      accessToken={session!.accessToken as string}
    />
  );
}
