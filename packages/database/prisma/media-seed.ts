/**
 * Media slot seed — upserts a PageSlot row for every slot defined in
 * apps/api/src/modules/media/media.config.ts. Idempotent.
 *
 * Run: pnpm --filter database seed:media
 *
 * This populates the slots with their specs + default headings/CTAs.
 * Media assets are NOT uploaded here — the admin does that via /admin/media.
 */

import { PrismaClient, MediaKind } from '@prisma/client';

const prisma = new PrismaClient();

interface SlotSpec {
  readonly pageKey: string;
  readonly slotKey: string;
  readonly label: string;
  readonly mediaKind: MediaKind;
  readonly acceptsVideo: boolean;
  readonly specWidth: number;
  readonly specHeight: number;
  readonly specAspect: string;
  readonly maxBytes: number;
  readonly position?: number;
  readonly groupKey?: string;
  readonly defaultHeading?: string;
  readonly defaultSubheading?: string;
  readonly defaultBody?: string;
  readonly defaultCtaLabel?: string;
  readonly defaultCtaHref?: string;
}

const MB = 1024 * 1024;

const SLOTS: readonly SlotSpec[] = [
  // HOME
  { pageKey: 'home', slotKey: 'hero_main', label: 'Hero (image or video)',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 15 * MB,
    defaultHeading: 'Denim rewritten.', defaultCtaLabel: 'Shop now', defaultCtaHref: '/shop' },

  { pageKey: 'home', slotKey: 'category_card_1', label: 'Category card 1',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'home.category_cards', position: 0,
    specWidth: 1200, specHeight: 1600, specAspect: '3:4', maxBytes: 2 * MB,
    defaultHeading: 'Wide-Leg', defaultCtaHref: '/shop/womens/womens-wide-leg' },
  { pageKey: 'home', slotKey: 'category_card_2', label: 'Category card 2',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'home.category_cards', position: 1,
    specWidth: 1200, specHeight: 1600, specAspect: '3:4', maxBytes: 2 * MB,
    defaultHeading: 'Baggy Fit', defaultCtaHref: '/shop/womens/womens-baggy' },
  { pageKey: 'home', slotKey: 'category_card_3', label: 'Category card 3',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'home.category_cards', position: 2,
    specWidth: 1200, specHeight: 1600, specAspect: '3:4', maxBytes: 2 * MB,
    defaultHeading: 'Cargo', defaultCtaHref: '/shop/womens/womens-cargo' },

  { pageKey: 'home', slotKey: 'editorial_slide_1', label: 'Editorial carousel slide 1',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 0,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_2', label: 'Editorial carousel slide 2',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 1,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_3', label: 'Editorial carousel slide 3',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 2,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_4', label: 'Editorial carousel slide 4',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 3,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_5', label: 'Editorial carousel slide 5',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 4,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_6', label: 'Editorial carousel slide 6',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 5,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_7', label: 'Editorial carousel slide 7',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 6,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },
  { pageKey: 'home', slotKey: 'editorial_slide_8', label: 'Editorial carousel slide 8',
    mediaKind: 'IMAGE', acceptsVideo: true, groupKey: 'home.editorial', position: 7,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 3 * MB },

  { pageKey: 'home', slotKey: 'brand_story_backdrop', label: 'Brand story backdrop',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 4 * MB,
    defaultHeading: 'The Denimisia story.',
    defaultBody: 'Premium denim, built in Bangladesh, for the modern everyday.' },

  // COLLECTIONS
  { pageKey: 'collections-index', slotKey: 'collections_hero', label: 'Collections index hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Curated collections.' },
  { pageKey: 'collection-bestsellers', slotKey: 'bestsellers_parallax_hero',
    label: 'Bestsellers parallax hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1920, specAspect: '4:3', maxBytes: 4 * MB,
    defaultHeading: 'Bestsellers',
    defaultSubheading: 'Our most-loved silhouettes.' },

  // BUNDLES
  { pageKey: 'bundles-index', slotKey: 'bundles_hero', label: 'Bundles hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 4 * MB,
    defaultHeading: 'Denim pairs, done for you.' },

  // ABOUT
  { pageKey: 'about', slotKey: 'about_hero', label: 'About hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Denim with a point of view.' },
  { pageKey: 'about', slotKey: 'about_story_image', label: 'About story image',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 1600, specHeight: 2000, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'about', slotKey: 'about_body', label: 'About body copy',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 0, specHeight: 0, specAspect: 'text-only', maxBytes: 0,
    defaultBody: '<p>We make denim the old way — with patience.</p>' },

  // AUTH
  { pageKey: 'auth', slotKey: 'auth_editorial_panel', label: 'Auth side panel image',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 1600, specHeight: 2400, specAspect: '2:3', maxBytes: 3 * MB },

  // MISSING OPPORTUNITY SLOTS (new)
  { pageKey: 'career', slotKey: 'career_hero', label: 'Career hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1440, specAspect: '16:9', maxBytes: 4 * MB,
    defaultHeading: 'Build with us.', defaultSubheading: 'Open roles at Denimisia.' },
  { pageKey: 'career', slotKey: 'career_team_1', label: 'Team photo 1',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'career.team', position: 0,
    specWidth: 1200, specHeight: 1500, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'career', slotKey: 'career_team_2', label: 'Team photo 2',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'career.team', position: 1,
    specWidth: 1200, specHeight: 1500, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'career', slotKey: 'career_team_3', label: 'Team photo 3',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'career.team', position: 2,
    specWidth: 1200, specHeight: 1500, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'career', slotKey: 'career_body', label: 'Career body copy',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 0, specHeight: 0, specAspect: 'text-only', maxBytes: 0,
    defaultBody: '<p>We are hiring across design, ops, and engineering.</p>' },

  { pageKey: 'contact', slotKey: 'contact_hero', label: 'Contact hero',
    mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Talk to us.' },
  { pageKey: 'contact', slotKey: 'contact_side', label: 'Contact form side image',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 1200, specHeight: 1500, specAspect: '4:5', maxBytes: 2 * MB },

  { pageKey: 'returns', slotKey: 'returns_hero', label: 'Returns hero',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Returns & exchanges.' },
  { pageKey: 'returns', slotKey: 'returns_body', label: 'Returns policy body',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 0, specHeight: 0, specAspect: 'text-only', maxBytes: 0,
    defaultBody: '<p>14-day returns on full-price items.</p>' },

  { pageKey: 'privacy', slotKey: 'privacy_hero', label: 'Privacy hero',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Privacy policy.' },
  { pageKey: 'privacy', slotKey: 'privacy_body', label: 'Privacy body',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 0, specHeight: 0, specAspect: 'text-only', maxBytes: 0,
    defaultBody: '<p>How we handle your data.</p>' },

  { pageKey: 'size-guide', slotKey: 'size_guide_chart_wide_leg',
    label: 'Wide-leg size chart', mediaKind: 'IMAGE', acceptsVideo: false,
    groupKey: 'sizeGuide.charts', position: 0,
    specWidth: 1600, specHeight: 2000, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'size-guide', slotKey: 'size_guide_chart_baggy',
    label: 'Baggy size chart', mediaKind: 'IMAGE', acceptsVideo: false,
    groupKey: 'sizeGuide.charts', position: 1,
    specWidth: 1600, specHeight: 2000, specAspect: '4:5', maxBytes: 2 * MB },
  { pageKey: 'size-guide', slotKey: 'size_guide_chart_cargo',
    label: 'Cargo size chart', mediaKind: 'IMAGE', acceptsVideo: false,
    groupKey: 'sizeGuide.charts', position: 2,
    specWidth: 1600, specHeight: 2000, specAspect: '4:5', maxBytes: 2 * MB },

  { pageKey: 'track-order', slotKey: 'track_order_hero', label: 'Track order hero',
    mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 2560, specHeight: 1330, specAspect: '16:8.3', maxBytes: 3 * MB,
    defaultHeading: 'Track your order.' },

  { pageKey: 'outlets', slotKey: 'outlet_card_1', label: 'Outlet card 1',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'outlets.cards', position: 0,
    specWidth: 1600, specHeight: 1000, specAspect: '16:10', maxBytes: 2 * MB },
  { pageKey: 'outlets', slotKey: 'outlet_card_2', label: 'Outlet card 2',
    mediaKind: 'IMAGE', acceptsVideo: false, groupKey: 'outlets.cards', position: 1,
    specWidth: 1600, specHeight: 1000, specAspect: '16:10', maxBytes: 2 * MB },

  { pageKey: 'not-found', slotKey: 'not_found_illustration',
    label: '404 illustration', mediaKind: 'IMAGE', acceptsVideo: true,
    specWidth: 1600, specHeight: 1200, specAspect: '4:3', maxBytes: 3 * MB,
    defaultHeading: 'Lost in the fabric.',
    defaultSubheading: "The page you're looking for has moved on." },

  { pageKey: 'search', slotKey: 'search_empty_illustration',
    label: 'Empty search illustration', mediaKind: 'IMAGE', acceptsVideo: false,
    specWidth: 1600, specHeight: 1200, specAspect: '4:3', maxBytes: 2 * MB,
    defaultHeading: 'No matches.',
    defaultSubheading: 'Try fewer keywords or browse the shop.' },
];

async function main(): Promise<void> {
  console.log(`Media slot seed — ${SLOTS.length} slots across pages.`);
  let created = 0;
  let updated = 0;

  for (const s of SLOTS) {
    const existing = await prisma.pageSlot.findFirst({
      where: { pageKey: s.pageKey, slotKey: s.slotKey },
    });
    if (existing) {
      await prisma.pageSlot.update({
        where: { id: existing.id },
        data: {
          label:        s.label,
          mediaKind:    s.mediaKind,
          acceptsVideo: s.acceptsVideo,
          specWidth:    s.specWidth,
          specHeight:   s.specHeight,
          specAspect:   s.specAspect,
          maxBytes:     s.maxBytes,
          position:     s.position ?? 0,
          groupKey:     s.groupKey ?? null,
        },
      });
      updated += 1;
    } else {
      await prisma.pageSlot.create({
        data: {
          pageKey:      s.pageKey,
          slotKey:      s.slotKey,
          label:        s.label,
          mediaKind:    s.mediaKind,
          acceptsVideo: s.acceptsVideo,
          specWidth:    s.specWidth,
          specHeight:   s.specHeight,
          specAspect:   s.specAspect,
          maxBytes:     s.maxBytes,
          position:     s.position ?? 0,
          groupKey:     s.groupKey ?? null,
          heading:      s.defaultHeading ?? null,
          subheading:   s.defaultSubheading ?? null,
          body:         s.defaultBody ?? null,
          ctaLabel:     s.defaultCtaLabel ?? null,
          ctaHref:      s.defaultCtaHref ?? null,
        },
      });
      created += 1;
    }
  }

  const pageCounts = await prisma.pageSlot.groupBy({
    by: ['pageKey'],
    _count: true,
    orderBy: { pageKey: 'asc' },
  });
  console.log(`  created=${created}  updated=${updated}`);
  console.log('  slots per page:');
  for (const p of pageCounts) console.log(`    ${p.pageKey.padEnd(25)} ${p._count}`);
}

main()
  .catch((err: unknown) => {
    const m = err instanceof Error ? err.message : String(err);
    console.error('Media seed failed:', m);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
