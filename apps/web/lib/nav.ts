import { NAV_ITEMS, type NavMenuItem, type NavSubItem } from './constants';
import { getCollectionsForNav } from './collections';

/**
 * Build a copy of NAV_ITEMS with the "Collection" menu augmented by live
 * collections from the DB (those with showInNav=true, sorted by navOrder).
 *
 * Server-only. Call from app/layout.tsx (which is async) and pass the result
 * to <Navbar /> and <MobileMenu />.
 *
 * Falls back to the static NAV_ITEMS if the fetch fails or returns empty.
 */
export async function buildNavWithCollections(): Promise<NavMenuItem[]> {
  let collections: Awaited<ReturnType<typeof getCollectionsForNav>> = [];
  try {
    collections = await getCollectionsForNav();
  } catch {
    return NAV_ITEMS;
  }

  if (collections.length === 0) return NAV_ITEMS;

  const dynamicItems: NavSubItem[] = collections.map((c) => ({
    label: c.name,
    href: `/collections/${c.slug}`,
  }));

  return NAV_ITEMS.map((item) => {
    if (item.label !== 'Collection') return item;

    return {
      ...item,
      sections: item.sections?.map((section) => ({
        ...section,
        items: [...section.items, ...dynamicItems],
      })),
      featuredImages: item.featuredImages?.map((img, idx) => {
        // Point the first featured tile at the first collection (newest by
        // navOrder) so the mega-menu's primary image actually opens a real
        // collection rather than the index.
        if (idx === 0 && collections[0]) {
          return { ...img, href: `/collections/${collections[0].slug}` };
        }
        return img;
      }),
    };
  });
}
