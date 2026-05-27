/**
 * Page-permission catalog. Each entry is one slot in the admin sidebar.
 * The `slug` is what gets stored in User.permissions; the `label` and
 * `group` mirror the sidebar so the InviteAdminModal renders the same
 * grouping the new staff member will see after login.
 *
 * Pages NOT listed here are unrestricted (e.g. /login, /profile). To
 * restrict a new page, add it to this catalog and the sidebar will start
 * gating it automatically.
 */
export interface PagePermission {
  readonly slug: string;
  readonly label: string;
  readonly group: string;
}

export const PAGE_PERMISSIONS: readonly PagePermission[] = [
  { slug: 'dashboard', label: 'Dashboard', group: 'Atelier' },

  { slug: 'products', label: 'Products', group: 'Catalog' },
  { slug: 'categories', label: 'Categories', group: 'Catalog' },
  { slug: 'collections', label: 'Collections', group: 'Catalog' },
  { slug: 'bundles', label: 'Bundles', group: 'Catalog' },

  { slug: 'orders', label: 'Orders', group: 'Sales' },
  { slug: 'returns', label: 'Returns', group: 'Sales' },
  { slug: 'discounts', label: 'Discounts', group: 'Sales' },
  { slug: 'pos', label: 'Point of Sale', group: 'Sales' },

  { slug: 'inventory', label: 'Stock', group: 'Inventory' },

  { slug: 'cms', label: 'CMS Hub', group: 'Content' },
  { slug: 'cms-media', label: 'Live Media', group: 'Content' },
  { slug: 'cms-home-banners', label: 'Home Banners', group: 'Content' },
  { slug: 'cms-banners', label: 'Promo Banners', group: 'Content' },

  { slug: 'marketing-campaigns', label: 'Campaigns', group: 'Marketing' },
  { slug: 'reviews', label: 'Reviews', group: 'Marketing' },
  { slug: 'marketing-facebook', label: 'Facebook', group: 'Marketing' },

  { slug: 'inbox', label: 'Inbox', group: 'Chat Bot' },
  { slug: 'bot-synonyms', label: 'Synonyms', group: 'Chat Bot' },
  { slug: 'bot-unrecognized', label: 'Unrecognized', group: 'Chat Bot' },

  { slug: 'customers', label: 'Customers', group: 'Customers' },

  { slug: 'design', label: 'Homepage Design', group: 'Design' },

  { slug: 'courier', label: 'Courier', group: 'Logistics' },

  { slug: 'accounting', label: 'Accounting', group: 'Finance' },
  { slug: 'analytics', label: 'Analytics', group: 'Finance' },

  { slug: 'system-theme', label: 'Theme', group: 'System' },
  { slug: 'system-users', label: 'Admin Users', group: 'System' },
  { slug: 'system-languages', label: 'Languages', group: 'System' },
  { slug: 'system-currencies', label: 'Currencies', group: 'System' },
  { slug: 'system-audit-log', label: 'Audit Log', group: 'System' },
  { slug: 'settings', label: 'Settings', group: 'System' },
];

// Each entry maps a sidebar href to its permission slug. Keep in sync with
// PAGE_PERMISSIONS — the sidebar filter looks up href → slug here, then
// checks the user's permissions array for the slug.
export const HREF_TO_SLUG: Readonly<Record<string, string>> = {
  '/': 'dashboard',
  '/products': 'products',
  '/catalog/categories': 'categories',
  '/catalog/collections': 'collections',
  '/catalog/bundles': 'bundles',
  '/orders': 'orders',
  '/returns': 'returns',
  '/discounts': 'discounts',
  '/pos': 'pos',
  '/inventory': 'inventory',
  '/cms': 'cms',
  '/cms/media': 'cms-media',
  '/cms/home-banners': 'cms-home-banners',
  '/cms/banners': 'cms-banners',
  '/marketing/campaigns': 'marketing-campaigns',
  '/reviews': 'reviews',
  '/marketing/facebook': 'marketing-facebook',
  '/inbox': 'inbox',
  '/bot/synonyms': 'bot-synonyms',
  '/bot/unrecognized': 'bot-unrecognized',
  '/customers': 'customers',
  '/design': 'design',
  '/courier': 'courier',
  '/accounting': 'accounting',
  '/analytics': 'analytics',
  '/system/theme': 'system-theme',
  '/system/users': 'system-users',
  '/system/languages': 'system-languages',
  '/system/currencies': 'system-currencies',
  '/system/audit-log': 'system-audit-log',
  '/settings': 'settings',
};

/**
 * Visibility check used by the sidebar + route guards.
 *
 * Rules:
 *   - SUPER_ADMIN always passes (no permission gating).
 *   - Empty / undefined permissions array = all pages allowed. This keeps
 *     legacy ADMIN accounts created before this column existed working
 *     (their permissions[] defaults to [] which the schema reads as "no
 *     restriction set"). New staff created through InviteAdminModal must
 *     get an explicit permission list.
 *   - Otherwise the page slug must appear in the user's permissions array.
 */
export function canAccessPage(
  role: string | undefined | null,
  permissions: readonly string[] | undefined | null,
  slug: string,
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  if (!permissions || permissions.length === 0) return true;
  return permissions.includes(slug);
}
