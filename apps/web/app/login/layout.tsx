import type { Metadata } from 'next';
import { noindexRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Sign in',
  robots: noindexRobots,
};

export const dynamic = 'force-dynamic';

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
