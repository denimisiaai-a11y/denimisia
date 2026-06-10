'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { canAccessPage, HREF_TO_SLUG } from '@/lib/permissions';

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
}

interface NavGroup {
  readonly label: string;
  readonly items: readonly NavItem[];
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Atelier',
    items: [{ href: '/', label: 'Dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: 'inventory_2' },
      { href: '/catalog/categories', label: 'Categories', icon: 'category' },
      { href: '/catalog/collections', label: 'Collections', icon: 'collections_bookmark' },
      { href: '/catalog/bundles', label: 'Bundles', icon: 'widgets' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { href: '/orders', label: 'Orders', icon: 'shopping_cart' },
      { href: '/returns', label: 'Returns', icon: 'assignment_return' },
      { href: '/discounts', label: 'Discounts', icon: 'sell' },
      { href: '/pos', label: 'Point of Sale', icon: 'point_of_sale' },
    ],
  },
  {
    label: 'Inventory',
    items: [{ href: '/inventory', label: 'Stock', icon: 'warehouse' }],
  },
  {
    label: 'Content',
    items: [
      { href: '/cms',         label: 'CMS Hub',        icon: 'space_dashboard' },
      { href: '/cms/media',        label: 'Live Media',    icon: 'auto_awesome' },
      { href: '/cms/home-banners', label: 'Home Banners',  icon: 'view_carousel' },
      { href: '/cms/banners',      label: 'Promo Banners', icon: 'campaign' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { href: '/marketing/campaigns', label: 'Campaigns', icon: 'campaign' },
      { href: '/reviews', label: 'Reviews', icon: 'rate_review' },
      { href: '/marketing/facebook', label: 'Facebook', icon: 'hub' },
    ],
  },
  {
    label: 'Chat Bot',
    items: [
      { href: '/inbox', label: 'Inbox', icon: 'inbox' },
      { href: '/bot/synonyms', label: 'Synonyms', icon: 'spellcheck' },
      { href: '/bot/unrecognized', label: 'Unrecognized', icon: 'help' },
    ],
  },
  {
    label: 'Customers',
    items: [{ href: '/customers', label: 'Customers', icon: 'group' }],
  },
  {
    label: 'Design',
    items: [{ href: '/design', label: 'Homepage', icon: 'dashboard_customize' }],
  },
  {
    label: 'Logistics',
    items: [{ href: '/courier', label: 'Courier', icon: 'local_shipping' }],
  },
  {
    label: 'Finance',
    items: [
      { href: '/accounting', label: 'Accounting', icon: 'account_balance' },
      { href: '/analytics', label: 'Analytics', icon: 'analytics' },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/system/theme', label: 'Theme', icon: 'palette' },
      { href: '/system/users', label: 'Admin Users', icon: 'admin_panel_settings' },
      { href: '/system/languages', label: 'Languages', icon: 'translate' },
      { href: '/system/currencies', label: 'Currencies', icon: 'currency_exchange' },
      { href: '/system/audit-log', label: 'Audit Log', icon: 'history' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const permissions = session?.user?.permissions;

  // Filter nav by the current user's permissions. Groups whose every item
  // is hidden disappear entirely so the sidebar doesn't leave empty section
  // headers (e.g. "System" with no children for a non-SUPER_ADMIN).
  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const slug = HREF_TO_SLUG[item.href];
        // Items without a slug entry are unrestricted — keeps the catalog
        // safe-by-default during incremental rollout.
        if (!slug) return true;
        return canAccessPage(role, permissions, slug);
      }),
    })).filter((group) => group.items.length > 0);
  }, [role, permissions]);

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-outline-variant/15 bg-surface py-6 dark:bg-ink">
      <div className="mb-6 px-8">
        <h1 className="font-headline text-2xl font-semibold tracking-[0.15em] text-ink dark:text-white">
          DENIMISIA
        </h1>
        <p className="mt-1 font-body text-[10px] font-semibold uppercase tracking-[0.1em] text-secondary">
          Atelier Admin
        </p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4 scrollbar-hide">
        {visibleGroups.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-4 text-[9px] font-bold uppercase tracking-[0.25em] text-secondary/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? 'flex items-center border-l-2 border-primary py-2 pl-[14px] font-body text-xs font-bold uppercase tracking-[0.1em] text-ink dark:text-white'
                        : 'flex items-center py-2 pl-4 font-body text-xs font-semibold uppercase tracking-[0.1em] text-secondary transition-colors duration-300 ease-editorial hover:bg-surface-container dark:hover:bg-surface-container-high'
                    }
                  >
                    <span className="material-symbols-outlined mr-4 text-base" aria-hidden>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto px-6 pt-4">
        <Link
          href="/products/new"
          className="block w-full bg-primary px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-on-primary transition-transform duration-300 ease-editorial hover:scale-[1.02]"
        >
          New Collection
        </Link>
      </div>
    </aside>
  );
}
