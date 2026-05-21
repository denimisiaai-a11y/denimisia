import { SITE_URL } from '@/config/brand';

/**
 * Canonical URL builder. Strips tracking/filter params that would otherwise
 * create duplicate-content variants competing in search. Per-route allowlists
 * whitelist only params that belong in the canonical.
 */

/** Params always stripped. */
const GLOBAL_STRIP = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'wbraid',
  'gbraid',
  'fbclid',
  'ttclid',
  'msclkid',
  'mc_cid',
  'mc_eid',
  '_ga',
  'ref',
  'referrer',
]);

/** Per-route canonical allowlists. Anything not in the list is stripped. */
const ROUTE_ALLOWLIST: Record<string, readonly string[]> = {
  '/search': ['q'],
  '/shop': ['page'],
  '/shop/men': ['page'],
  '/shop/women': ['page'],
};

function resolveAllowlist(pathname: string): readonly string[] {
  if (ROUTE_ALLOWLIST[pathname]) return ROUTE_ALLOWLIST[pathname];
  for (const [prefix, list] of Object.entries(ROUTE_ALLOWLIST)) {
    if (pathname.startsWith(prefix + '/')) return list;
  }
  return [];
}

export interface BuildCanonicalArgs {
  pathname: string;
  searchParams?: Record<string, string | string[] | undefined>;
  overrideAllowed?: readonly string[];
}

export function buildCanonical({
  pathname,
  searchParams = {},
  overrideAllowed,
}: BuildCanonicalArgs): string {
  const allowed = overrideAllowed ?? resolveAllowlist(pathname);
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined || value === '') continue;
    if (GLOBAL_STRIP.has(key)) continue;
    if (!allowed.includes(key)) continue;
    if (Array.isArray(value)) {
      const nonEmpty = value.filter((v) => v !== '');
      nonEmpty.forEach((v) => qs.append(key, v));
    } else {
      qs.set(key, value);
    }
  }

  const q = qs.toString();
  const cleanPath = pathname.endsWith('/') && pathname !== '/'
    ? pathname.slice(0, -1)
    : pathname;
  return `${SITE_URL}${cleanPath}${q ? `?${q}` : ''}`;
}

/** Absolute URL from a relative path under this site. */
export function absoluteUrl(pathname: string): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${SITE_URL}${clean}`;
}
