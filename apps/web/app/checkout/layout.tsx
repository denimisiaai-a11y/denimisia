import type { Metadata } from 'next';
import { noindexRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: noindexRobots,
};

export const dynamic = 'force-dynamic';

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
