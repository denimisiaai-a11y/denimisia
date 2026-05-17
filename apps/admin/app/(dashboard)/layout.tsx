'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar';
import { TopHeader } from '@/components/top-header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="font-body text-xs uppercase tracking-[0.2em] text-secondary">Loading</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopHeader
        userEmail={session.user?.email ?? ''}
        userRole={session.user?.role ?? 'ADMIN'}
        onSignOut={() => signOut({ callbackUrl: '/login' })}
      />
      <main className="ml-64 min-h-screen px-8 pb-12 pt-24 transition-all duration-700 ease-editorial">
        {children}
      </main>
    </div>
  );
}
