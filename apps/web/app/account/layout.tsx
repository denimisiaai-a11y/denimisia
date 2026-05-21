import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { noindexRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Account',
  robots: noindexRobots,
};

// Account pages are auth-gated; never statically prerender.
export const dynamic = 'force-dynamic';

const ACCOUNT_NAV = [
  { label: 'Profile', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Returns', href: '/account/returns' },
  { label: 'Wishlist', href: '/account/wishlist' },
  { label: 'Addresses', href: '/account/addresses' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-[1440px] px-6 pb-20 pt-28 lg:px-12">
      <h1 className="mb-10 text-2xl font-medium uppercase tracking-[0.2em] text-ink">
        My Account
      </h1>
      <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
        {/* Sidebar nav */}
        <nav className="flex gap-4 overflow-x-auto border-b border-border pb-4 lg:flex-col lg:gap-1 lg:border-b-0 lg:border-r lg:border-border lg:pb-0 lg:pr-8">
          {ACCOUNT_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {/* Content */}
        <div>{children}</div>
      </div>
    </div>
  );
}
