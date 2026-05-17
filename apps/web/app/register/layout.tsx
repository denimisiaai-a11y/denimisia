import type { Metadata } from 'next';
import { noindexRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Create account',
  robots: noindexRobots,
};

export const dynamic = 'force-dynamic';

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
