import type { Metadata } from 'next';
import Link from 'next/link';
import { SHOP_GENDER_FITS, genderCategorySlug } from '@/lib/category-copy';
import { getProductFacets } from '@/lib/api';
import { SITE_URL } from '@/config/brand';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Sitemap',
  description:
    'Browse every section of Denimisia — shop by fit, collections, company information, and customer support.',
  alternates: { canonical: `${SITE_URL}/sitemap` },
};

interface LinkItem {
  label: string;
  href: string;
}
interface Section {
  title: string;
  links: LinkItem[];
}

// Only list fit pages that resolve to a populated category, so the human
// directory mirrors what's actually shoppable (no empty "coming soon" pages).
async function populatedWomensFits(): Promise<LinkItem[]> {
  try {
    const facets = await getProductFacets();
    const populated = new Set(
      facets.categories.filter((c) => c.count > 0).map((c) => c.slug),
    );
    return (SHOP_GENDER_FITS.women ?? [])
      .filter((fit) => populated.has(`${genderCategorySlug('women')}-${fit.slug}`))
      .map((fit) => ({ label: `Women's ${fit.label}`, href: `/shop/women/${fit.slug}` }));
  } catch {
    return [];
  }
}

export default async function SitemapPage() {
  const womensFits = await populatedWomensFits();

  const sections: Section[] = [
    {
      title: 'Shop',
      links: [
        { label: 'All Products', href: '/shop' },
        { label: 'Women', href: '/shop/women' },
        { label: 'Men', href: '/shop/men' },
        ...womensFits,
      ],
    },
    {
      title: 'Collections & Series',
      links: [
        { label: 'Collections', href: '/collections' },
        { label: 'Bundles', href: '/bundles' },
        { label: 'Outlets', href: '/outlets' },
        { label: 'Series — Tops', href: '/series/tops' },
        { label: 'Series — Pants', href: '/series/pants' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Career', href: '/career' },
        { label: 'Contact', href: '/contact' },
        { label: 'Size Guide', href: '/size-guide' },
      ],
    },
    {
      title: 'Orders & Support',
      links: [
        { label: 'Track Your Order', href: '/track-order' },
        { label: 'Returns & Exchange', href: '/returns' },
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Sign In', href: '/login' },
        { label: 'Create Account', href: '/register' },
      ],
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-24 sm:px-6 lg:px-8">
      <header className="mb-12 border-b border-ink/10 pb-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-muted">
          Directory
        </p>
        <h1 className="font-serif text-4xl tracking-tight text-ink md:text-5xl">Sitemap</h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          All pages on the Denimisia site.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => (
          <nav key={section.title}>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink">
              {section.title}
            </h2>
            <ul className="space-y-2.5">
              {section.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </div>
  );
}
