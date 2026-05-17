import type { Metadata } from 'next';
import { noindexRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Forgot password',
  robots: noindexRobots,
};

export const dynamic = 'force-dynamic';

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
